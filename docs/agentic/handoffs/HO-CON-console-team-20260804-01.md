# Handoff HO-CON-console-team-20260804-01 — Deep-link ack pack

## From → To
CON (broadcast-web) → console team

## Type
contract-change (emit ack requested)

## Summary
broadcast-web SPA deep-link consumer is ready. Please emit launch URLs matching the proposed contract (or reply with param diffs). Formal ack moves the contract from **proposed** → **stable** (CON + BW).

## Decisions / facts
- Contract: `docs/contracts/console-deeplink.md` (example URL matrix included)
- SPA: `parseConsoleDeeplink` + `applyDeeplinkToBoot` under `src/console/`
- Boot order: `config.json` → optional `?race=` pack → CON query overrides (URL wins)
- LAN air role: companion query `?role=air` or `?projectsRole=air` (PLT `projectsAuth`, not CON parser fields)
- `token` is opaque / not validated in V1 — do not send real secrets into git examples
- Path `/overlay` is canonical for production; local Vite accepts query on `/`

## Asks of receiver
- [ ] Confirm you will emit the param names in the contract table (`race`, `mode`, `originLat`, `originLon`, optional `originAltMsl`, `outputMode`, `token`)
- [ ] Confirm navigation choice: same-tab vs `window.open`
- [ ] Confirm production path: `/overlay` vs query-on-`/`
- [ ] Confirm whether console sets `role=air` for air PCs or relies on machine `config.json`
- [ ] Reply with token format/lifetime notes (or “TBD / opaque string for V1”)
- [ ] Flag any param renames needed before emit

## Example URLs (copy/paste)

| Scenario | URL |
| --- | --- |
| Editor load race | `http://127.0.0.1:5173/?race=demo-istanbul` |
| Air PC | `http://127.0.0.1:5173/?race=demo-istanbul&role=air` |
| Replay + origin | `http://127.0.0.1:5173/?race=demo-istanbul&mode=replay&originLat=41.0082&originLon=28.9784` |
| Chroma | `http://127.0.0.1:5173/?race=demo-istanbul&outputMode=chroma` |
| Prod shape | `https://<host>/overlay?race=<id>&mode=live&role=air` |

Full matrix: contract § Example URL matrix.

## Artifacts
- `docs/contracts/console-deeplink.md`
- `src/console/`
- `docs/agentic/dispatches/done/DSP-CON-20260804-01-console-deeplink-ack.md`
- Ops LAN roles: `docs/ops/projects-api.md`

## Urgency
P1 (Phase 10.2 / V1-C)
