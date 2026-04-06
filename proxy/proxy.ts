import http, { type IncomingMessage, type ServerResponse } from 'http';
import https from 'https';
import net from 'net';
import { URL } from 'url';
import * as cache from './cache.js';

const PORT = process.env.PROXY_PORT
	? parseInt(process.env.PROXY_PORT, 10)
	: 8080;
const HOST = process.env.PROXY_HOST ?? '::'; // IPv6 dual-stack

const IDENTITY_HEADERS = {
	'X-Proxy': 'BI-VDC',
	'X-Proxy-Host': process.env.HOSTNAME,
	'X-Proxy-IP': process.env.POD_IP,
};
// ─── HTTP Request Handler (plain HTTP proxying with Redis cache) ──────────────
async function handleRequest(
	clientReq: IncomingMessage,
	clientRes: ServerResponse,
): Promise<void> {
	const targetUrl = clientReq.url ?? '';

	// Only handle absolute URLs (proxy requests)
	if (!targetUrl.startsWith('http')) {
		clientRes.writeHead(400, {
			'Content-Type': 'text/plain',
			...IDENTITY_HEADERS,
		});
		clientRes.end('Bad Request: proxy requires absolute URL');
		return;
	}

	let parsed: URL;
	try {
		parsed = new URL(targetUrl);
	} catch {
		clientRes.writeHead(400, {
			'Content-Type': 'text/plain',
			...IDENTITY_HEADERS,
		});
		clientRes.end('Bad Request: invalid URL');
		return;
	}

	const method = (clientReq.method ?? 'GET').toUpperCase();
	const cacheKey = `cache:${method}:${targetUrl}`;

	// ── Cache lookup (GET only) ──────────────────────────────────────────────────
	if (method === 'GET') {
		try {
			const cached = await cache.get(cacheKey);
			if (cached) {
				console.log(`[CACHE HIT]  ${targetUrl}`);
				clientRes.writeHead(cached.status, {
					...cached.headers,
					'X-Proxy-Cache': 'HIT',
					...IDENTITY_HEADERS,
				});
				clientRes.end(Buffer.from(cached.body, 'base64'));
				return;
			}
		} catch (err) {
			console.warn('[CACHE] Redis read error:', (err as Error).message);
		}
	}

	// ── Forward request ──────────────────────────────────────────────────────────
	console.log(`[PROXY]      ${method} ${targetUrl}`);

	const options: http.RequestOptions = {
		hostname: parsed.hostname,
		port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
		path: parsed.pathname + parsed.search,
		method,
		headers: { ...clientReq.headers, host: parsed.host },
	};

	const transport = parsed.protocol === 'https:' ? https : http;

	const proxyReq = transport.request(options, async (proxyRes) => {
		const chunks: Buffer[] = [];

		proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
		proxyRes.on('end', async () => {
			const body = Buffer.concat(chunks);

			// Send response to client
			clientRes.writeHead(proxyRes.statusCode ?? 502, {
				...proxyRes.headers,
				'X-Proxy-Cache': 'MISS',
				...IDENTITY_HEADERS,
			});
			clientRes.end(body);

			// ── Cache store (GET + 2xx only) ───────────────────────────────────────
			const status = proxyRes.statusCode ?? 0;
			if (method === 'GET' && status >= 200 && status < 300) {
				const ttl = cache.parseTTL(proxyRes.headers);
				if (ttl > 0) {
					try {
						await cache.set(
							cacheKey,
							{
								status,
								headers: proxyRes.headers,
								body: body.toString('base64'),
							},
							ttl,
						);
						console.log(`[CACHE SET]  ${targetUrl} (TTL: ${ttl}s)`);
					} catch (err) {
						console.warn('[CACHE] Redis write error:', (err as Error).message);
					}
				}
			}
		});
	});

	proxyReq.on('error', (err: Error) => {
		console.error('[PROXY ERROR]', err.message);
		if (!clientRes.headersSent) {
			clientRes.writeHead(502, {
				'Content-Type': 'text/plain',
				...IDENTITY_HEADERS,
			});
			clientRes.end(`Bad Gateway: ${err.message}`);
		}
	});

	clientReq.pipe(proxyReq);
}

// ─── HTTPS CONNECT Handler (SSL tunneling) ────────────────────────────────────
function handleConnect(
	req: IncomingMessage,
	clientSocket: net.Socket,
	head: Buffer,
): void {
	const [hostname, portStr] = (req.url ?? '').split(':');
	const port = parseInt(portStr ?? '443', 10) || 443;

	console.log(`[TUNNEL]     CONNECT ${hostname}:${port}`);

	const serverSocket = net.connect(port, hostname, () => {
		clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
		serverSocket.write(head);
		serverSocket.pipe(clientSocket);
		clientSocket.pipe(serverSocket);
	});

	serverSocket.on('error', (err: Error) => {
		console.error('[TUNNEL ERROR]', err.message);
		clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
		clientSocket.destroy();
	});

	clientSocket.on('error', () => serverSocket.destroy());
}

// ─── Server setup ─────────────────────────────────────────────────────────────
const server = http.createServer(handleRequest);
server.on('connect', handleConnect);

server.listen(PORT, HOST, () => {
	const addr = server.address() as net.AddressInfo;
	const display =
		addr.family === 'IPv6'
			? `[${addr.address}]:${addr.port}`
			: `${addr.address}:${addr.port}`;
	console.log(`Proxy server listening on ${display}`);
	console.log('Supports: HTTP proxying, HTTPS CONNECT tunneling, IPv4 + IPv6');
});

server.on('error', (err: Error) => {
	console.error('Server error:', err.message);
	process.exit(1);
});

export default server;
