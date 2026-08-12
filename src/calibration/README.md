# calibration

Owned by **CAL**. First-class `CalibrationOffsets` + per-device store (`getOffsets` / `setOffsets` / `resetOffsets`). Default FOV `66.8832°`, other knobs `0`. Pose apply lives in `src/pose/` (`applyCalibration`).

Ops UI: `startOffsetSliders({ container, povIds?, deviceId? })` — yaw/pitch/roll/FOV/alt sliders with a **device picker** over `povIds` (default `["1"]` / config list). Writes go to `setOffsets` / `resetOffsets` for the selected id only. Mounted in the ops sidebar **Calib** section (`main.ts`, order 35); CSS under `.ops-sidebar .calib-panel` neutralizes the legacy fixed top-left chrome. `main.ts` syncs the picker to the active HUD POV (`setDeviceId`); ops can still override via the select. Handle: `getDeviceId` / `setDeviceId` / `setPovIds`.

**RaceProject persistence** (soft): `snapshotCalibrationByPovId` / `applyRaceProjectCalibration` via `calibration.byPovId` on the pack (see [`docs/contracts/race-project.md`](../../docs/contracts/race-project.md)). Save embeds current store; Load / `?race=` hydrates through `applyRaceProjectToConfig`. Old packs without `calibration` still parse.

**Future CV** (Phase 4.5 plan only — no runtime CV yet): match underlay video to the synthetic view and write the **same** offsets via `setOffsets`. See [`docs/research/cv-calibration-spike.md`](../../docs/research/cv-calibration-spike.md).
