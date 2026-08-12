# Console deep-link contract (proposed)

| | |
| --- | --- |
| **Status** | **Draft / proposed** — SPA consumer ready; **pending console-team emit ack** |
| **Owner** | CON (Console Bridge Orchestrator) |
| **SPA consumer** | `src/console/` (`parseConsoleDeeplink` / `applyDeeplinkToBoot`) |
| **Ack pack** | [`docs/agentic/handoffs/HO-CON-console-team-20260804-01.md`](../agentic/handoffs/HO-CON-console-team-20260804-01.md) |
| **Out of scope** | Console UI, auth server, JWT validation, postMessage protocol |

This document is a **handable proposal** the console team can negotiate against. Do not treat parameter names or semantics as agreed until they acknowledge.

---

## Intent

The web console shows a control that opens **broadcast-web** (same tab or new tab — TBD with console team). The SPA boots from `public/config.json`, then applies **query-string overrides** so ops can launch a race context without editing config on disk.

Deep-link overrides are **runtime only** — they are never written back to `config.json`.

---

## Canonical URL template

```
https://<host>/overlay?race=<raceId>&token=<opaque>&mode=mock|replay|live&originLat=<deg>&originLon=<deg>&originAltMsl=<m>&outputMode=preview|chroma|transparent&role=editor|air
```

| Path | Notes |
| --- | --- |
| `/overlay` | Canonical path for production / console redirects (architecture §5.4) |
| `/` or `/index.html` | Accepted by the SPA parser today (Vite single-page app). Host routing for a real `/overlay` document is a separate PLT concern — V1 only needs the query string |

