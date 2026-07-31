# RaceProject contract (V1 local pack)

| | |
| --- | --- |
| **Status** | **Draft** — Phase 6.1 local static packs |
| **Owners** | PLT (I/O), SCN (features), CON (`?race=` load) |
| **Related** | [`race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) §3; editor export `WorldFeature[]` |

---

## Intent

A **RaceProject** is one race pack: origin, fleet, POV ids, world features (or fixture URL pointers), and optional output defaults. V1 ships as static files under Vite `public/`; API/DB is a later phase.

Deep link:

```
http://127.0.0.1:5173/?race=demo-istanbul
```

Boot order:

1. `loadConfig()` (`/config.json`)
2. If `?race=<id>` → fetch pack → merge into config
3. `applyDeeplinkToBoot` — remaining query params still **win** over pack/config
4. On pack miss / invalid → warn and continue with `config.json` (no crash)

---

## On-disk layout

```
public/races/<id>/project.json
```

Optional siblings (not required when `project.json` points at shared fixtures):

- `world-features.json` — editor-compatible `{ "features": WorldFeature[] }`
- course / sponsors / flags JSON (or reuse `/fixtures/...`)

---

## Document fields

| Field | Required | Notes |
| --- | --- | --- |
| `schemaVersion` | yes | Number ≥ 1 (V1 uses `1`) |
| `id` | yes | Pack id; should match folder name |
| `name` | yes | Display name |
| `updatedAt` | no | ISO-8601 string |
| `revision` | no | Monotonic int |
| `origin` | yes | `{ lat, lon, altMsl }` finite numbers |
| `takeoffAltitudeMSL` | no | GEO takeoff bridge |
| `fleet.boatIds` | yes | Arch band `21–52` (normalized like config) |
| `fleet.boatNamesUrl` | no | Catalogue JSON URL |
| `povIds` | yes | Arch bands `1–4` ∪ `11–12` |
| `features` | no* | Embedded `WorldFeature[]` (same shape as editor export) |
| `featuresUrl` | no* | URL to `{ features: WorldFeature[] }` |
| `courseUrl` / `sponsorsUrl` / `flagsUrl` | no* | Compat fixture pointers when features omitted |
| `replayUrl` | no | TEL replay fixture |
| `output` | no | Defaults: `outputMode`, `whepUrl`, `chromaKey`, timecode fields |

\* At least one of: non-empty `features`, `featuresUrl`, or course/sponsors/flags URL pointers (demo pack uses fixture URLs for visual parity).

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

Allowed `type`: `mark` | `gateLeft` | `gateRight` | `sponsor` | `flagP1` | `flagP2` | `start` | `finish` | `arrow` | `rotation`.

---

## Demo pack

Committed: `public/races/demo-istanbul/project.json`

- Origin / fleet / povIds match default Istanbul demo
- Points at existing `/fixtures/...` course, sponsors, flags, boats, replay
- Load: `http://127.0.0.1:5173/?race=demo-istanbul`

---

## Non-goals (this revision)

- Database / CRUD API
- Project list UI
- Auth / token validation
- GeoJSON as pack schema (interchange via SCN editor adapter only — see `src/scene/features/geojson.md`)
- NDI

---

## Versioning

| Stage | Meaning |
| --- | --- |
| **draft** (current) | Local packs only; schema may tighten with SCN/PLT |
| **stable** | After BW + PLT + SCN ack; breaking field renames need a new `schemaVersion` |
