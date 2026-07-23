# TEL_MEMO

**Last updated:** 2026-07-23  
**Status:** Roadmap 1.4 done — next live WS behind flag (1.9)

## Focus
Replay fixture v1 + loader shipped. Default remains **mock**. Next slice: live VPS WebSocket behind flag (**1.9**).

## Decisions
- Unity parity targets (read-only): `TelemetryData` / `BoatTelemetry`, `TelemetryWsJsonRouter` (`stream_anchor` vs pose), `StreamAnchorMessage`.
- Channel ID bands (arch §5.1): drones `1–4`, cams `11–12`, boats `21–52`, pilots `81–84`.
- Mock / sample replay IDs: drone `"1"`, boat `"21"`.
- Bus events: `drone` | `boat` | `stream_anchor`.
- Modes: `mock` | `replay` implemented; `live` still no-op until 1.9.
- Fixture v1: JSON `{ version: 1, name, loop, packets: [{ t_ms, channel, payload }] }` → `ingestPacket`.
- Sample: `/fixtures/telemetry/spine-demo.json` (~3 s loop, Istanbul-near).
- Config: default `telemetryMode: "mock"`; `replayUrl` configurable.
- HUD: runtime mock ↔ replay switch; live remains “not wired (TEL 1.9)”.
- Future optional: recorder writing the same v1 shape.
- Boat packets stay boat-shaped at ingest; `boatToStandardTelemetry` for normalized pose — no ENU in TEL.
- No pose math, scene meshes, or output in TEL dispatches.

## Issued dispatches
- **DSP-TEL-20260722-01-dto-router-mock** — **DONE** → `docs/agentic/dispatches/done/`
- **DSP-TEL-20260723-01-replay-fixture-loader** — **DONE** → `docs/agentic/dispatches/done/`  
  Replay fixture v1 + loader; sample `spine-demo`; HUD mock↔replay; live deferred.

## Handoffs
- FYI GEO/SCN: `telemetryBus` + mock/replay sources ready; live still TEL 1.9.
- FYI SCN: HUD “replay deferred” retired for mock/replay path.

## Blockers
- None.

## Next actions
1. Issue live WS client behind feature flag (roadmap **1.9**) when BW prioritizes.
2. Optional later: live→fixture recorder (same v1 shape).
