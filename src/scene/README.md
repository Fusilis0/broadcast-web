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
`startAssetInspector` (11.7 / 19.7) lists every boat/POV/feature with Focus / Show-3D / Show-2D / Details (lat/lon/alt/height; drone pose GPS read-only).
NDI AR never reads this DOM (`ndiFramePump` / WebGL only). Channel `'2d'` samples
the stream-map canvas bitmap separately (`streamMapNdiPump`). Text prompts (billboard texture/spacing,
boat/drone/buoy ids) use shared `promptModal` in `src/ui/` — Electron rejects `window.prompt()`.

## Boot

`main.ts` creates the ops sidebar → `startStubHud({ hosts })` → loads config → `startScene({ boatIds, povIds })` → **`loadBoatNamesFromUrl(boatNamesUrl)`** → EGM96 → origin → **`loadCourseFromUrl(courseUrl)`** → **`loadSponsorsFromUrl(sponsorsUrl)`** → **`loadCountdownFlagsFromUrl(flagsUrl)`** → TEL ingest → `startPosePipeline` → HUD mode + POV select. HUD boots early for status; scene waits on `loadConfig()` so allow-lists are known.

**World anchor (Unity GeoOrigin):** `config.origin` `{ lat, lon, altMsl }` is ENU `(0,0,0)`. HUD **origin** fields show the active values after boot/deeplink/race load; **Apply** updates runtime config → `applyConfigOrigin` → remounts world features so boats/course shift in ENU together. Save project embeds the current origin via `buildRaceProject`.

**Soft race switch** (`switchRace` / Load / `?race=` after boot): `scene.setFleetAllowLists({ boatIds, povIds })` replaces allow-lists without recreating WebGL — orphan boats leave the registry, POV pose cache is pruned, active POV is clamped; then HUD/calib `setPovIds` + fleet/Assets lists. Packed Load paints chrome + 2D + lists, yields a frame, then remounts 3D (`remountGen` aborts stale work). Ingest restarts after `fleetPanel.setState` (not awaited in front of lists). First-boot `?race=` still passes pack lists into `startScene` directly and **awaits** remount.

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

**Project section (Phase 11.4 + 19.9):** `startProjectManagerPanel` (PLT) mounts above Load/Save in the sidebar Project section — API list with rename / duplicate / archive + “Show archived”. Static-only mode disables those controls. Save still lives in `stubHud` and warns on boat ids missing from the catalogue. Load dropdown pick copies the pack id only; **Load** / Enter applies the full pack via one `switchRace` (Electron folderMode included). Last-action text under the Save/Load row (`data-ops="save-status"`): `loading` → `loaded`, `saving` → `saved`, or a short error — no modal.

