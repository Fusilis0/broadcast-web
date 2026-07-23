# SCN_MEMO

**Last updated:** 2026-07-23  
**Status:** Active — 0.5+1.7 DSP issued; awaiting worker

## Focus
Milestone A ops overlay: stub HUD + simple 2D fleet map from `poseBus`.

## Decisions
- V1 freeze: 1 drone + boats + course + 2D map; sponsors/flags can follow (BW)
- Owns: `src/scene/`, `src/assets/`, stub HUD (DOM), 2D map; applies CAL transforms, does not invent geodesy/WS/chroma
- Consume **`poseBus`** only for positions (`PoseEvent`); TEL bus OK for packet counts
- Mode UI is **placeholder** until TEL 1.9 — must not open WS / switch ingest
- 2D map: North-up, plot ENU East(x) vs North(z); no tiles
- **One DSP** for 0.5 + 1.7 (both small DOM overlays)

## Issued dispatches
- **DSP-SCN-20260722-01-boat-drone-camera** — **DONE** → `docs/agentic/dispatches/done/`  
  Boat 21 + drone cam from `poseBus`; cube removed
- **DSP-SCN-20260723-01-stub-hud-2d-map** — `docs/agentic/dispatches/active/DSP-SCN-20260723-01-stub-hud-2d-map.md`  
  Status: **active / awaiting worker**  
  Goal: stub HUD (mode placeholder + status) + 2D map fleet points; refactor status out of `main.ts`

## Handoffs
- **HO-SCN-GEO-20260722-01** — satisfied by GEO-02 `poseBus` (spine on main)

## Blockers
- None for this DSP — spine + `poseBus` on main

## Next
1. Human opens **new worker chat** with DSP paste block
2. On accept: tick roadmap 0.5 + 1.7; notify BW Milestone A closer
3. Later: Phase 2 content / map ops UX (4.2)
