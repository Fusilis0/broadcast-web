# CAL_MEMO

**Last updated:** 2026-08-12  
**Status:** Idle — Phase 11 CAL accepted; Phase 13.7 overlay shipped by SCN (Calib checkbox)

## Phase 13 — overlay landed via SCN (2026-08-12)
- `done/DSP-SCN-20260812-02` mounts **“Calibration overlay”** in the Calib sidebar next to offset
  sliders. Behavior is SCN-owned (`setCalibrationOverlayEnabled`); no `offsetsStore` writes.
  Ops: `docs/ops/ar-calibration-overlay.md`. CAL may later fold the checkbox into `offsetSliders`
  if desired — not required.

## Phase 13 — planned, design only (2026-08-12) — superseded
BW wrote [`docs/architecture/ar-calibration-map-overlay.md`](../../architecture/ar-calibration-map-overlay.md):
manual ENU-grid/marks overlay — precursor to `docs/research/cv-calibration-spike.md`.

## Accepted
- **DSP-CAL-20260811-01** — offset sliders in sidebar **Calib** (order 35); fixed top-left chrome gone; Assets POV hint → “sidebar → Calib”
- **DSP-CAL-20260804-01** — `calibration.byPovId` on RaceProject Save/Load