| Helper (continued) | Role |
| --- | --- |
| `formatConnectionStatus` | Compact `ws=…` / `ws=n/a (mock|replay)` string for HUD status |
| `createMap2d()` | Top-down ENU East/North fleet panel (canvas 2D) + shared layout features; `focusEnu` / `setHiddenPoseIds` / `removePose` / `retainPoseIds` |
| `createStreamMap2d()` | Viewer-facing 16:9 race map (1920×1080 source; off-screen for 2D NDI; local 2D host + Boat size slider) |
| `layoutFeatures` / `getLayoutFeatures` | Shared GPS→ENU world features (course/sponsors/flags adapters) |
| `startAssetInspector` | Assets sidebar: Focus / Show-3D / Show-2D / Details (11.7) |
| `startMapFeatureEditor` | World editor: map click + coordinate **Add/Edit**, inspector fields, GeoJSON I/O + **Save project**; remounts 3D (hosted in World Authoring) |
| `createWorldAuthoringWorkspace` | Dedicated DOM authoring window (large 2D map + tool hosts); NDI-safe overlay |
| `mountWorldMapAuthoringLauncher` | Compact Race setup header **World** toggle (open/close workspace) |
| `remountWorldFromFeatures` | Rebuild course/sponsors/flags/chains from `WorldFeature[]`; `[]` disposes leftover 3D (skips `visible3d: false`). Logs remount gen + `webglcontextlost`. Chains are continuous ribbons (few textures), not ~1k discrete canvases — Load remount must not OOM the GL context. Packed **Load** paints 2D/lists first, then remounts (stale gen abort). |
| `createBoatEntity()` | Pose root + glTF/procedural visual + billboard tag + visibility mode + foam wake |
| `setBoatVisibilityMode` / `setBoatVisibilityModes` | Per-boat `solid` \| `ghost` \| `hidden` (8.6) |
| `setBoatHeightM` | Uniform hull scale from boat `heightM` (omit → 1). Alt MSL is pose ENU y, not scale. |
| `setEnvironmentMode` / `getEnvironmentMode` | Scene dressing: `simple` \| `realistic` Gerstner sea+sky (13.2 / 14.2a); 14.2b wind via `windBus` inside the env handle |
| `setEnvironmentOpaqueClearSafe` | Gate realistic env: `true` only for opaque clears (`preview`) |
| `setTerrainEnabled` / `getTerrainEnabled` | Cesium ion World Terrain (14.1). Default **off**. Hidden when opaque-unsafe |
| `setBuildingsEnabled` / `getBuildingsEnabled` | Cesium OSM Buildings (20.1a, ion **96188**). Default **on**. Same opaque-clear gate. Independent of terrain on/off |
| `setHeroesEnabled` / `getHeroesEnabled` | Named historic landmarks (20.1b). Default **on**. Same opaque-clear gate. Off hides meshes and clears occupancy holes |
| `setOccupancyHoles` / `getOccupancyHoles` | ENU disks `{x,z,radiusM}` clipping OSM Buildings only (filled by hero landmarks). Default `[]` |
| `setTerrainAltitudeNudgeM` / `getTerrainAltitudeNudgeM` | Extra +Y metres after HAE reorientation (session nudge) |
| `setTerrainWaterDiscardYM` / `getTerrainWaterDiscardYM` | Height-fallback AMSL (m) for hiding Cesium water on tiles with no water mask (default +0.5, clamp **−20…+5**). Ops label **Cesium hide m**. Auto-on only while realistic ocean is mounted |
| `setSeaHeightYM` / `getSeaHeightYM` | Environment **sea m** (−20…+20, default 0). Moves Gerstner rest Y + shared water-plane Y (wakes). Does **not** change Cesium tile discard. Assets with Alt MSL stay put |
| `setTerrainTilesLocked` / `getTerrainTilesLocked` | Freeze tile LOD once the shot is framed |
| `setTerrainOverlay` / `getTerrainOverlay` | Bing **Aerial** ion **2** vs Bing **Road** ion **4** on World Terrain **1** (default **aerial**). Remounts terrain only — not OSM Buildings. Rec.709 grey filter removed. |
| `getTerrainCredits` / `setTerrainCreditsListener` | ion attribution strings for the **DOM** overlay (never WebGL / AR) |
| `setCalibrationOverlayEnabled` / `getCalibrationOverlayEnabled` | ENU grid + force-visible mark helpers for AR calib (13.7; default off) |
| `refreshCalibrationOverlay` | Rebuild overlay from layout store when enabled |
| `createBoatTag()` | Canvas sprite rectangle (catalogue name + category tint, or `Boat {id}` stub) |
| `createDroneCamera()` | PerspectiveCamera + ENU apply |
| `createFreeCam()` | OrbitControls free look around ENU origin (ops preview only) |
| `boatIdAllowSet` / `isAllowedBoatId` / `formatBoatEnuStatus` | Fleet allow-list + HUD helpers |
| `povIdAllowSet` / `isAllowedPovId` / `formatPovStatus` / `resolvePovIdList` | POV allow-list + HUD helpers |
| `formatOpsViewStatus` / `isOpsViewMode` | HUD helpers for `view=follow\|free` |

Clear color stays dark preview; OUT owns chroma / transparent. Ambient + sun + cool fill + weak bounce so `MeshStandard` / glTF / buoy materials read on alpha and chroma plates.

- **Cinematic sequences (Phase 21):** `src/scene/cinematics/` — JSON player, locked 30 Hz clock, globe vs ENU tiles, country pins (globe only), hide-race, cloud overlay. Ops **Cinematics** row. Catalogue: `intro-bosphorus` (60 s) + `_empty` (2 s fixture). Not MP4 (OUT).

## Calibration overlay (Phase 13.7)

