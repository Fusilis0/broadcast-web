# scene

Owned by **SCN**. Three.js view: fleet boats (glTF/procedural) + billboard tags, drone camera, stub HUD, 2D fleet map (pan/zoom + optional OSM), static course + buoys, sponsor panels, billboard chains, free buoys, countdown flags, start/finish water signs, distance position markers.

Unity asset inventory + backlog: [`docs/ops/unity-asset-port.md`](../../docs/ops/unity-asset-port.md).

## Consume contract

SCN draws fleet from **`poseBus`** (`src/pose/`) for **live** boat packets — ENU meters `x=East, y=Up, z=−North`. Allow-listed boats also spawn **without telemetry** via `syncFleetHulls` / `upsertStaticBoat` (planned ENU from GEO in `main`, or an origin grid). Live packets override that static pose; after telem, the last live pose is held (no snap-back to planned).

Do **not** call `gpsToEnu` inside `src/scene/` for boats. `main` converts planned lat/lon with GEO **`gpsToEnuAmsl`**. Do not subscribe to `telemetryBus` for positions or invent calibration math here.

**Course**, **sponsors**, and **countdown flags** are the exception for static world content: lat/lon waypoints are converted with GEO **`gpsToEnuAmsl` only** (no ECEF reimplementation in `src/scene/`). Call after `applyConfigOrigin` + EGM96. Fixtures also adapt into a shared **`WorldFeature[]`** → **`layoutFeatures`** list for the 2D map and **map feature editor**; see `src/scene/features/`.

`telemetryBus` may be used for **packet counts only** in the stub HUD.

**Ops sidebar (Phase 11.1 + 16.6):** `createSidebar` mounts **two** collapsible rails over the canvas
(does not reflow WebGL). Left = race setup (Project / Fleet & Live / Assets / World / Library /
leftover Race ops). Right = broadcast (Output `ndi` / Flow `flow` / Calibration / Environment / Wind).
`startAssetInspector` (11.7) lists every boat/POV/feature with Focus / Show-3D / Show-2D / Details.
NDI AR never reads this DOM (`ndiFramePump` / WebGL only). Channel `'2d'` samples
the stream-map canvas bitmap separately (`streamMapNdiPump`). Text prompts (billboard texture/spacing,
boat/drone/buoy ids) use shared `promptModal` in `src/ui/` — Electron rejects `window.prompt()`.

## Boot

`main.ts` creates the ops sidebar → `startStubHud({ hosts })` → loads config → `startScene({ boatIds, povIds })` → **`loadBoatNamesFromUrl(boatNamesUrl)`** → EGM96 → origin → **`loadCourseFromUrl(courseUrl)`** → **`loadSponsorsFromUrl(sponsorsUrl)`** → **`loadCountdownFlagsFromUrl(flagsUrl)`** → TEL ingest → `startPosePipeline` → HUD mode + POV select. HUD boots early for status; scene waits on `loadConfig()` so allow-lists are known.

**World anchor (Unity GeoOrigin):** `config.origin` `{ lat, lon, altMsl }` is ENU `(0,0,0)`. HUD **origin** fields show the active values after boot/deeplink/race load; **Apply** updates runtime config → `applyConfigOrigin` → remounts world features so boats/course shift in ENU together. Save project embeds the current origin via `buildRaceProject`.

**Soft race switch** (`switchRace` / Load / `?race=` after boot): `scene.setFleetAllowLists({ boatIds, povIds })` replaces allow-lists without recreating WebGL — orphan boats leave the registry, POV pose cache is pruned, active POV is clamped; then HUD/calib `setPovIds` + ingest restart with the same lists. First-boot `?race=` still passes pack lists into `startScene` directly.

Mock ids: POVs from `povIds` (default `1`,`2`), boats from `boatIds` (default `21–24`). Temporary hFOV default `66.8832` (also on `PoseEvent.fovHDeg` from CAL).

## Public API

