# Console deep-link contract (proposed)

| | |
| --- | --- |
| **Status** | **Draft / proposed** — not negotiated with the console team |
| **Owner** | CON (Console Bridge Orchestrator) |
| **SPA consumer** | `src/console/` parser stub (broadcast-web) |
| **Out of scope** | Console UI, auth server, JWT validation, postMessage protocol |

This document is a **handable proposal** the console team can negotiate against. Do not treat parameter names or semantics as agreed until they acknowledge.

---

## Intent

The web console shows a control that opens **broadcast-web** (same tab or new tab — TBD with console team). The SPA boots from `public/config.json`, then applies **query-string overrides** so ops can launch a race context without editing config on disk.

Deep-link overrides are **runtime only** — they are never written back to `config.json`.

---

## Canonical URL template

```
https://<host>/overlay?race=<raceId>&token=<opaque>&mode=mock|replay|live&originLat=<deg>&originLon=<deg>&originAltMsl=<m>&outputMode=preview|chroma|transparent
```

| Path | Notes |
| --- | --- |
| `/overlay` | Canonical path for production / console redirects (architecture §5.4) |
| `/` or `/index.html` | Accepted by the SPA parser today (Vite single-page app). Host routing for a real `/overlay` document is a separate PLT concern — V1 only needs the query string |

Local Vite examples:

```
http://127.0.0.1:5173/?race=demo-istanbul
http://127.0.0.1:5173/?mode=replay&originLat=41.0082&originLon=28.9784
```

Boot merge order: `config.json` → race pack (if `race` set) → other query overrides (URL wins).

---

## Parameters

| Param | Required | Type | Allowed / default | Notes |
| --- | --- | --- | --- | --- |
| `race` | optional (recommended) | string | safe id (`[A-Za-z0-9][A-Za-z0-9_-]{0,63}`) | Loads local pack `/races/<id>/project.json` (see [`race-project.md`](./race-project.md)). Miss → warn + `config.json` boot |
| `token` | optional | string | opaque string | Auth handoff. **Never decoded or validated in V1** — format/expiry TBD with console team |
| `mode` | optional | enum | `mock` \| `replay` \| `live`; default = `config.json` `telemetryMode` (else mock) | Invalid values are ignored (warn); boot does not crash |
| `originLat` | optional | number (degrees) | finite float | **URL wins** over `config.json` `origin.lat` when present |
| `originLon` | optional | number (degrees) | finite float | **URL wins** over `config.json` `origin.lon` when present |
| `originAltMsl` | optional (reserved) | number (meters) | finite float | AMSL; applied when present. Otherwise reserved for later |
| `outputMode` | optional (reserved / negotiable) | enum | `preview` \| `chroma` \| `transparent` | Applied when present and already supported by OUT. Other values ignored. `transparent` = NDI alpha plate (Electron studio) |

### Precedence

1. `loadConfig()` (`config.json`)
2. If `race` present → merge RaceProject pack (see [`race-project.md`](./race-project.md)); on failure warn and keep config
3. Other query params that parse successfully override matching `AppConfig` fields (**URL wins**)
4. Missing / invalid query params leave config unchanged
5. Overrides are not persisted to disk

### Token handling (V1)

- Treat as an opaque string (pass-through / log once).
- No JWT library, no signature check, no claims inspection.
- Do not put secrets or example live tokens in this repo.

---

## Open questions (console team)

1. **Token** — format, lifetime, refresh, and who validates (console vs broadcast-web later)?
2. **`race` namespace** — shared id scheme with console race lists / config packs?
3. **Navigation** — same-tab redirect vs `window.open` (new tab)?
4. **Path** — will production always use `/overlay`, or is query-on-`/` enough?
5. **postMessage** — parent↔overlay protocol (future CON); not part of this contract revision.

---

## Non-goals

- Console button / console repository implementation  
- Auth server or JWT inventing claims  
- Full `postMessage` parent↔overlay protocol  
- Live multi-URL TEL, WHEP, NDI changes  
- Rewriting Vite multi-page hosting for `/overlay`  
- Persisting deeplink overrides into `config.json`

---

## Versioning

| Stage | Meaning |
| --- | --- |
| **proposed** (current) | CON + SPA stub; console team has not acked |
| **stable** | Requires CON + BW agreement after console ack; breaking query changes need that gate |

Breaking changes while **proposed** should still be coordinated with CON (and FYI BW) so the SPA parser and this doc stay aligned.
