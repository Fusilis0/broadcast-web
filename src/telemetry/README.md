# telemetry

Owned by **TEL**. WebSocket-shaped ingest: DTOs, JSON router, mock / replay / live sources, typed event bus.

## Layout

| File | Role |
| --- | --- |
| `types.ts` | Wire DTOs (`TelemetryData`, `BoatTelemetry`, `StreamAnchorMessage`) |
| `boatToStandardTelemetry.ts` | Boat → standard pose mapping (Unity `ToStandardTelemetry` parity) |
| `router.ts` | `classify` / `tryParseStreamAnchor` (Unity `TelemetryWsJsonRouter`) |
| `mockSource.ts` | Interval mock: one drone packet per `povIds`, one boat per `boatIds`, periodic `stream_anchor` (`povIds[0]`) |
| `replayFixture.ts` | Fixture v1 types + `parseReplayFixture` / `loadReplayFixture` |
| `replaySource.ts` | Timer playback of a fixture onto `ingestPacket` |
| `liveSource.ts` | Browser WebSocket client(s) for live mode (drone + optional boat) |
| `bus.ts` | Typed pub-sub |
| `ingest.ts` | Start ingest from `telemetryMode`; route JSON onto the bus; live `getLiveStatus` / `onLiveStatus`; replay `getReplayStatus` |
| `index.ts` | Public exports |

## Events

Subscribe via `telemetryBus.on(event, handler)` or the bus returned by `startTelemetryIngest`:

| Event | Payload |
| --- | --- |
| `drone` | `TelemetryData` |
| `boat` | `BoatTelemetry` |
| `stream_anchor` | `StreamAnchorMessage` |

Boat vs drone for non-anchor pose JSON is decided by **source/channel context**, not by a `type` field (same as Unity).

## Config

`public/config.json`:

| Field | Notes |
| --- | --- |
| `telemetryMode` | `"mock"` \| `"replay"` \| `"live"` — **committed default is `mock`** |
| `replayUrl` | Fixture URL for replay (default `/fixtures/telemetry/spine-demo.json`) |
| `replayLoop` | Optional boolean override of fixture `loop`. Omit → use fixture. Committed samples use `loop: true` |
| `wsUrl` | Drone / primary live WebSocket URL (default `""`) |
| `wsBoatUrl` | Boat live WebSocket URL (default `""` → drone-only live). **Single socket only** |
| `boatIds` | `string[]` boat channel ids (default `["21","22","23","24"]`; band `21–52`) |
| `povIds` | `string[]` POV / drone+cam ids (default `["1","2"]`; bands `1–4` ∪ `11–12`) |

### `boatIds` (SCN consumers)

- Mock emits **one `boat` bus event per id** each pose tick (`BoatTelemetry.id` ∈ `boatIds`).
- `poseBus` already keys by `id` — SCN fleet registry should `Map<id, entity>` from the same list (`loadConfig().boatIds`).
- Pilots `81–84` are **deferred** (filtered if present in config). Full `21–52` is config-only later.
- Passed into `startTelemetryIngest({ boatIds })` the same way as `replayUrl` / `wsUrl`.

### `povIds` (SCN consumers)

- Mock emits **one `drone` bus event per id** each pose tick (`TelemetryData.id` ∈ `povIds`). Wire stays `channel: "drone"` even for cams `11–12` (Unity parity DTO).
- `poseBus` already keys `kind: 'drone'` by `id` — no new bus event. SCN POV switch should use `loadConfig().povIds`.
- Periodic `stream_anchor` uses **`povIds[0]`** (primary POV; not rotated).
- Passed into `startTelemetryIngest({ povIds })` like `boatIds`.
- **No Three camera / HUD POV switch in TEL** — that is SCN (`DSP-SCN-20260727-03`).
- **Live multi-drone / multi-cam URLs are deferred** — `wsUrl` remains a single primary socket (same spirit as single `wsBoatUrl`).

### Modes

