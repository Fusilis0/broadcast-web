# CON_MEMO

**Last updated:** 2026-07-28  
**Status:** Active — Phase 3.6 DSP issued

## Focus
Console → broadcast-web deep-link: expand contract + SPA parser stub.

## Decisions
- Console repo: no pull; contract + our SPA only
- Path baseline `/overlay?...`; local Vite may use `/?...` (same query parser)
- `mode`: `mock` | `replay` | `live`
- Token: opaque only — no JWT validation in V1
- URL origin overrides win over `config.json` when present
- Supersedes unfinished Phase 0 DSP-CON-20260722-01 (archived `done/`)

## Issued dispatches
- **DSP-CON-20260728-01-deeplink-contract-parser** — `docs/agentic/dispatches/active/` — **active / awaiting worker**

## Handoffs
—

## Blockers
- External “agreed” with console team is human/CON after contract is ready

## Next
1. Human: worker chat with DSP paste block
2. On accept: tick roadmap 3.6 (proposed-ready); FYI BW for console-team send
