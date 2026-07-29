# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-29  
**Session role:** BW

## Current phase
**Phase 0–2 complete; Phase 3 almost closed** (only **3.5** studio Results).  
**Design lock (2026-07-29):** race **projects** + map editor + shared 3D/2D features + DB remote load + **NDI optimum** air path — see architecture docs / roadmap Phases **4 / 6 / 7**.  
Remote: https://github.com/Fusilis0/broadcast-web  
**Standing order:** land accepted slices with commit/push.

## What works today
- Spine + race content fixtures + calib HUD + deeplink parser
- OUT: chroma, timecode, WHEP underlay
- TEL: mock/replay(loop)/live
- Single config pack pointers (not multi-project DB yet)

## Still human
1. **3.5** vMix Results  
2. Console deeplink ack  

## Next software tracks
1. **Phase 4.2+** map editor + shared features (+ GeoJSON)  
2. **Phase 6** RaceProject schema → API/DB → `?race=` far-PC load  
3. **Phase 5** Hetzner + chroma air runbook; NDI evaluate  
4. **Phase 7** NDI production (Electron / helper / third-party)  

## Compaction recovery
`BOOTSTRAP_BW.md` → this memo → `docs/roadmap/phases-roadmap.md` + `docs/architecture/race-projects-and-world-authoring.md`
