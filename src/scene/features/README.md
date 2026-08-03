# Shared world features (SCN)

Single GPS → ENU feature list for **3D scene** and **2D map** (race-projects §4).  
Existing `courseUrl` / `sponsorsUrl` / `flagsUrl` fixtures remain the V1 source via adapters — no RaceProject DB yet.

## Types

| `type` | Points | 3D today | 2D map |
| --- | --- | --- | --- |
| `mark` | 1 | buoy + label | orange dot |
| `gateLeft` / `gateRight` | 1 each (paired by name) | gate segment + buoys | green line |
| `sponsor` | 2 (A–B) | billboard panel | coloured footprint line |
| `flagP1` / `flagP2` | 1 each | countdown poles | diamond icons |
| `start` / `finish` | 1–2 | stub | stub (map glyph later) |
| `arrow` / `rotation` | 1 (+ heading later) | stub | stub |

## GPS JSON shape (`WorldFeature`)

```json
{
  "id": "course:Mark-NW",
  "name": "Mark-NW",
  "type": "mark",
  "points": [{ "lat": 41.0087, "lon": 28.9778, "altMsl": 0 }],
  "heightM": 5,
  "color": 16768251,
  "label": optional
}
```

Sponsor example: `type: "sponsor"`, `points: [a, b]`, `label` + `color`.

## Pipeline

1. Load + normalize fixture JSON (course / sponsors / flags) as today.  
2. **Adapt** → `WorldFeature[]` (`adaptCourseToFeatures`, …).  
3. **`layoutFeatures(features, gpsToEnuAmsl)`** — one GEO pass; water **Y = 0**.  
4. **`setLayoutFeatures` / `getLayoutFeatures`** — store for map + editor.  
5. Editor mutates the GPS list → re-layout → map redraw + **`remountWorldFromFeatures`** (3D course/sponsors/flags).

## Map feature editor (Phase 4.2 V1)

Enable with HUD **editor** checkbox or URL `?editor=1`.

| Action | How |
| --- | --- |
| Tools | select, mark, gate L/R, gate pair (A–B), sponsor (A–B), flags, start/finish/arrow stubs |
| Place | Click enlarged map (ENU → lat/lon via GEO `enuToGpsAmsl`) |
| Edit | Select → name / label / heightM / color; **Delete** |
| Export | **Export JSON** → `world-features.json` `{ features: [...] }` (features only) |
| GeoJSON | **Export GeoJSON** → `.geojson` FeatureCollection; **Import GeoJSON** → replace or merge (confirm), then layout + 3D remount |
| Save project | **Save project** → Save as with id/name fields → `project.json` (origin, fleet, povIds, features, URLs) + optional API |

### Persist a pack (Phase 6.2 / 6.4)

Browser cannot write into `public/`. **Download is primary**; API write is optional when `projectsApiBase` + stub are running.

1. Edit features / Fleet / origin (optional) → HUD **Save** (overwrite id) or **Save as** / editor **Save project** (new id)
2. Copy downloaded `project.json` to `public/races/<id>/project.json` (git / static)
3. Add `<id>` to `public/races/index.json` `{ "ids": [...] }`
4. HUD **Load**, or open `?race=<id>`

Boot without editor unchanged.

### GeoJSON (Phase 4.4)

Interchange for geojson.io — see [`geojson.md`](./geojson.md) for property keys and Point vs LineString rules. RaceProject JSON stays the native pack format.

## API

| Symbol | Role |
| --- | --- |
| `adaptCourseToFeatures` / `adaptSponsorsToFeatures` / `adaptFlagsToFeatures` | Fixture → GPS features |
| `geojsonToWorldFeatures` / `worldFeaturesToGeojson` | GeoJSON FeatureCollection ↔ `WorldFeature[]` |
| `serializeWorldFeaturesGeojson` / `downloadWorldFeaturesGeojson` | `.geojson` download |
| `layoutFeatures` | GPS → ENU (`FEATURE_WATER_Y`) |
| `pairLayoutGates` | Pair gate ends for map segments |
| `getLayoutFeatures` / `setLayoutFeatures` | Shared store |
| `startMapFeatureEditor` | Ops UI + place/select/export + GeoJSON I/O |
| `serializeWorldFeaturesExport` | Pure JSON string for download |
| `featuresToCourseData` / `featuresToSponsorsData` / `featuresToFlagsData` | Editor → remount fixtures |

Out of scope here: RaceProject DB/API (download-only save), NDI, stream PiP map.