| Symbol | Role |
| --- | --- |
| `startScene(options)` | Scene + lights + renderer + RAF + pose subscribe + fleet `Map` + POV switch + ops free cam + course/sponsors/flags/boatNames loaders |
| `setOpsViewMode` / `getOpsViewMode` / `getPreviewCamera` | Ops preview: `follow` (active POV) or `free` (orbit/pan/zoom); preview ≠ air |
| `frameFleet` / `frameEnuPoint` / `getBoatEnuPosition` / `getPovEnuPosition` | Free-cam Focus (fleet or single ENU point) |
| `getActivePovCamera` | Active POV camera — air / NDI source (OUT); never free cam |
| `orientOpsBillboards(camera)` | Distance-scale boat tags + countdown plate for the camera about to render (dual-render hook) |
| `setFleetAllowLists({ boatIds, povIds })` | Soft race switch: replace allow-lists, drop orphan boats, prune/clamp POV |
| `syncFleetHulls` / `upsertStaticBoat` | Spawn/move hulls from planned ENU without poseBus (15.4). Live packets still update the same entity |
| `loadCourse` / `mountCourse` | Fetch/normalize course JSON → GEO ENU → water cue + boundary/gates/buoys |
| `loadSponsors` / `mountSponsors` | Fetch/normalize sponsors JSON → GEO ENU → fixed world panels |
| `loadCountdownFlags` / `mountCountdownFlags` | Fetch/normalize flags JSON → GEO ENU → poles + phase timer |
| `loadBoatNames` / `normalizeBoatNames` | Fetch/normalize Unity category→id→name JSON → tag identity map |
| `startStubHud(options)` | Ops controls + status + ops/stream 2D maps; optional `hosts` split into sidebar sections |
| `createSidebar(options)` | Two-rail ops sidebar shell; `registerSection` for panels (Phase 11.1 / 16.6) |

**Project section (Phase 11.4):** `startProjectManagerPanel` (PLT) mounts above Load/Save in the sidebar Project section — API list with rename / duplicate / archive + “Show archived”. Static-only mode disables those controls. Save still lives in `stubHud` and warns on boat ids missing from the catalogue.

| Helper (continued) | Role |
| --- | --- |
| `formatConnectionStatus` | Compact `ws=…` / `ws=n/a (mock|replay)` string for HUD status |
| `createMap2d()` | Top-down ENU East/North fleet panel (canvas 2D) + shared layout features; `focusEnu` / `setHiddenPoseIds` / `removePose` / `retainPoseIds` |
| `createStreamMap2d()` | Viewer-facing broadcast PiP map (~520px; CSS overlay; default hidden; HUD toggle) |
| `layoutFeatures` / `getLayoutFeatures` | Shared GPS→ENU world features (course/sponsors/flags adapters) |
| `startAssetInspector` | Assets sidebar: Focus / Show-3D / Show-2D / Details (11.7) |
| `startMapFeatureEditor` | V1 world editor: place/select/delete/export + GeoJSON I/O + **Save project**; remounts 3D (hosted in World Authoring workspace) |
| `createWorldAuthoringWorkspace` | Dedicated DOM authoring window (large 2D map + tool hosts); NDI-safe overlay |
| `mountWorldMapAuthoringLauncher` | World Map sidebar Open/Close authoring + status |
| `remountWorldFromFeatures` | Rebuild course/sponsors/flags from editable `WorldFeature[]` (skips `visible3d: false`) |
| `createBoatEntity()` | Pose root + glTF/procedural visual + billboard tag + visibility mode |
| `setBoatVisibilityMode` / `setBoatVisibilityModes` | Per-boat `solid` \| `ghost` \| `hidden` (8.6) |
| `setEnvironmentMode` / `getEnvironmentMode` | Scene dressing: `simple` \| `realistic` Gerstner sea+sky (13.2 / 14.2a); 14.2b wind via `windBus` inside the env handle |
| `setEnvironmentOpaqueClearSafe` | Gate realistic env: `true` only for opaque clears (`preview`) |
| `setTerrainEnabled` / `getTerrainEnabled` | Cesium ion World Terrain (14.1). Default **off**. Hidden when opaque-unsafe |
| `setTerrainAltitudeNudgeM` / `getTerrainAltitudeNudgeM` | Extra +Y metres after HAE reorientation (session nudge) |
| `setTerrainWaterDiscardYM` / `getTerrainWaterDiscardYM` | Height-fallback AMSL (m) for hiding Cesium water on tiles with no water mask (default +0.5). Auto-on only while realistic ocean is mounted |
| `setTerrainTilesLocked` / `getTerrainTilesLocked` | Freeze tile LOD once the shot is framed |
| `getTerrainCredits` / `setTerrainCreditsListener` | ion attribution strings for the **DOM** overlay (never WebGL / AR) |
| `setCalibrationOverlayEnabled` / `getCalibrationOverlayEnabled` | ENU grid + force-visible mark helpers for AR calib (13.7; default off) |
| `refreshCalibrationOverlay` | Rebuild overlay from layout store when enabled |
| `createBoatTag()` | Canvas sprite label + mast-top leader line (catalogue name + category tint, or `Boat {id}` stub) |
| `createDroneCamera()` | PerspectiveCamera + ENU apply |
| `createFreeCam()` | OrbitControls free look around ENU origin (ops preview only) |
| `boatIdAllowSet` / `isAllowedBoatId` / `formatBoatEnuStatus` | Fleet allow-list + HUD helpers |
| `povIdAllowSet` / `isAllowedPovId` / `formatPovStatus` / `resolvePovIdList` | POV allow-list + HUD helpers |
| `formatOpsViewStatus` / `isOpsViewMode` | HUD helpers for `view=follow\|free` |