Toggle via sidebar **Calib → Calibration overlay** (`setCalibrationOverlayEnabled`). Default **off**.
Renders an ENU grid (50 m / ±1 km), origin pole, and high-contrast helpers for marks/gates/start–finish/buoys
**regardless** of `visible3d` — lines/poles/labels only (safe with transparent clear). See
[`docs/ops/ar-calibration-overlay.md`](../../docs/ops/ar-calibration-overlay.md).

## Course + buoys (Phase 2.3 / 8.8 polish)

- Fixture: `public/fixtures/course/demo-istanbul.json` (config key `courseUrl`).
- Waypoints: `mark` | `gateLeft` | `gateRight` — see fixture README for schema + gate pairing (Unity name-prefix).
- **Water Y:** course lines and buoy bases use **GEO `enu.y`** from Alt MSL (do not force `y = 0`). Origin Apply remounts for geoid. Environment **sea m** moves the ocean under assets.
- Boundary: `LineLoop` through marks (fixture order). Gates: horizontal **tubes** (MeshStandard) per Left/Right pair. Buoys: float body + band + stem + cap + name sprites (gate ends use gate-colour accent).
- **Rounding arrows (15.3 / 16.5):** per-feature `rounding: 'cw' | 'ccw' | 'none'` on `mark` / `buoy` / `gateLeft` / `gateRight` (**omit = CW**). Explicit `'none'` hides the glyph. A procedural water-level ring (white torus + red heads, ~8 m radius) with **two** arrow heads spins in that sense. Clock is from **above the water** (look −Y): `cw` = clock = **negative** `rotation.y`. Shared clock (`performance.now` in `onBeforeRender`) so 3D NDI `directRender` still animates. Inspector Details: Off / CW / CCW (CW on an omitted field stays omitted; only CCW / Off persist).
- **Buoy mesh / tag (DSP-06):** additive `visibleBuoyMesh` / `visibleTag` (omit = on) on the same types. Mesh off keeps the tag; tag off keeps the float. `visible3d: false` hides mesh + tag + arrows. 2D map dots stay on `visible2d` only. Assets Details + authoring inspector: Full 3D / Buoy mesh / Tag checkboxes + existing rounding.
- **Water / shore cue (8.8):** localized semi-transparent pads under course AABB (`WATER_CUE_DEFAULTS` in `course/waterCue.ts`) — not Cesium. Clear behaviour: see [`docs/ops/unity-asset-port.md`](../../docs/ops/unity-asset-port.md) + air runbook.
- **Realistic sea + sky (13.2 / 14.2 / 14.3e / 15.2 / 16.1 / 19.15):** Gerstner clipmap ocean + `Sky` (`src/scene/environment/`) behind Ops **environment** `simple` \| `realistic` (also `?env=realistic`). Default **`simple`**. Hard constraint: realistic meshes are **forced off** whenever the active clear is `transparent` or `chroma` (`setEnvironmentOpaqueClearSafe(false)`) so AR alpha plates stay clean. Course `waterCue` pad is **hidden** while the Gerstner ocean is mounted; `simple` keeps the pad. Wave time is a **shared clock** (`performance.now` in `onBeforeRender`), not accumulated `dt` on the preview tick — 3D NDI `directRender` still animates without an OUT pump change. **Flat sea (DSP-04-01 / 04-02 / 04-03 / 04-04 / 04-05 / 04-06 / 04-07 / 04-08):** `displacementScale` defaults to **0** (no vertex bounce); fragment Gerstner uses **`uShadingWaves`** (authored × wind, not × disp) for animated N / foam / glitter so the plane moves without burying boards and without a camera-locked half-screen Blinn terminator. Trough/crest albedo from fragment `waveHeight` (same train as foam); gust albedo curtains retired; quieter foam (`foamColor` `0x9ab0bc`, crest × 0.38, mix cap 0.55); near-field dark deep water `0x0c2f3a` / shallow `0x164a55`, horizon+fog `0x2a4a52` (not 04-06 bright cyan), nadir fresnel floor **0**; gentler troughs (`OCEAN_TROUGH_DEFAULTS` 0.82 / 0.48); softer sheen/glitter/fade (`OCEAN_SHEEN_DEFAULTS` 3.5 / 0.1, glitter 78 / 0.1, detail fade 40–1600 m). **Look (04-08 Fail):** `OCEAN_LOOK_XZ_SCALE` **1/9** (wavelengths 48→5.33 … 7→0.78; streak/noise UV ×9 — not the first 04-08 ×3). Clipmap extent unchanged. Fragment shading does **not** flatten under board footprints (those mats painted rectangular plates). Environment **sea m** (−20…+20) moves Gerstner rest Y + water-plane wakes; **Cesium hide m** (was water m) only tiles. Asset **Alt MSL** uses GEO `enu.y` (layout/course/boards). Fragment ocean **discard** holes retired. **Wind coupling (14.2b):** `createRealisticEnvironment` subscribes to `windBus` (snapshot on create, unsubscribe on `dispose` / `scene.stop()`). `SceneHandle` has no extra wind methods — Ops publishes on the bus. Mapping is `directionFromDeg` → `windTravelSceneXZ` → `atan2` (do not re-derive from/to): from **000° travels +Z** (south), from **090° travels −X**. Direction and `speedMs` (foam + a mild clamped amplitude scale) **ramp ~3 s** on shortest arc so a 90° operator step is not a snap — vertex amp still × `displacementScale` (0 → flat); shading amp follows wind. Uncoupled Gerstner default remains −Z if `coupleWind: false`. **Clipmap (15.2):** default **inner 32×32** over ±48 m (~3 m) / **7 rings** / 24 seg. Inner 48→32 cuts near-field verts 49²→33²; rings stay at 7 so the rim (48×2^7 = 6144 m) stays past fogFar (5200). `seaQuality` **high** (default) vs **low** (Ops **sea** or `?sea=low`): low drops to **5 rings** (rim 1536 m — edge can show) + **quarter-res** shore foam. Coarser rings **overlap ≥ one finer cell** so T-junctions sit inside the denser patch (no white hairline seams). Follow remains per-pass `uClipmapCenter` (not `mesh.position.xz`). **Glitter / streaks / whitecaps (16.1 / DSP-04-02…04-08):** Blinn on **fragment-perturbed N** at `glitterIntensity 0.1` / `glitterSharpness 78` plus a **wide sky-tinted sheen** (`OCEAN_SHEEN_DEFAULTS` 3.5 / 0.1) with fwidth-softened lobes so lighting ramps — do not raise glitter. Crest foam travels quieter. Foam/streak/glitter masks sample a 256² tileable **mipmapped** noise texture in **world XZ**, with `fwidth()` edges and a distance+graze fade so far rings carry almost no high-frequency shading (no extra `readPixels`). **Shore foam (14.2c):** when terrain **and** realistic ocean are both mounted (opaque-clear only), one **half-res depth FBO** (low: quarter-res) of the Cesium tileset group is rendered just before the ocean (`onBeforeRender`). The Gerstner fragment reconstructs terrain world **Y** and adds foam + a shallow tint where neighbouring pixels are land. Terrain off / `simple` / transparent-chroma: no extra FBO. Cesium **water** is discarded in the tileset shader while the ocean is mounted, so the depth prepass sees land only; ocean lift is **0.08 m** (z-fight only). Extra cost: one terrain-only draw at ½ (or ¼) resolution per ocean-visible pass. **Platform flatten (19.15):** optional local flatten under start/finish/sponsor footprints when displacementScale > 0; fragment discard removed after Fail. **Wind streaks (14.3e, cranked 15.2, muted 04-03):** the same Gerstner fragment still scrolls an anisotropic gust mask along `uDirectionRad` (from-000° → **+Z**) to chop glitter only — **no albedo curtains**. Intensity and scroll come from `setWindSpeed` / `speedMs` and fade to 0 below ~0.4 m/s. **3D vane (14.3f lite):** pole + two-sided arrow (`windVane.ts`) at a fixed origin offset (16, 12) m; yaw follows ramped travel; length scales with kt with a **minimum** so a set from-deg is never invisible. **Wind strings (14.3f / 16.2):** Windy-style streamlines (`windStrings.ts`) — ~180 short additive ribbons in an ~800 m disc around the camera, 4–10 m above water, drifting along the same ramped travel as swell/vane. Visible count / length / speed scale with `speedMs`; gone below ~0.5 m/s. One draw call; ticked from the ocean `onBeforeRender` so 3D NDI `directRender` animates. Inherits the realistic-env gate (ops preview + 3D NDI, never AR/chroma). No particles, flags, or spray.
- **Cesium ion terrain (14.1 / 16.1 / DSP-05):** `src/scene/terrain/` streams **World Terrain** (ion asset `1`) plus a draped imagery overlay via `3d-tiles-renderer` — not CesiumJS, not Google Photorealistic, not Google 2D. Default overlay is **Bing Aerial** (ion **2**) — satellite. Ops **map** `road` \| `aerial` (session `bw.terrain.overlay`, default **aerial**) remounts the terrain handle with overlay **4** or Bing Aerial **2**; leftover `bw.terrain.imageryLook` is ignored. Rec.709 grey luma is **removed**. Default **off** (Ops **terrain** `off` \| `on`, next to Environment). Token from Ops **ion token + Apply** → `public/config.json` (git-shared on this private repo), else session, else `VITE_CESIUM_ION_TOKEN`. Empty token → stays off with an Ops status line, no throw. If Road **4** 401s or is not `IMAGERY`, status + warn and fall back to Aerial **2** for that session. Alignment: `ReorientationPlugin` + `amslToHae` height + **180° azimuth** so plugin X-west/Z-north matches scene **X east, Z −north**. Residual vertical error: Ops **nudge m** (session-only this slice). **Lock tiles** freezes LOD. Same opaque-clear gate as sea/sky — terrain never draws into transparent/chroma. Race 3D ticks tiles from the **preview** camera only (a parked drone at the origin would pin SSE to a few tiles). Terrain and OSM each get their own LRU/download queues. Attribution is a **DOM** line on local **3D** focus only, never burned into the AR WebGL plate. **Water hide (16.1):** while realistic ocean is mounted, tile materials `discard` Cesium water (quantized-mesh water mask on `roughnessMap`; height fallback default +0.5 m AMSL via `setTerrainWaterDiscardYM`). `simple` env leaves terrain untouched. Ocean lift is 0.08 m for z-fight only. Shore foam (14.2c) depth-prepasses this group at half-res when realistic ocean is also mounted — discarded water no longer counts as land. VRAM budget: `UnloadTilesPlugin` `bytesTarget` **384 MiB**.
- **Cesium OSM Buildings (20.1a / 20.1c / DSP-03):** `src/scene/buildings/` is a **second** `TilesRenderer` (ion asset **96188**, batched 3D Tiles — no quantized-mesh, no Bing drape). Same token, reorient, nudge, lock-tiles, and opaque-clear gate as terrain. `GLTFExtensionsPlugin({ rtc: true })`, `loadSiblings = false`, `errorTarget = 16` (ADD+REGION globe). Occupancy shader skipped when holes are empty. Ops **buildings** checkbox default **on** (`bw.buildings.enabled`). Credits merge into the 3D DOM overlay (ODbL fallback **© OpenStreetMap contributors**). Status line: `Buildings: on · tiles N` / `ion load failed`. `setOccupancyHoles` clips ENU disks for hero glTF. VRAM budget **256 MiB**. DSP-01 drew terrain only (no volumes) until this load-path fix.
- **Hero landmarks (20.1b / DSP-03 pack):** `src/scene/landmarks/` — operator glTF at GPS (`gpsToEnuAmsl`, `altMsl` 0). Rumeli Hisarı is SKP `hisar2`. Maiden’s Tower is the CC-BY Sketchfab mesh (local ~98 MB; not git). Galata is the small SKP, not the 419 MB photogrammetry. Occupancy disks into OSM Buildings (bridges **80 m**). Ops **heroes** checkbox default **on**. Same opaque-clear gate (never AR/chroma). Residual bury/float is GEO. See `public/models/landmarks/LICENSE.md`.
- Not `poseBus`-driven; dispose on `scene.stop()`.

