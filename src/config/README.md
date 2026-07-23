# config

Owned by **PLT+BW**. Thin `/config.json` loader — no domain logic.

## Public API

| Symbol | Role |
| --- | --- |
| `loadConfig(url?)` | Fetch and normalize `public/config.json` |
| `normalizeConfig(raw)` | Fill defaults from a parsed object |
| `AppConfig` | Typed shape |

## Fields

| Field | Notes |
| --- | --- |
| `origin` | `{ lat, lon, altMsl }` — AMSL world origin for GEO |
| `takeoffAltitudeMSL` | Drone relative→HAE (default `0`) |
| `telemetryMode` | `mock` \| `replay` \| `live` (committed default: `mock`) |
| `replayUrl` | Fixture path for replay mode (default `/fixtures/telemetry/spine-demo.json`) |
| `wsUrl` | Drone / primary live WebSocket URL (default `""`) |
| `wsBoatUrl` | Boat live WebSocket URL (default `""`) |
| `outputMode` | Preview / later output modes |

Mock-centered default origin is Istanbul near TEL mock tracks (`41.0082, 28.9784`), not `0,0`.

### Live URLs

Leave `wsUrl` / `wsBoatUrl` empty in git. Override locally via config or Vite env (`VITE_WS_URL`, `VITE_WS_BOAT_URL` — see `.env.example`). Full resolution order and **`ws://` vs `wss://`** (HTTPS mixed content) are documented in [`src/telemetry/README.md`](../telemetry/README.md).

To try replay locally: set `"telemetryMode": "replay"` in `public/config.json` (do not commit that change as the default).