Clear color stays dark preview; OUT owns chroma / transparent. Ambient + sun + cool fill + weak bounce so `MeshStandard` / glTF / buoy materials read on alpha and chroma plates.

## Calibration overlay (Phase 13.7)

Toggle via sidebar **Calib → Calibration overlay** (`setCalibrationOverlayEnabled`). Default **off**.
Renders an ENU grid (50 m / ±1 km), origin pole, and high-contrast helpers for marks/gates/start–finish/buoys
**regardless** of `visible3d` — lines/poles/labels only (safe with transparent clear). See
[`docs/ops/ar-calibration-overlay.md`](../../docs/ops/ar-calibration-overlay.md).

## Course + buoys (Phase 2.3 / 8.8 polish)

- Fixture: `public/fixtures/course/demo-istanbul.json` (config key `courseUrl`).
- Waypoints: `mark` | `gateLeft` | `gateRight` — see fixture README for schema + gate pairing (Unity name-prefix).
- **Water Y:** course lines and buoy bases forced to **`y = 0`** (Unity `waterSurfaceY`). Converted AMSL ENU `y` is ignored for graphics so Istanbul geoid offset does not float the course.
- Boundary: `LineLoop` through marks (fixture order). Gates: horizontal **tubes** (MeshStandard) per Left/Right pair. Buoys: float body + band + stem + cap + name sprites (gate ends use gate-colour accent).
- **Rounding arrows (15.3 / 16.5):** per-feature `rounding: 'cw' | 'ccw' | 'none'` on `mark` / `buoy` / `gateLeft` / `gateRight` (**omit = CW**). Explicit `'none'` hides the glyph. A procedural water-level ring (white torus + red heads, ~8 m radius) with **two** arrow heads spins in that sense. Clock is from **above the water** (look −Y): `cw` = clock = **negative** `rotation.y`. Shared clock (`performance.now` in `onBeforeRender`) so 3D NDI `directRender` still animates. Inspector Details: Off / CW / CCW (CW on an omitted field stays omitted; only CCW / Off persist).
- **Water / shore cue (8.8):** localized semi-transparent pads under course AABB (`WATER_CUE_DEFAULTS` in `course/waterCue.ts`) — not Cesium. Clear behaviour: see [`docs/ops/unity-asset-port.md`](../../docs/ops/unity-asset-port.md) + air runbook.
- **Realistic sea + sky (13.2 / 14.2 / 14.3e / 15.2 / 16.1):** Gerstner clipmap ocean + `Sky` (`src/scene/environment/`) behind Ops **environment** `simple` \| `realistic` (also `?env=realistic`). Default **`simple`**. Hard constraint: realistic meshes are **forced off** whenever the active clear is `transparent` or `chroma` (`setEnvironmentOpaqueClearSafe(false)`) so AR alpha plates stay clean. Course `waterCue` pad is **hidden** while the Gerstner ocean is mounted; `simple` keeps the pad. Wave time is a **shared clock** (`performance.now` in `onBeforeRender`), not accumulated `dt` on the preview tick — 3D NDI `directRender` still animates without an OUT pump change. **Wind coupling (14.2b):** `createRealisticEnvironment` subscribes to `windBus` (snapshot on create, unsubscribe on `dispose` / `scene.stop()`). `SceneHandle` has no extra wind methods — Ops publishes on the bus. Mapping is `directionFromDeg` → `windTravelSceneXZ` → `atan2` (do not re-derive from/to): from **000° travels +Z** (south), from **090° travels −X**. Direction and `speedMs` (foam + a mild clamped amplitude scale) **ramp ~3 s** on shortest arc so a 90° operator step is not a snap. Uncoupled Gerstner default remains −Z if `coupleWind: false`. **Clipmap (15.2):** default **inner 32×32** over ±48 m (~3 m) / **7 rings** / 24 seg. Inner 48→32 cuts near-field verts 49²→33²; rings stay at 7 so the rim (48×2^7 = 6144 m) stays past fogFar (5200). `seaQuality` **high** (default) vs **low** (Ops **sea** or `?sea=low`): low drops to **5 rings** (rim 1536 m — edge can show) + **quarter-res** shore foam. Coarser rings **overlap ≥ one finer cell** so T-junctions sit inside the denser patch (no white hairline seams). Follow remains per-pass `uClipmapCenter` (not `mesh.position.xz`). **Glitter / streaks / whitecaps (16.1):** single Blinn lobe at `glitterIntensity 0.16` / `glitterSharpness 78`; foam/streak/glitter masks sample a 256² tileable **mipmapped** noise texture in **world XZ**, with `fwidth()` edges and a distance+graze fade so far rings carry almost no high-frequency shading (no extra `readPixels`). **Shore foam (14.2c):** when terrain **and** realistic ocean are both mounted (opaque-clear only), one **half-res depth FBO** (low: quarter-res) of the Cesium tileset group is rendered just before the ocean (`onBeforeRender`). The Gerstner fragment reconstructs terrain world **Y** and adds foam + a shallow tint where neighbouring pixels are land. Terrain off / `simple` / transparent-chroma: no extra FBO. Cesium **water** is discarded in the tileset shader while the ocean is mounted, so the depth prepass sees land only; ocean lift is **0.08 m** (z-fight only). Extra cost: one terrain-only draw at ½ (or ¼) resolution per ocean-visible pass. **Wind streaks (14.3e, cranked 15.2):** the same Gerstner fragment scrolls a high-contrast anisotropic gust mask along `uDirectionRad` (from-000° → **+Z**). Intensity and scroll come from `setWindSpeed` / `speedMs` and fade to 0 below ~0.4 m/s. **3D vane (14.3f lite):** pole + two-sided arrow (`windVane.ts`) at a fixed origin offset (16, 12) m; yaw follows ramped travel; length scales with kt with a **minimum** so a set from-deg is never invisible. **Wind strings (14.3f / 16.2):** Windy-style streamlines (`windStrings.ts`) — ~180 short additive ribbons in an ~800 m disc around the camera, 4–10 m above water, drifting along the same ramped travel as swell/vane. Visible count / length / speed scale with `speedMs`; gone below ~0.5 m/s. One draw call; ticked from the ocean `onBeforeRender` so 3D NDI `directRender` animates. Inherits the realistic-env gate (ops preview + 3D NDI, never AR/chroma). No particles, flags, or spray.
- **Cesium ion terrain (14.1 / 16.1):** `src/scene/terrain/` streams **World Terrain** (ion asset `1`) plus optional **Bing Aerial** drape (asset `2`) via `3d-tiles-renderer` — not CesiumJS. Default **off** (Ops **terrain** `off` \| `on`, next to Environment). Token from Ops **ion token + Apply** → `public/config.json` (git-shared on this private repo), else session, else `VITE_CESIUM_ION_TOKEN`. Empty token → stays off with an Ops status line, no throw. Alignment: `ReorientationPlugin` + `amslToHae` height + **180° azimuth** so plugin X-west/Z-north matches scene **X east, Z −north**. Residual vertical error: Ops **nudge m** (session-only this slice). **Lock tiles** freezes LOD. Same opaque-clear gate as sea/sky — terrain never draws into transparent/chroma. Attribution is a **DOM** line on local **3D** focus only, never burned into the AR WebGL plate. **Water hide (16.1):** while realistic ocean is mounted, tile materials `discard` Cesium water (quantized-mesh water mask on `roughnessMap`; height fallback default +0.5 m AMSL via `setTerrainWaterDiscardYM`). `simple` env leaves terrain untouched. Ocean lift is 0.08 m for z-fight only. Shore foam (14.2c) depth-prepasses this group at half-res when realistic ocean is also mounted — discarded water no longer counts as land. VRAM budget: `UnloadTilesPlugin` `bytesTarget` **384 MiB**.
- Not `poseBus`-driven; dispose on `scene.stop()`.

