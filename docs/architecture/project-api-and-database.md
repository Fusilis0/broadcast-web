# Phase 6.4 — Project API + database (design)

**Status:** Design + **stub shipped** (2026-08-01) — human VPS deploy pending  
**Ops:** [`docs/ops/projects-api.md`](../ops/projects-api.md) · [`server/README.md`](../../server/README.md)  
**Owners:** PLT (API/DB), CON (`?race=` load path), SCN (document body / features)  
**Related:** [`race-project.md`](../contracts/race-project.md) · [`race-projects-and-world-authoring.md`](./race-projects-and-world-authoring.md) §6 · [`hetzner-static-deploy.md`](../ops/hetzner-static-deploy.md)  
**Dispatches:** `DSP-PLT-20260731-03` (design) · `DSP-PLT-20260801-01` (stub) — done

---

## 1. Goals / non-goals (6.4)

### Goals

- Persist **RaceProject** documents so another studio PC can load the same project over **HTTPS** (Milestone F path).
- Keep today’s **static** packs under `public/races/` working unchanged (`?race=` → `/races/<id>/project.json`).
- Define a **minimal REST** surface: list / get / create / put / delete.
- Recommend a **small VPS stack** that coexists with the static SPA (same or sibling host).
- Leave a clear next step: **implement stub server** (follow-up DSP).

### Non-goals

- Full auth roles / multi-tenant (Phase **6.5**).
- Production deploy automation on Hetzner (human/CI later).
- Rewriting the SCN editor or changing `WorldFeature` shape.
- Dropping static `public/races/` support.
- Server-side render, realtime collaborative editing, or revision history UI (QoL later).
- Storing large binaries (GLB, geoid) in the DB — packs keep URL pointers to static assets.

---

## 2. Resource model

One row / record per race project. The **document body** is the same JSON as [`race-project.md`](../contracts/race-project.md) (`schemaVersion` … `output`).

| Column / field | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Safe race id: `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$` (same as `isSafeRaceId`) |
| `name` | text | Denormalized from body for list UI (also inside JSON) |
| `revision` | integer ≥ 1 | Monotonic; optimistic concurrency |
| `updatedAt` | ISO-8601 UTC | Server-set on every successful write |
| `labels` | JSON string array | Optional tags (`["demo","live"]`); empty = `[]` |
| `body` | JSON | Full RaceProject document |

**Invariants**

- `body.id` **must equal** row `id`.
- On write, server sets `body.updatedAt` and `body.revision` to match row metadata (clients may send them; server wins).
- `name` on the row tracks `body.name` after each write.
- Embedded `features` are stored inside `body` (no separate feature table in 6.4). Sibling fixture URLs (`courseUrl`, etc.) remain as today.

**List projection** (no full body):

```json
{
  "id": "demo-istanbul",
  "name": "Demo Istanbul",
  "revision": 1,
  "updatedAt": "2026-07-30T00:00:00.000Z",
  "labels": ["demo"]
}
```

---

## 3. REST endpoints

