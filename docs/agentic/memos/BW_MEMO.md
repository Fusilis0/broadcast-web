# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-28  
**Session role:** BW

## Current phase
**Phase 2 complete.**  
**Phase 3 in progress** — **3.1 + 3.2 + 3.4 + 3.6 (SPA) done**.  
- **3.6:** contract proposed + parser live; external “agreed” = console-team human follow-up  
- **3.5** human-pending (studio Results) — blocks Milestone C air proof  
- **3.3** WHEP deferred until underlay/CV needed  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)  
Last push: landing 3.6 with this commit.  
**Standing order:** after accepted Phase slices, BW may commit/push landings without waiting for an explicit ask.

## What works today
- Full race-content spine + name/colour tags
- OUT: preview/chroma + visual timecode
- HUD: live WS status; CAL multi-device over `povIds`
- CON: `?mode=&originLat=&originLon=` (etc.) applied at boot

## Priority queue
1. **3.5** studio Results when you can run vMix  
2. Console-team ack of deeplink contract (human / CON)  
3. **3.3** WHEP only when underlay/CV needed  
4. Optional: live multi-URL TEL, Phase 4/5, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- **3.5** needs studio PC + vMix (human)  
- **3.3** product-gated