## Sponsors (Phase 2.5)

- Fixture: `public/fixtures/sponsors/demo-istanbul.json` (config key `sponsorsUrl`) — **2–4** demo panels near the course.
- Schema: `a`/`b` GPS anchors + `heightM` + optional `textureUrl` / `label` / `color` / `panelColor` / `frameColor` — see fixture README.
- Placement: **`gpsToEnuAmsl` only**; panel baseline **water Y = 0** (same as course).
- Mesh: vertical quad spanning A↔B; **fixed** world orientation (not camera-billboard). Face normal = flatten(A→B) × up (left of A→B). Order points so the course is on the facing side.
- **Board (16.4):** every panel is a composed canvas — opaque background (default `#f4f4f2`), dark slate frame, then contain-fit `textureUrl` or procedural `label`. Optional additive `panelColor` / `frameColor`. Missing/failed texture → label on the same board (not a floating transparent logo). Demo logos under `public/textures/sponsors/` (Unity Sprites copy — see unity-asset-port).
- Dispose on `scene.stop()`. Full Unity Sponsors pack / BillboardChain tiling remain backlog.

## Start / finish line signs (Phase 8.5)

- Unity: `Start.prefab` / `Finish.prefab` + `BillboardBetweenTwoPoints` (flat water canvas).
- Web: `src/scene/lineSigns/` — textured horizontal band spanning A–B (or default east–west width for 1-point features).
- Demo: `public/fixtures/world/demo-istanbul-extras.json` merged at boot; editor tools **start** / **finish** are two-click A–B.
- Map draws red line segments + labels (no longer empty stub squares).

