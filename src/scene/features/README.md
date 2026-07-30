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
4. **`setLayoutFeatures` / `getLayoutFeatures`** — store for map + tests + future editor.  
5. 3D builders still mount from their own normalized data (parity); map draws from the shared ENU list.

## API

| Symbol | Role |
| --- | --- |
| `adaptCourseToFeatures` / `adaptSponsorsToFeatures` / `adaptFlagsToFeatures` | Fixture → GPS features |
| `layoutFeatures` | GPS → ENU (`FEATURE_WATER_Y`) |
| `pairLayoutGates` | Pair gate ends for map segments |
| `getLayoutFeatures` / `setLayoutFeatures` | Shared store |

Out of scope here: map editor UI, RaceProject pack/DB, GeoJSON import, NDI.
