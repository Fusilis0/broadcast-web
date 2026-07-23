# Dispatch DSP-TEL-20260723-01-replay-fixture-loader

**Status:** DONE — accepted by TEL 2026-07-23

## Meta
- From orchestrator: TEL (per BW priority — roadmap **1.4**)
- Worker role: WORKER(DSP-TEL-20260723-01-replay-fixture-loader)
- Priority: P0
- Phase: Phase 1 — Spine (roadmap 1.4)
- Related handoffs: none (SCN already deferred HUD replay wire to TEL 1.4)

## Goal

Define a versioned **replay fixture format**, ship one small **drone `1` + boat `21`** fixture, and implement a **replay loader/source** that plays packets onto the existing telemetry bus through `ingestPacket`. **`telemetryMode` default stays `mock`.** Do **not** implement live VPS WebSocket (roadmap **1.9**).

## Background

- Architecture §5.1 modes: `mock` | `replay` | `live` — `docs/architecture/system-architecture.md`
- Roadmap 1.4: “Replay fixture format” — TEL
- Existing ingest: `src/telemetry/ingest.ts` — `mock` works; `replay` / `live` currently no-op with console warn
- Packet path to reuse: `ingestPacket({ channel, jsonText }, bus)` + events `drone` | `boat` | `stream_anchor`
- Config today: `public/config.json` → `"telemetryMode": "mock"` (must remain default after this DSP)
- SCN stub HUD mode select is UI-only; console already says replay deferred to TEL 1.4 — thin wire-up for **mock ↔ replay only** is in scope; **live** stays unwired
- Unity sibling is reference only; fixtures are web-owned under `public/`

## In scope

1. **Fixture format (v1)** — document in `src/telemetry/README.md` (and a one-line pointer in fixture folder README if useful)
   - JSON file (not binary), served from `public/`
   - Suggested envelope (worker may refine field names if documented consistently):

     ```json
     {
       "version": 1,
       "name": "spine-demo",
       "loop": true,
       "packets": [
         {
           "t_ms": 0,
           "channel": "drone",
           "payload": { }
         }
       ]
     }
     ```

   - `t_ms`: milliseconds from replay start (monotonic non-decreasing)
   - `channel`: `"drone"` | `"boat"` (same connection-context rule as mock / Unity)
   - `payload`: object matching wire DTOs — drone pose (`TelemetryData`), boat (`BoatTelemetry`), or `stream_anchor` (`type: "stream_anchor"`, …)
   - Replay serializes `payload` → JSON text and feeds `ingestPacket` (so router/`stream_anchor` path stays real)
   - Design should stay friendly to a **future live recorder** writing the same v1 shape (no need to implement the recorder now)

2. **Sample fixture**
   - Path e.g. `public/fixtures/telemetry/spine-demo.json` (or equivalent under `public/`)
   - Include **both** drone id `"1"` and boat id `"21"` over a short clip (several seconds of wall-clock playback is enough)
   - Include at least one `stream_anchor` on the drone channel
   - Positions should be near existing mock/config origin (~Istanbul) so GEO/SCN pose path remains sensible when mode is switched for testing
   - Keep file small (human-editable; no huge dumps)

3. **Replay loader / source**
   - Fetch fixture URL, validate `version === 1` and required fields; fail soft (warn + do not crash app)
   - Play back on timers using `t_ms` deltas; support `loop: true|false`
   - `start` / `stop` API; stopping clears pending timers
   - Wire into `startTelemetryIngest`:
     - `mock` → existing `MockTelemetrySource` (unchanged behavior)
     - `replay` → load + play fixture
     - `live` → still no-op / warn (explicitly **1.9**, not this DSP)

4. **Config**
   - Keep **`telemetryMode`: `"mock"`** as the committed default in `public/config.json`
   - Add optional `replayUrl` (string) to config types + `normalizeConfig` / defaults, e.g. `"/fixtures/telemetry/spine-demo.json"`
   - When mode is `replay`, use `replayUrl` (fallback to the sample path if empty)
   - Document how to try replay: set `"telemetryMode": "replay"` locally (do not leave default as replay in git)

5. **HUD / main thin glue (mock ↔ replay only)**
   - Allow switching **mock ↔ replay** at runtime without full page reload if practical: stop current source, start the other, reset or keep counters as already designed
   - Prefer a small callback from `stubHud` (`onModeChange`) invoked from `main.ts` — update HUD hint text so replay is no longer “deferred”
   - Selecting **`live`**: keep current “not wired (TEL 1.9)” behavior; do not open sockets
   - Do not redesign HUD layout (SCN)

6. **Tests**
   - Vitest: parse/validate happy path + reject bad version / missing packets
   - Vitest: playback ordering / `t_ms` scheduling can be tested with fake timers (emit order + relative delays) — keep pure, no WebGL

7. **Docs**
   - Update `src/telemetry/README.md`: format, fixture path, how to verify replay vs mock

## Out of scope

- Live WebSocket / VPS connect / reconnect (TEL **1.9**)
- Recording live sessions to disk (format only; recorder later)
- Multi-channel fleet beyond what the sample fixture needs (ids `1` + `21` sufficient)
- Geodesy, pose math, SCN meshes, CAL UI, OUT chroma
- Changing default boot mode away from `mock`
- Git commit unless human asks

## Likely files

- `src/telemetry/replayFixture.ts` (types + parse/validate)
- `src/telemetry/replaySource.ts` (playback)
- `src/telemetry/ingest.ts` (wire `replay` mode)
- `src/telemetry/index.ts`, `src/telemetry/README.md`
- `src/telemetry/*.test.ts` (new)
- `public/fixtures/telemetry/spine-demo.json` (+ optional README)
- `public/config.json` — add `replayUrl`; **keep** `telemetryMode: "mock"`
- `src/config/types.ts`, `src/config/loadConfig.ts` (optional `replayUrl`)
- `src/main.ts`, `src/scene/stubHud.ts` (thin mode switch glue only)

## Inputs provided

- Workspace: `C:\Users\PC\Documents\GitHub\broadcast-web`
- Existing mock IDs / bus / `ingestPacket`
- BW: 1.8 done; prioritize 1.4; mock default; no live yet

## Acceptance criteria

- [x] Fixture format v1 documented in `src/telemetry/README.md`
- [x] Sample fixture under `public/` with drone `1`, boat `21`, and at least one `stream_anchor`
- [x] `telemetryMode: "replay"` starts playback onto the same bus events as mock
- [x] Committed `public/config.json` still defaults to **`mock`**
- [x] `replayUrl` (or equivalent) configurable; sample path works out of the box when mode is replay
- [x] `live` remains unimplemented (warn / no socket)
- [x] Invalid fixture does not crash the app
- [x] `npm run build` and `npm run test` pass
- [x] Manual: with mode temporarily set to `replay` (config or HUD), counters / pose path show activity from the fixture; restoring `mock` still works
- [x] No live VPS code paths beyond existing stubs

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (`npm run build`, `npm run test`, brief replay manual check)
4. Follow-ups / blockers
5. Suggested memo bullets for TEL

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-TEL-20260723-01-replay-fixture-loader).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260723-01-replay-fixture-loader.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/system-architecture.md §5.1
4. src/telemetry/README.md, ingest.ts, mockSource.ts

Implement in scope only. Mock stays default. No live VPS (1.9). Report back per the dispatch.
```
