# Dispatch DSP-TEL-20260727-01-multi-pov-channels

**Status:** DONE — accepted by TEL 2026-07-27

## Meta
- From orchestrator: TEL (BW open Phase **2.4**; ack `HO-SCN-TEL-20260727-01`)
- Worker role: WORKER(DSP-TEL-20260727-01-multi-pov-channels)
- Priority: P0
- Phase: Phase 2.4 — multi-POV (TEL half; SCN camera switch is separate)
- Related handoffs:
  - `HO-SCN-TEL-20260727-01` (request)
  - `HO-TEL-SCN-20260727-01` (FYI green)

## Goal

Add **`povIds: string[]`** config and make **mock** (plus optional short **replay** fixture) emit **one drone-channel packet per POV id** each tick so SCN can switch among ≥2 sources. **Live multi-URL out.** **No Three camera switch** (SCN owns that).

## Background

- Arch §5.1: drones `1–4`, cams `11–12` (same `TelemetryData` / relative+gimbal path as drones)
- Today: mock emits a single drone id `"1"` + boats from `boatIds`
- BW locks:
  - Config: `povIds: string[]` in `public/config.json`
  - Default: `["1","2"]` (cams `11–12` allowed in band later)
  - This DSP: mock (± short replay) multi-drone emit; live multi-URL out
  - No Three camera switch (SCN)
- Wire: keep `channel: "drone"` + `TelemetryData` with distinct `id` ∈ `povIds` (cam ids still use drone channel / DTO — Unity parity)
- `poseBus` already keys `kind: 'drone'` by `id` — no new bus event
- Mirror pattern: `boatIds` / `DSP-TEL-20260724-01-multi-boat-channels`
- SCN DSP (parallel): `DSP-SCN-20260727-03-multi-pov-switch`

## In scope

1. **Config**
   - Add `povIds: string[]` to `AppConfig` / `normalizeConfig` / `public/config.json`
   - Committed default: `["1", "2"]`
   - Validation: non-empty strings in bands **`1–4` or `11–12`**; warn+filter out-of-band (boats/pilots/junk); empty/all-junk → `["1","2"]`
   - Pass `povIds` into `startTelemetryIngest` like `boatIds`
   - Update `src/config/README.md` + `src/telemetry/README.md` (SCN contract: use `loadConfig().povIds`)

2. **Mock**
   - Each pose tick: emit **one** `channel: 'drone'` packet per `povIds` entry (→ `ingestPacket` → bus `drone`)
   - Distinct `id`; phase-offset lat/lon/yaw (and gentle attitude) so POVs are observably different for camera switch
   - Periodic `stream_anchor`: keep working — prefer anchor for `povIds[0]` (or rotate; document choice)
   - Keep existing multi-boat emit from `boatIds` unchanged
   - `MOCK_DRONE_ID` may remain `"1"` for legacy; prefer configured `povIds`

3. **Replay (optional but preferred)**
   - Add short fixture e.g. `public/fixtures/telemetry/spine-pov.json` with drone packets for ids in default `povIds` (`1` + `2`), plus existing boats optional/minimal, ≥1 `stream_anchor`
   - Do **not** change committed default `replayUrl` away from current spine-demo/fleet unless clearly better — document how to point at POV fixture
   - Fixture v1 format unchanged

4. **Live**
   - **Out:** no multi-drone WebSockets; `wsUrl` remains single primary; document follow-up
   - Live behavior otherwise unchanged

5. **Tests**
   - Vitest: mock emits all configured `povIds` within a tick window
   - Vitest: normalize `povIds` (default, filter out-of-band, allow `11`/`12`)
   - Optional: replay fixture with ≥2 POV ids
   - `npm run build` + `npm run test` green

6. **Docs**
   - Document `povIds` for SCN; note live multi-URL deferred; no camera switch in TEL

## Out of scope

- Three.js camera / HUD POV switch (SCN `DSP-SCN-20260727-03`)
- Live multi-drone / multi-cam URLs
- Boat/pilot channel changes
- Display names (**2.7**)
- ENU / meshes / chroma
- Git commit unless human asks

## Likely files

- `public/config.json` — add `povIds`
- `src/config/types.ts`, `loadConfig.ts`, `README.md`, `loadConfig.test.ts`
- `src/telemetry/mockSource.ts`, `ingest.ts`, `index.ts`, `README.md`
- `src/telemetry/*.test.ts` (new or extend)
- `public/fixtures/telemetry/spine-pov.json` (+ README touch)
- Thin `src/main.ts` pass-through of `povIds`

## Inputs provided

- BW locks (above)
- `HO-SCN-TEL-20260727-01`
- Prior boat pattern: `boatIds` / done `DSP-TEL-20260724-01`

## Acceptance criteria

- [x] `public/config.json` has `povIds: ["1","2"]`
- [x] `loadConfig` / types expose `povIds: string[]` with band filter `1–4` ∪ `11–12`
- [x] Mock emits distinct drone packets for each configured POV id each tick cycle
- [x] Boat multi-emit still works
- [x] Live multi-URL **not** implemented; documented as follow-up
- [x] No Three camera / HUD POV switch code in TEL scope
- [x] `npm run build` and `npm run test` pass
- [x] README documents `povIds` for SCN

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for TEL (+ reminder: orchestrator FYI SCN when accepted)

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-TEL-20260727-01-multi-pov-channels).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260727-01-multi-pov-channels.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-SCN-TEL-20260727-01.md
4. docs/architecture/system-architecture.md §5.1
5. src/telemetry/README.md, mockSource.ts, ingest.ts
6. src/config/types.ts, loadConfig.ts, public/config.json
7. Prior pattern: DSP-TEL-20260724-01-multi-boat-channels (done)

Implement in scope only. povIds + mock (± short replay) multi-drone. Live multi-URL out. No Three camera switch. Report back per the dispatch.
```
