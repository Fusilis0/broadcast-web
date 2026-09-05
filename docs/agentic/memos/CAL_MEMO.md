# CAL_MEMO

**Last updated:** 2026-09-02  
**Status:** Phase 19 CAL done. Handoff to SCN issued.

## Phase 19 domain roadmap (CAL)

| Wave | Item | DSP | Notes |
| --- | --- | --- | --- |
| A | **19.5** yaw/pitch/roll ±200° | `DSP-CAL-20260901-01-offset-range-200` | **Worker done** — human test next |

FOV / alt / `syncTrimMs` unchanged. No further CAL Phase 19 DSPs.

## Issued dispatches
—

## Done (Phase 19)
- **DSP-CAL-20260901-01-offset-range-200** — yaw/pitch/roll ±200°, step 0.1; FOV/alt/`syncTrimMs` unchanged. Tests cover all three angle fields + unchanged FOV/alt/sync specs. CV spike soak criterion now ±200°. Client 1027 + server 23 tests; build green.

## Phase 17.1 accepted 2026-08-26 (BW)

- `done/DSP-CAL-20260826-05` — sixth knob `syncTrimMs` on `CalibrationOffsets`, Calib slider, `calibration.byPovId` round-trip. `0` = today’s behaviour; old packs default to 0.
- **Sign (locked):** `t_ntp = toNtp(pts) + syncTrimMs`. Positive = AR leads video. Range ±500 ms, step 5. TEL-08 applies it; `applyCalibration` does not.

## Phase 14.0 FYI 2026-08-17
Scene ENU packing will change to `z = −North`. Saved `calibration.byPovId` / offsetsStore yaw
may have been compensating the old mirror. GEO worker will **not** migrate numbers. After 14.0
lands: eyeball one POV yaw on the Bosphorus origin before issuing any CAL DSP.

Handoff: `docs/agentic/handoffs/HO-BW-CAL-20260817-01.md`

## Phase 13 — overlay landed via SCN (2026-08-12)
- `done/DSP-SCN-20260812-02` mounts **“Calibration overlay”** in the Calib sidebar next to offset
  sliders. Behavior is SCN-owned (`setCalibrationOverlayEnabled`); no `offsetsStore` writes.
  Ops: `docs/ops/ar-calibration-overlay.md`. CAL may later fold the checkbox into `offsetSliders`
  if desired — not required.

## Accepted (prior)
- **DSP-CAL-20260811-01** — offset sliders in sidebar **Calib** (order 35)
- **DSP-CAL-20260804-01** — `calibration.byPovId` on RaceProject Save/Load

## Handoffs
- **HO-CAL-SCN-20260902-01** — CAL 19.5 complete; SCN takes Wave B. Path: `docs/agentic/handoffs/HO-CAL-SCN-20260902-01.md`

## Next actions
- CAL idle for Phase 19. Human opens **SCN** with the paste block (and optional Calib ±200 eyeball).
