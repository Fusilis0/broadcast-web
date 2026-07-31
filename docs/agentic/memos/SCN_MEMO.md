# SCN_MEMO

**Last updated:** 2026-07-31  
**Status:** Active — 6.2 done; fleet-switch follow-up DSP issued

## Focus
Race pack UX — save/load local; fix allow-lists on soft switch.

## Decisions
- **6.2 DONE:** HUD race Load/Save; editor Save project → `project.json` download
- Persist = drop under `public/races/<id>/` + `index.json`
- Soft switch gap: boat/POV allow-lists boot-frozen → **DSP-SCN-20260731-02**

## Issued dispatches
- DSP-SCN-20260731-01 — **DONE**
- DSP-SCN-20260731-02-race-switch-fleet-lists — **active**

## Next
1. Worker: fleet-lists DSP
2. Then BW: GeoJSON 4.4 / Hetzner 5.1 / DB 6.4
