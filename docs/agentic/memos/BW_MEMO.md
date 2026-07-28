# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-28  
**Session role:** BW

## Current phase
**Phase 2 complete.**  
**Phase 3 in progress** — **3.1 + 3.2 + 3.4 done** (chroma, timecode, connection/calib HUD; 154 tests).  
- **3.5** still human-pending (studio Results / vMix runbook)  
- **Next software:** **3.6** CON deeplink (or **3.3** WHEP if underlay/CV needed)  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)  
**Standing order:** after accepted Phase slices, BW may commit/push landings without waiting for an explicit ask.  
Last push: `7c83f10` (3.4).

## What works today
- Full race-content spine + name/colour tags
- OUT: preview/chroma + visual timecode
- HUD: live WS drone/boat status; mock/replay `ws=n/a`
- CAL: multi-device picker over `povIds`; synced from HUD POV

## Priority queue
1. **3.5** studio Results when you can run vMix  
2. **3.6** CON deeplink  
3. **3.3** WHEP only when underlay/CV needed  
4. Optional: live multi-URL TEL, VPS soak, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- **3.5** needs studio PC + vMix (human)  
- **3.3** product-gated (CV/underlay need)