## Position markers (Phase 8.5 partial)

- Unity: `Distances.prefab` (TMP meter labels on water).
- Web: `src/scene/positionMarkers/` + `public/fixtures/markers/demo-istanbul.json`.
- Not yet a WorldFeature editor tool — fixture-only; see backlog in unity-asset-port.

## Countdown flags (Phase 2.6)

- Fixture: `public/fixtures/flags/demo-istanbul-countdown.json` (config key **`flagsUrl`**).
- Two GPS poles near the demo course gate: P1 shore (**white**), P2 committee (**orange** + **blue-white**).
- Timeline (Unity defaults): orange @ 6:00 → white @ 5:00 → blue-white up @ 4:00 → blue-white down @ 1:00 → freeze at 0:00.
- Placement: **`gpsToEnuAmsl` only**; pole baseline **water Y = 0**. Flags face the other point (yaw-only).
- World `MM:SS` sprite above P1; faces the render camera with mild distance scale (boat-tag spirit). Plate red while running, green at zero.
- Demo speed: fixture **`demoTimeScale: 20`** (~18 s for a 6-min sequence). Set `1` for real-time. HUD: Start / Pause / Reset / Restart.
- Procedural colored planes — no Unity FBX/PNG dump. Dispose on `scene.stop()`.

## Fleet registry (Phase 2.2 + 15.4)

