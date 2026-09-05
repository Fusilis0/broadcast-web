# Shared world features (SCN)

Single GPS → ENU feature list for **3D scene** and **2D map** (race-projects §4).  
Existing `courseUrl` / `sponsorsUrl` / `flagsUrl` fixtures remain the V1 source via adapters **when `features` is omitted**. Present `features` (including `[]`) replaces the world and ignores those URLs.

## Types

| `type` | Points | 3D today | 2D map |
| --- | --- | --- | --- |
| `mark` | 1 | buoy + label | orange dot |
| `gateLeft` / `gateRight` | 1 each (paired by name) | gate segment + buoys | green line |
| `sponsor` | 2 (A–B) | flat water board | coloured footprint line |
| `billboardChain` | ≥2 polyline | continuous upright ribbon; `spacingM` = logo pitch | polyline |
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

Sponsor example: `type: "sponsor"`, `points: [a, b]`, `label` + `color`. Additive board chrome: optional `panelColor` / `frameColor` (`#rrggbb`), `panelAlpha` (0–1; **flat sponsors omit → 0** = logo/text only, no plate). Chosen Library `textureUrl` is contain-fit — the name/label is **not** drawn on the 3D mesh. GPS A–B is the canvas; across-water follows default board aspect (not `heightM` metres). `heightM` scales the glyph inside that canvas (clamped).

`billboardChain` (Phase 19.11 / ribbon follow-up): omit `panelColor` → bluish TV plate `#2A6FA6`. Additive `logos?: { url, weight }[]` (integer weights). Empty / omitted logos (and no `textureUrl`) → solid coloured ribbon, no label. Sequence along the strip is **weighted fair interleave** (`[3,2]` → **AABAB**). Geometry is a **continuous abutting ribbon** (SailGP shoreline), not framed squares with gaps. `spacingM` = logo **pitch** on the plate; `heightM` is **vertical** only (logos contain-fit, aspect locked). Plate colour shares `panelAlpha` (**omit → opaque 1**). Library picker: `src/scene/sidebar/libraryLogoPicker.ts` (`openLibraryLogoPicker`).

Soft visibility (Phase 11.7): optional `visible3d` / `visible2d` (default true). Assets inspector
toggles these; 3D remount skips `visible3d: false`; map draw skips `visible2d: false`.

Racing marks / buoys / gates (DSP-06): additive `visibleBuoyMesh` / `visibleTag` (omit = on).
Mesh off leaves the name sprite; tag off leaves the float. `visible3d: false` still hides the
whole 3D prop (mesh + tag + rounding arrows). Rounding stays Off / CW / CCW. 2D dots only
follow `visible2d`.

## Pipeline

1. Load + normalize fixture JSON (course / sponsors / flags) as today.  
2. **Adapt** → `WorldFeature[]` (`adaptCourseToFeatures`, …).  
3. **`layoutFeatures(features, gpsToEnuAmsl)`** — one GEO pass; water **Y = 0**.  
4. **`setLayoutFeatures` / `getLayoutFeatures`** — store for map + editor.  
5. Editor mutates the GPS list → re-layout → map redraw + **`remountWorldFromFeatures`** (3D course/sponsors/flags/start–finish/`buoy`/`billboardChain`). Empty remount disposes leftover 3D (chains included).  
   Pack Load: present `features` (including `[]`) remounts that list only. Fixture URLs + `fixtures/world/demo-istanbul-extras.json` + default position markers apply **only** when `features` is omitted.

**Ops 2D map (Phase 11.6 / 19.12):** pan/zoom + optional OSM basemap (`map2d` / `map2dBasemap`) covering the visible canvas on zoom; stream/NDI 2D stays without OSM. Tools for boat/drone place, anchor pick, buoy, billboard chain. Logo picker is a Library **thumb modal** (`libraryLogoPicker.ts` / `listLibraryAssets`); no numbered stub list and never `window.prompt`.

