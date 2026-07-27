# SCN_MEMO

**Last updated:** 2026-07-27  
**Status:** Idle — 2.6 accepted; awaiting BW next slice

## Focus
Phase 2 race content — countdown flags landed. Next: **2.7** name/colour JSON (closes Milestone B content) or OUT chroma.

## Decisions
- Owns: `src/scene/`, `src/assets/`, stub HUD, 2D map; no geo/WS/chroma
- **2.1–2.6 DONE**
- **2.6:** `flagsUrl` → `/fixtures/flags/demo-istanbul-countdown.json`; `demoTimeScale: 20`; Unity phase timeline; `gpsToEnuAmsl`; water Y=0; HUD Start/Pause/Reset/Restart; blue-white +6 m
- No boat name/colour JSON yet (**2.7**); no chroma (OUT 3.x)

## Issued dispatches
- Through **DSP-SCN-20260727-05-countdown-flags** — **DONE** → `dispatches/done/`  
  Accepted 2026-07-27; tests 115/115

## Handoffs
—

## Blockers
- None

## Next
1. FYI BW: roadmap **2.6** ticked; land commit/push when asked
2. BW pick: **2.7** name/colour JSON (default) / OUT chroma
