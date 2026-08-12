# Venue / offline pack (Phase 9.2)

Cache a race (project + linked fixtures/assets) for air PCs that lose WAN or lack a full `public/` tree. No Hetzner / cloud sync.

## Bundle format

Single JSON file: `{id}-venue-pack.json`

| Field | Notes |
| --- | --- |
| `schemaVersion` | `1` |
| `kind` | Always `broadcast-web-venue-pack` |
| `id` / `name` | Same race id as RaceProject |
| `project` | Full RaceProject document |
| `files` | Map of site-relative path → `{ contentType, encoding: utf-8\|base64, body }` |

Embedded paths typically include `/fixtures/…`, nested `/textures/…` from sponsor JSON, and scene extras (`/models/boat.glb`, map chrome, world extras, position markers) when fetchable at export time.

## Operator flow

### Before the show (online / studio)

1. Load the race (`?race=demo-istanbul` or HUD Load).
2. HUD **Pack ↓** → downloads `demo-istanbul-venue-pack.json` and caches it in the browser (IndexedDB).
3. Copy the file to USB / shared drive for the air PC if needed.

### On the air PC (WAN down OK)

**Option A — pack file**

1. Open broadcast-web (local Vite, `preview`, or Electron `file` build).
2. HUD **Pack ↑** → choose `*-venue-pack.json`.
3. Scene applies the pack (blob URLs for fixtures/textures).

**Option B — cached `?race=`**

1. After a prior Pack ↓ / Pack ↑ on that browser profile, open `?race=<id>`.
2. If API and static `/races/<id>/project.json` miss, the cached venue pack is used.

## Load precedence

1. Projects API (`projectsApiBase`) when configured  
2. Static `/races/<id>/project.json`  
3. Cached venue pack (IndexedDB)

Deeplink query params still win after pack merge (unchanged CON behaviour).

## Notes

- **Save** still downloads bare `project.json` (git drop-in). Venue pack is the offline bundle.
- Air-only LAN role may disable Save; **Pack ↓ / Pack ↑** stay available.
- Not a full PWA install — no service-worker polish in this slice.
- Calib profiles (Phase 9.3) ride inside `project` when present; this pack does not invent a separate calib schema.

## Code

- `src/projects/venuePack/`
- HUD wiring: `src/scene/stubHud.ts` + `src/main.ts`
- Module README: `src/projects/README.md`
