# PLT_MEMO

**Last updated:** 2026-07-31  
**Status:** Active — 5.1 done; 5.2 WSS DSP issued

## Focus
HTTPS live telemetry path (docs + client verify).

## Decisions
- **5.1 DONE:** `docs/ops/hetzner-static-deploy.md`; `base: '/'`; example rsync script; `dist/` has races + EGM96
- Human owns first Hetzner upload / smoke
- Live on HTTPS needs **5.2** — DSP issued

## Issued dispatches
- DSP-PLT-20260731-01 — **DONE**
- **DSP-PLT-20260731-02-wss-live-proxy** — active

## Next
1. Worker: 5.2
2. Human: upload `dist/` when ready
