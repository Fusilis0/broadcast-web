# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-28  
**Session role:** BW

## Current phase
**Phase 2 complete.**  
**Phase 3 in progress** — **3.1 + 3.2 + 3.4 done**.  
- **3.6 open:** CON DSP issued — `DSP-CON-20260728-01-deeplink-contract-parser`  
- **3.5** human-pending (studio Results)  
- **3.3** WHEP deferred  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)  
Last push: landing 3.6 DSP with this commit.  
**Standing order:** after accepted Phase slices, BW may commit/push landings without waiting for an explicit ask.

## What works today
- Full race-content spine + name/colour tags
- OUT: preview/chroma + visual timecode
- HUD: live WS status; CAL multi-device over `povIds`
- Console deeplink: contract still stub until 3.6 worker

## Priority queue
1. **3.6** CON deeplink contract + parser (DSP active)  
2. **3.5** studio Results when ready  
3. **3.3** WHEP only when underlay/CV needed  
4. Optional: live multi-URL TEL, VPS soak, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- **3.5** needs studio PC + vMix (human)  
- **3.6** “agreed” with console team is after contract ships  
- **3.3** product-gated
