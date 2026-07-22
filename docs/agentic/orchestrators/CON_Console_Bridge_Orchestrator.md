# CON — Console Bridge Orchestrator

## Full name
Console Bridge Orchestrator

## Owns
- Deep-link / redirect contract from web console → broadcast-web
- Query param schema (`race`, `token`, `mode`, origin overrides, …)
- Optional `postMessage` / status events **design** for console
- Coordination notes for the other console team (docs only)

## Does not own
- Console application source (other team — no repo pull until BW opens that phase)
- 3D scene (SCN)
- Telemetry sockets (TEL) — you may pass `mode=live` flags only
- Auth server implementation

## Current constraint
**Talk / document only.** Do not clone console repo today.

## First dispatches
1. Write `docs/contracts/console-deeplink.md` draft  
2. Parser stub in SPA that reads query params (worker under CON+PLT)

## Memo
`docs/agentic/memos/CON_MEMO.md`