## Map feature editor + World Authoring (Phase 4.2 V1 + Phase 8.2 + SCN-04)

Primary UI: **World Authoring** workspace (large map + grouped tools). Open from the Race setup
header **World** toggle (click again to close). Editor role defaults open; air closed. Overrides: `?editor=1` /
`?editor=0`. Ops **authoring** checkbox mirrors workspace open/close.

| Action | How |
| --- | --- |
| Tools | Grouped: Course (start/finish/mark/gates/buoy/flags), Graphics (sponsor/billboard chain/arrow), Fleet (boat/drone), Anchor |
| Place | Map click **or** type + lat/lon/alt/height + **Add** (GEO `gpsToEnuAmsl` / `enuToGpsAmsl`). New id is in the in-memory features array **before** the 3D remount promise. Assets list refreshes on the same tick (`onStoreChange`). |
| Confirm | **Enter** finishes a billboard chain (≥2 pts) or commits two-click B at the last cursor/snap — Library picker + spacing via `promptModal` (not native `prompt`) |
| Cancel | **Escape** clears a pending A / polyline draft (modal Escape cancels the prompt only) |
| Snap | **Vertex** on by default (14 px screen radius); optional **grid 5 m** (ENU). Vertex wins when both on. Yellow crosshair when snapped. |
| Bearing | While drawing A→B (gate pair / sponsor / start / finish / arrow): HUD readout `brg NNN° · L m` + dashed draft segment |
| Inspector | Name, label, type, lat/lon/alt MSL, height (every type). Start/finish: both GPS ends. Sponsor: Library logo (not name on mesh), plate colour + alpha. Chain: `spacingM` = logo pitch; `heightM` vertical; plate colour + alpha. Pack id/name are **hidden** (Save project still uses stored meta). Select a feature → **Add becomes Edit**. |
| Fleet | Coordinate Add boat/drone. Drone lat/lon/alt are **read-only** when live TEL pose exists (HO-TEL-SCN-20260901-01). Boat visibility: hidden = hull off, tag on (19.8). |
| Edit | Select → click a **vertex** and drag to move; inspector **Edit**; **Delete** / **Backspace** removes |

| Validate | Before **Export** / **Save project**: orphan gate half, sponsor missing B, empty name → block; empty sponsor label → warn + confirm |
| Export | **Export JSON** → `world-features.json` `{ features: [...] }` (features only) |
| GeoJSON | **Export GeoJSON** → `.geojson` FeatureCollection; **Import GeoJSON** → replace or merge (confirm), then layout + 3D remount |
| Save project | **Save project** → uses stored pack id/name (fields hidden on the overlay; Project section owns visible id) → `project.json` + optional API |

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
| `layoutFeatures` | GPS → ENU (GEO `y` from Alt MSL; `FEATURE_WATER_Y` is the default-rest constant only) |
| `pairLayoutGates` | Pair gate ends for map segments |
| `getLayoutFeatures` / `setLayoutFeatures` | Shared store |
| `startMapFeatureEditor` | Ops UI + place/select/export + GeoJSON I/O + snap/bearing/validate + coordinate **Add/Edit** (hosts in World Authoring) |
| `addFromCoordinates` / `editFromCoordinates` | Pure GPS draft → in-memory `WorldFeature[]` (or fleet payload). New id is present before remount. |
| `serializeWorldFeaturesExport` | Pure JSON string for download |
| `validateWorldFeatures` / `formatValidationSummary` | Pre-save/export checks (orphan gates, incomplete sponsors) |
| `applySnap` / `segmentReadout` | Pure snap + bearing/length helpers (tests / reuse) |
| `featuresToCourseData` / `featuresToSponsorsData` / `featuresToFlagsData` | Editor → remount fixtures |

Out of scope here: RaceProject DB/API (download-only save), NDI. Stream 2D map (`createStreamMap2d`) consumes this same layout; PiP overlay removed in Phase 19.2.
