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
| `courseUrl` | Static course JSON for SCN (default `/fixtures/course/demo-istanbul.json`) |
| `sponsorsUrl` | Static sponsor billboards JSON for SCN (default `/fixtures/sponsors/demo-istanbul.json`) |
| `flagsUrl` | Countdown flags JSON for SCN (default `/fixtures/flags/demo-istanbul-countdown.json`) |
| `boatNamesUrl` | Boat name/colour catalogue JSON for SCN (default `/fixtures/boats/demo-istanbul-names.json`) |
| `wsUrl` | Drone / primary live WebSocket URL (default `""`) |
| `wsBoatUrl` | Boat live WebSocket URL (default `""`) — **single** socket; multi-URL is a TEL follow-up |
| `boatIds` | Boat channel ids for mock + SCN fleet registry (default `["21","22","23","24"]`; arch band `21–52`) |
| `povIds` | POV / drone+cam ids for mock multi-emit + SCN camera switch (default `["1","2"]`; bands `1–4` ∪ `11–12`) |
| `outputMode` | OUT clear mode: `preview` (committed default) \| `chroma` (see OUT). Unknown → preview |
| `chromaKey` | Optional chroma hex when mode is chroma (e.g. `"#00ff00"`). Empty → OUT default green |
| `timecodeEnabled` | OUT 8×8 visual timecode burn-in (default `true`) |
| `timecodeCorner` | `"bottom-right"` (default) \| `"bottom-left"` |
| `timecodeSizePx` | On-screen barcode size in CSS px (default `96`, clamped 32–256) |
| `whepUrl` | OUT MediaMTX WHEP underlay URL (default `""` = idle). Non-empty enables in preview — see [`src/output/README.md`](../output/README.md) |

### `boatIds` (SCN contract)

- Non-empty strings in band **`21–52`**. Missing / empty / all junk → four-id default matching committed `public/config.json`.
- Out-of-band values (including pilots **`81–84`**) are filtered with a console warn — pilots are deferred past Phase 2.2.
- Full band `21–52` later by extending the array only — no schema change.
- Display names / colours: SCN **2.7** via `boatNamesUrl`.

### `povIds` (SCN contract)

- Non-empty strings in bands **`1–4`** (drones) ∪ **`11–12`** (cams). Missing / empty / all junk → `["1","2"]`.
- Out-of-band values (boats / pilots / junk) are filtered with a console warn.
- Wire: still `channel: "drone"` + `TelemetryData.id` ∈ `povIds` (cams use the same DTO). SCN reads `loadConfig().povIds` for HUD switch allow-list.
- Full `1–4` + cams later by extending the array only. Display names remain **2.7**. Camera / HUD POV switch is **SCN**, not config/TEL.

Mock-centered default origin is Istanbul near TEL mock tracks (`41.0082, 28.9784`), not `0,0`.

### Live URLs

Leave `wsUrl` / `wsBoatUrl` empty in git. Override locally via config or Vite env (`VITE_WS_URL`, `VITE_WS_BOAT_URL` — see `.env.example`). Full resolution order and **`ws://` vs `wss://`** (HTTPS mixed content) are documented in [`src/telemetry/README.md`](../telemetry/README.md). Live remains a **single** primary `wsUrl` — multi-drone / multi-cam WebSockets are a TEL follow-up.

To try replay locally: set `"telemetryMode": "replay"` in `public/config.json` (do not commit that change as the default). For multi-boat replay, point `replayUrl` at `/fixtures/telemetry/spine-fleet.json`. For multi-POV replay, point at `/fixtures/telemetry/spine-pov.json`.
