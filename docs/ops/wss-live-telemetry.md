# Phase 5.2 — Live telemetry over WSS (HTTPS SPA)

Enable **live** telemetry when `broadcast-web` is served over **HTTPS**. Browsers block mixed content: an `https://` page cannot open `ws://`. Use **`wss://`** (TLS WebSocket) either on the telemetry host itself or via a reverse proxy on the SPA host.

**Non-goals:** logging into a customer VPS from this repo, changing TEL subscribe protocol / multi-URL maps, NDI, RaceProject DB, CI soak against a real race server.

Related: static SPA deploy — [`hetzner-static-deploy.md`](./hetzner-static-deploy.md). Client URL resolution — [`src/telemetry/README.md`](../../src/telemetry/README.md).

## Why mixed content fails

| Page | Live URL | Result |
| --- | --- | --- |
| `https://spa.example/` | `ws://race-vps:PORT/…` | **Blocked** (mixed content) |
| `https://spa.example/` | `wss://…` | Allowed (TLS) |
| `http://localhost:5173/` | `ws://…` or `wss://…` | Both OK for local dev |

The SPA client (`LiveTelemetrySource`) passes URL strings through to the browser `WebSocket` constructor. Empty `wsUrl` / `wsBoatUrl` stay idle (no fake open). Scheme choice is an ops/config concern, not a client protocol change.

## Option A — Native `wss://` on the telemetry host

Terminate TLS on the race VPS (or a dedicated WS gateway) and point the SPA at absolute WSS URLs.

1. Obtain a certificate for the telemetry hostname (Let’s Encrypt, existing org cert, etc.).
2. Configure the WS server (or a local nginx/Caddy in front of plain `ws://` on localhost) for TLS + WebSocket upgrade.
3. Set SPA config to those URLs (see [Config examples](#config-examples)).
4. Confirm CORS / Origin policies on the WS server allow the SPA origin if the server checks `Origin`.

Placeholders only:

```text
wss://TELEMETRY_HOST/stream?client=web&id=drone1
wss://TELEMETRY_HOST/stream?client=web&id=boat21
```

Path and query shape must match whatever the race VPS already expects (Unity / existing clients). This runbook does not redefine subscribe protocol.

## Option B — Same-origin reverse proxy on the SPA host

Keep plain `ws://` on the private/upstream race VPS. Terminate TLS on the **static SPA** host (already required for HTTPS) and proxy WebSocket paths to upstream.

Browser sees same-origin WSS:

```text
wss://YOUR_SPA_DOMAIN/ws/drone
wss://YOUR_SPA_DOMAIN/ws/boat
```

Upstream (placeholder):

```text
ws://UPSTREAM_TEL_HOST:UPSTREAM_PORT/stream?client=web&id=drone1
ws://UPSTREAM_TEL_HOST:UPSTREAM_PORT/stream?client=web&id=boat21
```

Choose path names that fit your nginx/Caddy layout (`/ws/drone`, `/stream`, etc.). Query strings can be rewritten or passed through.

### nginx (SPA host)

Add WebSocket locations **before** the SPA `try_files` catch-all. Placeholders: `YOUR_DOMAIN`, `UPSTREAM_TEL_HOST`, ports, and upstream path.

```nginx
# Inside the same server { } that serves the SPA over 443
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

location /ws/drone {
    proxy_pass http://UPSTREAM_TEL_HOST:UPSTREAM_PORT/stream?client=web&id=drone1;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location /ws/boat {
    proxy_pass http://UPSTREAM_TEL_HOST:UPSTREAM_PORT/stream?client=web&id=boat21;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

# Existing SPA root + try_files → index.html (see hetzner-static-deploy.md)
```

If the upstream already includes the full path in a single URL, set `proxy_pass` to that `http://…` URL (still with Upgrade headers). Prefer keeping upstream on a private network or firewall-restricted port.

### Caddy (SPA host)

```caddy
YOUR_SPA_DOMAIN {
    handle /ws/drone {
        reverse_proxy UPSTREAM_TEL_HOST:UPSTREAM_PORT {
            # Adjust if upstream path differs; Caddy upgrades WebSocket by default
        }
    }
    handle /ws/boat {
        reverse_proxy UPSTREAM_TEL_HOST:UPSTREAM_PORT
    }

    root * /var/www/broadcast-web
    encode gzip
    try_files {path} /index.html
    file_server
}
```

For path rewriting (browser `/ws/drone` → upstream `/stream?client=web&id=drone1`), use Caddy `rewrite` / `uri` directives or an upstream that accepts the proxied path. Match whatever the race server expects.

## Config examples

Resolution order (TEL): explicit ingest options → non-empty `VITE_WS_*` → `public/config.json` `wsUrl` / `wsBoatUrl`. Do **not** commit production hosts or `"telemetryMode": "live"` as repo defaults.

### Absolute WSS (Option A)

```json
{
  "telemetryMode": "live",
  "wsUrl": "wss://TELEMETRY_HOST/stream?client=web&id=drone1",
  "wsBoatUrl": "wss://TELEMETRY_HOST/stream?client=web&id=boat21"
}
```

### Same-origin WSS (Option B)

On the deployed host only (or bake via env at build — still placeholders):

```json
{
  "telemetryMode": "live",
  "wsUrl": "wss://YOUR_SPA_DOMAIN/ws/drone",
  "wsBoatUrl": "wss://YOUR_SPA_DOMAIN/ws/boat"
}
```

Relative WebSocket URLs are **not** used by this client today — prefer absolute `wss://` including host.

### Vite env (build-time bake-in)

```bash
# Build machine only — never commit real values
export VITE_WS_URL='wss://YOUR_SPA_DOMAIN/ws/drone'
export VITE_WS_BOAT_URL='wss://YOUR_SPA_DOMAIN/ws/boat'
npm run build
```

See [`.env.example`](../../.env.example).

### Deeplink

Console deeplink can set `mode=live` (see [`docs/contracts/console-deeplink.md`](../contracts/console-deeplink.md)). **WS URLs are not deeplink query params** — they come from `config.json` / `VITE_WS_*` / explicit ingest options.

```text
https://YOUR_SPA_DOMAIN/?race=demo-istanbul&mode=live
https://YOUR_SPA_DOMAIN/?mode=live&outputMode=chroma
```

With empty `wsUrl`, live mode idles (warn, no crash). Set URLs on the host before relying on `mode=live`.

## Smoke (human / ops)

After proxy or native WSS is configured:

| # | Check | Pass |
| --- | --- | --- |
| 1 | SPA loads over `https://YOUR_SPA_DOMAIN/` | ☐ |
| 2 | `config.json` (or env) has non-empty `wss://` `wsUrl` | ☐ |
| 3 | HUD or config → **live**; DevTools → WebSocket → status **101** / open | ☐ |
| 4 | TEL counters advance (drone / boat as configured) | ☐ |
| 5 | From the HTTPS page, a deliberate `ws://` URL must **fail** (mixed content) | ☐ |
| 6 | HUD back to **mock** → sockets close; no reconnect spam | ☐ |

No live VPS soak is required in CI. Unit tests use a fake `WebSocket` and assert `wss://` strings are passed through unchanged.

## Related

- Phase 5.1 static host — [`hetzner-static-deploy.md`](./hetzner-static-deploy.md)
- TEL live client — [`src/telemetry/README.md`](../../src/telemetry/README.md)
- Roadmap 5.2 — [`docs/roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md)