- **mock** — `MockTelemetrySource` with multi-id POVs from `povIds` + boats from `boatIds`.
- **replay** — fetch `replayUrl`, validate v1, play via timers onto `ingestPacket` (fixtures may carry multiple drone/boat ids). **Looping** is controlled by fixture `loop` (committed samples: `true`); optional `replayLoop` in config / `startTelemetryIngest` overrides. HUD mock↔replay↔live calls `stop()` then a fresh ingest — timers/sockets do not leak.
- **live** — open WebSocket(s) when URL(s) resolve; text frames → `ingestPacket` by channel. **Still one `wsUrl` + one `wsBoatUrl`** — multi-URL / subscribe-map is a **follow-up TEL DSP**.

If `/config.json` fetch fails, mode defaults to `mock`, `boatIds` to the four-id default, and `povIds` to `["1","2"]`.

### Live reconnect (capped exponential backoff)

`LiveTelemetrySource` reconnects after unexpected close/error:

| Knob | Default | Behaviour |
| --- | --- | --- |
| `initialBackoffMs` | `500` | Delay before first reconnect attempt |
| `maxBackoffMs` | `10_000` | Cap; delay doubles after each attempt (`500 → 1000 → … → 10000`) |
| On successful `open` | — | Backoff resets to `initialBackoffMs` |
| `stop()` | — | Sets intentional-stop, **clears reconnect timers**, closes sockets; no further connects |
| Empty URLs | — | Stay `idle` (warn once); **no** fake `open` |

HUD mode switches and `beforeunload` call ingest `stop()` so reconnect cannot fire after leave-live / teardown.

### Live URL resolution order

Documented order used by `startTelemetryIngest`:

1. **Explicit options** — `wsUrl` / `wsBoatUrl` passed into `startTelemetryIngest` (including `""` to force no connect).
2. **Vite env** — non-empty `import.meta.env.VITE_WS_URL` / `VITE_WS_BOAT_URL` (see `.env.example`).
3. **`public/config.json`** — `wsUrl` / `wsBoatUrl`.

Do **not** commit production VPS URLs or `telemetryMode: "live"` as defaults.

### Enable live locally

1. Set URLs (pick one layer):
   - `.env`: `VITE_WS_URL=…` and optional `VITE_WS_BOAT_URL=…`, **or**
   - `public/config.json`: `"wsUrl": "…"`, `"wsBoatUrl": "…"`.
2. Set `"telemetryMode": "live"` in config **or** pick **live** in the HUD mode select (mock ↔ replay ↔ live switches without reload).
3. Do **not** leave the committed default as `live`.

Empty drone URL in live mode: console warn, idle handle, app does not crash. Empty boat URL: drone-only live (OK for spine).

### Live status expose (HUD)

Live `IngestHandle` adds optional:

- `getLiveStatus()` → `{ drone, boat }` as `LiveWsStatus` (`idle` | `connecting` | `open` | `closed`)
- `onLiveStatus(listener)` → unsubscribe; forwards `LiveTelemetrySource` `onStatus`

Mock/replay handles omit these — SCN HUD shows `ws=n/a (mock|replay)` instead of inventing sockets. Empty URLs stay `idle` (no fake `open`).

### Replay status expose (optional)

Replay `IngestHandle` adds optional:

- `getReplayStatus()` → `ReplayStatus` (`idle` | `playing` | `ended` | `error`)

Mock/live omit this. Not wired into SCN HUD yet — cheap for later soak/debug. Fixture load failure → `error` + console warn (ops-friendly message includes URL / HTTP / parse detail). One-shot (`loop: false`) reaches `ended`; call ingest again (HUD mode switch) or `source.start()` after stop to restart.

### `ws://` vs `wss://` (mixed content)

Browsers block **mixed content**: an **HTTPS** page cannot open `ws://` endpoints.

| Page origin | Use |
| --- | --- |
| `https://…` (e.g. future Hetzner static host) | **`wss://`** WebSocket URLs |
| `http://localhost` (Vite dev) | `ws://` or `wss://` both OK |

