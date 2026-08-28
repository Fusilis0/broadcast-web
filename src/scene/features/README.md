# Shared world features (SCN)

Single GPS → ENU feature list for **3D scene** and **2D map** (race-projects §4).  
Existing `courseUrl` / `sponsorsUrl` / `flagsUrl` fixtures remain the V1 source via adapters — no RaceProject DB yet.

## Types

| `type` | Points | 3D today | 2D map |
| --- | --- | --- | --- |
| `mark` | 1 | buoy + label | orange dot |
| `gateLeft` / `gateRight` | 1 each (paired by name) | gate segment + buoys | green line |
| `sponsor` | 2 (A–B) | billboard panel | coloured footprint line |
| `billboardChain` | ≥2 polyline | repeated sponsor panels at `spacingM` | polyline |
| `buoy` | 1 | racing-mark buoy prop | orange dot (+ cyan ring if `telemetryId`) |
| `flagP1` / `flagP2` | 1 each | countdown poles | diamond icons |
| `start` / `finish` | 1–2 | water line signs (`lineSigns/`) | red segment + label |
| `arrow` / `rotation` | 1 (+ heading later) | stub | stub square |

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

Sponsor example: `type: "sponsor"`, `points: [a, b]`, `label` + `color`. Additive board chrome: optional `panelColor` / `frameColor` (`#rrggbb`); omit → white board + dark slate frame.

Soft visibility (Phase 11.7): optional `visible3d` / `visible2d` (default true). Assets inspector
toggles these; 3D remount skips `visible3d: false`; map draw skips `visible2d: false`.

## Pipeline

1. Load + normalize fixture JSON (course / sponsors / flags) as today.  
2. **Adapt** → `WorldFeature[]` (`adaptCourseToFeatures`, …).  
3. **`layoutFeatures(features, gpsToEnuAmsl)`** — one GEO pass; water **Y = 0**.  
4. **`setLayoutFeatures` / `getLayoutFeatures`** — store for map + editor.  
5. Editor mutates the GPS list → re-layout → map redraw + **`remountWorldFromFeatures`** (3D course/sponsors/flags/start–finish/`buoy`/`billboardChain`).  
   Boot also merges `fixtures/world/demo-istanbul-extras.json` (start/finish) and loads position markers fixture.

**Ops 2D map (Phase 11.6):** pan/zoom + optional OSM basemap (`map2d` / `map2dBasemap`); tools for boat/drone place, anchor pick, buoy, billboard chain. Texture picker in Assets Details prefers Library (`listLibraryAssets`); falls back to `stubTexturePicker.ts` when the catalogue is empty. Free-text prompts use shared DOM `promptModal` (`src/ui/`) — Electron throws on `window.prompt()`.

## Map feature editor + World Authoring (Phase 4.2 V1 + Phase 8.2 + SCN-04)

Primary UI: **World Authoring** workspace (large map + grouped tools). Open from sidebar
**World Map → Open authoring**. Editor role defaults open; air closed. Overrides: `?editor=1` /
`?editor=0`. Ops **authoring** checkbox mirrors workspace open/close.

| Action | How |
| --- | --- |
| Tools | Grouped: Course (start/finish/mark/gates/buoy/flags), Graphics (sponsor/billboard chain/arrow), Fleet (boat/drone), Anchor |
| Place | Click enlarged map (ENU → lat/lon via GEO `enuToGpsAmsl`) |
| Confirm | **Enter** finishes a billboard chain (≥2 pts) or commits two-click B at the last cursor/snap — texture + spacing via `promptModal` (not native `prompt`) |
| Cancel | **Escape** clears a pending A / polyline draft (modal Escape cancels the prompt only) |
| Snap | **Vertex** on by default (14 px screen radius); optional **grid 5 m** (ENU). Vertex wins when both on. Yellow crosshair when snapped. |
| Bearing | While drawing A→B (gate pair / sponsor / start / finish / arrow): HUD readout `brg NNN° · L m` + dashed draft segment |
| Edit | Select → click a **vertex** and drag to move; name / label / heightM / color; **Delete** / **Backspace** removes |

| Validate | Before **Export** / **Save project**: orphan gate half, sponsor missing B, empty name → block; empty sponsor label → warn + confirm |
| Export | **Export JSON** → `world-features.json` `{ features: [...] }` (features only) |
| GeoJSON | **Export GeoJSON** → `.geojson` FeatureCollection; **Import GeoJSON** → replace or merge (confirm), then layout + 3D remount |
| Save project | **Save project** → Save as with id/name fields → `project.json` (origin, fleet, povIds, features, URLs) + optional API |

### Editor snap defaults (8.2)

| Mode | Default | Notes |
| --- | --- | --- |
| Vertex | **on** | Nearest layout vertex within 14 px on the editor map |
| Grid | **off** | 5 m ENU East/North cells when enabled |

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
| `startMapFeatureEditor` | Ops UI + place/select/export + GeoJSON I/O + snap/bearing/validate (hosts in World Authoring) |
| `serializeWorldFeaturesExport` | Pure JSON string for download |
| `validateWorldFeatures` / `formatValidationSummary` | Pre-save/export checks (orphan gates, incomplete sponsors) |
| `applySnap` / `segmentReadout` | Pure snap + bearing/length helpers (tests / reuse) |
| `featuresToCourseData` / `featuresToSponsorsData` / `featuresToFlagsData` | Editor → remount fixtures |

Out of scope here: RaceProject DB/API (download-only save), NDI. Stream PiP map (Phase 8.1) consumes this same layout via `createStreamMap2d` / HUD toggle.
