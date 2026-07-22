# Dispatch DSP-TEL-20260722-01-dto-router-mock

**Status:** DONE — accepted by TEL 2026-07-22

## Meta
- From orchestrator: TEL
- Worker role: WORKER(DSP-TEL-20260722-01-dto-router-mock)
- Priority: P0
- Phase: Phase 1 — Spine (roadmap 1.3)
- Related handoffs: none

## Goal

Implement typed telemetry DTOs (Unity parity), a WebSocket JSON message router (`stream_anchor` vs pose), and a `mock` source that emits **one drone** and **one boat** packet stream on a tick. Downstream modules must be able to subscribe to typed events — no geodesy and no Three.js scene work.

## Background

- Architecture §5.1: `docs/architecture/system-architecture.md`
- Module home: `src/telemetry/` (owned by TEL; scaffold empty stub)
- Config: `public/config.json` already has `"telemetryMode": "mock"`
- Unity reference (read-only, do not modify):
  - `../broadcast/Assets/Scripts/TelemetryData.cs` (`TelemetryData`, `BoatTelemetry`, nested types)
  - `../broadcast/Assets/Scripts/TelemetryWsJsonRouter.cs`
  - `../broadcast/Assets/Scripts/StreamAnchorMessage.cs`
- Channel bands (use these IDs in mock): drone `1`, boat `21`
- Scaffold complete: Vite + TS + Three runs; keep existing preview canvas — do not replace with race meshes

## In scope

1. **DTOs** (`src/telemetry/`)
   - TypeScript types matching Unity wire shapes:
     - Drone/camera pose: `ts`, `seq`, `id`, `ntp_synced`, `ntp_err_ms`, `pos`, `rot`, `gimbal`, `vel`, `cam`, `meta`
     - `rot` / `gimbal`: quaternion `x/y/z/w` **and** Euler `yaw/pitch/roll` (as Unity sender does)
     - Boat: `lat`, `lon`, `alt`, `acc`, `spd`, `brg`, `time`, `id`, `t_sync`, `t_err`
     - `StreamAnchorMessage`: `type`, `stream_id`, `kind`, `fps`, optional `pts_basis_90khz` / `pts_90khz`, `ntp_capture_ms`, `ntp_synced`, `ntp_err_ms`
   - Helper: `boatToStandardTelemetry(boat) → TelemetryData`-shaped object (mirror Unity `BoatTelemetry.ToStandardTelemetry`) for a single normalized pose view — pure data mapping, no ENU

2. **Message router**
   - Port `TelemetryWsJsonRouter` behavior:
     - `classify(jsonText) → Invalid | StreamAnchor | DroneOrCameraTelemetry` (boat pose JSON also lands in the non-anchor pose bucket; boat vs drone is decided by connection/source context, not `type`)
     - `tryParseStreamAnchor(parsed) → StreamAnchorMessage | null`
   - Safe on empty/malformed JSON (return Invalid / null; do not throw to callers)

3. **Mock source**
   - Mode: `mock` only (no live WS, no replay file loader)
   - Emit on an interval (~10–20 Hz is fine):
     - **One drone** id `"1"`: `TelemetryData`-shaped packets with slowly changing `pos` (lat/lon/alt) and plausible Euler in `rot`/`gimbal` (e.g. gentle yaw drift); fill other fields with sensible defaults
     - **One boat** id `"21"`: `BoatTelemetry`-shaped packets with slowly changing lat/lon/alt/spd/brg
     - Occasionally (e.g. every ~1–2 s) emit a `stream_anchor` for the drone channel so the router path is exercised
   - Start/stop API; no reconnect logic required

4. **Ingest façade / bus**
   - Small typed pub-sub or callback API, e.g. events:
     - `drone` / `boat` / `stream_anchor` (names flexible; document in README)
   - Entry that starts mock when `telemetryMode === "mock"` (fetch `/config.json` or accept explicit mode; default mock if fetch fails)
   - Wire from `src/main.ts` **minimally**: start ingest; optional lightweight packet counters in `console` or a plain text DOM line (not a Three mesh, not SCN HUD design). Do **not** move/remove the existing wireframe cube beyond what’s needed to call start.

5. **Docs**
   - Update `src/telemetry/README.md`: module layout, event names, how to verify mock is running

## Out of scope

- ECEF / ENU / EGM96 / GeoOrigin (GEO)
- Three.js boats, cameras, maps, glTF (SCN)
- Calibration UI / offsets (CAL)
- Chroma / WebRTC / NDI (OUT)
- Live WebSocket client or replay fixture loader (later TEL DSPs 1.4 / 1.9)
- Multi-channel fleet (only ids `1` and `21`)
- Adding React, or changing Vite/Three stack
- New test-runner dependency unless already present (prefer `npm run build` + manual/dev verification)
- Committing unless the human explicitly asks
- Modifying Unity `../broadcast`

## Likely files

- `src/telemetry/types.ts` (or split `dto*.ts`)
- `src/telemetry/router.ts`
- `src/telemetry/mockSource.ts` (or `sources/mock.ts`)
- `src/telemetry/bus.ts` / `ingest.ts` / `index.ts`
- `src/telemetry/README.md`
- `src/main.ts` (thin wire-up only)

## Inputs provided

- Workspace: `C:\Users\PC\Documents\GitHub\broadcast-web`
- `public/config.json` — `telemetryMode: "mock"`
- Unity paths above
- Channel bands: drones `1–4`, boats `21–52` — use `1` and `21`

## Acceptance criteria

- [x] `npm run build` succeeds
- [x] DTOs cover drone pose, boat, and `stream_anchor` wire fields used by Unity
- [x] Router classifies `type === "stream_anchor"` vs other JSON; invalid JSON does not crash
- [x] Mock emits ongoing drone id `1` and boat id `21` packets
- [x] Mock (or ingest path) exercises `stream_anchor` classification at least periodically
- [x] `boatToStandardTelemetry` (or equivalent name) maps boat → standard pose fields
- [x] No geodesy math and no new Three meshes / boat-drone visuals
- [x] `src/telemetry/README.md` documents how to confirm mock is alive (`npm run dev`)

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (`npm run build`, `npm run dev` observation)
4. Follow-ups / blockers
5. Suggested memo bullets for TEL

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-TEL-20260722-01-dto-router-mock).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260722-01-dto-router-mock.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/system-architecture.md §5.1
4. Unity (read-only): ../broadcast/Assets/Scripts/TelemetryData.cs, TelemetryWsJsonRouter.cs, StreamAnchorMessage.cs

Implement in scope only. No geo math, no Three meshes. Report back per the dispatch.
```
