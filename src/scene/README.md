# scene

Owned by **SCN**. Three.js view: fleet boats (glTF/procedural) + billboard tags, drone camera, stub HUD, 2D fleet map, static course + buoys.

## Consume contract

SCN draws fleet from **`poseBus`** (`src/pose/`) only — ENU meters `x=East, y=Up, z=North`.

Do **not** call `gpsToEnu` for boats, subscribe to `telemetryBus` for positions, or invent calibration math here.

**Course** is the exception for static world content: lat/lon waypoints are converted with GEO **`gpsToEnuAmsl` only** (no ECEF reimplementation in `src/scene/`). Call after `applyConfigOrigin` + EGM96.

`telemetryBus` may be used for **packet counts only** in the stub HUD.

## Boot

`main.ts` loads config → `startScene({ boatIds })` → EGM96 → origin → **`loadCourseFromUrl(courseUrl)`** → TEL ingest → `startPosePipeline` → HUD mode. HUD boots early for status; scene waits on `loadConfig()` so the allow-list is known.

Mock ids: drone `1`, boats from `boatIds` (default `21–24`). Temporary hFOV default `66.8832` (also on `PoseEvent.fovHDeg` from CAL).

## Public API

| Symbol | Role |
| --- | --- |
| `startScene(options)` | Scene + lights + renderer + RAF + pose subscribe + fleet `Map` + `loadCourseFromUrl` |
| `loadCourse` / `mountCourse` | Fetch/normalize course JSON → GEO ENU → boundary/gates/buoys |
| `startStubHud(options)` | Ops overlay: mode select + status + 2D map (`setCourseMarks`) |
| `createMap2d()` | Top-down ENU East/North fleet panel (canvas 2D) + optional course dots |
| `createBoatEntity()` | Pose root + glTF/procedural visual + billboard tag |
| `createBoatTag()` | Canvas sprite label (`Boat {id}` stub) |
| `createDroneCamera()` | PerspectiveCamera + ENU apply |
| `boatIdAllowSet` / `isAllowedBoatId` / `formatBoatEnuStatus` | Fleet allow-list + HUD helpers |

Clear color stays dark preview; OUT owns chroma later. Ambient + directional lights are present so `MeshStandard` / glTF materials read.

## Course + buoys (Phase 2.3)

- Fixture: `public/fixtures/course/demo-istanbul.json` (config key `courseUrl`).
- Waypoints: `mark` | `gateLeft` | `gateRight` — see fixture README for schema + gate pairing (Unity name-prefix).
- **Water Y:** course lines and buoy bases forced to **`y = 0`** (Unity `waterSurfaceY`). Converted AMSL ENU `y` is ignored for graphics so Istanbul geoid offset does not float the course.
- Boundary: `LineLoop` through marks (fixture order). Gates: segment per Left/Right pair. Buoys: cylinder poles + stub name sprites at marks and gate ends (visible for web ops).
- Not `poseBus`-driven; dispose on `scene.stop()`.

## Fleet registry (Phase 2.2)

- `startScene({ boatIds })` maintains `Map<string, BoatEntityHandle>`.
- On `poseBus` boat pose: ignore ids not in `boatIds`; otherwise create (clone 2.1 template + tag) then `applyPose`.
- Each RAF: `updateTag` for every active boat (drone camera).
- `stop()` disposes all entities and clears the map.
- Drone path unchanged (`droneId`, default `1`).
- Names/colours still roadmap **2.7** (stub tags by id).

## Boat + tag (Phase 2.1 template)

- Visual: loads `/models/boat.glb` (cached, cloned per entity); procedural multi-mesh fallback if load fails. See `src/assets/README.md` for axis offset.
- Tag: sprite billboard (auto-faces camera) with mild distance scale (Unity `BoatTagRotation` spirit). Stub name `Boat {id}`.

## Stub HUD + 2D map

- **HUD:** mode select (`mock` / `replay` / `live`) restarts TEL ingest via `onModeChange`. Status shows mode, TEL counts, last drone ENU, and a multi-boat ENU line (`boats=N  21=(…) 22=(…)` truncated if long).
- **Map:** plots `position.x` (East) vs `position.z` (North), north-up; auto-fits bounds to recent points + course marks with padding. Orange dots = course marks/gate ends.

## Camera convention

Pose rotations are Unity-style (camera forward **+Z**). Three.js `PerspectiveCamera` looks along **−Z**, so `createDroneCamera` right-multiplies a 180° Y flip when applying pose attitude. Boat meshes use the pose quaternion as-is (object forward +Z).
