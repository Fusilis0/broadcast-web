# CAL_MEMO

**Last updated:** 2026-07-23  
**Status:** Idle — roadmap **1.8** accepted

## Focus
None active. V1 human calib UI landed; await BW for next CAL work (persistence / multi-device / CV later).

## Decisions
- Offsets are first-class; CV will write same knobs (no second pose pipeline)
- Default hFOV **66.8832°** for Mini 4 Pro (architecture §5.3)
- Declination default **0** (GEO-owned)
- Web V1 contract: §5.3 five fields; east/north deferred
- Apply order (Unity-aligned): world yaw × telemetry rot × local pitch/roll; alt on ENU Y; FOV from offsets (not `cam.fov`)
- Owns `src/calibration/` + pose apply helpers; SCN draws
- **1.8 UX:** CAL-owned `startOffsetSliders` panel; store-only writes; V1 device `"1"`; Reset → `resetOffsets`
- Slider ranges (locked by worker): yaw/pitch/roll ±45° step 0.1; FOV 20–120° step 0.1; alt ±50 m step 0.1
- Persistence / multi-device picker deferred

## Issued dispatches
—

## Done
- **DSP-CAL-20260722-01-default-fov-zero-offsets** — store + apply + FOV default (1.5/1.6)
- **DSP-CAL-20260723-01-offset-sliders** — human offset sliders → `startOffsetSliders` in `src/calibration/offsetSliders.ts`, mounted from `main.ts`; roadmap **1.8** acceptance met (device `"1"`, five knobs + Reset, store-only writes); 38/38 tests + manual yaw/FOV verify

## Planned
- Optional: localStorage / export of offsets
- Optional: multi-device picker (beyond `"1"`)
- Later: CV spike doc (Phase 4 / roadmap 4.5)

## Handoffs
—

## Blockers
- None

## Next actions
1. Notify BW: **1.8** green — CAL idle until next priority.
2. On BW ask: draft persistence DSP and/or multi-device picker.
