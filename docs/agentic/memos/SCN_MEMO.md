# SCN_MEMO

**Last updated:** 2026-07-27  
**Status:** Idle — Phase 2 content complete (2.7 accepted); awaiting BW / OUT chroma

## Focus
**Phase 2.1–2.7 done.** Milestone B content gate ready for BW. SCN idle on product features until BW opens Phase 3 support (e.g. HUD harden with CAL) or polish.

## Decisions
- Owns: `src/scene/`, `src/assets/`, stub HUD, 2D map; no geo/WS/chroma
- **2.1–2.7 DONE**
- **2.7:** `boatNamesUrl` → `/fixtures/boats/demo-istanbul-names.json`; Unity nested category→id→name; keyword colours; tags wired via `setTagIdentity`; hull tint deferred
- Chroma is **OUT 3.1** — not SCN

## Issued dispatches
- Through **DSP-SCN-20260727-06-boat-name-colour-json** — **DONE** → `dispatches/done/`  
  Accepted 2026-07-27; tests 123/123

## Handoffs
—

## Blockers
- None

## Next
1. FYI BW: roadmap **2.7** ticked — **Phase 2 content / Milestone B** ready (optional human `npm run dev` tag check)
2. Land commit/push when BW asks
3. No further SCN P0 until BW routes (OUT chroma / 3.4 HUD / Phase 4 map ops)
