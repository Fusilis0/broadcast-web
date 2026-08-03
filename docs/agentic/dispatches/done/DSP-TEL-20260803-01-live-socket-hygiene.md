# Dispatch DSP-TEL-20260803-01-live-socket-hygiene

## Meta
- From orchestrator: BW (ops feedback 2026-08-03)
- Worker role: WORKER(DSP-TEL-20260803-01-live-socket-hygiene)
- Priority: P0
- Phase: Live ops polish (post Fleet / Live panel)
- Related: `src/telemetry/ingest.ts`, `liveSource.ts`, `liveWsUrl.ts`, `src/scene/fleetLivePanel.ts`, HUD connection status
- BW ask: Connect live must not open unused default sockets; `open` must not be mistaken for “data flowing”
- **Status: DONE** (BW accepted 2026-08-03)

## Goal

Live connect opens **only** the boat/drone ids the operator registered (or explicitly enabled). HUD/Fleet show **per-id** socket + last-packet age so ops can tell VPS handshake vs real telemetry.

## Background

- Today: defaults `boatIds=["21"…"24"]`, `povIds=["1","2"]` → Connect live opens **6** sockets on VPS base URL.
- Server accepts WS even when that id sends no frames → `ws drone=open boat=open` with frozen scene.
- Aggregate channel status = any socket open → channel open (`liveSource.ts`).

## In scope

1. Fleet panel: enable/disable per boat & drone row; Connect uses only **enabled** ids (defaults: keep current list but document; prefer starting empty or only last-edited for live).
2. Do not reconnect the full default fleet when ops cleared to a single id (e.g. boat `40` only).
3. Status: per-id `open|closed` + `lastPacketAgeMs` (or “no packets”); HUD line can stay compact (`drone=open/1pkt` style OK).
4. Optional soft: warn if sockets open but no packets for N seconds.
5. Tests for URL list = enabled ids only; `npm test` green.
6. Short note in `src/telemetry/README.md` + Fleet panel hint.

## Out of scope

- Free cam / NDI split
- World-anchor UI
- Project save-as API
- Changing VPS URL contract (`?type=drone&id=`)

## Acceptance criteria

- [ ] With only boat `40` enabled, Connect opens **one** boat socket; no drone sockets
- [ ] HUD/Fleet can distinguish connected-empty vs receiving packets
- [ ] `npm test` + `npm run build` green

## Worker paste block

```
You are WORKER(DSP-TEL-20260803-01-live-socket-hygiene).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260803-01-live-socket-hygiene.md
2. src/telemetry/ingest.ts, liveSource.ts, liveWsUrl.ts
3. src/scene/fleetLivePanel.ts
4. src/scene/stubHud.ts (connection status)

Implement enabled-id live sockets + last-packet visibility. No free cam, no NDI, no origin UI.
Report back per dispatch.
```
