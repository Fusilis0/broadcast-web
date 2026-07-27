# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-27  
**Session role:** BW

## Current phase
**Phase 2 complete.**  
**Phase 3 in progress** — **3.1 + 3.2 done** (chroma clear + visual timecode; 149 tests).  
- **3.3** WHEP still deferred until underlay/CV needed  
- **Next:** land 3.2 commit; then **3.5** vMix experiment (human) and/or **3.4** HUD harden / **3.6** CON deeplink  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)  
Last push: `0fb3dcc` (3.2).  
**Standing order:** after accepted Phase slices, BW may commit/push landings without waiting for an explicit ask.

## What works today
- Full race-content spine + name/colour tags
- OUT: preview/chroma clear + Unity-compatible 8×8 LSB visual timecode overlay
- Config: `timecodeEnabled`, `timecodeCorner`, `timecodeSizePx`

## Priority queue
1. **3.5** local vMix chroma experiment when studio ready (human + OUT)  
2. Parallel software: **3.4** HUD harden and/or **3.6** CON deeplink  
3. **3.3** WHEP only when underlay/CV needed  
4. Optional: live multi-URL TEL, VPS soak, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- **3.5** needs studio PC + vMix (human)  
- **3.3** product-gated (CV/underlay need)
