# Dispatch DSP-TEL-20260728-01-replay-reconnect-polish

## Meta
- From orchestrator: TEL (BW: finish no-studio software — Phase **4.1**)
- Worker role: WORKER(DSP-TEL-20260728-01-replay-reconnect-polish)
- Priority: P1
- Phase: Phase 4.1 — Replay polish, reconnect
- Related handoffs: none
- BW ask: harden replay + live reconnect UX; live multi-URL still deferred

## Goal

Polish telemetry **replay** (loop / restart / clearer fixture errors) and document/tighten **live reconnect** behaviour already in `LiveTelemetrySource`, so ops can soak mock/replay/live without brittle edges. No multi-URL sockets in this slice.

## Background

- Roadmap 4.1; live reconnect backoff already exists (`liveSource.ts`)
- Replay: `ReplayTelemetrySource` + fixtures under `public/fixtures/telemetry/`
- HUD mode switch restarts ingest via `main.ts`

## In scope

1. **Replay**
   - Config or API: loop replay when fixture ends (default **on** or explicit `replayLoop: true` — pick one, document)
   - Clean restart when HUD switches mock→replay→mock
   - Clearer warn when fixture missing / invalid (already partial — harden messages)
   - Optional: expose `getReplayStatus()` (playing/ended/error) if cheap for HUD later — not required to wire SCN

2. **Live reconnect**
   - Confirm/document capped exponential backoff behaviour in `src/telemetry/README.md`
   - Ensure `stop()` cancels timers (tests already cover some — extend if gaps)
   - Status callbacks already used by HUD — no fake `open` on empty URLs

3. **Tests** for loop + stop/reconnect cancellation

## Out of scope

- Live multi-drone / multi-boat URL maps (separate TEL DSP later)
- WHEP, NDI, scene, calib
- Recorder writing fixtures
- PLT WSS proxy (5.2)

## Likely files

- `src/telemetry/replay*.ts`, `liveSource.ts`, `ingest.ts`, README, tests
- `src/config/*` if `replayLoop` added
- `public/config.json` optional

## Acceptance criteria

- [ ] Replay can loop (or documented one-shot with explicit restart path)
- [ ] Live `stop()` cancels reconnect; empty URLs stay idle
- [ ] README updated
- [ ] `npm test` + `npm run build` green

## Report back

Standard five sections; suggested TEL memo bullets.

## Worker paste block

```
You are WORKER(DSP-TEL-20260728-01-replay-reconnect-polish).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260728-01-replay-reconnect-polish.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. src/telemetry/README.md + replay + liveSource + ingest

Implement 4.1 only. No multi-URL live, no WHEP/NDI/SCN.
Report back per dispatch.
```
