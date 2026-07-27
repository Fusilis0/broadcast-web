# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-27  
**Session role:** BW

## Current phase
**Phase 2 in progress.**  
- **2.1–2.5 done** (sponsors subset; 106/106 tests)  
- **Next (BW pick):** **2.6** countdown flags (SCN)  
- Then **2.7** names; OUT chroma remains Phase 3  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)  
Last push: `7ebf504` (2.4). **2.5 still uncommitted.**

## What works today
- TEL: `boatIds` + `povIds` mock multi-emit; live single URLs
- GEO / CAL / pose spine as before
- SCN: fleet + course + multi-POV + sponsors subset
- Config: `boatIds`, `povIds`, `courseUrl`, sponsors fixture path (see SCN DSP)

## Priority queue
1. **Land 2.5** — commit/push  
2. **2.6** countdown flags  
3. **2.7** name/colour JSON  
4. Parallel later: OUT **3.1** chroma  
5. Optional: live multi-URL TEL, VPS soak, CON deeplink, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- None for 2.6
