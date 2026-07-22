# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-22  
**Session role:** BW

## Current phase
Phase 1 — **pose spine accepted** (mock → ENU → boat + drone camera).  
**Done:** 0.1–0.4, 0.6–0.7, 1.1–1.3, **1.5, 1.6**.  
**Open for Milestone A:** 0.5 stub HUD, **1.7 2D map**.  
Then: 1.8 sliders, 1.4 replay, 1.9 live.  
Remote: https://github.com/Fusilis0/broadcast-web

## Accepted (this update)
- DSP-GEO-20260722-02 — pose ENU bus + config origin + lerp → `poseBus`
- DSP-CAL-20260722-01 — offset store + apply; default FOV 66.8832°
- DSP-SCN-20260722-01 — boat 21 + drone cam from `poseBus`; cube removed; Unity→Three Ry(π)

## Contracts locked
- Consume `poseBus` `pose`: `{ id, kind, position, rotation, fovHDeg, ts }`
- Render FOV = `fovHDeg` only
- Boat HAE; drone relative + takeoff; declination 0

## Known quirk
- Mock drone/boat ~300 m apart; boat intermittent until gimbal yaw sweeps — OK for now

## Priority queue
1. **P0:** Commit + push spine (ask human)  
2. **P0:** SCN **1.7** 2D map + **0.5** stub HUD  
3. **P1:** CAL **1.8** sliders  
4. **P1:** TEL **1.4** replay → **1.9** live  
5. Optional: CON deeplink  

## Next actions for human
1. Say **“commit and push”** to land spine on GitHub  
2. Tell **SCN**: draft DSP for 2D map (1.7) + stub HUD (0.5)  
3. Optional: CAL draft 1.8 sliders  

## Blockers
- None
