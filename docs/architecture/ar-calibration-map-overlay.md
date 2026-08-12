# AR calibration — coordinate/world-map overlay for manual sight comparison

**Status:** Design + **dispatch issued** — `DSP-SCN-20260812-02` (run after SCN-01).  
**Owner:** CAL (+ SCN for the overlay render, OUT for underlay compositing it sits alongside).  
**Related:** `src/calibration/` (offsets store + sliders), `src/output/whepUnderlay.ts` (real
camera feed), `docs/research/cv-calibration-spike.md` (the **automated** CV version of this same
idea — see §4 for how they relate).

## 1. The ask

> "For AR calibration, having option to open world map on 3D world with exact coordinates would
> be good, so we can compare it with real camera view."

Today, calibrating a POV camera means adjusting yaw/pitch/roll/FOV/alt sliders
(`src/calibration/offsetSliders.ts`, `CalibrationOffsets` in `src/calibration/`) until the
synthetic AR render (boats, course, buoys — all placed from real GPS via the ENU pipeline) lines
up with what the real camera actually sees. There is currently **no direct visual aid** for this
beyond the AR content itself (which is often sparse — a few boats, some markers) and the
independent WHEP underlay (`src/output/whepUnderlay.ts`, real camera video shown **under** the
canvas in `preview` mode only). Lining up sparse boat positions with a live camera is harder than
it needs to be, especially before boats are on the water or when only a couple of marks are
placed.

## 2. Proposed feature

A toggleable **coordinate overlay** rendered from the active POV camera, showing the exact
real-world ENU grid / marks / course geometry as dense, unambiguous reference geometry — not just
"whatever WorldFeatures happen to be placed" but a deliberately calibration-friendly layer:

- **ENU grid lines** at a configurable spacing (e.g. every 50 m / 100 m) extending out from the
  world origin, each labeled with its offset (so a horizon-level gridline is a strong pitch/roll
  cue even with zero boats on the water).
- **All placed marks/gates/start-finish/buoys**, drawn with high-contrast, unmissable styling
  (thin poles + labels) regardless of their normal AR visibility toggles — calibration mode should
  show *everything* with known coordinates, not respect per-asset hide/show state.
- Optionally, the **world origin** itself as a marker (it's already a real lat/lon per
  `config.origin` / world-anchor UI — useful as a single, unambiguous "does this point match reality"
  check).

This overlay renders through the **same calibrated camera** (`applyCalibration` pipeline in
`src/pose/`) as the rest of AR, so it moves exactly like the rest of the scene when sliders
change — the whole point is that a mismatch between overlay and real camera *is* the calibration
error, made visible even when the race itself has little content on screen yet.

## 3. Where it's viewed — side-by-side with the real camera

The natural place to *compare* is wherever the real camera is already visible next to the
synthetic render:

- **`preview` + WHEP underlay** (`src/output/whepUnderlay.ts`) is the existing "real camera under
  the canvas" path — turning on the coordinate overlay here gives literally the ask: synthetic
  grid drawn over (or admittedly, currently *replacing*, since the canvas isn't alpha-blended with
  the underlay in preview today — confirm current compositing before assuming true overlay vs.
  side-by-side) the live feed for direct comparison.
- Alternatively, once the **3D channel** exists (`multi-output-streaming.md`), the calibration
  overlay could be a dedicated mode of that channel — useful when there's no WHEP underlay
  configured and the operator just wants to sanity-check placed-coordinate accuracy against a
  phone photo or a known landmark bearing, without needing a live camera feed wired up at all.

Both are valid v1 targets; the doc doesn't pick one yet (see open questions).

## 4. Relationship to the CV calibration spike

`docs/research/cv-calibration-spike.md` already describes an **automated** version of this exact
comparison — a CV estimator matching the live camera frame to the synthetic view and writing
`setOffsets` deltas itself. This feature is the **manual precursor**: instead of an algorithm
doing the matching, a **human** looks at the overlay vs. the real camera and drags the existing
sliders until they agree. Concretely, this ships:

- The exact "synthetic proxy to compare against video" concept the CV spike's Milestone 1 assumes
  (`cv-calibration-spike.md` §"Candidate approaches", Approach A) — except rendered for a human's
  eyes, with deliberately exaggerated/labeled reference geometry instead of a CV-friendly
  silhouette.
- No new pose bus, no new offset-writing path — it's a **read-only visualization** layered on top
  of the existing `applyCalibration` → SCN camera pipeline. Zero risk to the calibration math
  itself.

This is worth building **before** any CV work — it gives operators a usable manual tool today, and
whatever rendering path it needs (geo-referenced grid draw, camera-aligned overlay compositing)
will very likely be reused as the CV spike's own synthetic-proxy renderer later.

## 5. Suggested slice (for the eventual CAL/SCN dispatch — not written yet)

1. New SCN render layer: ENU grid + "show all marks regardless of visibility toggle" mode, off by
   default, driven by the same active-POV camera as AR.
2. CAL-side toggle (Calib sidebar section) to arm/disarm the overlay per device — mirrors the
   existing device-picker pattern in `offsetSliders.ts`.
3. Confirm interplay with WHEP underlay compositing (§3 open question) — decide overlay-on-video
   vs. side-by-side before building, since it changes whether this needs new canvas-alpha work in
   OUT's `whepUnderlay.ts` or is free once the render layer exists.
4. Document a short "how to calibrate with the overlay" ops runbook once shipped (candidate:
   extend `docs/ops/vmix-ndi-alpha-runbook.md` or a new `docs/ops/ar-calibration-overlay.md`).

## Open questions

| # | Question |
| --- | --- |
| 1 | Does `preview` mode's canvas currently composite with alpha over the WHEP `<video>` underneath, or does an opaque scene paint over it entirely? This decides whether "overlay over real camera" is free today or needs new alpha-compositing work in OUT. |
| 2 | Grid spacing / extent defaults — tied to typical course size (tens to a few hundred meters) or should it be configurable per venue? |
| 3 | Should calibration mode force-show hidden assets (ghost/invisible boats, hidden features) globally, or only add the grid/labels on top of whatever's already visible? |
