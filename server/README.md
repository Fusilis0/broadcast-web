# Projects API stub (Phase 6.4)

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

## Env

| Variable | Default | Meaning |
| --- | --- | --- |
| `PROJECTS_API_HOST` | `127.0.0.1` | Bind address |
| `PROJECTS_API_PORT` | `8787` | Bind port |
| `PROJECTS_DB_PATH` | `server/data/races.sqlite` | SQLite file |
| `PROJECTS_SEED_DIR` | `public/races` | Packs to seed on boot |
| `PROJECTS_SEED_ON_BOOT` | on (`0` to disable) | Auto-seed |
| `PROJECTS_API_TOKEN` | unset | If set, writes require `Authorization: Bearer …` |
| `PROJECTS_API_CORS` | unset | e.g. `http://127.0.0.1:5173` or `*` |

Do not commit tokens. See root [`.env.example`](../.env.example).

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
