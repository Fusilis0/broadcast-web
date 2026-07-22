# TEL_MEMO

**Last updated:** 2026-07-22  
**Status:** DSP issued — awaiting worker for 1.3 dto/router/mock

## Focus
Roadmap **1.3**: DTOs + message router + mock (one drone + one boat).

## Decisions
- Unity parity targets (read-only): `TelemetryData` / `BoatTelemetry`, `TelemetryWsJsonRouter` (`stream_anchor` vs pose), `StreamAnchorMessage`.
- Channel ID bands (arch §5.1): drones `1–4`, cams `11–12`, boats `21–52`, pilots `81–84`.
- First mock slice: drone `"1"`, boat `"21"` only.
- Modes: `mock` → `replay` → `live` (live later). Default `mock` via `public/config.json`.
- Boat packets stay boat-shaped at ingest; `boatToStandardTelemetry` for normalized pose view — no ENU in TEL.
- No pose math, scene meshes, or output in TEL dispatches.
- PLT scaffold accepted; `src/telemetry/` ready for implementation.

## Issued dispatches
- **DSP-TEL-20260722-01-dto-router-mock** — **ACTIVE** → `docs/agentic/dispatches/active/DSP-TEL-20260722-01-dto-router-mock.md`

## Handoffs
—

## Blockers
- None for this slice (scaffold green).

## Next actions
1. Human: open **new** worker chat → paste worker bootstrap from the DSP above.
2. On worker report-back: accept/reject, move DSP to `done/`, update this memo.
3. Later: replay loader (1.4) → live WS behind flag (1.9).