Local Vite examples — see [Example URL matrix](#example-url-matrix-ack-pack).

Boot merge order (SPA `main.ts`):

1. `loadConfig()` (`config.json`)
2. If `race` present → merge RaceProject pack (see [`race-project.md`](./race-project.md)); on failure warn and keep config
3. Other CON query params that parse successfully override matching `AppConfig` fields (**URL wins**)
4. LAN role query (`role` / `projectsRole`) is resolved separately by PLT `projectsAuth` (query wins over `config.projectsRole`)
5. Missing / invalid query params leave config unchanged
6. Overrides are not persisted to disk

---

## Parameters (CON parser)

Consumed by `parseConsoleDeeplink` / `applyDeeplinkToBoot`.

| Param | Required | Type | Allowed / default | Notes |
| --- | --- | --- | --- | --- |
| `race` | optional (recommended) | string | safe id (`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`) | Loads pack `/races/<id>/project.json` (or API when `projectsApiBase` set). Unsafe id → warn + omitted (pack not loaded). Miss / load fail → warn + `config.json` boot |
| `token` | optional | string | opaque string | **Console auth handoff** only. **Never decoded or validated in V1**. Distinct from LAN `projectsApiToken` in `config.json` (PLT) |
| `mode` | optional | enum | `mock` \| `replay` \| `live`; default = `config.json` `telemetryMode` (else mock) | Invalid values are ignored (warn); boot does not crash |
| `originLat` | optional | number (degrees) | finite float | **URL wins** over `config.json` `origin.lat` when present |
| `originLon` | optional | number (degrees) | finite float | **URL wins** over `config.json` `origin.lon` when present |
| `originAltMsl` | optional (reserved) | number (meters) | finite float | AMSL; applied when present. Otherwise reserved for later |
| `outputMode` | optional (reserved / negotiable) | enum | `preview` \| `chroma` \| `transparent` | Applied when present and already supported by OUT. Other values ignored. `transparent` = NDI alpha plate (Electron studio) |

### Token handling (V1)

- Treat as an opaque string (pass-through / log once — presence only, never the value in production logs beyond debug).
- No JWT library, no signature check, no claims inspection.
- Do not put secrets or example live tokens in this repo.

---

## Companion parameters (PLT — not CON parser)

These are **not** fields on `ConsoleDeeplink`. The SPA reads them from the same query string via `src/projects/projectsAuth.ts`. Console emitters should still include them when launching air vs editor boots.

| Param | Required | Type | Allowed / default | Notes |
| --- | --- | --- | --- | --- |
| `role` | optional | enum | `editor` \| `air` (aliases: `edit` → editor; `air-only` / `aironly` → air) | Shorthand for LAN studio role. Query wins over `config.projectsRole`. Unknown → `editor` |
| `projectsRole` | optional | enum | same as `role` | Long form; if both present, **`projectsRole` wins** (`params.get('projectsRole') ?? params.get('role')`) |

Air role: Save / Save as / API writes disabled (UI + client guard). Ops detail: [`docs/ops/projects-api.md`](../ops/projects-api.md).

---

## Example URL matrix (ack pack)

Base (local Vite): `http://127.0.0.1:5173/`  
Production shape: `https://<host>/overlay?...` (same query).

| Scenario | Example URL |
| --- | --- |
| Editor — load demo race | `http://127.0.0.1:5173/?race=demo-istanbul` |
| Editor — race + replay mode | `http://127.0.0.1:5173/?race=demo-istanbul&mode=replay` |
| Editor — origin override | `http://127.0.0.1:5173/?race=demo-istanbul&originLat=41.0082&originLon=28.9784&originAltMsl=12.5` |
| Editor — chroma output | `http://127.0.0.1:5173/?race=demo-istanbul&outputMode=chroma` |
| Air PC — read/load only | `http://127.0.0.1:5173/?race=demo-istanbul&role=air` |
| Air — long-form role | `http://127.0.0.1:5173/?race=demo-istanbul&projectsRole=air` |
| Live mode (ops) | `http://127.0.0.1:5173/?race=demo-istanbul&mode=live&role=air` |
| Full proposed shape | `http://127.0.0.1:5173/overlay?race=demo-istanbul&mode=replay&originLat=41.0082&originLon=28.9784&outputMode=preview&role=editor` |
| Opaque token (shape only) | `http://127.0.0.1:5173/?race=demo-istanbul&token=<opaque-from-console>` |

Do **not** commit real production tokens. `<opaque-from-console>` is a placeholder.

---

## Open questions (console team)

1. **Token** — format, lifetime, refresh, and who validates (console vs broadcast-web later)?
2. **`race` namespace** — shared id scheme with console race lists / config packs? (SPA safe-id regex above)
3. **Navigation** — same-tab redirect vs `window.open` (new tab)?
4. **Path** — will production always use `/overlay`, or is query-on-`/` enough?
5. **Role emission** — will console set `role=air` for air PCs, or rely on per-machine `config.json` `projectsRole`?
6. **postMessage** — parent↔overlay protocol (future CON); not part of this contract revision.

---

## Non-goals

- Console button / console repository implementation  
- Auth server or JWT inventing claims  
- Full `postMessage` parent↔overlay protocol  
- Live multi-URL TEL, WHEP, NDI changes  
- Rewriting Vite multi-page hosting for `/overlay`  
- Persisting deeplink overrides into `config.json`
- Inventing a new auth product beyond documenting existing LAN `role` companion params

---

## Gaps / known SPA notes

| Topic | Status |
| --- | --- |
| CON params ↔ `src/console/` | Aligned (2026-08-04 ack pack) |
| `role` / `projectsRole` | Documented as PLT companion; not on `ConsoleDeeplink` type |
| `/overlay` document route | Query works on `/` today; host `/overlay` is PLT deploy concern |
| Console emit | **Pending** — console team has not formally acked |

---

## Versioning

| Stage | Meaning |
| --- | --- |
| **proposed** (current) | CON + SPA ready; console team has not acked emit |
| **stable** | Requires CON + BW agreement after console ack; breaking query changes need that gate |

Breaking changes while **proposed** should still be coordinated with CON (and FYI BW) so the SPA parser and this doc stay aligned.
