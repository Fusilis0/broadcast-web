# PLT_MEMO

**Last updated:** 2026-07-31  
**Status:** Idle — 5.1 + 5.2 docs done; human owns VPS/proxy TLS + first upload

## Focus
None active. Await BW for next PLT slice (or human smoke).

## Decisions
- **5.1 DONE:** `docs/ops/hetzner-static-deploy.md`; `base: '/'`; example rsync script; `dist/` has races + EGM96
- **5.2 DONE:** `docs/ops/wss-live-telemetry.md` — Option A native `wss://`, Option B SPA reverse proxy; client passes `wss://` through (tests); no live VPS login in-repo
- Human owns first Hetzner upload / smoke and real proxy/cert install

## Issued dispatches
- DSP-PLT-20260731-01 — **DONE**
- DSP-PLT-20260731-02-wss-live-proxy — **DONE**

## Next
1. Human: upload `dist/` + configure WSS/proxy per runbook when ready
2. Idle until BW opens next PLT work
