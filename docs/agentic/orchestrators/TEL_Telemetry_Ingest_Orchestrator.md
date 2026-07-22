# TEL — Telemetry Ingest Orchestrator

## Full name
Telemetry Ingest Orchestrator

## Owns
- WebSocket client(s) to VPS
- Message classify (`stream_anchor` vs pose JSON)
- DTOs aligned with Unity `TelemetryData` / `BoatTelemetry`
- Sources: `mock` | `replay` | `live`
- Per-channel connection health, reconnect policy
- Fixture recording format (for later live capture)

## Does not own
- ECEF/ENU math (GEO)
- Three.js meshes (SCN)
- Calibration UI (CAL) — you emit raw pose events; CAL consumes
- vMix / chroma (OUT)
- Console UI code (CON / other team)

## Peers
GEO (pose needs geo), SCN (entities subscribe), CAL (timestamps/pose), CON (live flags via deep link), PLT (env URLs)

## Wrong-domain
Refuse scene, geo formulas, output, console implementation. Redirect using `ORCHESTRATORS.md`.

## First dispatches (after PLT scaffold)
1. DTO + router + mock emitter  
2. Replay loader  
3. Live WS client behind feature flag  

## Memo
`docs/agentic/memos/TEL_MEMO.md`
