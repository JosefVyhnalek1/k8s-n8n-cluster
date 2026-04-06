import type { IncomingHttpHeaders } from 'http';
import { Cluster, Redis, type ClusterNode, type ClusterOptions } from 'ioredis';

const REDIS_CLUSTER_NODES: ClusterNode[] = (
	process.env.REDIS_CLUSTER_NODES ?? '127.0.0.1:6379'
)
	.split(',')
	.map((node) => {
		const [host, portStr] = node.trim().split(':');
		return { host, port: parseInt(portStr ?? '6379', 10) };
	});

const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL ?? '60', 10); // seconds
const MAX_TTL = parseInt(process.env.CACHE_MAX_TTL ?? '3600', 10);

const clusterOptions: ClusterOptions = {
	redisOptions: {
		connectTimeout: 5000,
		password: process.env.REDIS_PASSWORD ?? '',
	},
	enableReadyCheck: true,
	scaleReads: 'slave',
	enableAutoPipelining: true,
};

const client: Cluster | Redis =
	process.env.NODE_ENV === 'production'
		? new Cluster(REDIS_CLUSTER_NODES, clusterOptions)
		: new Redis({
				host: '127.0.0.1',
				port: 6379,
			});

client.on('error', (err: Error) => console.error('[REDIS]', err.message));
client.on('connect', () => console.log(`[REDIS] Connected to redis`));
client.on('ready', () => console.log('[REDIS] Redis ready'));

// ─── Cached response shape ────────────────────────────────────────────────────

export interface CachedResponse {
	status: number;
	headers: IncomingHttpHeaders;
	body: string; // base64-encoded
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve a cached response object, or null if absent / error.
 */
export async function get(key: string): Promise<CachedResponse | null> {
	const raw = await client.get(key);
	return raw ? (JSON.parse(raw) as CachedResponse) : null;
}

/**
 * Store a response object with a TTL (seconds).
 */
export async function set(
	key: string,
	value: CachedResponse,
	ttl: number,
): Promise<void> {
	await client.set(key, JSON.stringify(value), 'EX', ttl);
}

/**
 * Derive a sensible TTL (in seconds) from response headers.
 *
 * Rules (in priority order):
 *  1. Cache-Control: no-store / no-cache  → 0  (do not cache)
 *  2. Cache-Control: max-age=N            → min(N, MAX_TTL)
 *  3. Expires header                      → seconds until expiry (clamped)
 *  4. Fallback                            → DEFAULT_TTL
 *
 * Returns 0 to mean "do not cache".
 */
export function parseTTL(headers: IncomingHttpHeaders): number {
	const cc = ((headers['cache-control'] as string) || '').toLowerCase();

	if (cc.includes('no-store') || cc.includes('no-cache')) return 0;

	const maxAgeMatch = cc.match(/max-age\s*=\s*(\d+)/);
	if (maxAgeMatch) {
		return Math.min(parseInt(maxAgeMatch[1]!, 10), MAX_TTL);
	}

	const expires = headers['expires'] as string | undefined;
	if (expires) {
		const delta = Math.floor((new Date(expires).getTime() - Date.now()) / 1000);
		if (delta > 0) return Math.min(delta, MAX_TTL);
	}

	return DEFAULT_TTL;
}
