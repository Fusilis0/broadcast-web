# Dispatch DSP-TEL-20260724-01-multi-boat-channels

**Status:** DONE — accepted by TEL 2026-07-24

## Meta
- From orchestrator: TEL (BW open Phase **2.2**; ack `HO-SCN-TEL-20260723-01`)
- Worker role: WORKER(DSP-TEL-20260724-01-multi-boat-channels)
- Priority: P0
- Phase: Phase 2 — Race content (roadmap **2.2** TEL half)
- Related handoffs:
  - `HO-SCN-TEL-20260723-01` (plan)
  - `HO-TEL-SCN-20260724-01` (FYI config shape locked for SCN fleet-registry DSP)

## Goal

Add **multi-boat channel config** and make **mock + replay** emit multiple distinct boat ids from `boatIds`. One drone (`1`) remains. **No live multi-URL** in this DSP (document as follow-up). **No ENU, no meshes.**

## Background

- Arch §5.1 boat band: `21–52`; pilots `81–84` **out of 2.2** (BW lock)
- Today: mock/replay/live are one drone `1` + one boat `21`
- BW locks:
  - Config: `boatIds: string[]` in `public/config.json`
  - Default mock e.g. `["21","22","23","24"]` (full `21–52` later OK)
  - This DSP: config + mock + replay multi-id; live multi-URL may follow if heavy
- `poseBus` already keys by `id` — TEL only needs to emit multiple `boat` bus events with distinct `BoatTelemetry.id`
- SCN 2.1 shipped single-boat glTF template; SCN fleet registry is a **separate** DSP after this contract

## In scope

1. **Config**
   - Add `boatIds: string[]` to `AppConfig` / `normalizeConfig` / `public/config.json`
   - Committed default: `["21", "22", "23", "24"]`
   - Validation: non-empty strings; prefer ids in `21–52` (warn or filter junk; do not invent pilot ids)
   - If missing/invalid → fall back to `["21"]` (or the four-id default — pick one, document it; prefer four-id default matching committed config)
   - Pass `boatIds` into `startTelemetryIngest` the same way as `replayUrl` / `wsUrl`
   - Update `src/config/README.md` + `src/telemetry/README.md`

2. **Mock**
   - Each pose tick: emit **one boat packet per** `boatIds` entry (still `channel: 'boat'` → `ingestPacket`)
   - Distinct `id` on each packet; slight lat/lon (or bearing) phase offset per index so boats are not stacked identical
   - Keep one drone `1` + periodic `stream_anchor` as today
   - `MOCK_BOAT_ID` may remain as a constant for `"21"` or become deprecated in favor of `boatIds[0]` — document

3. **Replay**
   - Fixture v1 already allows multiple `{ channel: "boat", payload: { id, … } }` packets — keep format
   - Update sample fixture **or** add `public/fixtures/telemetry/spine-fleet.json` (and optionally point `replayUrl` at it, **or** keep `spine-demo` and document fleet fixture for multi-id tests — prefer adding a fleet fixture and leaving default `replayUrl` as today unless switching is clearly better)
   - Fleet fixture must include at least the default `boatIds` set (21–24) over a short loop, plus drone `1` / at least one `stream_anchor`
   - Loader needs no format change if packets already carry ids; ensure ingest still routes all boat packets

4. **Live (document only / minimal)**
   - **Do not** implement N boat WebSockets in this DSP
   - README note: current `wsBoatUrl` remains a single boat socket; multi-URL / subscribe-map is a **follow-up TEL DSP**
   - Live mode behavior otherwise unchanged

5. **Tests**
   - Vitest: mock (or ingest with mock) emits all configured boat ids within a tick window
   - Vitest: replay fixture with ≥2 boat ids reaches the bus
   - `npm run build` + `npm run test` green

6. **Docs**
   - Document `boatIds` contract for SCN consumers
   - Note pilots `81–84` deferred; full `21–52` list optional later via config only

## Out of scope

- Live multi-URL / per-boat sockets (follow-up)
- Pilots `81–84`
- Display names / colours (SCN **2.7**)
- ENU / geodesy (GEO)
- Boat meshes / fleet registry / tags (SCN follow-up DSP)
- Changing drone multi-channel (still one drone `1`)
- Fixture recorder
- Git commit unless human asks

## Likely files

- `public/config.json` — add `boatIds`
- `src/config/types.ts`, `loadConfig.ts`, `README.md`
- `src/telemetry/mockSource.ts`, `ingest.ts`, `index.ts`, `README.md`
- `src/telemetry/*.test.ts`
- `public/fixtures/telemetry/spine-fleet.json` (and/or update `spine-demo.json`)
- `public/fixtures/telemetry/README.md`
- Thin `src/main.ts` pass-through of `boatIds` if needed

## Inputs provided

- BW locks (above)
- `HO-SCN-TEL-20260723-01`, `HO-TEL-SCN-20260724-01`
- Existing bus: `boat` events already carry `BoatTelemetry.id`

## Acceptance criteria

- [x] `public/config.json` has `boatIds: ["21","22","23","24"]` (or documented equivalent default)
- [x] `loadConfig` / types expose `boatIds: string[]`
- [x] Mock emits distinct boat packets for each configured id each tick cycle
- [x] Replay path can deliver multiple boat ids (sample/fleet fixture + tests)
- [x] Live multi-URL **not** required; documented as follow-up
- [x] No ENU math, no Three/mesh changes
- [x] No pilot channels
- [x] `npm run build` and `npm run test` pass
- [x] README documents `boatIds` for SCN

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (esp. live multi-URL)
5. Suggested memo bullets for TEL (+ FYI SCN: ready for fleet-registry DSP)

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-TEL-20260724-01-multi-boat-channels).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260724-01-multi-boat-channels.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-TEL-SCN-20260724-01.md
4. docs/architecture/system-architecture.md §5.1
5. src/telemetry/README.md, mockSource.ts, ingest.ts
6. src/config/types.ts, public/config.json

Implement in scope only. Config + mock + replay multi-id. No live multi-URL, no ENU, no meshes, no pilots. Report back per the dispatch.
```
