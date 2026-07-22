# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-22  
**Session role:** BW

## Current phase
Phase 0 — **scaffold green**.  
Done: 0.1 docs, 0.3 Vite/Three, 0.4 folders, 0.7 config stubs.  
Remaining Phase 0: 0.5 stub HUD (SCN), 0.6 EGM96 (GEO), 0.2 GitHub remote (optional).

## Locked decisions
- Project name: `broadcast-web`
- Local folder now; GitHub `fusilis` private later
- Browser only; no Electron
- Orchestrators plan/dispatch only; workers implement in new chats
- Console: talk/design only; no repo pull today
- Output priority: Chroma → WebRTC underlay → egress → NDI helper last
- Cesium/tiles deferred; 2D map early
- Telemetry: mock/replay first; live at Version 1 spine
- Boat alt: HAE provisional
- Language: English

## Open orchestrator sessions (human-tracked)
- BW: this chat
- PLT: scaffold DSP complete
- CON: DSP-CON-20260722-01 still active (P1 — can wait)
- Next to drive: **GEO** + **TEL** (parallel)

## Open dispatches
- P1: `DSP-CON-20260722-01-console-deeplink-contract` (optional)
- Need GEO + TEL to issue Phase 1 spine DSPs

## Blockers
- None for Phase 1 spine start

## Next actions for human
1. Paste into **GEO** chat (or re-open with BOOTSTRAP_GEO): ask for DSP — EGM96 copy + GeoOrigin/GeoUtils + tests
2. Paste into **TEL** chat (or BOOTSTRAP_TEL): ask for DSP — DTOs + router + mock source
3. Run those two worker chats in parallel after DSPs exist
4. Optional: ask BW/PLT for a git commit of scaffold

## Notes
- Unity reference: `C:\Users\PC\Documents\GitHub\broadcast`
- Worker left uncommitted; human may request commit anytime
