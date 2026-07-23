# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-23  
**Session role:** BW

## Current phase
Phase 1 nearly complete.  
**Done:** Milestone A, 1.4 replay, 1.8 sliders.  
**Open Phase 1:** **1.9** live WS behind flag.  
Remote: https://github.com/Fusilis0/broadcast-web

## Accepted (this update)
- DSP-TEL-20260723-01 — replay fixture v1 + `spine-demo`; HUD mock↔replay; live warn-only

## Priority queue
1. **P0:** Commit + push TEL 1.4 (if uncommitted)  
2. **P0:** TEL **1.9** live WS behind flag (wire HUD `live` for real; default stays mock)  
3. After 1.9: Phase 1 complete → Phase 2 (SCN race content) and/or OUT chroma  
4. Optional later: TEL recorder; CAL persistence; CON deeplink; CV  

## Next actions for human
1. Say **“commit and push”** for replay work  
2. Tell **TEL**: draft DSP for roadmap **1.9** — live WebSocket client behind flag; mock/replay unchanged as defaults  

## Blockers
- None (need VPS `ws`/`wss` URL in config/env for soak — document in DSP)
