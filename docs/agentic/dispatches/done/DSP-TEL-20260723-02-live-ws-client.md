# Dispatch DSP-TEL-20260723-02-live-ws-client

**Status:** DONE — accepted by TEL 2026-07-23

## Meta
- From orchestrator: TEL (per BW priority — roadmap **1.9**)
- Worker role: WORKER(DSP-TEL-20260723-02-live-ws-client)
- Priority: P0
- Phase: Phase 1 — Spine (roadmap 1.9 — last Phase 1 open item)
- Related handoffs: none (SCN HUD already prepared for live wire-up)

## Goal

Implement a **live WebSocket telemetry client** that connects only when mode is **`live`**, feeds the existing `ingestPacket` → bus path, and wires the HUD **`live`** option for real (alongside mock/replay). **Committed default stays `mock`.** Document **`ws` / `wss`** config and HTTPS constraints. **No fixture recorder.**

## Background

- Architecture §5.1 / §6–7: `docs/architecture/system-architecture.md` — modes `mock` | `replay` | `live`; VPS WS today; **WSS required** when the page is HTTPS; live URLs via config / `.env`, not secrets in git
- Roadmap 1.9: “Live switch wired but off by default”
- Rules: live telemetry is **opt-in**; do not call production VPS destructively
- Current state:
  - `startTelemetryIngest`: mock + replay work; `live` warns and no-ops
  - HUD `onModeChange` handles mock ↔ replay only; `live` logs “not wired (TEL 1.9)”
  - Config already has `wsUrl: ""` and `.env.example` has `VITE_WS_URL=`
- Unity reference (read-only): `../broadcast/Assets/Scripts/TelemetryReceiver.cs` — per-connection WS; text JSON; router then boat vs drone by connection context
- Spine parity: **one drone + one boat** channel (same as mock/replay). Multi-fleet later (Phase 2)
- Example Unity-style URL shape (illustrative, not a committed default): `ws://<host>:<port>/stream?client=…&id=…`

## In scope

1. **Live WebSocket source(s)**
   - Browser `WebSocket` client(s) under `src/telemetry/`
   - Spine minimum: **two logical connections** (or one URL + channel map — prefer explicit drone + boat URLs for clarity):
     - drone channel → `ingestPacket({ channel: 'drone', jsonText })`
     - boat channel → `ingestPacket({ channel: 'boat', jsonText })`
   - On message: decode UTF-8 text → existing classify / `ingestPacket` (so `stream_anchor` works unchanged)
   - `start` / `stop`: close sockets; clear reconnect timers
   - Basic **reconnect** with backoff (e.g. capped exponential); stop cancels reconnect
   - Soft-fail: missing URL, immediate close, or parse errors → warn, do not crash the app
   - Do **not** auto-start live unless mode is `live`

2. **Config / flag (opt-in)**
   - Keep committed `public/config.json` → `"telemetryMode": "mock"`
   - Document and implement URL resolution order (pick one clear order; document it):
     1. Explicit options passed into `startTelemetryIngest`
     2. Optional `import.meta.env.VITE_WS_URL` / boat override if present
     3. `public/config.json` fields
   - Config fields (extend types + `normalizeConfig` as needed):
     - Keep `wsUrl` as the **drone** (or primary) live URL
     - Add `wsBoatUrl` (string) for the boat connection — empty means “no boat socket” (drone-only live still OK)
     - Optional: allow `VITE_WS_BOAT_URL` mirror in `.env.example`
   - **Do not** commit a real production VPS URL as the default; leave strings empty in git
   - If mode is `live` but drone URL is empty → warn, no connect (same soft-fail spirit as bad replay fixture)

3. **Wire into ingest**
   - `startTelemetryIngest({ mode: 'live', … })` starts the live source(s)
   - mock / replay behavior unchanged
   - Pass `wsUrl` / `wsBoatUrl` through from `main` / config (same pattern as `replayUrl`)

