# Projects API stub (Phase 6.4 + 9.1 LAN roles)

Minimal **Node + SQLite** REST API for RaceProject documents. Design: [`docs/architecture/project-api-and-database.md`](../docs/architecture/project-api-and-database.md). Ops proxy: [`docs/ops/projects-api.md`](../docs/ops/projects-api.md).

## Quick start

From repo root:

```bash
npm run server:install   # once
npm run server           # listen 127.0.0.1:8787, seed public/races/
```

Or from this directory:

```bash
npm install
npm start
```

Seed only (idempotent — never overwrites existing rows):

```bash
npm run seed
# or from root: npm run server:seed
```

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/races` | List projections; optional `?label=` |
| `GET` | `/api/races/:id` | Full RaceProject |
| `POST` | `/api/races` | Create (`revision` = 1) |
| `PUT` | `/api/races/:id` | Replace; `If-Match: "<rev>"` or body `revision` |
| `DELETE` | `/api/races/:id` | `204` / `404` |
| `GET` | `/api/assets` | Universal library manifest (no auth) |
| `POST` | `/api/assets` | Multipart upload (`file` + optional `label`); editor bearer |

### Asset library (`/api/assets`)

Writes go to `public/assets/library/<kind>/<slug>-<shortHash>.<ext>` and append
`index.json` (git-tracked studio path; not `userData` / `server/data/`). After
upload, **commit** the manifest and new file(s) so other PCs get them on pull.
Extensions: `png|jpg|jpeg|webp|glb|gltf`. Default size cap **20 MiB**
(`PROJECTS_MAX_ASSET_BYTES`). Multipart parsing is in-process (no extra npm dep).
Delete/replace is out of scope (append-only). Static-only SPA deployments browse
`/assets/library/index.json` without this endpoint.

## Env

| Variable | Default | Meaning |
| --- | --- | --- |
| `PROJECTS_API_HOST` | `127.0.0.1` | Bind address |
| `PROJECTS_API_PORT` | `8787` | Bind port |
| `PROJECTS_DB_PATH` | `server/data/races.sqlite` | SQLite file |
| `PROJECTS_SEED_DIR` | `public/races` | Packs to seed on boot |
| `PROJECTS_SEED_ON_BOOT` | on (`0` to disable) | Auto-seed |
| `PROJECTS_ASSETS_LIBRARY_DIR` | `public/assets/library` | Library storage root |
| `PROJECTS_MAX_ASSET_BYTES` | `20971520` (20 MiB) | Upload file size cap |
| `PROJECTS_API_EDITOR_TOKEN` | unset | Preferred editor bearer for POST/PUT/DELETE |
| `PROJECTS_API_TOKEN` | unset | Legacy alias for editor bearer |
| `PROJECTS_API_AIR_TOKEN` | unset | Optional; write with this → **403**; reads stay open |
| `PROJECTS_API_CORS` | unset | e.g. `http://127.0.0.1:5173` or `*` |

**Roles:** `editor` (write with editor bearer) vs `air` (read-only; air bearer on write → 403). Unset tokens → open writes (dev). Do not commit tokens. See root [`.env.example`](../.env.example) and [`docs/ops/projects-api.md`](../docs/ops/projects-api.md).

## Local SPA

1. Start this server (`npm run server`).
2. Vite proxies `/api` → `8787` (see root `vite.config.ts`).
3. Set in `public/config.json`: `"projectsApiBase": "/api"`.
4. Open `http://127.0.0.1:5173/?race=demo-istanbul` — loads via API; if API is down, SPA falls back to `/races/<id>/project.json`.

## Tests

```bash
npm test
```

Uses Node built-in `node:sqlite` (Node 22+). No native addon build.
