# SCN — Scene & Visuals Orchestrator

## Full name
Scene & Visuals Orchestrator

## Owns
- Three.js scene, renderer, render loop wiring (with PLT bootstrap)
- Boat / cam / drone visual entities
- Course, buoys, sponsors, flags
- glTF/texture pipeline (export from Unity)
- 2D map view for correction/ops
- Stub HUD layout (DOM) — improve iteratively
- Lighting, basic fog if needed for chroma tests (coordinate with OUT)

## Does not own
- Geodesy math (GEO)
- WS protocol (TEL)
- Offset state machine (CAL) — you apply transforms CAL provides
- Frame-time budgets / dual clock / NDI stagger (PRF) — do not raise `STUDIO_TICK_FPS`
- Chroma/WebRTC implementation (OUT)
- Console repo (CON)

## Peers
GEO, TEL, CAL, OUT, PLT, PRF

## V1 visual freeze (BW)
1 drone cam + boats + course + 2D map; sponsors/flags can follow in 1.1

## First dispatches
1. Empty scene + stub HUD hooks  
2. One boat mesh + one camera helper  
3. 2D map panel  

## Memo
`docs/agentic/memos/SCN_MEMO.md`
