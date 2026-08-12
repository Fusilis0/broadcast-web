# CON_MEMO

**Last updated:** 2026-08-04  
**Status:** Active — Phase 10.2 SPA ack pack shipped; pending console-team emit ack

## Mandate
Handoff: `docs/agentic/dispatches/active/HO-BW-20260804-04-open-phase10-cutover.md` (item **10.2**)  
Worker: `DSP-CON-20260804-01-console-deeplink-ack` → **done** (SPA side)

## Goal
Close console deep-link loop for V1-C: SPA contract + example URL ack pack for console team; memo ack status when done.

## Decisions / facts
- Console repo: still no pull unless BW opens it — CON docs + SPA consumer only
- SPA parser: `src/console/parseConsoleDeeplink` + `applyDeeplinkToBoot`; unsafe `race` ids warn + omit
- Contract: `docs/contracts/console-deeplink.md` — **proposed**; example URL matrix + PLT companion `role` / `projectsRole` documented
- Ack pack handoff: `docs/agentic/handoffs/HO-CON-console-team-20260804-01.md`
- `token` (console opaque) ≠ LAN `projectsApiToken` (PLT config)

## Issued / active dispatches
- None (10.2 SPA worker complete)

## Handoffs
- Received: `HO-BW-20260804-04` — Phase 10 cutover open; CON owns 10.2
- Out: `HO-CON-console-team-20260804-01` — example URL ack pack; awaiting console emit confirmation

## Ack status
**Pending console** — SPA + contract + example matrix ready; formal console-team emit **not** confirmed

## Out of scope for CON this phase
- 10.1 Unity cutover (BW + human)
- 10.3 NDI studio smoke (OUT)
- Phase 11/12
