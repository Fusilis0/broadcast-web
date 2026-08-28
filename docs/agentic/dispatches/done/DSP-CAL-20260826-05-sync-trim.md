# Dispatch DSP-CAL-20260826-05-sync-trim

## Meta
- From orchestrator: BW → CAL
- Worker role: WORKER(DSP-CAL-20260826-05-sync-trim)
- Priority: P1
- Phase: Phase 17.1 — per-POV video/telemetry sync trim
- Design: `docs/architecture/ar-video-underlay-ntp-sync.md` §5
- Prerequisite reading: `docs/architecture/ntp-matching.md` §3.2, §3.3, §5
- Parallel-safe with: TEL-01, TEL-02, OUT-03, OUT-04. **You own** `src/calibration/*`. Do not touch `src/output/`, `src/telemetry/`, or `src/pose/`.
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` 741+23, `npm run build` green). Sign locked: `t_ntp = toNtp(pts) + syncTrimMs`. TEL-08 applies it.

## Goal

Add `syncTrimMs` as a sixth calibration knob: a per-POV millisecond offset applied to the resolved video-frame NTP time, adjustable by the operator and persisted with the race pack.

Small dispatch. It exists because of a limitation nothing in our code can fix.

## Background

Phase 17 renders the AR overlay at the video frame's capture time, resolved through `stream_anchor.ntp_capture_ms`. But `ntp-matching.md` is explicit that this is **not photon time**:

- §3.2 — DJI's `anchorPreCallbackOffsetMs` defaults to **0**. The sensor→SDK-callback delay was never measured. Anchors are NAL-callback-accurate minus mux queue.
- §5 — *"Do not treat GoPro `ntp_capture_ms` as photon time"*, and the same caution applies in kind to DJI.

So even a flawless implementation of the whole phase lands with an **unknown constant offset per camera model**. It is a producer-side measurement gap, not a bug we can chase in consumer code.

The remedy is an operator trim, measured once per airframe against a clapper or a hard boat manoeuvre, then left alone. It is stable — it is a property of the camera and its encode path, not of the network.

### Why it belongs in CAL

It is a per-POV camera calibration constant of exactly the same character as `yawDeg` or `fovHDeg`: measured by eye against reality, stored per device, saved with the pack. Putting it in `CalibrationOffsets` also means it inherits `calibration.byPovId` persistence, the device picker, and the pack round-trip **for free** — no new storage, no new parse path, no new race-project field.

## In scope

1. `src/calibration/types.ts`:
   - Add `syncTrimMs: number` to `CalibrationOffsets`; `zeroOffsets()` returns **0**.
   - `0` must mean "today's behaviour" so nothing changes for anyone who never touches it.
2. `src/calibration/offsetSliders.ts`:
   - Add a slider spec. Suggested range **−500 … +500 ms**, step 5, but justify whatever you pick. Sign convention must be documented in the UI label or tooltip, unambiguously — "positive = AR lags video" or the reverse, stated in plain words, decided once and written down. An operator guessing the sign will chase the trim the wrong way and conclude the feature is broken.
   - Note `offsetSliders.test.ts` asserts the exact set of five fields — that test must be updated, deliberately, not worked around.
3. `src/calibration/projectCalibration.ts`:
   - `parseCalibrationOffsets` accepts `syncTrimMs` plus a short alias (`syncTrim` / `trimMs`), consistent with existing aliases (`yaw`, `fov`, `alt`).
   - **Old packs without the field must still parse and default to 0.** This is soft-parse territory; follow the existing pattern exactly.
4. Docs: `src/calibration/README.md`, `docs/contracts/race-project.md` (the `calibration.byPovId` shape), and a line in `docs/architecture/ar-video-underlay-ntp-sync.md` §5 recording the sign convention you chose.

## Out of scope

- **Applying the trim to anything.** No consumer exists yet — TEL-08 reads it during the pose cutover. Ship the field, the slider, and the persistence; that is the whole job.
- `src/pose/applyCalibration.ts` — do **not** add `syncTrimMs` to the pose transform. It is a time offset, not a spatial one; it has no business in the quaternion path. If you find yourself editing that file, stop.
- FOV / distortion work (C6 in the design). Real and important, separate track.
- Any `src/output/` or `src/telemetry/` file.

## Likely files

- `src/calibration/types.ts`
- `src/calibration/offsetSliders.ts` (+ test update)
- `src/calibration/projectCalibration.ts` (+ test)
- `src/calibration/calibration.test.ts`
- `src/calibration/README.md`, `docs/contracts/race-project.md`, `docs/architecture/ar-video-underlay-ntp-sync.md`

## Inputs provided

- `CalibrationOffsets` + `zeroOffsets` — `src/calibration/types.ts` L9–24
- Slider specs + clamping — `src/calibration/offsetSliders.ts` L17–79
- Soft-parse + aliases + snapshot/hydrate — `src/calibration/projectCalibration.ts` L29–120
- Pack round-trip test precedent — `src/projects/buildRaceProject.test.ts` L105–128
- Existing five-field assertion to update — `src/calibration/offsetSliders.test.ts` L20–25

## Acceptance criteria

- [ ] `zeroOffsets().syncTrimMs === 0`.
- [ ] Slider appears in the Calib panel, respects the device picker, writes through `setOffsets` for the selected POV only.
- [ ] Sign convention is stated in the UI and in the docs, in words, not just a sign.
- [ ] Save → Load round-trips the value via `calibration.byPovId`.
- [ ] **A pack with no `syncTrimMs` parses and yields 0** — no throw, no `undefined` leaking into the store.
- [ ] Alias parses.
- [ ] Out-of-range input clamps.
- [ ] `applyCalibration` output is **unchanged** — assert a non-zero `syncTrimMs` does not perturb position or rotation.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary — range/step chosen, and the **sign convention** in plain words
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested CAL memo bullets
