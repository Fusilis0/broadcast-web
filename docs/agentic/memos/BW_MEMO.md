# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-27  
**Session role:** BW

## Current phase
**Phase 2 in progress.**  
- **2.1–2.4 done** (boats, fleet, course, multi-POV; 99/99 tests)  
- **Next (BW pick):** **2.5** sponsors subset (SCN)  
- Alt: **2.7** names if tags matter more; OUT chroma remains Phase 3  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)  
Last push: `e5c3713` (2.3). **2.4 still uncommitted.**

## What works today
- TEL: `boatIds` + `povIds` mock multi-emit; live still single URLs
- GEO: EGM96 + ENU; pose bus multi-id keyed
- CAL: FOV 66.8832° + per-device offsets + sliders
- SCN: fleet + course + HUD POV switch (`activePovId` ∈ `povIds`, last-pose cache)
- Config: `boatIds`, `povIds` `["1","2"]`, `courseUrl`

## Priority queue
1. **Land 2.4** — commit/push  
2. **2.5** sponsors subset  
3. **2.6** countdown flags  
4. **2.7** name/colour JSON  
5. Parallel later: OUT **3.1** chroma  
6. Optional: live multi-URL TEL, VPS soak, CON deeplink, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- None for 2.5  
- Live multi-POV/boat soak deferred until TEL follow-up + VPS URLs
