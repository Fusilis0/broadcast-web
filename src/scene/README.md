# scene

Owned by **SCN**. Three.js view: boat primitives, drone camera, later course / 2D map.

## Consume contract

SCN draws from **`poseBus`** (`src/pose/`) only — ENU meters `x=East, y=Up, z=North`.

Do **not** call `gpsToEnu`, subscribe to `telemetryBus` for positions, or invent calibration math here.

## Boot

`main.ts` loads config → EGM96 → origin → TEL ingest → `startPosePipeline` → `startScene({ container })`.

Mock ids: drone `1`, boat `21`. Temporary hFOV default `66.8832` (also on `PoseEvent.fovHDeg` from CAL).

## Public API

| Symbol | Role |
| --- | --- |
| `startScene(options)` | Scene + renderer + RAF + pose subscribe |
| `createBoatEntity()` | Elongated box group |
| `createDroneCamera()` | PerspectiveCamera + ENU apply |

Clear color stays dark preview; OUT owns chroma later.

## Camera convention

Pose rotations are Unity-style (camera forward **+Z**). Three.js `PerspectiveCamera` looks along **−Z**, so `createDroneCamera` right-multiplies a 180° Y flip when applying pose attitude. Boat meshes use the pose quaternion as-is (object forward +Z).
