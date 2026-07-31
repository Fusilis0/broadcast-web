# scene

Owned by **SCN**. Three.js view: fleet boats (glTF/procedural) + billboard tags, drone camera, stub HUD, 2D fleet map, static course + buoys, sponsor panels, countdown flags.

## Consume contract

SCN draws fleet from **`poseBus`** (`src/pose/`) only — ENU meters `x=East, y=Up, z=North`.

Do **not** call `gpsToEnu` for boats, subscribe to `telemetryBus` for positions, or invent calibration math here.

**Course**, **sponsors**, and **countdown flags** are the exception for static world content: lat/lon waypoints are converted with GEO **`gpsToEnuAmsl` only** (no ECEF reimplementation in `src/scene/`). Call after `applyConfigOrigin` + EGM96. Fixtures also adapt into a shared **`WorldFeature[]`** → **`layoutFeatures`** list for the 2D map and **map feature editor**; see `src/scene/features/`.

`telemetryBus` may be used for **packet counts only** in the stub HUD.

## Boot

`main.ts` loads config → `startScene({ boatIds, povIds })` → **`loadBoatNamesFromUrl(boatNamesUrl)`** → EGM96 → origin → **`loadCourseFromUrl(courseUrl)`** → **`loadSponsorsFromUrl(sponsorsUrl)`** → **`loadCountdownFlagsFromUrl(flagsUrl)`** → TEL ingest → `startPosePipeline` → HUD mode + POV select. HUD boots early for status; scene waits on `loadConfig()` so allow-lists are known.

**Soft race switch** (`switchRace` / Load / `?race=` after boot): `scene.setFleetAllowLists({ boatIds, povIds })` replaces allow-lists without recreating WebGL — orphan boats leave the registry, POV pose cache is pruned, active POV is clamped; then HUD/calib `setPovIds` + ingest restart with the same lists. First-boot `?race=` still passes pack lists into `startScene` directly.

Mock ids: POVs from `povIds` (default `1`,`2`), boats from `boatIds` (default `21–24`). Temporary hFOV default `66.8832` (also on `PoseEvent.fovHDeg` from CAL).

## Public API

| Symbol | Role |
| --- | --- |
| `startScene(options)` | Scene + lights + renderer + RAF + pose subscribe + fleet `Map` + POV switch + course/sponsors/flags/boatNames loaders |
| `setFleetAllowLists({ boatIds, povIds })` | Soft race switch: replace allow-lists, drop orphan boats, prune/clamp POV |
| `loadCourse` / `mountCourse` | Fetch/normalize course JSON → GEO ENU → boundary/gates/buoys |
| `loadSponsors` / `mountSponsors` | Fetch/normalize sponsors JSON → GEO ENU → fixed world panels |
| `loadCountdownFlags` / `mountCountdownFlags` | Fetch/normalize flags JSON → GEO ENU → poles + phase timer |
| `loadBoatNames` / `normalizeBoatNames` | Fetch/normalize Unity category→id→name JSON → tag identity map |
| `startStubHud(options)` | Ops overlay: mode + POV + countdown + editor + race Load/Save + WS + status + 2D map |
| `formatConnectionStatus` | Compact `ws=…` / `ws=n/a (mock|replay)` string for HUD status |
| `createMap2d()` | Top-down ENU East/North fleet panel (canvas 2D) + shared layout features |
| `layoutFeatures` / `getLayoutFeatures` | Shared GPS→ENU world features (course/sponsors/flags adapters) |
| `startMapFeatureEditor` | V1 world editor: place/select/delete/export + **Save project** download; remounts 3D |
| `remountWorldFromFeatures` | Rebuild course/sponsors/flags from editable `WorldFeature[]` |
| `createBoatEntity()` | Pose root + glTF/procedural visual + billboard tag |
| `createBoatTag()` | Canvas sprite label (catalogue name + category tint, or `Boat {id}` stub) |
| `createDroneCamera()` | PerspectiveCamera + ENU apply |
| `boatIdAllowSet` / `isAllowedBoatId` / `formatBoatEnuStatus` | Fleet allow-list + HUD helpers |
| `povIdAllowSet` / `isAllowedPovId` / `formatPovStatus` / `resolvePovIdList` | POV allow-list + HUD helpers |

Clear color stays dark preview; OUT owns chroma later. Ambient + directional lights are present so `MeshStandard` / glTF materials read.

## Course + buoys (Phase 2.3)

- Fixture: `public/fixtures/course/demo-istanbul.json` (config key `courseUrl`).
- Waypoints: `mark` | `gateLeft` | `gateRight` — see fixture README for schema + gate pairing (Unity name-prefix).
- **Water Y:** course lines and buoy bases forced to **`y = 0`** (Unity `waterSurfaceY`). Converted AMSL ENU `y` is ignored for graphics so Istanbul geoid offset does not float the course.
- Boundary: `LineLoop` through marks (fixture order). Gates: segment per Left/Right pair. Buoys: cylinder poles + stub name sprites at marks and gate ends (visible for web ops).
- Not `poseBus`-driven; dispose on `scene.stop()`.

## Sponsors (Phase 2.5)

- Fixture: `public/fixtures/sponsors/demo-istanbul.json` (config key `sponsorsUrl`) — **2–4** demo panels near the course.
- Schema: `a`/`b` GPS anchors + `heightM` + optional `textureUrl` / `label` / `color` — see fixture README.
- Placement: **`gpsToEnuAmsl` only**; panel baseline **water Y = 0** (same as course).
- Mesh: vertical quad spanning A↔B; **fixed** world orientation (not camera-billboard). Face normal = flatten(A→B) × up (left of A→B). Order points so the course is on the facing side.
- Missing texture → procedural canvas with `label` (no blank void). Sponsor `label` ≠ boat name catalogue (**2.7**).
- Dispose on `scene.stop()`. Full Unity Sponsors pack / BillboardChain tiling are out of this slice.

