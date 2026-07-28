# calibration

Owned by **CAL**. First-class `CalibrationOffsets` + per-device store (`getOffsets` / `setOffsets` / `resetOffsets`). Default FOV `66.8832°`, other knobs `0`. Pose apply lives in `src/pose/` (`applyCalibration`).

Ops UI: `startOffsetSliders({ container, povIds?, deviceId? })` — yaw/pitch/roll/FOV/alt sliders with a **device picker** over `povIds` (default `["1"]` / config list). Writes go to `setOffsets` / `resetOffsets` for the selected id only. `main.ts` syncs the picker to the active HUD POV (`setDeviceId`); ops can still override via the select. Handle: `getDeviceId` / `setDeviceId` / `setPovIds`.

**Future CV** (Phase 4.5 plan only — no runtime CV yet): match underlay video to the synthetic view and write the **same** offsets via `setOffsets`. See [`docs/research/cv-calibration-spike.md`](../../docs/research/cv-calibration-spike.md).