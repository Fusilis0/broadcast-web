# calibration

Owned by **CAL**. First-class `CalibrationOffsets` + per-device store (`getOffsets` / `setOffsets` / `resetOffsets`). Default FOV `66.8832°`, other knobs `0` (including `syncTrimMs`). Pose apply lives in `src/pose/` (`applyCalibration`) and uses the spatial knobs only — `syncTrimMs` is a time offset, not a pose transform.

Ops UI: `startOffsetSliders({ container, povIds?, deviceId? })` — yaw/pitch/roll/FOV/alt/**sync ms** sliders with a **device picker** over `povIds` (default `["1"]` / config list). Writes go to `setOffsets` / `resetOffsets` for the selected id only. Mounted in the ops sidebar **Calib** section (`main.ts`, order 35); CSS under `.ops-sidebar .calib-panel` neutralizes the legacy fixed top-left chrome. `main.ts` syncs the picker to the active HUD POV (`setDeviceId`); ops can still override via the select. Handle: `getDeviceId` / `setDeviceId` / `setPovIds`.

**`syncTrimMs` sign:** `t_ntp = toNtp(pts) + syncTrimMs`. **Positive = AR leads video** (sample later NTP). Overlay lags the picture → raise; overlay leads → lower. `0` = no trim. Range ±500 ms, step 5. TEL-08 applies it; this module only stores it.

**RaceProject persistence** (soft): `snapshotCalibrationByPovId` / `applyRaceProjectCalibration` via `calibration.byPovId` on the pack (see [`docs/contracts/race-project.md`](../../docs/contracts/race-project.md)). Save embeds current store; Load / `?race=` hydrates through `applyRaceProjectToConfig`. Old packs without `calibration` (or without `syncTrimMs`) still parse; missing trim defaults to `0`.

**Future CV** (Phase 4.5 plan only — no runtime CV yet): match underlay video to the synthetic view and write the **same** offsets via `setOffsets`. See [`docs/research/cv-calibration-spike.md`](../../docs/research/cv-calibration-spike.md).