- `startScene({ boatIds })` maintains `Map<string, BoatEntityHandle>`.
- On `poseBus` boat pose: ignore ids not in `boatIds`; otherwise create (clone 2.1 template + tag) then `applyPose`. Marks the id as live so planned GPS will not snap it back.
- After allow-list change / add-boat: `syncFleetHulls` ensures every allow-listed id has a mesh. Planned ENU from the Fleet row, or a default origin grid (offset by index). Map place uses click ENU via `upsertStaticBoat`.
- Soft race switch: `setFleetAllowLists` rebuilds the allow-set and disposes ids that leave the pack; new ids spawn on `syncFleetHulls` (or the next allowed pose).
- `frameFleet` counts spawned hulls (static or live) — no packets required.
- Each RAF: `orientOpsBillboards(previewCamera)` (boat tags + countdown plate). NDI dual-render re-orients for air before the FBO pass.
- `stop()` disposes all entities and clears the map.
- Names/colours: **2.7** catalogue via `boatNamesUrl` (see below).

## Boat names / colours (Phase 2.7 + 8.3)

- Fixture: `public/fixtures/boats/demo-istanbul-names.json` (config key **`boatNamesUrl`**).
- Schema: Unity `BoatNameAssigner` nested map — category → `{ "<id>": "<name>" }` (covers default `21`–`24`).
- Colour from category Turkish keywords (`pembe`/`mavi`/`sarı`/`sari`/`yeşil`/`yesil`/`turuncu`; else white) **unless** the fleet row has an explicit palette `color`. Optional `_color` / per-entry hex overrides in the names JSON.
- Boot: `loadBoatNamesFromUrl` before TEL; `ensureBoat` resolves on create; late load / Fleet upsert re-applies via `setTagIdentity` (tag canvas + **hull tint** + **map dots**).
- Unknown id → stub `Boat {id}` / neutral plate; hull keeps procedural default; map dot uses orange fallback.
- **Hull / sail tint (8.3 + 16.3):** catalogue `#rrggbb` applied to procedural hull (`userData.categoryTint`) and a lighter sail fabric (`userData.sailTint`). See `src/assets/tintBoatVisual.ts` + `src/assets/README.md`.
- **Category palette (16.3):** Fleet row colour `<select>` (~10 presets) → `upsertBoatName({ color })`. Persisted as additive `fleet.boats[].color`.
- **Nametag leader (16.3):** line from named `mastTop` (glTF: bounding-box top) to the tag plate; hidden with the tag (ghost/hidden unchanged).
- **Map dots (8.3):** same id→colour via `map.setBoatDotColors(boatColorsFromCatalogue(…))` from `main` after load / Fleet edits.
- **Pack persist (15.4 + 16.3):** RaceProject `fleet.boats` stores id/name/category/`color`/visibility/map/planned GPS. Load rebuilds the Fleet panel from that array (names URL is fallback). sessionStorage is a tab cache only.
- Details: [`boatNames/README.md`](./boatNames/README.md).

## Ghost / invisible boats (Phase 8.6)

Per-boat draw mode: **`solid`** | **`ghost`** | **`hidden`** (`BoatVisibilityMode`).

| Mode | 3D hull | Tag | Water ring | Map dot |
| --- | --- | --- | --- | --- |
| `solid` (default) | opaque | yes | no | tracks |
| `ghost` | translucent (`GHOST_HULL_OPACITY`) | yes | yes (category tint) | tracks |
| `hidden` | off | off | no | **still tracks** (ops choice) |

- Ops: Fleet / Live row select → `scene.setBoatVisibilityMode` (sessionStorage via `FleetBoatRow.visibility`).
- Soft RaceProject field: `fleet.boatVisibility` `{ "<id>": "ghost"|"hidden"|… }` — invalid entries dropped; omitted → solid.
- Independent 2D map hide (11.7): `FleetBoatRow.mapVisible` / `fleet.boatMapVisible` — `false` hides the map icon while 3D mode is unchanged.
- Pose updates continue in all modes; hidden boats do not draw a hull on air/preview.
- Unity sibling had no dedicated ghost script in-tree; web mirrors the ops intent (transparent / icon-only tracking).

## Multi-POV switch (Phase 2.4)

