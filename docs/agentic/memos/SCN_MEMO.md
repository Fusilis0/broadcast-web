# SCN_MEMO

**Last updated:** 2026-07-27  
**Status:** Idle — 2.5 accepted; awaiting BW next slice

## Focus
Phase 2 race content — sponsors subset landed; next likely **2.6** countdown flags or **2.7** names.

## Decisions
- Owns: `src/scene/`, `src/assets/`, stub HUD, 2D map; no geo/WS/chroma
- **2.1–2.5 DONE**
- **2.5:** `sponsorsUrl` → `/fixtures/sponsors/demo-istanbul.json` (3 panels); `gpsToEnuAmsl`; water Y=0; facing left-of-A→B; procedural label textures
- Sponsor fixture labels ≠ boat name/colour JSON (**2.7** deferred)
- No chroma (OUT 3.x)

## Issued dispatches
- Through **DSP-SCN-20260727-04-sponsors-subset** — **DONE** → `dispatches/done/`  
  Accepted 2026-07-27; tests 106/106

## Handoffs
- 2.4 TEL/SCN HOs — closed

## Blockers
- None

## Next
1. FYI BW: roadmap **2.5** ticked; land commit/push when asked
2. BW pick: **2.6** countdown flags / **2.7** names / OUT chroma
