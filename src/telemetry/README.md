# telemetry

Owned by **TEL**. WebSocket-shaped ingest: DTOs, JSON router, mock source, typed event bus.

## Layout

| File | Role |
| --- | --- |
| `types.ts` | Wire DTOs (`TelemetryData`, `BoatTelemetry`, `StreamAnchorMessage`) |
| `boatToStandardTelemetry.ts` | Boat → standard pose mapping (Unity `ToStandardTelemetry` parity) |
| `router.ts` | `classify` / `tryParseStreamAnchor` (Unity `TelemetryWsJsonRouter`) |
| `mockSource.ts` | Interval mock: drone `1`, boat `21`, periodic `stream_anchor` |
| `bus.ts` | Typed pub-sub |
| `ingest.ts` | Start ingest from `telemetryMode`; route mock JSON onto the bus |
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

`public/config.json` → `telemetryMode: "mock" | "replay" | "live"`.

This slice implements **mock only**. If `/config.json` fetch fails, mode defaults to `mock`.

## Verify mock is alive

```bash
npm run dev
```

Open the app. You should see:

1. Existing wireframe cube (unchanged).
2. A plain status line (or console logs) with rising `drone` / `boat` / `stream_anchor` counters.
3. In DevTools console (optional): packet counts increasing ~15 Hz for drone/boat; stream_anchor every ~1.5 s.

```bash
npm run build
```

Must succeed with no TypeScript errors.

## Channel IDs (mock)

- Drone: `"1"`
- Boat: `"21"`

## Out of this module (other orchestrators)

No ECEF/ENU (GEO), no Three boat/drone meshes (SCN), no live WS / replay loader (later TEL).