## Sponsors (Phase 2.5)

- Fixture: `public/fixtures/sponsors/demo-istanbul.json` (config key `sponsorsUrl`) — **2–4** demo panels near the course.
- Schema: `a`/`b` GPS anchors + `heightM` + optional `textureUrl` / `label` / `color` / `panelColor` / `frameColor` / `panelAlpha` / `boardAspect` — see fixture README.
- Placement: **`gpsToEnuAmsl` only**; board on water at **GEO midY + 0.08** (Alt MSL lifts). Shared helper `waterPlanePlacement.ts`. Environment **sea m** lowers the ocean under boards.
- Mesh: **flat** quad. GPS A–B is the along-water canvas; across-water is A–B / aspect (2), **not** inspector `heightM`. `heightM` scales the glyph inside that canvas (clamped — 100/120 m packs do not grow a slab). World Y is water + 0.08, never `heightM/2` on flat. Normal points **up**. Logo/text reads along A→B. `billboardChain` is a separate continuous upright **ribbon** along the polyline (not discrete framed boards).
- **Board (16.4 / 19.11 / 19.7 / 04-04 … 04-08):** **Flat sponsors** default **no plate** (`panelAlpha` omit → 0): logo/text only, water through; skip fill+frame when alpha ≈ 0. When the plate is off, compose **luminance-keys near-black** PNG pixels to alpha 0 (soft edge) **and zeros RGB where alpha is 0** (library holes are `(255,255,255,0)`, not black), then **crops canvas + mesh to the opaque glyph AABB** so a full-board transparent quad cannot remain. Water-plane `CanvasTexture` **mipmaps off** (`LinearFilter`) + `alphaTest` 0.05 + **`fog: false`**. Inspector slider restores a plate (no knockout; plate fill OK; full plate mesh). Chosen Library `textureUrl` is contain-fit — the name/label is **not** burned on the mesh. Omit `panelColor` → `#f4f4f2`. **Billboard chains** keep opaque plate (omit `panelAlpha` → 1) and omit `panelColor` → bluish `#2A6FA6`; empty logos → solid coloured ribbon; logos on the ribbon also knock out black boxes. Chain `logos[]` integer weights use weighted fair interleave (`3:2` → AABAB) along U. `spacingM` = logo pitch on the strip; `heightM` scales **vertical** size only (logo aspect locked). Library picker: `src/scene/sidebar/libraryLogoPicker.ts`. Demo logos under `public/textures/sponsors/` and Library `public/assets/library/`.
- Dispose on `scene.stop()`. Full Unity Sponsors pack / BillboardChain tiling remain backlog.

