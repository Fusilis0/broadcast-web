# TEL_MEMO

**Last updated:** 2026-07-27  
**Status:** 2.4 TEL half done — idle pending SCN POV switch / BW route

## Focus
Multi-POV sources shipped for mock (± `spine-pov` replay). SCN owns camera/HUD switch. Live multi-POV URLs deferred.

## Decisions
- Unity parity targets (read-only): `TelemetryData` / `BoatTelemetry`, router, `StreamAnchorMessage`.
- Channel bands (arch §5.1): drones `1–4`, cams `11–12`, boats `21–52`, pilots `81–84`.
- **2.2:** `boatIds` default `["21","22","23","24"]` — **DONE**.
- **2.4:** `povIds` default `["1","2"]`; bands `1–4` ∪ `11–12` — **DONE** (TEL half).
- Mock: one `drone` packet per `povIds` entry per tick (phase offsets); `stream_anchor` → `povIds[0]`; boats unchanged.
- Replay: `/fixtures/telemetry/spine-pov.json`; default `replayUrl` still `spine-demo`.
- Live: single `wsUrl` / `wsBoatUrl` — multi-URL follow-ups later.
- No Three camera / HUD POV switch in TEL (SCN).

## Issued dispatches
- **DSP-TEL-20260722-01-dto-router-mock** — **DONE**
- **DSP-TEL-20260723-01-replay-fixture-loader** — **DONE**
- **DSP-TEL-20260723-02-live-ws-client** — **DONE**
- **DSP-TEL-20260724-01-multi-boat-channels** — **DONE**
- **DSP-TEL-20260727-01-multi-pov-channels** — **DONE** → `docs/agentic/dispatches/done/`  
  `povIds` + mock multi-drone + `spine-pov.json`; live multi-URL deferred.

## Handoffs
- **Acked:** `HO-SCN-TEL-20260727-01` — asks complete (FYI green sent).
- **Sent:** `HO-TEL-SCN-20260727-01` — TEL 2.4 green; SCN can verify ≥2 POVs on mock.
- Prior: `HO-TEL-SCN-20260724-01` (boatIds / fleet).

## Blockers
- None for TEL. Full 2.4 needs SCN `DSP-SCN-20260727-03` accept.

## Next actions
1. SCN: verify/accept multi-POV switch against mock `1`/`2`.
2. Later TEL: live multi-POV / multi-boat URLs; recorder.
