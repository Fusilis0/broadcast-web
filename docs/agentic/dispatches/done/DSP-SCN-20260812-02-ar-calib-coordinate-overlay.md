# Dispatch DSP-SCN-20260812-02-ar-calib-coordinate-overlay

## Meta
- From orchestrator: BW → SCN (Phase 13.7 render; CAL toggle may be included here for v1)
- Worker role: WORKER(DSP-SCN-20260812-02-ar-calib-coordinate-overlay)
- Priority: P1
- Phase: Phase 13 — AR calibration overlay
- Prerequisite: `done/DSP-SCN-20260812-01` (landed — shared scene files free)
- Parallel-safe with: `DSP-OUT-20260812-02`, `DSP-OUT-20260812-03` (rebase `main.ts` if needed)
- Design: `docs/architecture/ar-calibration-map-overlay.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 439+23)

## Goal

Ship a toggleable **ENU coordinate / marks overlay** drawn through the same calibrated active-POV
camera, so operators can eyeball AR alignment (manual precursor to the CV calibration spike).
Read-only visualization — **no** changes to offset math / `setOffsets` writers.

## Background

- Calib today: yaw/pitch/roll/FOV/alt sliders (`src/calibration/offsetSliders.ts`).
- Sparse AR content makes alignment hard; overlay adds dense grid + force-visible marks.
- Related research: `docs/research/cv-calibration-spike.md` (automated later — out of scope).

### BW locks (open questions resolved for this DSP)

1. **Compositing:** do **not** require new WHEP alpha compositing in OUT. Ship the overlay as a
   scene layer visible in `preview` (and whenever the 3D/opaque view is on). If the canvas paints
   opaque over WHEP, document the ops workaround (e.g. use transparent NDI + vMix, or compare
   marks to a known landmark) — do not block on OUT canvas-alpha work.
2. **Grid default:** **50 m** spacing, extent large enough for a typical course (~1–2 km side or
   clamp to a constant — document choice). No per-venue config UI required in v1.
3. **Visibility:** calibration overlay **force-shows** placed marks/gates/start/finish/buoys with
   high-contrast styling **regardless** of `visible2d`/`visible3d` / ghost hide — overlay off
   restores normal visibility rules.

## In scope

1. SCN render layer: ENU grid + origin marker + high-contrast mark helpers; driven by active POV /
   preview camera (same calibration pipeline as AR).
2. API: `setCalibrationOverlayEnabled(boolean)` / getter; default **off**.
3. UI toggle in **Calib** sidebar section (SCN may mount the checkbox next to existing CAL sliders
   for v1 — note in report for CAL memo). Label e.g. "Calibration overlay".
4. Docs: short `docs/ops/ar-calibration-overlay.md` (or section in an existing calib/ops doc) —
   how to use with sliders.
5. Tests: default off; enable adds overlay group; disable removes/hides; transparent clear still
   safe (overlay geometry should not invent an opaque sky — lines/poles only).

## Out of scope

- Writing calibration offsets automatically (CV).
- Changing `applyCalibration` math.
- Multi-sender NDI / sea-sky (other DSPs).
- OUT WHEP alpha refactor.
- Full world basemap texture draped on 3D (grid + marks only).

## Likely files

- New: `src/scene/calibrationOverlay.ts` (or under `src/scene/calib/`) + test
- Edit: `src/scene/createScene.ts`, `src/main.ts`, Calib sidebar mount point / `offsetSliders.ts`
  host, `src/style.css`, scene README, ops doc

## Inputs provided

- `docs/architecture/ar-calibration-map-overlay.md`
- Existing CAL sidebar section from `DSP-CAL-20260811-01`

## Acceptance criteria

- [ ] Overlay toggle off by default; on shows grid + origin + force-visible marks from POV cam
- [ ] Slider changes still move the overlay with the scene (same camera)
- [ ] No writes to `offsetsStore` from this feature
- [ ] `npm test` + `npm run build` green
- [ ] Ops note checked in

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for SCN (+ CAL if you mounted into Calib UI)