## Start / finish line signs (Phase 8.5)

- Unity: `Start.prefab` / `Finish.prefab` + `BillboardBetweenTwoPoints` (flat water canvas).
- Web: `src/scene/lineSigns/` — textured horizontal band spanning A–B (or default east–west **100 m** for 1-point features). Across-water depth **24 m**. Texture is a **full-width line above** the START/FINISH letters (no solid plate, no glyph crop); water-plane canvas **mipmaps off**; material **`fog: false`**.
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
- After allow-list change / add-boat: `syncFleetHulls` ensures every allow-listed id has a mesh. Planned ENU from the Fleet row **including GEO `y` from Alt MSL** (`gpsToEnuAmsl` in `main` — do not force `y: 0`), or a default origin grid (offset by index). Map place uses click XZ + GEO y at alt 0 via `upsertStaticBoat`. Boat **`heightM`** is uniform hull scale (omit → 1); independent of Alt MSL. Environment **Cesium hide m** terrain-discard range **−20…+5** (default 0.5). Environment **sea m** (−20…+20) moves the Gerstner ocean.
- Soft race switch: `setFleetAllowLists` rebuilds the allow-set and disposes ids that leave the pack; new ids spawn on `syncFleetHulls` (or the next allowed pose).
- `frameFleet` counts spawned hulls (static or live) — no packets required.
- Each RAF: `orientOpsBillboards(previewCamera)` (boat tags + countdown plate). NDI dual-render re-orients for air before the FBO pass.
- **Foam wake (19.13):** each moving hull gets a short additive strip on the water (`y ≈ 0.05`, 8–12 m, fade ~2.5 s toward the tail). Not Gerstner. Hidden hulls skip it; ghost is fainter. Ticked from the existing scene clock (`tickWake`). Not on the 2D map.
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
- **Nametag (16.3, rectangle plate):** sprite sits above named `mastTop` (glTF: bounding-box top); hidden mode keeps the tag. No pennant / leader triangle.
- **Map dots (8.3 + 19.2b):** same id→colour via `map.setBoatDotColors(boatColorsFromCatalogue(…))` from `main` after load / Fleet edits. Stream fleet pills use `setBoatNames(boatNamesFromCatalogue(…))` (21 → Bora); ops map still shows ids.
- **Pack persist (15.4 + 16.3):** RaceProject `fleet.boats` stores id/name/category/`color`/visibility/map/planned GPS. Load rebuilds the Fleet panel from that array (names URL is fallback). sessionStorage is a tab cache only.
- Details: [`boatNames/README.md`](./boatNames/README.md).

