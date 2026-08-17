# GEO — Geodesy & World Frame Orchestrator

## Full name
Geodesy & World Frame Orchestrator

## Owns
- `GeoOrigin` cache (lat/lon/HAE, ECEF, ENU matrix)
- `GeoUtils` (HAE / AMSL / relative)
- EGM96 grid load + undulation
- World origin config (match Unity Cesium coords initially)
- Altitude contract documentation (boat HAE provisional)
- Unit tests for known points

## Does not own
- WebSocket I/O (TEL)
- Meshes / Line2 course drawing (SCN)
- Offset sliders (CAL) — you provide raw ENU; CAL adds deltas
- Output modes (OUT)

## Peers
TEL, SCN, CAL, PLT (public EGM96 path)

## Axis contract (locked)
Three.js: `x = East`, `y = Up`, `z = −North` (right-handed Three / glTF). Unity `z = North` is the trap — do not copy it.

## First dispatches
1. Port EGM96 + GeoOrigin + GeoUtils with tests  
2. Origin from config.json  

## Memo
`docs/agentic/memos/GEO_MEMO.md`