- `startScene({ povIds })` caches last `poseBus` drone pose per id ∈ `povIds`.
- Only **`activePovId`** (default `povIds[0]`) drives the **air** Three `PerspectiveCamera` (`getActivePovCamera` / `scene.camera`).
- `setActivePovId(id)` switches immediately using the cached pose when available (no wait for next packet). Does **not** leave free-cam preview mode. Optional `onActivePovChange(id)` fires after a real change (and after allow-list clamp) so OUT can swap the warm video texture and TEL can `tick(0)` resample at the new LUT + presented PTS — camera and video move together, no black frame.
- Soft race switch: `setFleetAllowLists` updates `povIds`, drops cached poses for removed ids, and clamps `activePovId` into the new list (HUD/calib sync via `setPovIds`).
- Deprecated `droneId` remains as a single-id / initial-active alias when needed.
- Cam ids `11`/`12` use the same `kind: 'drone'` path when listed in `povIds` — no second pipeline.
- HUD: POV select (labels = raw id; **not** 2.7 names) + status `pov=<id>  seen=…`; optional digit keys `1`–`4`.
- Boat tags / countdown plates: on-screen → **preview** camera (free or follow); NDI air FBO → **active POV** when dual-rendering. Frustum gizmos for inactive POVs are out of this slice.
- TEL must emit ≥2 POV ids on mock for a visible switch demo (`HO-SCN-TEL-20260727-01`).

## Ops free cam (preview vs air)

- HUD **view** select: **Follow active POV** (default) | **Free cam**.
- **Free cam:** OrbitControls on the WebGL canvas (drag orbit, right-drag/pan, wheel zoom) around ENU origin — works even when drone telemetry is idle.
- **Follow:** on-screen preview uses the active POV pose again (`1`–`4` / Fleet **Cam** / POV select).
- Free cam does **not** mutate `activePovId` — air selection stays with POV switch / Fleet Cam.
- Status line includes `view=follow` or `view=free`.
- **OUT / NDI:** `getActivePovCamera()` is the air source; screen may use `getPreviewCamera()`. NDI dual-renders air when preview ≠ air (`startNdiFramePump({ getAirCamera, prepareCameraPass })`). See `src/output/README.md` § Air camera lock.
- **Billboard pass contract:** sprites auto-face the WebGL camera; distance scale must match that same camera. Tick orients for preview; NDI `prepareCameraPass` orients for air then preview again.

### Manual checklist (free cam + NDI billboards)

1. **Follow:** `view=follow` — tags readable on screen; sizes match active POV.
2. **Free cam:** switch to Free cam, orbit away — on-screen tags face/scale to free look (not stuck on drone POV size).
3. **NDI dual-render (Electron):** with Free cam on screen, NDI plate still shows **active POV** framing; tags on NDI are sized for that air cam (not free-cam distance).
4. **POV switch:** change active cam (`1`–`4` / Fleet Cam) while Free cam is on — NDI framing + tag scale follow the new active POV; preview stays free.
5. **Back to Follow:** preview and air share one camera again; tags stay sane.

## Boat + tag (Phase 2.1 template)

- Visual: loads `/models/boat.glb` (cached, cloned per entity); procedural multi-mesh fallback if load fails. See `src/assets/README.md` for axis offset + **category hull tint**.
- Tag: sprite billboard (auto-faces camera) with mild distance scale (Unity `BoatTagRotation` spirit). Catalogue name + category tint when **2.7** loaded; else stub `Boat {id}`.

## Stub HUD + 2D map

