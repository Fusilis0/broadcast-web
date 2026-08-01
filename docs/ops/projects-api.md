# Phase 6.4 — Projects API (stub) ops

Run the **RaceProject** SQLite API next to the static SPA. Design: [`project-api-and-database.md`](../architecture/project-api-and-database.md). Server package: [`server/README.md`](../../server/README.md).

**Non-goals:** production auth roles (6.5), automated Hetzner deploy of the API, dropping static `public/races/`.

## Local

```bash
npm run server:install   # once
npm run server           # http://127.0.0.1:8787
npm run dev              # Vite; proxies /api → 8787
```

In `public/config.json` (local only — leave empty in git for static-only default):

```json
"projectsApiBase": "/api"
```

Without the API (or with empty `projectsApiBase`), `?race=` still loads `/races/<id>/project.json`.

## Reverse proxy (same-origin `/api`)

Prefer terminating TLS on the SPA host and proxying `/api/` to the Node process on localhost (same pattern as WSS Option B in [`wss-live-telemetry.md`](./wss-live-telemetry.md)).

### nginx

```nginx
# Inside the same server { } that serves the SPA over 443
location /api/ {
    proxy_pass http://127.0.0.1:8787/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 2m;
}
```

SPA `config.json`:

```json
"projectsApiBase": "/api"
```

### Caddy

```caddy
handle /api/* {
    reverse_proxy 127.0.0.1:8787
}
```

## Process on the VPS

1. Install Node **22+** (uses built-in `node:sqlite`).
2. Copy `server/` (+ seed from `public/races` or set `PROJECTS_SEED_DIR`).
3. `cd server && npm install && npm start` (or systemd unit).
4. Set `PROJECTS_API_TOKEN` so anonymous writes are rejected.
5. Keep serving `dist/` as today — API is additive.

Env reference: root [`.env.example`](../../.env.example) and [`server/README.md`](../../server/README.md).

## Smoke

```bash
curl -sS http://127.0.0.1:8787/api/races | head
curl -sS http://127.0.0.1:8787/api/races/demo-istanbul | head
# HTTPS SPA with proxy:
curl -sS https://YOUR_SPA_DOMAIN/api/races/demo-istanbul | head
```

Browser: `https://YOUR_SPA_DOMAIN/?race=demo-istanbul` with `projectsApiBase: "/api"`.
