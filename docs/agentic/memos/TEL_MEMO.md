# TEL_MEMO

**Last updated:** 2026-07-23  
**Status:** Roadmap 1.9 done — Phase 1 TEL spine complete

## Focus
All Phase 1 TEL items shipped: mock (1.3), replay (1.4), live WS behind flag (1.9). Default remains **mock**. Idle pending BW route (Phase 2 multi-fleet / recorder / soak).

## Decisions
- Unity parity targets (read-only): `TelemetryData` / `BoatTelemetry`, `TelemetryWsJsonRouter` (`stream_anchor` vs pose), `StreamAnchorMessage`.
- Channel ID bands (arch §5.1): drones `1–4`, cams `11–12`, boats `21–52`, pilots `81–84`.
- Mock / sample replay IDs: drone `"1"`, boat `"21"`.
- Bus events: `drone` | `boat` | `stream_anchor`.
- Modes: `mock` | `replay` | `live` all implemented; committed default **`mock`**.
- Live URL resolve: options → `VITE_WS_URL` / `VITE_WS_BOAT_URL` → `config.json` `wsUrl` / `wsBoatUrl`.
- Empty live URLs soft-fail; reconnect capped exponential backoff; `stop` closes cleanly.
- HTTPS pages need **`wss://`** (mixed content); PLT reverse-proxy remains roadmap **5.2**.
- Fixture v1 for replay; **recorder** still not implemented (later).
- Multi-channel fleet deferred to Phase 2+.
- Boat packets stay boat-shaped at ingest; `boatToStandardTelemetry` for normalized pose — no ENU in TEL.
- No pose math, scene meshes, or output in TEL dispatches.

## Issued dispatches
- **DSP-TEL-20260722-01-dto-router-mock** — **DONE** → `docs/agentic/dispatches/done/`
- **DSP-TEL-20260723-01-replay-fixture-loader** — **DONE** → `docs/agentic/dispatches/done/`
- **DSP-TEL-20260723-02-live-ws-client** — **DONE** → `docs/agentic/dispatches/done/`  
  Live WS client; HUD live wired; default mock; empty URLs soft-fail; reconnect; `ws`/`wss` docs. Real VPS soak not run (human-gated).

## Handoffs
- **FYI BW:** Roadmap **1.9** accepted by TEL → **Phase 1 TEL work complete** (spine modes mock/replay/live). Optional Milestone A-live = human soak vs VPS.
- FYI GEO/SCN: all three modes share the same bus.
- FYI PLT: client requires `wss://` on HTTPS; reverse-proxy remains 5.2.

## Blockers
- None.

## Next actions
1. BW: acknowledge Phase 1 complete / prioritize Phase 2 or OUT.
2. Optional human: soak live against real VPS via local `.env` (steps in `src/telemetry/README.md`).
3. Later TEL: fixture recorder; multi-channel fleet (Phase 2+).