- **HUD:** mode select (`mock` / `replay` / `live`) restarts TEL ingest via `onModeChange`. POV select lists `povIds` and calls `onPovChange` → scene `setActivePovId` (and calib device sync in `main`). **View** select: Free cam | Follow active POV → `onOpsViewChange` → `scene.setOpsViewMode` (does not change air POV). Countdown Start / Pause / Reset / Restart → `onCountdownControl` → scene `controlCountdown`. **Authoring** checkbox mirrors World Authoring workspace open state (primary: World Map → Open authoring; `?editor=1|0` override). **Stream map** checkbox (default **off**) toggles the viewer-facing broadcast PiP map. Status shows mode, TEL counts, **connection line** (`ws drone=… boat=…` in live via `setConnectionStatus`, or `ws=n/a (mock|replay)` — never fake `open`), `pov=<active>  seen=…  view=follow|free`, last active-drone ENU, and a multi-boat ENU line (`boats=N  21=(…) 22=(…)` truncated if long).
- **Ops map:** small top-right panel; plots `position.x` (East) vs `position.z` (North), north-up; auto-fits bounds to recent points + shared layout features (marks, gates, sponsors, flags, S/F). Boat **sail icons** (Unity `tekne_yeni` tinted by catalogue colour, yaw from pose `brg`; procedural fallback). Drones stay cyan circles. Editor click tools attach here. **Wind readout (14.3d):** both ops and stream maps subscribe to `windBus` (snapshot + `subscribe`, no Open-Meteo fetch). Arrow is **travel** via `windTravelSceneXZ` (from-000° → screen-down on the north-up map; from-090° → screen-left); label stays meteorological **`from NNN° · XX kt`**. Ops: dense top-left pill. Stream: larger bottom-left pill (clear of the north compass; readable on `broadcast-web-2d` / 1920×1080 letterbox). Default/stale frames still draw (slightly lower opacity).
- **Fleet ↔ map sync:** Live/Fleet delete/rename prunes ops + stream map icons via `retainPoseIds` (buoy poses kept). HUD pose subscribe ignores boat/drone ids outside the current allow-lists so mock/live cannot re-add ghosts. World Authoring place-boat/drone seeds an icon at click ENU immediately (planned lat/lon on the fleet row) without waiting for telemetry.
- **Stream map (Phase 8.1 + 8.7 + Phase 11 broadcast graphic):** larger CSS-overlay PiP (`createStreamMap2d`, **520px**, top-left when shown). Shares layout/fleet data with ops via `createMap2d` + `mapChrome`, but **`variant: 'stream'`** gets a distinct broadcast look — framed card CSS, race-name title strip (`setTitle` from loaded project), larger icons/labels, water vignette, north compass ring. Ops/authoring map stays utilitarian (unchanged). **Not** a Three.js HUD — never steals WebGL / NDI air POV. Default hidden (air clutter). Manual check: toggle on in preview → polished graphic with course + coloured sailboats; free cam / POV switch unchanged; NDI still active POV.

### Map chrome checklist (Phase 8.7)

1. Mock demo: boats 21–24 show sailboat icons in category colours (not flat squares); heading rotates with pose.
2. Start/finish segments: thicker red bars + **START/FINISH** label pills; gate lines dashed.
3. Toggle **Stream map** — broadcast graphic (larger icons, compass, framed card); ops map still small utilitarian top-right. Both show the wind travel arrow + from/kt (Ops **wind** row drives `windBus`).
4. Place editor **arrow** / **rotation** — chevron or curved glyph (Unity CW/RCW PNG port deferred; see `docs/ops/unity-asset-port.md`).
5. No tile basemap.
- **World editor (4.2 / 4.4):** see `src/scene/features/README.md` — place/edit/delete features on the map; ENU→GPS via GEO `enuToGpsAmsl`; export `world-features.json`; **Import/Export GeoJSON** (geojson.io); remounts 3D course/sponsors/flags. No DB.

### Stream map + OUT compositing

| Path | Stream map visible? |
| --- | --- |
| Preview (ops) | Yes when HUD toggle on |
| Chrome chroma (window capture) | Yes when toggle on (opaque DOM plate over green — may need key/crop care) |
| Electron alpha NDI | **No** — NDI is WebGL `readPixels` only; DOM PiP is not burned in |

**OUT flag:** if the stream map must appear on the NDI / transparent plate, burn it into WebGL (or another capture path). SCN owns the graphic; OUT owns plate compositing.

## Camera convention

Pose rotations are Unity-style (camera forward **+Z**). Three.js `PerspectiveCamera` looks along **−Z**, so `createDroneCamera` right-multiplies a 180° Y flip when applying pose attitude. Boat meshes use the pose quaternion as-is (object forward +Z).
