# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-27  
**Session role:** BW

## Current phase
**Phase 2 in progress.**  
- **2.1–2.3 done** (glTF boats, multi-boat fleet, course + buoys; 79/79 tests)  
- **Next (BW pick):** **2.4** multi-POV switch (SCN+TEL)  
- **2.7** names later; OUT chroma remains Phase 3  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)  
Last push: `16a89fb` (2.1–2.2). **2.3 still uncommitted.**

## What works today
- TEL: mock | replay multi-boat via `boatIds` (default `21–24`); live single `wsBoatUrl`
- GEO: EGM96 + ENU; pose bus multi-id keyed
- CAL: FOV 66.8832° + offset store + sliders
- SCN: fleet registry + tags; demo Istanbul course/buoys (`courseUrl`, water Y=0, `gpsToEnuAmsl`); HUD/map course marks
- Config: `boatIds`, `courseUrl` → `/fixtures/course/demo-istanbul.json`

## Priority queue
1. **Land 2.3** — commit/push course+buoys  
2. **2.4** multi-POV  
3. **2.5–2.6** sponsors / countdown (or **2.7** names if tags matter more)  
4. Parallel later: OUT **3.1** chroma  
5. Optional: live multi-URL TEL, VPS soak, CON deeplink, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- None for 2.4  
- Live multi-boat soak blocked until TEL follow-up + VPS URLs
