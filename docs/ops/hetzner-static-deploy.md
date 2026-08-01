# Phase 5.1 — Hetzner static SPA deploy

Deploy `broadcast-web` as a **static SPA** on Hetzner (or any static host): build → upload `dist/` → TLS → smoke. No application server, no DB, no NDI.

**Non-goals:** implementing WSS on the VPS from this runbook (see Phase **5.2** [`wss-live-telemetry.md`](./wss-live-telemetry.md)), project API (6.4), NDI, SSHing from CI with committed secrets.

## Prerequisites

- Node.js LTS + npm (build machine)
- A Hetzner Cloud VM (or any host) with:
  - Public IPv4/IPv6
  - nginx **or** Caddy
  - TLS certificate (Let’s Encrypt via Caddy auto-HTTPS, or certbot + nginx)
- SSH access to upload files (human or CI with secret-stored keys — **never** commit keys)

## What gets served

Vite copies everything under `public/` into `dist/` at build time:

| Path in `dist/` | Role |
| --- | --- |
| `index.html` + `assets/` | SPA shell + JS/CSS |
| `config.json` | Default runtime config |
| `EGM96_1deg.bin` | Geoid grid (fetched as `/EGM96_1deg.bin`) |
| `races/` | Race packs (`index.json`, `<id>/project.json`) |
| `fixtures/` | Course, sponsors, flags, boats, telemetry JSON |
| `models/` | e.g. `boat.glb` |

Root-relative URLs (`/races/…`, `/fixtures/…`, `/EGM96_1deg.bin`) require the site to be served at the **domain root** (`base: '/'` in Vite). Subpath hosting (e.g. `https://host/app/`) is out of scope for this runbook.

## Build

```bash
npm install
npm run build
```

Output: `dist/`. Local check:

```bash
npm run preview
```

Open the printed URL (usually `http://localhost:4173`). Confirm canvas loads and `/?race=demo-istanbul` resolves the pack.

Optional production WS bake-in (HTTPS hosts need **wss://** — see [`wss-live-telemetry.md`](./wss-live-telemetry.md)):

```bash
# On the build machine only — do not commit real values
export VITE_WS_URL='wss://YOUR_SPA_DOMAIN/ws/drone'
export VITE_WS_BOAT_URL='wss://YOUR_SPA_DOMAIN/ws/boat'
npm run build
```

Prefer leaving these empty and setting `public/config.json` on the host (or env at build) when going live. Replay/mock modes do not need WebSockets.

## Upload `dist/`

Sync the **contents** of `dist/` to the web root (e.g. `/var/www/broadcast-web/`):

```bash
# Example — see also scripts/deploy-static.example.sh
rsync -avz --delete ./dist/ USER@HOST:/var/www/broadcast-web/
```

Placeholders only: set `USER`, `HOST`, and remote dir yourself. Do not commit hostnames that embed secrets or private keys.

After upload, ensure the process serving files can read the tree (typical: `www-data` / `caddy` ownership or world-readable files).

## SPA fallback (required)

Deep links and future routes (e.g. `/overlay`) must fall back to `index.html`. Without this, refreshing a non-file path returns 404.

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name YOUR_DOMAIN;

    # ssl_certificate / ssl_certificate_key — certbot or your TLS paths

    root /var/www/broadcast-web;
    index index.html;

    # Binary geoid — optional explicit type
    location = /EGM96_1deg.bin {
        default_type application/octet-stream;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

HTTP → HTTPS redirect is recommended (certbot `redirect` or a separate `listen 80` server).

### Caddy

```caddy
YOUR_DOMAIN {
    root * /var/www/broadcast-web
    encode gzip
    try_files {path} /index.html
    file_server
}
```

Caddy obtains and renews TLS automatically for a public DNS name.

## TLS

- Serve the app over **HTTPS** for studio far-PCs and any non-localhost use.
- Mixed content: an HTTPS page **cannot** open `ws://` live telemetry — needs **wss://** or a same-origin proxy (Phase 5.2).

## Live telemetry / WSS (Phase 5.2)

| Mode | On HTTPS static host |
| --- | --- |
| `mock` / `replay` | Works — no WebSocket |
| `live` | Needs **`wss://`** — plain `ws://` is blocked (mixed content) |

Full runbook (native WSS on telemetry host, or SPA-host reverse proxy to upstream `ws://`, nginx/Caddy snippets, `config.json` examples): **[`wss-live-telemetry.md`](./wss-live-telemetry.md)**.

## Smoke checklist

Run after first deploy and after each upload:

| # | Check | Pass |
| --- | --- | --- |
| 1 | `https://YOUR_DOMAIN/` loads dark WebGL canvas (no blank/404) | ☐ |
| 2 | DevTools Network: `EGM96_1deg.bin` → 200 | ☐ |
| 3 | `https://YOUR_DOMAIN/?race=demo-istanbul` loads Demo Istanbul pack (fleet/course fixtures) | ☐ |
| 4 | `/races/index.json` and `/races/demo-istanbul/project.json` → 200 JSON | ☐ |
| 5 | Chroma: OUT control or `?outputMode=chroma` → clear green `#00ff00` behind AR | ☐ |
| 6 | Hard refresh / open a non-file path that should SPA-fallback → still `index.html` (not nginx 404) | ☐ |
| 7 | (Optional) Live mode: follow [`wss-live-telemetry.md`](./wss-live-telemetry.md) — `wss://` connects; plain `ws://` from HTTPS must fail | ☐ |

Studio on-air: [`air-runbook.md`](./air-runbook.md) (preferred Electron alpha NDI; Chrome chroma fallback). Historical 3.5 record: [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md). Hosted URL can replace `npm run dev` once smoke 1–5 pass.

## Optional CI sketch (placeholders)

```yaml
# Illustrative — wire secrets in the CI product, never in git
# build:
#   - npm ci && npm run build
# deploy:
#   - rsync -avz --delete dist/ ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}/
```

Use repository secrets for `DEPLOY_USER` / `DEPLOY_HOST` / SSH key. This repo does not ship a live workflow for Hetzner.

## Related

- Human upload + WSS checklist — [`human-hetzner-wss-checklist.md`](./human-hetzner-wss-checklist.md)
- Live WSS / proxy (5.2) — [`wss-live-telemetry.md`](./wss-live-telemetry.md)
- Project API + DB design (6.4) — [`../architecture/project-api-and-database.md`](../architecture/project-api-and-database.md) (additive `/api`; static `races/` unchanged)
- Roadmap Phase 5.1–5.2 — [`docs/roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md)
- Env keys — [`.env.example`](../../.env.example)
- Example upload script — [`scripts/deploy-static.example.sh`](../../scripts/deploy-static.example.sh)
- Air runbook (preferred NDI + chroma fallback) — [`air-runbook.md`](./air-runbook.md)
- vMix / OBS chroma experiment (3.5) — [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md)
