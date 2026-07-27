# SCN_MEMO

**Last updated:** 2026-07-27  
**Status:** Phase 2.2 accepted — idle pending BW route (2.3 / 2.7)

## Focus
Phase 2 race content. **2.1 + 2.2 done.** Next: course/buoys (**2.3**) or name/colour JSON (**2.7**) when BW opens.

## Decisions
- V1 freeze: 1 drone + boats + course + 2D map; sponsors/flags can follow (BW)
- Owns: `src/scene/`, `src/assets/`, stub HUD, 2D map; no geo/WS/chroma
- **2.1 DONE:** `public/models/boat.glb` + procedural fallback + tags
- **2.2 DONE:** fleet `Map<id, entity>` from `poseBus`, capped by `loadConfig().boatIds` (default 21–24); HUD multi-boat ENU; `main` awaits config before `startScene`
- Contract: `HO-TEL-SCN-20260724-01` — TEL mock/replay multi-id + SCN registry; live multi-URL still TEL follow-up
- Name/colour JSON = **2.7**

## Issued dispatches
- **DSP-SCN-20260722-01** … **02**, **20260723-01** — **DONE**
- **DSP-SCN-20260727-01-fleet-registry** — **DONE** → `docs/agentic/dispatches/done/`  
  Accepted 2026-07-27; worker [fleet-registry](960384da-b853-4396-adc0-fcc7d1b784ba); tests 71/71

## Handoffs
- **HO-TEL-SCN-20260724-01** — **closed** (SCN asks checked)
- **HO-SCN-TEL-20260723-01** — prior plan; satisfied via TEL-24 + this DSP

## Blockers
- None

## Next
1. FYI BW: roadmap **2.2** closed (TEL + SCN)
2. Optional human: `npm run dev` confirm boats 21–24 in 3D/map/HUD
3. When BW opens: **2.3** course + buoys (SCN) and/or **2.7** name/colour JSON