## Ghost / invisible boats (Phase 8.6)

Per-boat draw mode: **`solid`** | **`ghost`** | **`hidden`** (`BoatVisibilityMode`).

| Mode | 3D hull | Tag | Water ring | Map dot |
| --- | --- | --- | --- | --- |
| `solid` (default) | opaque | yes | no | unchanged (tracks unless `mapVisible` is false) |
| `ghost` | translucent (`GHOST_HULL_OPACITY`) | yes | yes (category tint) | unchanged |
| `hidden` (3D off) | off | **yes** | no | unchanged |

- Ops: Fleet / Live row select → `scene.setBoatVisibilityMode` (sessionStorage via `FleetBoatRow.visibility`).
- Soft RaceProject field: `fleet.boatVisibility` `{ "<id>": "ghost"|"hidden"|… }` — invalid entries dropped; omitted → solid.
- Independent 2D map hide (11.7): `FleetBoatRow.mapVisible` / `fleet.boatMapVisible` — `false` hides the map icon while 3D mode is unchanged.
- Pose updates continue in all modes; hidden boats do not draw a hull on air/preview, but the nametag stays.
- glTF/template `clone(true)` shares materials — each entity runs `cloneSharedMaterials` so ghost/solid opacity cannot leak across boats after save/reload.
- Unity sibling had no dedicated ghost script in-tree; web mirrors the ops intent (transparent hull or tag-only).

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