Base path: `/api` (same-origin via reverse proxy preferred).

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/races` | List projections; optional `?label=` filter; **default excludes `archived`**; `?includeArchived=1` includes all |
| `GET` | `/api/races/:id` | Full RaceProject JSON (`200`) or `404` |
| `POST` | `/api/races` | Create; body = RaceProject (+ optional `labels` wrapper — see below) |
| `PUT` | `/api/races/:id` | Full replace; optimistic concurrency; optional labels wrapper |
| `DELETE` | `/api/races/:id` | Delete; `204` or `404` |
| `GET` | `/api/assets` | Universal asset library manifest (array; no auth) |
| `POST` | `/api/assets` | Multipart library upload (`file`, optional `label`); editor auth |

### Asset library (`GET`/`POST /api/assets`)

Phase 11.3 — git-trackable shared textures/models under `public/assets/library/`.

- Storage: `<kind>/<slug>-<shortHash>.<ext>` where `kind` is `image` | `model`.
- Manifest: `public/assets/library/index.json` (pretty-printed).
- Allow-list: `png|jpg|jpeg|webp|glb|gltf`. Default max file size **20 MiB**.
- Errors: `400` invalid extension / missing file; `401`/`403` auth; `413` oversized;
  `503` when library dir not configured on the process.
- Venue packs: `/assets/library/…` is an allow-listed path in
  `collectVenuePackUrls` / `isVenueAssetPath`.

### Create (`POST /api/races`)

Request body options (either accepted):

1. Bare RaceProject JSON (labels default `[]`).
2. Wrapper: `{ "project": RaceProject, "labels"?: string[] }`.

Rules:

- `id` required and safe; **409** if already exists.
- Server assigns `revision = 1` and `updatedAt = now`.
- Response: `201` + stored RaceProject (+ `Location: /api/races/:id`).

### Put (`PUT /api/races/:id`)

- Path `:id` must match `body.id` (or `body.project.id` when using the labels wrapper).
- Request body options (either accepted):
  1. Bare RaceProject JSON (labels unchanged).
  2. Wrapper: `{ "project": RaceProject, "labels"?: string[] }` — when `labels` is present, replaces stored labels (archive = include `"archived"`).
- Client sends expected revision via **either**:
  - header `If-Match: "<revision>"`, or
  - field `revision` on the RaceProject body (current known value).
- If stored revision ≠ expected → **409** `{ "error": "revision_conflict", "currentRevision": N }`.
- On success: `revision := current + 1`, `updatedAt := now`, store body, return `200` + stored document.
- Missing row → **404** (use POST to create; no silent upsert).

### Archive / rename (Phase 11.4)

- **Archive** is the `archived` label (not a separate column). Default `GET /api/races` excludes it; projects remain loadable by id.
- **Rename** is client-orchestrated (duplicate under new id, then DELETE old). Schema id immutability is unchanged; do not delete until create succeeds.

### Delete

- `DELETE /api/races/:id` → `204` if removed, `404` if missing.

### Errors (common)

| Status | When |
| --- | --- |
| `400` | Invalid id, JSON, or RaceProject validation fail |
| `401` / `403` | Write without token when auth stub enabled (6.5 expands roles) |
| `404` | Unknown id |
| `409` | Create duplicate or revision conflict |
| `413` | Body over size limit (recommend **2 MiB** soft cap) |

CORS: prefer **same-origin** (`/api` on SPA host). If API is a sibling origin, allow the SPA origin explicitly; credentials only if cookie auth is chosen later (bearer token is simpler for studio).

---

## 4. Storage recommendation

| Option | Verdict | Rationale |
| --- | --- | --- |
| **SQLite file on VPS** | **Recommended for 6.4** | One file (`data/races.sqlite`), zero ops for Postgres, fine for tens/hundreds of packs and low write concurrency |
| Postgres | Later | Only if multi-instance API or org already runs it |
| JSON files on disk | Rejected as primary | Racey writes; reinventing SQLite |
| In-memory only | Dev spike only | Not multi-machine |

**Stack sketch (impl DSP):**

- Node **ESM** process next to the static site (same Hetzner VM is fine).
- Lightweight router: **Hono** or Node `http` + tiny router (match repo’s TS/ESM style).
- Driver: `better-sqlite3` or `node:sqlite` (Node 22+) — pick in impl DSP; prefer whatever installs cleanly on the VPS.
- Schema: single table `race_projects (id, name, revision, updated_at, labels_json, body_json)`.
- Process listens on localhost (e.g. `127.0.0.1:8787`); nginx/Caddy proxies `/api/` → that port (same pattern as WSS Option B in [`wss-live-telemetry.md`](../ops/wss-live-telemetry.md)).

Static SPA deploy runbook stays valid: API is **additive**, not required for smoke of `/?race=demo-istanbul` from `dist/races/`.

---

## 5. How the SPA loads a project

Boot order today (unchanged when API unset):

1. `loadConfig()` → `/config.json`
2. `?race=<id>` → `GET /races/<id>/project.json`
3. Deeplink query params still win over pack
4. Pack miss → warn, continue with `config.json`

**Additive API path (impl):**

| Config | Behaviour |
| --- | --- |
| `projectsApiBase` empty / absent | Static only (current behaviour) |
| `projectsApiBase` set (e.g. `"/api"` or absolute HTTPS origin) | `GET {base}/races/:id` **first**; on network/`404` → fall back to `/races/:id/project.json` |

List / picker:

- Static: `/races/index.json` (unchanged).
- When API base set: prefer `GET {base}/races` and merge or replace picker ids (impl choice: **API list wins when reachable**, else static index).

Deep link for far PC:

```text
https://YOUR_SPA_DOMAIN/?race=demo-istanbul
```

Same query; host must serve SPA + (optional) proxy `/api`. No USB copy.

**Do not** change the meaning of `?race=` or remove static fetch — API is additive.

---

## 6. Migration from `public/races/`

| Step | Action |
| --- | --- |
| Keep committed demos | `demo-istanbul` (and future packs) stay in git under `public/races/` for offline/dev and static deploy |
| Seed script (impl) | On first API boot or `npm run projects:seed`: read `public/races/*/project.json` + `index.json` → `INSERT` if missing |
| Editor save today | Download `project.json` (browser cannot write `public/`) |
| Editor save with API | `PUT`/`POST` to API when `projectsApiBase` + write token present; download remains fallback |
| Fixture URLs | Unchanged (`/fixtures/...`); API stores pointers, not fixture blobs |

Conflict policy for seed: **never overwrite** a DB row that already exists (higher revision / studio edits win).

---

## 7. Security note (LAN roles — Phase 9.1)

| Environment | Read | Write |
| --- | --- | --- |
| Local stub / studio LAN | Open | Editor bearer (`PROJECTS_API_EDITOR_TOKEN` / legacy `PROJECTS_API_TOKEN`); air bearer → **403** |
| Production HTTPS | Open list/get OK for studio overlays | **No public anonymous write** — editor bearer required |

Roles (stub, not IdP):

| Role | Server | SPA |
| --- | --- | --- |
| `editor` | Matching bearer may POST/PUT/DELETE | `projectsRole: "editor"` + `projectsApiToken` |
| `air` | Reads open; air bearer on write → 403 | `projectsRole: "air"` or `?role=air` — Save UI disabled |

Ops: [`docs/ops/projects-api.md`](../ops/projects-api.md). Console deep-link token remains a later CON concern. Do not commit tokens.

---

## 8. OpenAPI-ish sketch (optional)

```yaml
openapi: 3.0.3
info:
  title: broadcast-web RaceProject API
  version: "0.1.0-draft"
paths:
  /api/races:
    get:
      summary: List race projects
      parameters:
        - in: query
          name: label
          schema: { type: string }
      responses:
        "200":
          description: Array of list projections
    post:
      summary: Create race project
      responses:
        "201": { description: Created RaceProject }
        "409": { description: Id exists }
  /api/races/{id}:
    get:
      summary: Get RaceProject document
      responses:
        "200": { description: RaceProject }
        "404": { description: Not found }
    put:
      summary: Replace RaceProject (If-Match or body.revision)
      parameters:
        - in: header
          name: If-Match
          schema: { type: string }
      responses:
        "200": { description: Updated RaceProject }
        "409": { description: revision_conflict }
    delete:
      summary: Delete race project
      responses:
        "204": { description: Deleted }
        "404": { description: Not found }
```

---

## 9. Next DSP (suggested)

**`DSP-PLT-…-project-api-stub`** — implement:

1. `server/` (or `packages/projects-api/`) minimal Node process + SQLite schema.
2. Endpoints above + seed from `public/races/`.
3. nginx/Caddy snippet for `/api` proxy (ops doc addendum).
4. SPA: optional `projectsApiBase` in config + `loadRaceProject` try-API-then-static (small CON/PLT client change).
5. No production auth roles — bearer stub only.

Docs-only design does **not** require that stub in this DSP; ship contract + this doc first.

---

## 10. Acceptance checklist (design)

- [x] Stack recommended (SQLite + small Node API + reverse proxy)
- [x] Endpoints: list / get / create / put / delete
- [x] Revision / optimistic concurrency defined
- [x] Static fallback for `?race=` preserved
- [x] Migration path from `public/races/`
- [x] Security placeholder; production anonymous write forbidden
