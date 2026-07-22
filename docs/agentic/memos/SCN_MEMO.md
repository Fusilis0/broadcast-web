# SCN_MEMO

**Last updated:** 2026-07-22  
**Status:** Bootstrapped — idle until PLT canvas exists

## Focus
Phase 0.5 after PLT scaffold lands: stub HUD + empty scene loop hooks; then plan Phase 1.7 2D map panel.

## Decisions
- V1 freeze: 1 drone + boats + course + 2D map; sponsors/flags can follow (BW)
- Owns: `src/scene/`, `src/assets/`, stub HUD (DOM), 2D map; applies CAL transforms, does not invent geodesy/WS/chroma
- First worker sequence (planned, not issued):
  1. Stub HUD + empty scene loop hooks (roadmap 0.5; PLT light touch if needed)
  2. One boat mesh + one camera helper (Phase 1)
  3. 2D map panel (Phase 1.7)

## Issued dispatches
—

## Handoffs
—

## Blockers
- **PLT scaffold not done** — `DSP-PLT-20260722-01-scaffold-vite-three` active/awaiting worker; no `src/` yet
- Do not issue SCN DSPs until `npm run dev` blank canvas exists

## Next (when PLT reports green)
1. Issue **DSP-SCN-…-stub-hud-scene-hooks** (Phase 0.5): DOM stub HUD (mock/live placeholder + status), scene module hooks into existing render loop, no entities yet
2. Draft plan notes for 2D map panel (deps: GEO ENU + TEL mock points — coordinate handoffs)
3. Update this memo + notify BW that 0.5 is in flight
