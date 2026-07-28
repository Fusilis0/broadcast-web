# CON_MEMO

**Last updated:** 2026-07-28  
**Status:** Idle — 3.6 SPA gate done; awaiting console-team ack

## Focus
None active. Contract proposed + SPA parser live.

## Decisions
- Console repo: no pull; contract + our SPA only
- Path `/overlay?...` canonical; local Vite `/?...` OK
- Boot: `loadConfig` → `parseConsoleDeeplink` / `applyDeeplinkToBoot` → origin → ingest
- URL wins for `mode` / origin / `outputMode`; `race`/`token` pass-through; token never validated
- Status remains **Draft / proposed** until console team acks open questions in `docs/contracts/console-deeplink.md`

## Issued dispatches
- **DSP-CON-20260728-01-deeplink-contract-parser** — **DONE** → `dispatches/done/`

## Handoffs
—

## Blockers
- Human negotiation with console team (token, race namespace, tab behaviour, `/overlay` hosting)

## Next
1. Send contract to console team when ready
2. Optional later: postMessage protocol DSP; PLT `/overlay` host route
