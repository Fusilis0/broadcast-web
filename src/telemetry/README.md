# telemetry

Owned by **TEL**. WebSocket-shaped ingest: DTOs, JSON router, mock / replay / live sources, typed event bus.

## Layout

| File | Role |
| --- | --- |
| `types.ts` | Wire DTOs (`TelemetryData`, `BoatTelemetry`, `StreamAnchorMessage`) |
| `boatToStandardTelemetry.ts` | Boat → standard pose mapping (Unity `ToStandardTelemetry` parity) |
| `router.ts` | `classify` / `tryParseStreamAnchor` (Unity `TelemetryWsJsonRouter`) |
| `mockSource.ts` | Interval mock: drone `1`, boat `21`, periodic `stream_anchor` |
| `replayFixture.ts` | Fixture v1 types + `parseReplayFixture` / `loadReplayFixture` |
| `replaySource.ts` | Timer playback of a fixture onto `ingestPacket` |
| `liveSource.ts` | Browser WebSocket client(s) for live mode (drone + optional boat) |
| `bus.ts` | Typed pub-sub |
| `ingest.ts` | Start ingest from `telemetryMode`; route JSON onto the bus |
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
| `wsUrl` | Drone / primary live WebSocket URL (default `""`) |
| `wsBoatUrl` | Boat live WebSocket URL (default `""` → drone-only live) |

### Modes

- **mock** — `MockTelemetrySource` (unchanged).
- **replay** — fetch `replayUrl`, validate v1, play via timers onto `ingestPacket`.
- **live** — open WebSocket(s) when URL(s) resolve; text frames → `ingestPacket` by channel.

If `/config.json` fetch fails, mode defaults to `mock`.

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
| `loop` | `true` restarts after the last `t_ms`; `false` plays once |
| `packets` | Non-empty array |
| `t_ms` | ms from replay start; finite ≥ 0; monotonic non-decreasing |
| `channel` | `"drone"` \| `"boat"` (connection context, same as mock) |
| `payload` | Object matching wire DTOs — drone pose, boat, or `stream_anchor` |

Replay serializes each `payload` → JSON text and feeds `ingestPacket`, so the router / `stream_anchor` path stays real. A live→fixture recorder is **not** implemented here.

Sample: [`public/fixtures/telemetry/spine-demo.json`](../../public/fixtures/telemetry/spine-demo.json) — drone `1` + boat `21` near Istanbul (~3 s loop), includes `stream_anchor`.

Invalid fixtures fail soft: console warn, ingest no-op stop, app does not crash.

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

## Channel IDs (mock / sample fixture)

- Drone: `"1"`
- Boat: `"21"`

## Out of this module (other orchestrators)

No ECEF/ENU (GEO), no Three boat/drone meshes (SCN), no fixture recorder, no PLT reverse-proxy WSS (5.2).
