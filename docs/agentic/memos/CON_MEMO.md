# CON_MEMO

**Last updated:** 2026-07-31  
**Status:** Idle — `?race=` pack load live (PLT 6.1)

## Focus
None active. Console-team ack of deeplink contract still pending.

## Decisions
- Parser + boot apply: mode/origin/outputMode
- **`race`:** loads `/races/<id>/project.json` before other deeplink overrides (PLT); miss → config boot
- Contract: `docs/contracts/console-deeplink.md` + `race-project.md`

## Done
- DSP-CON-20260728-01 deeplink parser — DONE
- PLT 6.1 wire for `?race=` — DONE (PLT-owned load)

## Next
1. Human: send contract to console team
2. Later: auth token validation with console
