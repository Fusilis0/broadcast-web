# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-27  
**Session role:** BW

## Current phase
**Phase 2 complete** (2.1–2.7 / Milestone B content).  
**Phase 3 in progress** — **3.1 done** (preview/chroma clear).  
- **Next (BW pick):** **3.2** visual timecode (OUT)  
- **3.3** WHEP deferred until underlay/CV needed  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)  
Last push: `7eee8de` (2.7). **3.1 still uncommitted.**

## What works today
- Full race-content spine: fleet, course, POV, sponsors, flags, name/colour tags
- TEL mock/replay/live (live single URLs); GEO/CAL pose path
- OUT: `preview` / `chroma` clear modes (runtime toggle; default preview)
- Studio: capture WebGL window; key on clear green

## Priority queue
1. **Land 3.1** — commit/push  
2. **3.2** visual timecode  
3. **3.5** local vMix chroma experiment (human + OUT) when studio ready  
4. **3.3** WHEP underlay when preview/CV needs video  
5. **3.4** HUD harden / **3.6** CON deeplink as needed  
6. Optional: live multi-URL TEL, VPS soak, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- None for 3.2  
- 3.3 blocked only by product need (no technical gate)