4. **HUD / main — live for real**
   - Extend mode switch so **`live`** calls the same restart path as mock/replay (`onModeChange` accepts all three modes, or equivalent)
   - Update hints/titles: drop “not wired (TEL 1.9)”; show something like “live WS” when selected
   - Switching away from live must **stop** sockets
   - Switching into live with empty URLs must not hang the UI (warn + idle handle)
   - No HUD redesign beyond hint/status text needed for connection clarity
   - Optional thin status: e.g. `live: connecting|open|closed` in the existing status line or console — keep minimal

5. **Documentation (required)**
   - Update `src/telemetry/README.md` and touch `src/config/README.md` / `.env.example` comments:
     - How to enable live locally (`telemetryMode: "live"` **or** HUD **live**)
     - `wsUrl` / `wsBoatUrl` vs `VITE_WS_*`
     - **`ws://` vs `wss://`**: browsers block mixed content — HTTPS page ⇒ **`wss://`** endpoints (or local `ws://` only on `http://localhost`)
     - Note Phase 5.2 (PLT) may add reverse-proxy WSS later; this DSP only documents the client requirement
     - Reminder: default remains mock; do not commit live mode or production URLs
   - Example placeholder URLs only (`wss://example.invalid/…` or commented samples)

6. **Tests**
   - Vitest with a injectable / fake WebSocket (or message-handler unit test): text frame → bus emits drone/boat/`stream_anchor` as appropriate
   - Empty URL / live mode does not throw
   - `npm run build` + `npm run test` green
   - Manual against real VPS is **optional** and human-gated (document steps; do not require CI to hit VPS)

## Out of scope

- Fixture **recorder** (write live → v1 JSON) — later
- Full multi-channel fleet (drones 1–4, boats 21–52, cams, pilots) — Phase 2+
- PLT reverse-proxy / Hetzner WSS termination (roadmap 5.2) — document client needs only
- Auth tokens / console deep-link live handoff (CON)
- Geodesy, SCN meshes, CAL UI, OUT
- Changing committed default away from `mock`
- Aggressive production soak automation
- Git commit unless human asks

## Likely files

- `src/telemetry/liveSource.ts` (or `wsClient.ts`) — new
- `src/telemetry/ingest.ts`, `index.ts`, `README.md`
- `src/telemetry/*.test.ts` — new/updated
- `src/config/types.ts`, `loadConfig.ts`, `README.md`
- `public/config.json` — empty `wsUrl` / new `wsBoatUrl`; **mode stays `mock`**
- `.env.example` — document `VITE_WS_URL` / optional boat key
- `src/main.ts`, `src/scene/stubHud.ts` — live mode switch glue

## Inputs provided

- Workspace: `C:\Users\PC\Documents\GitHub\broadcast-web`
- Existing `ingestPacket` + bus + router
- BW: 1.4 done; draft 1.9; mock default; HUD live real; document ws/wss; no recorder

## Acceptance criteria

- [x] `telemetryMode: "live"` opens WebSocket(s) when URL(s) configured; feeds bus via `ingestPacket`
- [x] Committed default remains **`mock`**; no production URL committed
- [x] HUD **live** switches ingest for real (start/stop sockets); mock/replay still work
- [x] Empty live URL soft-fails (warn, no crash)
- [x] Reconnect backoff exists; `stop` closes cleanly
- [x] `ws` / `wss` + HTTPS mixed-content guidance documented in TEL (and config/env stubs)
- [x] No recorder implementation
- [x] `npm run build` and `npm run test` pass
- [x] Manual path documented for optional real-VPS soak (human opt-in)

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (`npm run build`, `npm run test`; note if real VPS was tried)
4. Follow-ups / blockers
5. Suggested memo bullets for TEL (and FYI BW: Phase 1.9 / Phase 1 complete if accepted)

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-TEL-20260723-02-live-ws-client).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260723-02-live-ws-client.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/system-architecture.md §5.1, §6–7
4. src/telemetry/README.md, ingest.ts
5. Unity (read-only): ../broadcast/Assets/Scripts/TelemetryReceiver.cs

Implement in scope only. Default stays mock. Wire HUD live for real. Document ws/wss. No recorder. Report back per the dispatch.
```
