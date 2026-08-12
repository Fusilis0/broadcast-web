# Projects API (stub) ops — LAN

Run the **RaceProject** SQLite API next to the static SPA. Design: [`project-api-and-database.md`](../architecture/project-api-and-database.md). Server package: [`server/README.md`](../../server/README.md).

**Non-goals:** OAuth / multi-tenant IdP, console deep-link tokens (Phase 10 / CON), offline pack cache (separate DSP), automated Hetzner deploy of the API, dropping static `public/races/`.

## Local

```bash
npm run server:install   # once
npm run server           # http://127.0.0.1:8787
npm run dev              # Vite; proxies /api → 8787
```

In `public/config.json` (local only — leave empty / defaults in git for static-only):

```json
"projectsApiBase": "/api",
"projectsRole": "editor",
"projectsApiToken": "dev-editor-token"
```

Without the API (or with empty `projectsApiBase`), `?race=` still loads `/races/<id>/project.json`.

## Electron local folder vs HTTP API

| Path | When | Where |
| --- | --- | --- |
| **Electron `races:*` IPC** | Studio shell (`desktop:dev` / `--file`) | **Primary Save** → Dev: repo `public/races/`; `--file`: `userData/races/`. Load dropdown lists that folder. No `projectsApiBase` required. |
| **Static / download** | Chrome (always); Electron **Export…** | Download `project.json`; manually drop under `public/races/` |
| **HTTP API** (`projectsApiBase`) | LAN / VPS SQLite stub | `POST`/`PUT` `/api/races` — additive; does not replace local Electron write |

In Electron, Save writes the races folder first (shows path/status in the Project section). **Export…**
downloads JSON without a folder write. When API is also configured, Save does **folder + API**
(Chrome remains **download + optional API**). Shell folder details: [`desktop/README.md`](../../desktop/README.md).

## LAN roles (Phase 9.1)

| Role | Who | Reads (`GET`) | Writes (`POST`/`PUT`/`DELETE`) | SPA Save / Save as |
| --- | --- | --- | --- | --- |
| **editor** | Studio authoring PC | Open | Bearer = editor token | Enabled; sends bearer |
| **air** | Air / overlay PC | Open (`?race=` OK) | Rejected | Disabled (UI + client guard) |

Library uploads (`POST /api/assets`) use the same editor/air write gate. Without
`projectsApiBase`, the Library sidebar is **browse-only** against
`/assets/library/index.json`.

## Project manager (Phase 11.4)

Sidebar **Project** section lists API projects with rename / duplicate / archive.
Rename and Duplicate collect new id/name via the shared DOM `promptModal` (not `window.prompt`,
which Electron overrides to throw).

| Action | Behaviour |
| --- | --- |
| **List** | `GET /api/races` — **excludes** `labels` containing `archived` by default |
| **Show archived** | UI toggle → `GET /api/races?includeArchived=1` (or `?label=archived`) |
| **Duplicate** | Load source → `POST /api/races` under a new id (original untouched) |
| **Rename** | Client-orchestrated: **create new id first**, then `DELETE` old — never deletes until create succeeds (ids remain immutable in the schema) |
| **Archive** | Add label `archived` via PUT wrapper `{ project, labels }` — still loadable by id / `?race=` |
| **Static-only** | No `projectsApiBase` → manager rename/dup/archive disabled; Electron still Saves to the races folder via the Load/Save row; Chrome Save = download |

Boat-id check on Save / Save as: warn when fleet ids are missing from the boat-name catalogue (`orphanBoatIds` vs catalogue keys). Warning is **non-blocking** (ops may Save anyway).

### List / archive query

| Query | Result |
| --- | --- |
| (none) | Active projects only (no `archived` label) |
| `?includeArchived=1` | All projects |
| `?label=archived` | Only archived |
| `?label=demo` | Only that label (archived still excluded unless the label *is* `archived`) |

### PUT labels (archive)

Same wrapper shape as create:

```json
{ "project": { "...RaceProject...", "revision": 2 }, "labels": ["archived"] }
```

Omit `labels` on PUT to leave existing labels unchanged. Revision / `If-Match` semantics unchanged.

### Server env

| Variable | Meaning |
| --- | --- |
| `PROJECTS_API_EDITOR_TOKEN` | Preferred editor bearer. When set, mutating methods require `Authorization: Bearer <token>`. |
| `PROJECTS_API_TOKEN` | Legacy alias for the editor token (same behaviour). |
| `PROJECTS_API_AIR_TOKEN` | Optional. Presenting this bearer on a write → **403** `{ "error": "forbidden", "role": "air" }`. Missing/wrong token → **401**. Reads never require a token. |
| `PROJECTS_ASSETS_LIBRARY_DIR` | Optional override for `public/assets/library` absolute path. |
| `PROJECTS_MAX_ASSET_BYTES` | Optional library upload size cap (default 20 MiB). |

Unset editor + air tokens → open writes (local dev only). For LAN studio, set at least `PROJECTS_API_EDITOR_TOKEN`.

### SPA config / query

| Field / query | Meaning |
| --- | --- |
| `projectsRole`: `"editor"` \| `"air"` | Default `"editor"`. Air = read/load only. |
| `projectsApiToken` | Editor bearer string (local config only — do not commit secrets). |
| `?projectsRole=air` or `?role=air` | Overrides config role for that boot. |

Air PC example:

```json
"projectsApiBase": "/api",
"projectsRole": "air"
```

```text
http://127.0.0.1:5173/?race=demo-istanbul&role=air
```

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
    # RaceProject JSON ~2m; library uploads up to 20m (PROJECTS_MAX_ASSET_BYTES)
    client_max_body_size 20m;
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

## Process on the VPS / studio LAN host

1. Install Node **22+** (uses built-in `node:sqlite`).
2. Copy `server/` (+ seed from `public/races` or set `PROJECTS_SEED_DIR`).
3. `cd server && npm install && npm start` (or systemd unit).
4. Set `PROJECTS_API_EDITOR_TOKEN` so anonymous writes are rejected.
5. Editor PCs: `projectsRole: "editor"` + matching `projectsApiToken`. Air PCs: `projectsRole: "air"` (no write token).
6. Keep serving `dist/` as today — API is additive.

Env reference: root [`.env.example`](../../.env.example) and [`server/README.md`](../../server/README.md).

## Smoke

```bash
curl -sS http://127.0.0.1:8787/api/races | head
curl -sS http://127.0.0.1:8787/api/races/demo-istanbul | head

# Write without token (when EDITOR_TOKEN set) → 401
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8787/api/races \
  -H "Content-Type: application/json" -d '{"schemaVersion":1,"id":"x","name":"x","origin":{"lat":0,"lon":0,"altMsl":0},"fleet":{"boatIds":["21"]}}'

# Write with editor bearer → 201
curl -sS -X POST http://127.0.0.1:8787/api/races \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_EDITOR_TOKEN" \
  -d @public/races/demo-istanbul/project.json | head

# HTTPS SPA with proxy:
curl -sS https://YOUR_SPA_DOMAIN/api/races/demo-istanbul | head

# Asset library list (no auth)
curl -sS http://127.0.0.1:8787/api/assets | head

# Asset upload (multipart; editor bearer when auth locked)
curl -sS -X POST http://127.0.0.1:8787/api/assets \
  -H "Authorization: Bearer YOUR_EDITOR_TOKEN" \
  -F "file=@public/textures/sponsors/rolex.png" \
  -F "label=Rolex"
```

Browser: `https://YOUR_SPA_DOMAIN/?race=demo-istanbul` with `projectsApiBase: "/api"`.
