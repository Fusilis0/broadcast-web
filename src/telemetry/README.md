# telemetry

Owned by **TEL**. WebSocket-shaped ingest: DTOs, JSON router, mock source, replay fixtures, typed event bus.

## Layout

| File | Role |
| --- | --- |
| `types.ts` | Wire DTOs (`TelemetryData`, `BoatTelemetry`, `StreamAnchorMessage`) |
| `boatToStandardTelemetry.ts` | Boat → standard pose mapping (Unity `ToStandardTelemetry` parity) |
| `router.ts` | `classify` / `tryParseStreamAnchor` (Unity `TelemetryWsJsonRouter`) |
| `mockSource.ts` | Interval mock: drone `1`, boat `21`, periodic `stream_anchor` |
| `replayFixture.ts` | Fixture v1 types + `parseReplayFixture` / `loadReplayFixture` |
| `replaySource.ts` | Timer playback of a fixture onto `ingestPacket` |
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

- **mock** — `MockTelemetrySource` (unchanged).
- **replay** — fetch `replayUrl`, validate v1, play via timers onto `ingestPacket`.
- **live** — not implemented (TEL **1.9**); warn only, no WebSocket.

If `/config.json` fetch fails, mode defaults to `mock`.

### Try replay locally

1. Set `"telemetryMode": "replay"` in `public/config.json` **or** pick **replay** in the HUD mode select (mock ↔ replay switches without reload).
2. Do **not** leave the committed default as `replay`.
3. Optional: point `replayUrl` at another fixture under `public/`.

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

Replay serializes each `payload` → JSON text and feeds `ingestPacket`, so the router / `stream_anchor` path stays real. The same v1 shape is intended for a future live recorder (not implemented here).

Sample: [`public/fixtures/telemetry/spine-demo.json`](../../public/fixtures/telemetry/spine-demo.json) — drone `1` + boat `21` near Istanbul (~3 s loop), includes `stream_anchor`.

Invalid fixtures fail soft: console warn, ingest no-op stop, app does not crash.

## Verify mock is alive

```bash
npm run dev
```

Open the app (default mode **mock**). You should see:

1. Scene + ops HUD.
2. Status line with rising `drone` / `boat` / `stream_anchor` counters.
3. HUD hint: `mock source`. Switch to **replay** → hint `fixture replay`; counters keep advancing from the fixture. Switch back to **mock**. Selecting **live** only warns (TEL 1.9).

```bash
npm run build
npm run test
```

Must succeed with no TypeScript errors; Vitest covers fixture parse + playback ordering.

## Channel IDs (mock / sample fixture)

- Drone: `"1"`
- Boat: `"21"`

## Out of this module (other orchestrators)

No ECEF/ENU (GEO), no Three boat/drone meshes (SCN), no live WS (TEL 1.9).