## Countdown flags (Phase 2.6)

- Fixture: `public/fixtures/flags/demo-istanbul-countdown.json` (config key **`flagsUrl`**).
- Two GPS poles near the demo course gate: P1 shore (**white**), P2 committee (**orange** + **blue-white**).
- Timeline (Unity defaults): orange @ 6:00 → white @ 5:00 → blue-white up @ 4:00 → blue-white down @ 1:00 → freeze at 0:00.
- Placement: **`gpsToEnuAmsl` only**; pole baseline **water Y = 0**. Flags face the other point (yaw-only).
- World `MM:SS` sprite above P1; billboards to active POV camera with mild distance scale (boat-tag spirit). Plate red while running, green at zero.
- Demo speed: fixture **`demoTimeScale: 20`** (~18 s for a 6-min sequence). Set `1` for real-time. HUD: Start / Pause / Reset / Restart.
- Procedural colored planes — no Unity FBX/PNG dump. Dispose on `scene.stop()`.

## Fleet registry (Phase 2.2)

- `startScene({ boatIds })` maintains `Map<string, BoatEntityHandle>`.
- On `poseBus` boat pose: ignore ids not in `boatIds`; otherwise create (clone 2.1 template + tag) then `applyPose`.
- Soft race switch: `setFleetAllowLists` rebuilds the allow-set and disposes ids that leave the pack; new ids spawn on the next allowed pose.
- Each RAF: `updateTag` for every active boat (drone camera).
- `stop()` disposes all entities and clears the map.
- Names/colours: **2.7** catalogue via `boatNamesUrl` (see below).

## Boat names / colours (Phase 2.7)

- Fixture: `public/fixtures/boats/demo-istanbul-names.json` (config key **`boatNamesUrl`**).
- Schema: Unity `BoatNameAssigner` nested map — category → `{ "<id>": "<name>" }` (covers default `21`–`24`).
- Colour from category Turkish keywords (`pembe`/`mavi`/`sarı`/`sari`/`yeşil`/`yesil`/`turuncu`; else white). Optional `_color` / per-entry hex overrides.
- Boot: `loadBoatNamesFromUrl` before TEL; `ensureBoat` resolves on create; late load re-applies via `setTagIdentity` (canvas texture redraw, no leak — same texture updated).
- Unknown id → stub `Boat {id}` / neutral plate. Hull tint and 2D map dots are out of this slice.

## Multi-POV switch (Phase 2.4)

- `startScene({ povIds })` caches last `poseBus` drone pose per id ∈ `povIds`.
- Only **`activePovId`** (default `povIds[0]`) drives the Three `PerspectiveCamera`.
- `setActivePovId(id)` switches immediately using the cached pose when available (no wait for next packet).
- Soft race switch: `setFleetAllowLists` updates `povIds`, drops cached poses for removed ids, and clamps `activePovId` into the new list (HUD/calib sync via `setPovIds`).
- Deprecated `droneId` remains as a single-id / initial-active alias when needed.
- Cam ids `11`/`12` use the same `kind: 'drone'` path when listed in `povIds` — no second pipeline.
- HUD: POV select (labels = raw id; **not** 2.7 names) + status `pov=<id>  seen=…`; optional digit keys `1`–`4`.
- Boat tags still billboard to the **active** camera. Frustum gizmos for inactive POVs are out of this slice.
- TEL must emit ≥2 POV ids on mock for a visible switch demo (`HO-SCN-TEL-20260727-01`).

## Boat + tag (Phase 2.1 template)

- Visual: loads `/models/boat.glb` (cached, cloned per entity); procedural multi-mesh fallback if load fails. See `src/assets/README.md` for axis offset.
- Tag: sprite billboard (auto-faces camera) with mild distance scale (Unity `BoatTagRotation` spirit). Catalogue name + category tint when **2.7** loaded; else stub `Boat {id}`.

## Stub HUD + 2D map

- **HUD:** mode select (`mock` / `replay` / `live`) restarts TEL ingest via `onModeChange`. POV select lists `povIds` and calls `onPovChange` → scene `setActivePovId` (and calib device sync in `main`). Countdown Start / Pause / Reset / Restart → `onCountdownControl` → scene `controlCountdown`. **Editor** checkbox (or `?editor=1`) opens the world feature editor. Status shows mode, TEL counts, **connection line** (`ws drone=… boat=…` in live via `setConnectionStatus`, or `ws=n/a (mock|replay)` — never fake `open`), `pov=<active>  seen=…`, last active-drone ENU, and a multi-boat ENU line (`boats=N  21=(…) 22=(…)` truncated if long).
- **Map:** plots `position.x` (East) vs `position.z` (North), north-up; auto-fits bounds to recent points + shared layout features (marks, gates, sponsors, flags).
- **World editor (4.2):** see `src/scene/features/README.md` — place/edit/delete features on the map; ENU→GPS via GEO `enuToGpsAmsl`; export `world-features.json`; remounts 3D course/sponsors/flags. No DB / GeoJSON import.

## Camera convention

Pose rotations are Unity-style (camera forward **+Z**). Three.js `PerspectiveCamera` looks along **−Z**, so `createDroneCamera` right-multiplies a 180° Y flip when applying pose attitude. Boat meshes use the pose quaternion as-is (object forward +Z).
