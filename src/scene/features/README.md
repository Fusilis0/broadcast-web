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
| Save project | **Save project** → `project.json` (full RaceProject: origin, fleet, povIds, features, URLs) |

### Persist a pack in git (Phase 6.2)

Browser cannot write into `public/`. Download → drop file:

1. Edit features (optional) → set **project id** / **name** → **Save project** (or HUD **Save**)
2. Copy downloaded `project.json` to `public/races/<id>/project.json`
3. Add `<id>` to `public/races/index.json` `{ "ids": [...] }`
4. HUD **race** picker → Load, or open `?race=<id>`

No DB persist, no GeoJSON import. Boot without editor unchanged.

## API

| Symbol | Role |
| --- | --- |
| `adaptCourseToFeatures` / `adaptSponsorsToFeatures` / `adaptFlagsToFeatures` | Fixture → GPS features |
| `layoutFeatures` | GPS → ENU (`FEATURE_WATER_Y`) |
| `pairLayoutGates` | Pair gate ends for map segments |
| `getLayoutFeatures` / `setLayoutFeatures` | Shared store |
| `startMapFeatureEditor` | Ops UI + place/select/export |
| `serializeWorldFeaturesExport` | Pure JSON string for download |
| `featuresToCourseData` / `featuresToSponsorsData` / `featuresToFlagsData` | Editor → remount fixtures |

Out of scope here: RaceProject DB/API (download-only save), GeoJSON import, NDI, stream PiP map.