- HUD **view** select: **Free cam** (default) | **Follow active POV**.
- **Free cam:** MapControls on the WebGL canvas (left-drag pan, right-drag orbit, wheel zoom toward cursor, **WASD** fly). Pan/WASD stay on the ground plane; speed scales with camera height so the same move covers more metres when zoomed out. Pivot follows WASD — Focus does not trap you. Works even when drone telemetry is idle.
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

- **HUD:** mode select (`mock` / `replay` / `live`) restarts TEL ingest via `onModeChange`. POV select lists `povIds` and calls `onPovChange` → scene `setActivePovId` (and calib device sync in `main`). **View** select: Free cam (default) | Follow active POV → `onOpsViewChange` → `scene.setOpsViewMode` (does not change air POV). Countdown Start / Pause / Reset / Restart → `onCountdownControl` → scene `controlCountdown`. **Authoring** checkbox mirrors World Authoring workspace open state (primary: Race setup header **World** toggle; closed at boot; `?editor=1` opens). The **stream-map PiP checkbox is removed** (Phase 19.2); 2D NDI still samples the off-screen canvas, and local **2D** focus hosts the same map full-screen. Status shows mode, TEL counts, **connection line** (`ws drone=… boat=…` in live via `setConnectionStatus`, or `ws=n/a (mock|replay)` — never fake `open`), `pov=<active>  seen=…  view=follow|free`, last active-drone ENU, and a multi-boat ENU line (`boats=N  21=(…) 22=(…)` truncated if long).
- **Ops map:** small top-right panel; plots `position.x` (East) vs `position.z` (North), north-up; auto-fits bounds to recent points + shared layout features (marks, gates, sponsors, flags, S/F). Boat **sail icons** (Unity `tekne_yeni` tinted by catalogue colour, yaw from pose `brg`; procedural fallback). Drones stay cyan circles. Editor click tools attach here. Optional **OSM** covers the visible ops / World Authoring canvas on pan/zoom (1-tile pad; last zoom stays until the new z loads). Stream/NDI 2D draws the same OSM path when `geoBridge` is set (default on, no checkbox; wash if offline). **Wind readout (14.3d):** both ops and stream maps subscribe to `windBus` (snapshot + `subscribe`, no Open-Meteo fetch). Arrow is **travel** via `windTravelSceneXZ` (from-000° → screen-down on the north-up map; from-090° → screen-left); label stays meteorological **`from NNN° · XX kt`**. Ops: dense top-left pill. Stream: larger bottom-left pill (clear of the north compass; readable on `broadcast-web-2d` / 1920×1080 letterbox). Default/stale frames still draw (slightly lower opacity).
- **Fleet ↔ map sync:** Live/Fleet delete/rename prunes ops + stream map icons via `retainPoseIds` (buoy poses kept). HUD pose subscribe ignores boat/drone ids outside the current allow-lists so mock/live cannot re-add ghosts. World Authoring place-boat/drone seeds an icon at click ENU immediately (planned lat/lon on the fleet row) without waiting for telemetry.
- **Stream map (Phase 8.1 + 8.7 + Phase 11 + 19.2 / 19.2b):** `createStreamMap2d` is a **16:9** canvas (**1920×1080**, same studio lock as AR/3D). PiP corner card and ops checkbox are **removed**. The canvas stays alive off-screen (`.local-2d-map-host`) so `broadcast-web-2d` keeps sampling `getCanvas()`. Local **2D** CSS-fits the same 1920×1080 bitmap into the 16:9 gap between sidebars (`width: 100% !important` on focus; off-screen host stays 1920 px). **Boat size** slider (0.25–2, default **0.5**, `bw.streamMap.boatScale`) scales hulls, fleet pills, S/F, buoys, and rounding glyphs — compass / title / OSM / wind stay put. Stream draws boat **names** + START/FINISH (centered on the line) + named buoys + CW/CCW rounding rings (`filterFeaturesForStreamMap`; no marks, drones, sponsors, or chains). Compact on-air pills (ops metrics unchanged). Sprite hulls have no AABB rectangle. **Not** a Three.js HUD — never steals WebGL / NDI air POV. To restore a PiP later: re-add `#ops-stream-map`, mount on the overlay host, restore absolute top-left card CSS (chrome can stay).

