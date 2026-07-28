# Dispatch DSP-CON-20260728-01-deeplink-contract-parser

## Meta
- From orchestrator: CON (BW-opened Phase **3.6**)
- Worker role: WORKER(DSP-CON-20260728-01-deeplink-contract-parser)
- Priority: P1
- Phase: Phase 3.6 — Console deep-link design doc + SPA parser stub
- Related handoffs: none (console team negotiation is human/CON later)
- BW ask: lock a handable contract + SPA query parser stub; no console repo; no auth server; no WHEP/NDI
- Supersedes: `DSP-CON-20260722-01-console-deeplink-contract` (Phase 0 docs-only; never completed — contract still stub)

## Goal

1. Expand `docs/contracts/console-deeplink.md` into a self-contained **proposed** URL contract the console team can negotiate against.  
2. Implement a thin **parser stub** under `src/console/` and wire boot so query overrides (`mode`, origin lat/lon) apply on load.  
Do **not** claim console-team agreement — status stays Draft / proposed until they ack.

## Background

- Roadmap: Phase **3.6** — “Console deep-link design doc agreed” (gate = contract ready + SPA can consume; external “agreed” is human follow-up)
- Architecture §5.4: `/overlay?race=&token=&originLat=&originLon=&mode=…`
- Folder stub: `src/console/README.md` (empty until this DSP)
- Config today: `loadConfig()` from `public/config.json`; telemetry mode + origin already drive boot (`src/main.ts`, `src/config/`)
- Vite SPA: parser must work from `window.location.search` whether path is `/`, `/overlay`, or `/index.html` (document host routing separately; do not require a real `/overlay` file)
- Token: opaque string only — **no** JWT decode / validation in V1
- Console repo: discussion-only — **do not** clone or edit console code

## In scope

### A. Contract doc

Rewrite `docs/contracts/console-deeplink.md` to include:

1. Status banner: Draft / not negotiated; owner CON; console UI out of scope  
2. Intent: console button → opens broadcast-web (same or new tab)  
3. Canonical URL template: `https://<host>/overlay?...` (and note query on `/` is accepted by SPA parser for local Vite)  
4. Parameter table (name, required/optional, type, allowed values, default, notes):

| Param | Baseline |
| --- | --- |
| `race` | optional/recommended — race/event id string |
| `token` | optional — opaque auth handoff; TBD with console team |
| `mode` | optional — `mock` \| `replay` \| `live`; default = config / `mock` |
| `originLat` / `originLon` | optional — degrees; **URL wins** over `config.json` origin when both present |
| `originAltMsl` | optional reserved — meters; apply if cheap, else document reserved |
| `outputMode` | optional reserved — `preview` \| `chroma` (negotiable; apply if cheap) |

5. Open questions for console team (token format/expiry, race namespace, same-tab vs new-tab, host path `/overlay` vs `/`, postMessage later)  
6. Non-goals: console UI, auth server, full postMessage protocol, inventing JWT claims  
7. Versioning: proposed; breaking changes need CON + BW before “stable”

### B. SPA parser (`src/console/`)

8. `parseConsoleDeeplink(search: string | URLSearchParams): ConsoleDeeplink` (pure; unit-tested)  
9. Typed result: present fields only; invalid `mode` ignored or warned (do not crash)  
10. `applyDeeplinkToBoot` or equivalent used from `main.ts` **after** `loadConfig()`, before origin/EGM96 + ingest:
    - Override `telemetryMode` when `mode` valid  
    - Override origin lat/lon (and alt if implemented) when present  
    - Pass through `race` / `token` as read-only fields (log once or stash on a small CON handle — **do not** validate token)  
    - Optional: apply `outputMode` if parsed and already supported by OUT  
11. Update `src/console/README.md` ownership + usage  
12. Light note in root `README.md` or ops doc: example local URL `http://127.0.0.1:5173/?mode=replay&originLat=41.0082&originLon=28.9784`

## Out of scope

- Console repository / console button UI  
- Auth validation, JWT libraries, secrets  
- `postMessage` parent↔overlay protocol (future CON)  
- Changing live multi-URL TEL, WHEP, NDI  
- Rewriting Vite multi-page `/overlay` hosting (document only; SPA query on `/` is enough for V1)  
- Persisting deeplink overrides into `config.json` on disk

## Likely files

- `docs/contracts/console-deeplink.md`
- `src/console/*` (parse, types, tests, README, index)
- `src/main.ts` (apply after `loadConfig`)
- Possibly thin helpers in `src/config/` only if needed to merge overrides — prefer CON-owned merge in `src/console/`

## Inputs provided

- Existing stub contract + architecture §5.4  
- Working `loadConfig` / boot path in `main.ts`  
- Modes already: `mock` \| `replay` \| `live`

## Acceptance criteria

- [ ] Contract doc is self-contained proposed (not a stub); status Draft / not negotiated  
- [ ] Param table covers `race`, `token`, `mode`, `originLat`, `originLon`  
- [ ] `parseConsoleDeeplink` unit tests cover happy path + bad mode + missing params  
- [ ] Boot respects `?mode=` and origin overrides without crashing when query empty  
- [ ] Token never validated; no secrets in docs  
- [ ] `npm test` + `npm run build` green  
- [ ] No console-repo access

## Report back

When done, reply with:
1. Summary of changes  
2. Files touched  
3. Tests run / how verified (incl. example query string)  
4. Follow-ups / blockers (esp. anything needing console-team ack)  
5. Suggested memo bullets for CON (+ FYI BW)

## Worker paste block

```
You are WORKER(DSP-CON-20260728-01-deeplink-contract-parser).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-CON-20260728-01-deeplink-contract-parser.md (full)
2. docs/agentic/DISPATCH_PROTOCOL.md (worker rules)
3. docs/contracts/console-deeplink.md (current stub)
4. docs/architecture/system-architecture.md §5.4
5. src/console/README.md + src/main.ts boot (loadConfig → origin → ingest)
6. src/config/types.ts (AppConfig fields you may override)

Implement in scope only: expand contract + SPA parser stub + boot wire.
No console repo, no auth validation, no WHEP/NDI, no postMessage protocol.
When finished, report using the dispatch Report back section.
```
