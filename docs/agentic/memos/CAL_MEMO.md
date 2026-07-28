# CAL_MEMO

**Last updated:** 2026-07-28  
**Status:** Idle — 3.4 multi-device panel accepted

## Focus
None active. Per-device calib UI landed for `povIds`.

## Decisions
- Offsets are first-class; CV will write same knobs (no second pose pipeline)
- Default hFOV **66.8832°**; declination **0** (GEO-owned)
- Owns `src/calibration/` + pose apply helpers; SCN draws
- Slider ranges locked: yaw/pitch/roll ±45°; FOV 20–120°; alt ±50 m
- **3.4:** device picker over `povIds`; `getDeviceId` / `setDeviceId` / `setPovIds`; HUD POV syncs device in `main`

## Issued dispatches
—

## Done
- **DSP-CAL-20260722-01** — store + apply + FOV default
- **DSP-CAL-20260723-01** — offset sliders (1.8)
- **DSP-SCN-20260727-07** (CAL slice) — multi-device picker over `povIds` (3.4)

## Planned
- Optional: localStorage / export of offsets
- Later: CV spike doc (Phase 4 / roadmap 4.5)

## Handoffs
—

## Blockers
- None

## Next actions
1. Idle until BW asks persistence or CV spike