### Map chrome checklist (Phase 8.7)

1. Mock demo: boats 21–24 show sailboat icons in category colours (not flat squares); heading rotates with pose. Stream pills are **Bora / Aksu / …**; ops still shows ids.
2. Start/finish segments: thicker red bars + **START/FINISH** pills **centered on the line**; gate lines dashed; stream buoys named (not “buoy”) with CW/CCW rounding rings.
3. Local **2D** — broadcast graphic fills the sidebar gap (1920×1080 store); **Boat size** scales hulls + course chrome; no marks/drones on stream; ops map still small utilitarian with chains/sponsors/marks. Both show the wind travel arrow + from/kt (Ops **wind** row drives `windBus`).
4. Place editor **arrow** / **rotation** — chevron or curved glyph (Unity CW/RCW PNG port deferred; see `docs/ops/unity-asset-port.md`).
5. Stream OSM uses the same tile helper as ops; no stream OSM checkbox.
- **World editor (4.2 / 4.4):** see `src/scene/features/README.md` — place/edit/delete features on the map; ENU→GPS via GEO `enuToGpsAmsl`; export `world-features.json`; **Import/Export GeoJSON** (geojson.io); remounts 3D course/sponsors/flags. No DB.

### Stream map + OUT compositing

| Path | Stream map visible? |
| --- | --- |
| Preview (ops) | Local **2D** focus only (no PiP over 3D/AR) |
| Chrome chroma (window capture) | Same — map is off-screen unless local 2D |
| Electron alpha NDI | **No** — NDI is WebGL `readPixels` only; DOM map is not burned in |
| Electron **2D** NDI (`broadcast-web-2d`) | **Yes** — samples the off-screen 16:9 canvas |

**OUT:** AR/3D plates stay WebGL `readPixels` only (no DOM burn-in). Channel `'2d'` samples this canvas. SCN owns the graphic; OUT owns the pump.

## Camera convention

Pose rotations are Unity-style (camera forward **+Z**). Three.js `PerspectiveCamera` looks along **−Z**, so `createDroneCamera` right-multiplies a 180° Y flip when applying pose attitude. Boat meshes use the pose quaternion as-is (object forward +Z).
