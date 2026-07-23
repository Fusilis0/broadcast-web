# scene

Owned by **SCN**. Three.js view: boat primitives, drone camera, stub HUD, 2D fleet map.

## Consume contract

SCN draws from **`poseBus`** (`src/pose/`) only — ENU meters `x=East, y=Up, z=North`.

Do **not** call `gpsToEnu`, subscribe to `telemetryBus` for positions, or invent calibration math here.

`telemetryBus` may be used for **packet counts only** in the stub HUD.

## Boot

`main.ts` loads config → EGM96 → origin → TEL ingest → `startPosePipeline` → `startScene` + `startStubHud`.

Mock ids: drone `1`, boat `21`. Temporary hFOV default `66.8832` (also on `PoseEvent.fovHDeg` from CAL).

## Public API

| Symbol | Role |
| --- | --- |
| `startScene(options)` | Scene + renderer + RAF + pose subscribe |
| `startStubHud(options)` | Ops overlay: mode placeholder + status + 2D map |
| `createMap2d()` | Top-down ENU East/North fleet panel (canvas 2D) |
| `createBoatEntity()` | Elongated box group |
| `createDroneCamera()` | PerspectiveCamera + ENU apply |

Clear color stays dark preview; OUT owns chroma later.

## Stub HUD + 2D map

- **HUD:** mode select (`mock` / `replay` / `live`) is UI-only — does not open WS or switch ingest (TEL 1.4 / 1.9). Status shows mode, TEL counts, last drone/boat ENU from `poseBus`.
- **Map:** plots `position.x` (East) vs `position.z` (North), north-up; auto-fits bounds to recent points with padding. Shared single `poseBus.on('pose')` with HUD ENU lines.

## Camera convention

Pose rotations are Unity-style (camera forward **+Z**). Three.js `PerspectiveCamera` looks along **−Z**, so `createDroneCamera` right-multiplies a 180° Y flip when applying pose attitude. Boat meshes use the pose quaternion as-is (object forward +Z).
