# TEL_MEMO

**Last updated:** 2026-07-24  
**Status:** 2.2 TEL half done — idle pending SCN fleet-registry / BW route

## Focus
Multi-boat channels shipped for mock + replay. Live multi-URL still deferred. Waiting on SCN registry (or BW next).

## Decisions
- Unity parity targets (read-only): `TelemetryData` / `BoatTelemetry`, router, `StreamAnchorMessage`.
- Channel bands (arch §5.1): drones `1–4`, cams `11–12`, boats `21–52`, pilots `81–84`.
- **2.2 config (BW lock):** `boatIds: string[]` — default `["21","22","23","24"]`; out-of-band filtered with warn; empty → four-id default.
- **Pilots `81–84` deferred** out of 2.2.
- Mock: one `boat` packet per `boatIds` entry per tick (phase offsets); drone `1` + `stream_anchor` unchanged.
- Replay: `spine-fleet.json` (21–24); default `replayUrl` still `spine-demo`.
- Live: single `wsBoatUrl` only — multi-URL / subscribe-map = follow-up TEL DSP.
- Bus contract for SCN: `boat` events with distinct `BoatTelemetry.id` ∈ `boatIds`; use `loadConfig().boatIds`.
- No pose math, scene meshes, or output in TEL dispatches.

## Issued dispatches
- **DSP-TEL-20260722-01-dto-router-mock** — **DONE**
- **DSP-TEL-20260723-01-replay-fixture-loader** — **DONE**
- **DSP-TEL-20260723-02-live-ws-client** — **DONE**
- **DSP-TEL-20260724-01-multi-boat-channels** — **DONE** → `docs/agentic/dispatches/done/`  
  `boatIds` + mock multi-emit + `spine-fleet.json`; live multi-URL deferred.

## Handoffs
- **Acked:** `HO-SCN-TEL-20260723-01`
- **Sent:** `HO-TEL-SCN-20260724-01` — config shape locked; **TEL worker green** — SCN can implement fleet-registry against mock/replay now.
- FYI PLT: `wss://` on HTTPS still 5.2.

## Blockers
- None for TEL. 2.2 complete on TEL side pending SCN registry.

## Next actions
1. SCN: fleet-registry DSP/worker (if not already) — `loadConfig().boatIds`, mock 21–24, optional replay `spine-fleet`.
2. Later TEL: live multi-boat URLs; fixture recorder; full `21–52` via config only.
