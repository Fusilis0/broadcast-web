# Dispatch DSP-CAL-20260722-01-default-fov-zero-offsets

## Meta
- From orchestrator: CAL
- Worker role: WORKER(DSP-CAL-20260722-01-default-fov-zero-offsets)
- Priority: P0
- Phase: Phase 1 — Spine (roadmap **1.5** pose apply slice + **1.6** FOV default)
- Related handoffs: none (BW directed; parallel with GEO/SCN pose-spine DSPs)

## Goal

Land a minimal first-class calibration slice: typed `CalibrationOffsets`, a per-device map defaulting to **zero** angular/altitude offsets and **hFOV 66.8832°**, plus an apply helper on the pose path so GEO→CAL→SCN can compose without inventing a second pipeline. No UI.

## Background

- Architecture §5.3: `CalibrationOffsets` + pipeline `rawTelemetryPose → GEO → + CAL offsets → SCN camera`
- Roadmap 1.5 / 1.6; sliders are **1.8** (later DSP)
- BW priority: “CAL FOV 66.8832° + zero offsets stub” applied in pose path
- Unity read-only apply order (`../broadcast/Assets/Scripts/WorldAnchorManager.cs`): world yaw (+ declination later) × telemetry rot × local pitch/roll; altitude on ENU Y. Declination stays **0** / GEO-owned — do not add a declination service here
- Folders already exist: `src/calibration/`, `src/pose/` (stubs only)
- CV must only write these same offset knobs later — keep one apply path

## In scope

1. **Types** (`src/calibration/`) matching architecture §5.3:
   - `CalibrationOffsets`: `yawDeg`, `pitchDeg`, `rollDeg`, `fovHDeg`, `altMeters`
   - Constant `DEFAULT_HFOV_DEG = 66.8832` (Mini 4 Pro)
   - `zeroOffsets()` / factory returning zeros for angles/alt and `fovHDeg: DEFAULT_HFOV_DEG`

2. **Per-device store** (`src/calibration/`):
   - Map keyed by device id (`string`)
   - `getOffsets(deviceId)` → returns stored or default zero+FOV (do not mutate map on bare get unless you document copy-on-write; prefer returning a copy of defaults when missing)
   - `setOffsets(deviceId, partial | full)` for future UI/CV (no HUD in this DSP)
   - `resetOffsets(deviceId)` → back to zero+FOV default
   - Optional: clear-all for tests

3. **Pose-path apply** (`src/pose/` + thin re-export from calibration as needed):
   - Define a small ENU pose input/output type owned for apply (e.g. position `{x,y,z}` metres ENU, rotation as quaternion or yaw/pitch/roll degrees — pick one and document; Three.js-friendly quaternion preferred if already available)
   - `applyCalibration(pose, offsets) → { pose, fovHDeg }`:
     - Position: add `altMeters` to ENU **Y** only (east/north offsets **out of scope**)
     - Rotation: Unity-aligned — world yaw offset × input rot × local pitch/roll offsets (degrees → radians as needed). With all-zero angles this must be identity within float epsilon
     - `fovHDeg` always from offsets (default **66.8832**), **not** from `TelemetryData.cam.fov`
   - Convenience: `applyCalibrationForDevice(pose, deviceId)` using the store
   - Export from `src/pose/` (and `src/calibration/` for the store) so GEO/SCN workers can import without reaching into private files

4. **Tests** (Vitest, match GEO/TEL style):
   - Default FOV is exactly `66.8832`
   - Missing device → zero angles/alt + default FOV
   - Zero offsets leave position/rotation unchanged (epsilon); FOV still 66.8832
   - Non-zero yaw/pitch/roll/alt change pose in the expected axes (smoke, not full Unity parity suite)

5. **Wire point (minimal):** export apply from pose module; if `main.ts` already has a pose/camera hook from another worker, call apply there **only if** a clear single place exists — otherwise leave exports ready and note “await GEO/SCN wiring” in report-back. Do **not** invent SCN meshes or GEO bus subscription.

## Out of scope

- Human slider HUD / persistence / localStorage (roadmap **1.8**)
- Declination service, EGM96, GeoOrigin, WS/mock telemetry
- SCN camera object, boat meshes, midpoint lerp ownership (SCN/GEO)
- East/north position offsets, lens distortion
- WebRTC / chroma / console
- Changing architecture docs unless a typo blocks you (escalate)

## Likely files

- `src/calibration/types.ts` (or equivalent)
- `src/calibration/offsetsStore.ts`
- `src/calibration/index.ts`
- `src/calibration/README.md` (one-line ownership + API pointer)
- `src/pose/applyCalibration.ts` (name flexible)
- `src/pose/index.ts`
- `src/pose/README.md`
- `src/calibration/*.test.ts` and/or `src/pose/*.test.ts`
- `src/main.ts` — **only** if a trivial import/export smoke is already natural; no UI

## Inputs provided

- Architecture: `docs/architecture/system-architecture.md` §5.3
- Roadmap: `docs/roadmap/phases-roadmap.md` 1.5, 1.6 (sliders = 1.8)
- Unity reference (read-only): `../broadcast/Assets/Scripts/WorldAnchorManager.cs` (`manualYawOffset` / pitch / roll / `manualAltitudeOffset`)
- Existing modules: `src/geodesy/`, `src/telemetry/` — consume types only if needed; do not expand TEL/GEO scope

## Acceptance criteria

- [ ] `CalibrationOffsets` matches §5.3 field set
- [ ] Default / reset FOV is **66.8832**; other knobs default **0**
- [ ] Per-device map get/set/reset works; missing key behaves as zero+FOV
- [ ] `applyCalibration` is exported from the pose path and is identity (pose) for zero offsets
- [ ] Render FOV source of truth is offsets `fovHDeg`, not telemetry `cam.fov`
- [ ] Unit tests green (`npm test` or project’s existing test script)
- [ ] No slider UI; no east/north; no second pose pipeline

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (esp. whether GEO/SCN still need to call `applyCalibrationForDevice`)
5. Suggested memo bullets for CAL