Phase **5.2** (PLT) may add reverse-proxy WSS termination in front of the VPS; this module only requires the **browser client** to use a scheme the page origin allows. Placeholder example shape (not a committed default):

`wss://example.invalid/stream?client=web&id=…`

### Optional real-VPS soak (human-gated)

Not required for CI. Locally:

1. Put real URLs in `.env` (never commit).
2. `npm run dev` on `http://localhost` (so `ws://` is allowed if the VPS is plain WS).
3. HUD → **live** (or config mode `live`); confirm counters advance.
4. Switch back to **mock** — sockets must stop (check console / server).

## Replay fixture format (v1)

JSON only (not binary), served from `public/`. Shape:

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

| Field | Rule |
| --- | --- |
| `version` | Must be `1` |
| `name` | String label |
| `loop` | `true` restarts after the last `t_ms`; `false` plays once then `ended`. Committed samples use `true`. Optional config / ingest `replayLoop` overrides this |
| `packets` | Non-empty array |
| `t_ms` | ms from replay start; finite ≥ 0; monotonic non-decreasing |
| `channel` | `"drone"` \| `"boat"` (connection context, same as mock) |
| `payload` | Object matching wire DTOs — drone pose, boat, or `stream_anchor` |

Replay serializes each `payload` → JSON text and feeds `ingestPacket`, so the router / `stream_anchor` path stays real. A live→fixture recorder is **not** implemented here.

Sample: [`public/fixtures/telemetry/spine-demo.json`](../../public/fixtures/telemetry/spine-demo.json) — drone `1` + boat `21` near Istanbul (~3 s loop), includes `stream_anchor`.

Fleet sample (multi-id tests / SCN registry): [`public/fixtures/telemetry/spine-fleet.json`](../../public/fixtures/telemetry/spine-fleet.json) — drone `1` + boats `21–24` (~1.6 s loop). Default `replayUrl` stays `spine-demo`; point config at `spine-fleet` when exercising multi-boat replay.

POV sample (multi-drone for SCN camera switch): [`public/fixtures/telemetry/spine-pov.json`](../../public/fixtures/telemetry/spine-pov.json) — drones `1` + `2` + boat `21` (~1.2 s loop). Point `replayUrl` at `/fixtures/telemetry/spine-pov.json` when exercising multi-POV replay; committed default remains `spine-demo`.

Invalid fixtures fail soft: console warn with URL + reason (missing 404, bad JSON, schema), ingest returns a no-op `stop` with `getReplayStatus() === "error"`, app does not crash.

## Verify mock is alive

```bash
npm run dev
```

Open the app (default mode **mock**). You should see:

1. Scene + ops HUD.
2. Status line with rising `drone` / `boat` / `stream_anchor` counters.
3. HUD hint: `mock source`. Switch to **replay** → hint `fixture replay`. Switch to **live** → hint `live WS` (needs URLs; empty URLs warn and stay idle). Switch back to **mock**.

```bash
npm run build
npm run test
```

Must succeed with no TypeScript errors; Vitest covers fixture parse/playback and live WS (fake WebSocket) → bus.

## Channel IDs (mock / fixtures)

- POVs / drones+cams: configured `povIds` (default `"1"`, `"2"`; bands `1–4` ∪ `11–12`). Legacy export `MOCK_DRONE_ID === "1"` remains for single-id callers; prefer `povIds[0]` / configured list.
- Boats: configured `boatIds` (default `"21"`…`"24"`). Legacy export `MOCK_BOAT_ID === "21"` remains for single-id callers; prefer `boatIds[0]` / configured list.
- Pilots `81–84`: out of scope

## Out of this module (other orchestrators)

No ECEF/ENU (GEO), no Three boat/drone meshes / fleet registry / POV camera switch (SCN), no fixture recorder, no live multi-URL (multi-drone or multi-boat), no PLT reverse-proxy WSS (5.2).
