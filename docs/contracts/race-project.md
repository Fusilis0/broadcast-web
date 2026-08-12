# RaceProject contract (V1 local pack + API draft)

| | |
| --- | --- |
| **Status** | **API draft** — Phase 6.1 local packs + Phase 6.4 persistable API design |
| **Owners** | PLT (I/O + API), SCN (features), CON (`?race=` load) |
| **Related** | [`race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) §3 · [`project-api-and-database.md`](../architecture/project-api-and-database.md) · editor export `WorldFeature[]` |

---

## Intent

A **RaceProject** is one race pack: origin, fleet, POV ids, world features (or fixture URL pointers), and optional output defaults. V1 ships as static files under Vite `public/`. Phase **6.4** adds an optional HTTPS API + database with the **same document body**; static packs remain supported.

Deep link:

```
http://127.0.0.1:5173/?race=demo-istanbul
```

Boot order:

1. `loadConfig()` (`/config.json`)
2. If `?race=<id>` → fetch pack → merge into config
3. `applyDeeplinkToBoot` — remaining query params still **win** over pack/config
4. On pack miss / invalid → warn and continue with `config.json` (no crash)

Fetch resolution (when API is implemented):

1. If `projectsApiBase` is set → `GET {projectsApiBase}/races/<id>`
2. Else, or on API miss → `GET /races/<id>/project.json` (static; **required fallback**, never removed)
3. On API + static miss → cached **venue pack** (IndexedDB; Phase 9.2) when the operator previously used Pack ↓ / Pack ↑ — see [`../ops/venue-pack.md`](../ops/venue-pack.md)

---

## On-disk layout

```
public/races/<id>/project.json
```

Optional siblings (not required when `project.json` points at shared fixtures):

- `world-features.json` — editor-compatible `{ "features": WorldFeature[] }`
- course / sponsors / flags JSON (or reuse `/fixtures/...`)

Manifest (picker): `public/races/index.json` → `{ "ids": ["demo-istanbul", ...] }`.

---

## Document fields

| Field | Required | Notes |
| --- | --- | --- |
| `schemaVersion` | yes | Number ≥ 1 (V1 uses `1`) |
| `id` | yes | Pack id; should match folder name / API row id |
| `name` | yes | Display name |
| `updatedAt` | no* | ISO-8601 string (* server-set on API writes) |
| `revision` | no* | Monotonic int (* required for API optimistic concurrency after create) |
| `origin` | yes | `{ lat, lon, altMsl }` finite numbers |
| `takeoffAltitudeMSL` | no | GEO takeoff bridge |
| `fleet.boatIds` | yes | Arch band `21–52` (normalized like config) |
| `fleet.boatNamesUrl` | no | Catalogue JSON URL |
| `fleet.boatVisibility` | no | Soft map id → `solid`\|`ghost`\|`hidden` (SCN 8.6; omit → solid; junk dropped) |
| `fleet.boatMapVisible` | no | Soft map id → boolean (SCN 11.7; `false` hides 2D icon; omit → show) |
| `fleet.povMapVisible` | no | Soft map id → boolean (SCN 11.7; `false` hides 2D icon; omit → show) |
| `povIds` | yes | Arch bands `1–4` ∪ `11–12` |
| `features` | no* | Embedded `WorldFeature[]` (same shape as editor export) |
| `featuresUrl` | no* | URL to `{ features: WorldFeature[] }` |
| `courseUrl` / `sponsorsUrl` / `flagsUrl` | no* | Compat fixture pointers when features omitted |
| `replayUrl` | no | TEL replay fixture |
| `output` | no | Defaults: `outputMode`, `whepUrl`, `chromaKey`, timecode fields |
| `calibration` | no | Soft CAL map — see below. Omit when empty; old packs without it still parse |

\* At least one of: non-empty `features`, `featuresUrl`, or course/sponsors/flags URL pointers (demo pack uses fixture URLs for visual parity).

### `calibration` (CAL — soft)

Per-POV runtime offsets (same knobs as the calib panel / `offsetsStore`). Soft field: missing/`null`/junk → ignored; empty `byPovId` → omit on save.

```json
"calibration": {
  "byPovId": {
    "1": {
      "yawDeg": 2.5,
      "pitchDeg": 0,
      "rollDeg": 0,
      "fovHDeg": 66.8832,
      "altMeters": -1.2
    }
  }
}
```

| Nested field | Notes |
| --- | --- |
| `byPovId` | Map POV/device id → offsets. Keys should align with `povIds` |
| offsets | Prefer store names: `yawDeg`, `pitchDeg`, `rollDeg`, `fovHDeg`, `altMeters`. Soft aliases also accepted on parse: `yaw`, `pitch`, `roll`, `fov`, `alt`. Unknown keys ignored |

Load (`applyRaceProjectToConfig` / `?race=` / HUD Load) hydrates `offsetsStore` before pose apply. Save / Save as embeds a snapshot for current `povIds`.

### `WorldFeature` (SCN)

Matches `src/scene/features/types.ts` and editor download `world-features.json`:

```json
{
  "id": "course:Mark-NW",
  "name": "Mark-NW",
  "type": "mark",
  "points": [{ "lat": 41.0087, "lon": 28.9784, "altMsl": 0 }],
  "heightM": 2,
  "color": 16768251,
  "label": "optional"
}
```

Allowed `type`: `mark` | `gateLeft` | `gateRight` | `sponsor` | `flagP1` | `flagP2` | `start` | `finish` | `arrow` | `rotation` | `buoy` | `billboardChain`.

Additive optional fields (old packs without them still parse):

| Field | Types | Notes |
| --- | --- | --- |
| `textureUrl` | `sponsor`, `billboardChain` | URL under `public/` (or Library). `null` / omit → procedural |
| `spacingM` | `billboardChain` | Meters between instances along the polyline (≥2 `points`) |
| `telemetryId` | `buoy` | Optional TEL buoy id for live bind; omit / `null` → static placed point |
| `visible3d` | all | Soft 3D draw flag (SCN 11.7). Omit / `true` → show; `false` → omit from 3D remount |
| `visible2d` | all | Soft 2D map draw flag (SCN 11.7). Omit / `true` → show; `false` → hide map chrome |

`buoy` is a free-floating mark (distinct from course `mark` waypoints). `billboardChain` is a polyline of ≥2 GPS points with repeated sponsor-style panels at `spacingM`.

Additional soft fleet map-visibility maps (independent of `boatVisibility` solid/ghost/hidden):

| Field | Notes |
| --- | --- |
| `fleet.boatMapVisible` | id → boolean; only `false` entries need persist; omit → show map icon |
| `fleet.povMapVisible` | id → boolean; only `false` entries need persist; omit → show map icon |

---

## API (draft — Phase 6.4)

Full design: [`project-api-and-database.md`](../architecture/project-api-and-database.md).

| | |
| --- | --- |
| **Transport** | HTTPS REST under `/api` (same-origin proxy preferred) |
| **Storage** | SQLite on VPS (recommended); one row per project |
| **Document** | Same RaceProject JSON as on-disk `project.json` |
| **Metadata** | `revision`, `updatedAt`, optional `labels: string[]` |

### Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/races` | List `{ id, name, revision, updatedAt, labels }[]` (default excludes `archived`; `?includeArchived=1` / `?label=`) |
| `GET` | `/api/races/:id` | Full RaceProject |
| `POST` | `/api/races` | Create (`revision` starts at 1); 409 if id exists |
| `PUT` | `/api/races/:id` | Replace; `If-Match: "<revision>"` or body `revision` must match; else 409 |
| `DELETE` | `/api/races/:id` | Remove |

### Concurrency

- Successful `PUT` increments `revision` and refreshes `updatedAt` (server authoritative).
- Clients must send the revision they last read; conflicts return `409` with `currentRevision`.

### Auth (placeholder)

- Reads: open (studio overlay load).
- Writes: no public anonymous write in production — shared bearer token stub until Phase **6.5** roles.
- Local/LAN stub may leave writes open for convenience.

### Config hook (impl)

| Key | Meaning |
| --- | --- |
| `projectsApiBase` | Empty → static packs only. Set to `"/api"` (or absolute origin) → try API then static fallback |

Static `public/races/` and `?race=` behaviour **must not** break when the API is absent.

---

## Demo pack

Committed: `public/races/demo-istanbul/project.json`

- Origin / fleet / povIds match default Istanbul demo
- Points at existing `/fixtures/...` course, sponsors, flags, boats, replay
- Load: `http://127.0.0.1:5173/?race=demo-istanbul`

---

## Non-goals (this revision)

- Full auth roles / multi-tenant (6.5)
- Production Hetzner API deploy automation
- Project list UI beyond local picker (QoL)
- GeoJSON as pack schema (interchange via SCN editor adapter only — see `src/scene/features/geojson.md`)
- NDI
- Dropping static pack support

---

## Versioning

| Stage | Meaning |
| --- | --- |
| **draft** | Local packs only (historical 6.1) |
| **API draft** (current) | Local packs + documented persistable API; schema may tighten with SCN/PLT |
| **stable** | After BW + PLT + SCN ack; breaking field renames need a new `schemaVersion` |
