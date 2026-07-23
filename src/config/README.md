# config

Owned by **PLT+BW**. Thin `/config.json` loader — no domain logic.

## Public API

| Symbol | Role |
| --- | --- |
| `loadConfig(url?)` | Fetch and normalize `public/config.json` |
| `normalizeConfig(raw)` | Fill defaults from a parsed object |
| `AppConfig` | Typed shape |

## Fields used by Phase 1.5

| Field | Notes |
| --- | --- |
| `origin` | `{ lat, lon, altMsl }` — AMSL world origin for GEO |
| `takeoffAltitudeMSL` | Drone relative→HAE (default `0`) |
| `telemetryMode` | `mock` \| `replay` \| `live` (committed default: `mock`) |
| `replayUrl` | Fixture path for replay mode (default `/fixtures/telemetry/spine-demo.json`) |

Mock-centered default origin is Istanbul near TEL mock tracks (`41.0082, 28.9784`), not `0,0`.

To try replay locally: set `"telemetryMode": "replay"` in `public/config.json` (do not commit that change as the default).
