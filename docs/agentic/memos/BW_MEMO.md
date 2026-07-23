# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-23  
**Session role:** BW

## Current phase
**Phase 1 COMPLETE** — mock / replay / live spine + HUD + map + calib.  
**Next:** Phase 2 (race content) and/or Phase 3 OUT chroma — BW default: **Phase 2 first** (visible fleet/course), OUT when studio wants air experiment.  
Remote: https://github.com/Fusilis0/broadcast-web

## Accepted (this update)
- DSP-TEL-20260723-02 — live WS client behind flag; default `mock`; empty URLs; docs for ws/wss

## Priority queue
1. **P0:** Commit + push TEL 1.9  
2. **P0 Phase 2 start:** SCN **2.1** glTF boat + tags (or primitives→glTF); TEL+SCN **2.2** multi-boat channels  
3. **P1:** SCN course/buoys **2.3**, multi-POV **2.4**  
4. **P1 / parallel:** OUT **3.1** chroma when ready for vMix trial  
5. Optional: TEL recorder; human VPS soak; CON deeplink  

## Next actions for human
1. Say **“commit and push”** for live WS  
2. Tell **SCN**: draft first Phase 2 DSP — **2.1** boat glTF (or improved mesh) + tags; coordinate **2.2** multi-fleet with TEL if needed  
3. Optional: schedule live soak with real `VITE_WS_*` / config URLs  

## Blockers
- None for Phase 2 planning  
- Live soak needs real VPS endpoints (human)
