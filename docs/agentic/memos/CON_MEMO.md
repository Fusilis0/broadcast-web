# CON_MEMO

**Last updated:** 2026-07-22  
**Status:** Active — bootstrapped

## Focus
Proposed console → broadcast-web deep-link URL contract (docs only). Next after contract: SPA query parser stub under `src/console/` (CON+PLT), when scaffold exists.

## Decisions
- Console repo: no pull today; contract docs only
- Deep-link path baseline from architecture §5.4: `/overlay?race=&token=&originLat=&originLon=&mode=live|mock` — expand `mode` to include `replay` for PLT/TEL config parity
- Auth token: opaque handoff design only; no JWT claims invented until console team negotiates
- Existing stub at `docs/contracts/console-deeplink.md` is insufficient; worker expands it via DSP below

## Issued dispatches
- `DSP-CON-20260722-01-console-deeplink-contract` — expand `docs/contracts/console-deeplink.md` into negotiable proposed contract (**active**)

## Handoffs
—

## Blockers
- Need console team contact for deep-link negotiation (later)
- SPA parser dispatch blocked until PLT scaffold lands `src/console/` (PLT `DSP-PLT-20260722-01-scaffold-vite-three`)
