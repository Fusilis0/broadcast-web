# Dispatch DSP-SCN-20260915-01-srt-ar-look-freeze

## Meta
- From: **BW**. Domain: **SCN**
- Worker: WORKER(DSP-SCN-20260915-01-srt-ar-look-freeze)
- Priority: **P0**
- Phase: **22.4b**
- Design: `docs/architecture/srt-program-cameras.md` §3 · §5 AR env row
- Related: `HO-BW-SCN-20260915-01`

## Goal

1. **AR SRT** has **no** terrain, sea, OSM buildings, or hero glTF (even if studio 3D has them on).
2. AR camera **does not move** until the follow target has **active telemetry**. Then Follow selected POV.

## Background

AR plate uses `setOpsViewMode('follow')` and `applySrtWorldLook` from studio 3D — that is why OBS AR shows Cesium and wanders with no GPS.

## In scope

1. Stop sending / applying **3D world look** to the AR plate. AR defaults: env may stay opaque clear; **terrain off, sea off, buildings off, heroes off**. 3D plate still gets `srtOut:worldLook`.
2. AR follow **idle**: freeze at origin or last good pose. No orbit, no cinematic leftover, no follow on empty.
3. **Active telemetry** = recent valid GPS on that POV. Planned-only boats do not unlock Follow.
4. Tests: AR plate path does not enable terrain; freeze when no pose.

## Out of scope

Bottom bar UI (DSP-02). 3D program rig (DSP-03). 2D cam (DSP-04). 1080 capture (OUT-01). `STUDIO_TICK_FPS`. Boat mesh/tag presets (DSP-02).

## Likely files

- `src/main.ts` (`applySrtWorldLook`, `applySrtPlatePresentation`, `applySrtPlateCameraLock`)
- `src/scene/freeCam.ts` / follow apply
- `src/output/srtPublisher.ts` if world-look IPC must be 3D-only

## Acceptance

- [x] OBS AR: no hills/aerial city mesh/heroes (3D still has them)
- [x] No GPS: AR camera still
- [x] GPS on selected POV: Follow works
- [x] 3D OBS look not regressed
- [x] No `STUDIO_TICK_FPS`

## Report

**AR look isolation:** `srtOut:worldLook` IPC is 3D-plate only (`desktop/main.cjs` + `srtPlateAcceptsWorldLook`). AR plate does not subscribe or apply studio look. `applySrtPlatePresentation` forces `AR_PLATE_WORLD_LAYERS` (simple env, terrain/buildings/heroes off) and returns before the 3D boot path that enables realistic+terrain. Cinematic tile warm is skipped on AR so region-look cannot remount Cesium.

**Freeze condition:** AR `followRequiresActiveGps`. Follow pose applies only when the **selected POV** has a recent (`≤2s`) usable GPS sample on the drone telemetry bus (`hasUsableGps`). Attitude-only / lat,lon 0 packets and planned-only boats do not unlock. Until then the drone cam stays at origin (or last good GPS pose). No `STUDIO_TICK_FPS` change. DSP-02 not started.
