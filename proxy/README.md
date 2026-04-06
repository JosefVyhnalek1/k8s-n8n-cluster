# Node.js Forward Proxy with Redis Cluster Cache

A Windows-compatible HTTP/HTTPS forward proxy with IPv6 support and Redis Cluster response caching, written in TypeScript.

## Features

- **HTTP proxying** — forwards plain HTTP requests, caches GET responses in Redis Cluster
- **HTTPS CONNECT tunneling** — handles `CONNECT` method for SSL (works with Windows proxy settings, curl, browsers, etc.)
- **IPv6 dual-stack** — listens on `::` so both `127.0.0.1` and `[::1]` work
- **Redis Cluster caching** — respects `Cache-Control` and `Expires` headers; configurable TTL
- **TypeScript** — fully typed, strict mode enabled

## Requirements

- Node.js >= 18
- Redis Cluster (one or more nodes; a single-node Redis also works)

## Installation

```bash
npm install
```

## Build & Run

```bash
# Compile TypeScript
npm run build

# Start compiled output
npm start

# Dev mode (no compile step — Node 18+ strip-types)
npm run dev
```

## Environment Variables

| Variable                | Default               | Description                                              |
|-------------------------|-----------------------|----------------------------------------------------------|
| `PROXY_PORT`            | `8080`                | Port the proxy listens on                                |
| `PROXY_HOST`            | `::`                  | Bind address (:: = IPv4 + IPv6)                          |
| `REDIS_CLUSTER_NODES`   | `127.0.0.1:6379`      | Comma-separated list of cluster seed nodes (`host:port`) |
| `CACHE_DEFAULT_TTL`     | `60`                  | Fallback TTL in seconds                                  |
| `CACHE_MAX_TTL`         | `3600`                | Maximum TTL cap in seconds                               |

### Multi-node cluster example

```bash
REDIS_CLUSTER_NODES=10.0.0.1:6379,10.0.0.2:6379,10.0.0.3:6379 npm start
```

## Configuring Windows to Use the Proxy

### System-wide (Settings)
1. **Settings → Network & Internet → Proxy**
2. Toggle **"Use a proxy server"** on
3. Address: `127.0.0.1`, Port: `8080`
4. Save

### Per-application (environment variables)
```cmd
set HTTP_PROXY=http://127.0.0.1:8080
set HTTPS_PROXY=http://127.0.0.1:8080
```

### curl
```bash
curl -x http://127.0.0.1:8080 https://example.com
# IPv6:
curl -x http://[::1]:8080 https://example.com
```

## Caching Behaviour

| Condition                                              | Action                              |
|--------------------------------------------------------|-------------------------------------|
| Method is not GET                                      | Never cached                        |
| `Cache-Control: no-store` or `no-cache`                | Not cached                          |
| `Cache-Control: max-age=N`                             | Cached for `min(N, MAX_TTL)` seconds |
| `Expires` header present                               | Cached until expiry (clamped)       |
| No caching headers                                     | Cached for `DEFAULT_TTL` seconds    |

Cache hits add an `X-Proxy-Cache: HIT` response header.

## Architecture

```
Client (browser / Windows)
        │
        ├─ HTTP  ──► handleRequest() ──► Redis Cluster lookup ──► upstream HTTP/S ──► Redis Cluster store
        │
        └─ HTTPS ──► handleConnect() ──► TCP CONNECT tunnel to upstream:443
```

## Notes

- HTTPS traffic is **tunneled**, not decrypted — the proxy cannot cache HTTPS responses (correct for a standard forward proxy).
- To cache HTTPS you would need SSL interception (MITM proxy with a custom CA certificate).
- ioredis Cluster reconnects automatically on node failure and re-routes reads to replicas (`scaleReads: 'slave'`).
