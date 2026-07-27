# SCN_MEMO

**Last updated:** 2026-07-27  
**Status:** Idle — 2.3 accepted; awaiting BW next slice

## Focus
Phase 2 race content — course/buoys landed; next likely 2.4 multi-POV.

## Decisions
- V1 freeze: 1 drone + boats + course + 2D map; sponsors/flags can follow (BW)
- Owns: `src/scene/`, `src/assets/`, stub HUD, 2D map; no geo/WS/chroma
- **2.1–2.2 DONE** (pushed `16a89fb`)
- **2.3 DONE** (`DSP-SCN-20260727-02`) — demo Istanbul course + buoys; water Y = 0; `courseUrl`; ENU via `gpsToEnuAmsl` only; 2D map orange mark dots
- Buoy labels = fixture waypoint names only — **not** boat name/colour JSON (**2.7** deferred)
- No chroma (OUT 3.x)

## Issued dispatches
- Prior SCN DSPs — **DONE** (see `dispatches/done/`)
- **DSP-SCN-20260727-02-course-buoys** — archived `dispatches/done/` — **DONE**

## Handoffs
- **HO-TEL-SCN-20260724-01** — closed (2.2)

## Blockers
- None

## Next
1. Land 2.3 (commit/push when BW asks)
2. BW pick: **2.4** multi-POV (default) / 2.5–2.6 / 2.7 / OUT chroma
