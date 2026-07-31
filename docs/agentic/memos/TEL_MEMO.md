# TEL_MEMO

**Last updated:** 2026-07-31  
**Status:** Idle — FYI PLT 5.2 WSS docs

## Focus
None active. Live multi-URL still deferred.

## Decisions
- Live: single `wsUrl` / `wsBoatUrl` strings — **`wss://` pass-through** verified (PLT 5.2 / `live.test.ts`)
- HTTPS SPA must not use `ws://` (mixed content) — see `docs/ops/wss-live-telemetry.md`
- **4.1** replay/reconnect polish DONE

## Done (recent)
- Through 4.1; multi-POV/boat mock
- FYI: PLT **5.2** runbook linked from TEL README — no protocol change

## Next
1. Idle until BW opens live multi-URL, recorder, or live HTTPS soak support
