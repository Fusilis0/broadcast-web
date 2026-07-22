# GEO_MEMO

**Last updated:** 2026-07-22  
**Status:** Active — pose ENU bus DSP issued; awaiting worker

## Focus
Phase 1.5 GEO slice: config origin + TEL bus → midpoint-lerp ENU on `src/pose/` bus; SCN draws via handoff.

## Decisions
- Axis contract: Three.js `x=East`, `y=Up`, `z=North` — locked
- Boat altitude: HAE provisional; drone: relative + `takeoffAltitudeMSL` + EGM96
- Origin: from `public/config.json` (mock Istanbul center near TEL tracks — not 0,0)
- Pose live in `src/pose/`; **no meshes** in GEO DSPs
- CAL offsets / FOV deferred to CAL DSP (GEO emits raw/lerp ENU + packet orientation, offsets = 0)
- Istanbul EGM96 smoke: N ≈ 37.43 m at (41, 29)

## Issued dispatches
- **DSP-GEO-20260722-01-egm96-geo-port** — **DONE** → `docs/agentic/dispatches/done/`
- **DSP-GEO-20260722-02-pose-enu-bus** — **active / awaiting worker**  
  Path: `docs/agentic/dispatches/active/DSP-GEO-20260722-02-pose-enu-bus.md`

## Handoffs
- **HO-GEO-SCN-20260722-01** — request SCN consume pose bus / draw one boat + camera  
  Path: `docs/agentic/handoffs/HO-GEO-SCN-20260722-01.md`

## Blockers
- Waiting on worker for DSP-GEO-20260722-02
- SCN must pick up handoff (separate chat)

## Next after worker reports
1. Accept pose bus; archive DSP to `done/`
2. Confirm SCN issued draw DSP against README contract
3. FYI BW + CAL (offset/FOV stub still open)
