# TEL_MEMO

**Last updated:** 2026-07-22  
**Status:** Roadmap 1.3 done — mock ingest live; next replay or live

## Focus
Typed telemetry bus ready for GEO/SCN subscribers. Next slice: replay (1.4) or live WS flag (1.9).

## Decisions
- Unity parity targets (read-only): `TelemetryData` / `BoatTelemetry`, `TelemetryWsJsonRouter` (`stream_anchor` vs pose), `StreamAnchorMessage`.
- Channel ID bands (arch §5.1): drones `1–4`, cams `11–12`, boats `21–52`, pilots `81–84`.
- Mock IDs: drone `"1"`, boat `"21"`.
- Bus events: `drone` | `boat` | `stream_anchor`.
- Modes: `mock` → `replay` → `live`. Config resolves replay/live but they are no-ops until later DSPs.
- Boat packets stay boat-shaped at ingest; `boatToStandardTelemetry` for normalized pose — no ENU in TEL.
- Pose typing after classify is intentionally shallow until live WS; tighten then.
- No pose math, scene meshes, or output in TEL dispatches.

## Issued dispatches
- **DSP-TEL-20260722-01-dto-router-mock** — **DONE** → `docs/agentic/dispatches/done/`  
  DTOs + router + mock ingest (~15 Hz pose, ~1.5 s stream_anchor); counters wired in `main.ts`.

## Handoffs
- FYI GEO/SCN: subscribe via `telemetryBus` / `src/telemetry` exports when ready for ENU / visuals.

## Blockers
- None.

## Next actions
1. Issue replay loader DSP (roadmap **1.4**) when BW prioritizes fixtures.
2. Or issue live WS client behind flag (roadmap **1.9**) when VPS soak is wanted.
3. Optional: tighten typed parse of pose JSON when live lands.
