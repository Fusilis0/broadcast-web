# Dispatch DSP-SCN-20260727-04-sponsors-subset

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260727-04-sponsors-subset)
- Priority: P0
- Phase: Phase 2.5 — sponsors subset (SCN-only)
- Related handoffs: none
- BW ask: sponsors subset; **no chroma**; **no 2.7** boat name/colour JSON
- **Status: DONE** (worker report accepted by SCN 2026-07-27)

## Goal

Add a **small subset** of race **sponsor billboards** in the Three.js scene: static world panels placed from a JSON fixture (lat/lon pairs → ENU via GEO `gpsToEnuAmsl`), visible under default mock near the Istanbul origin/course. Placeholder branding is fine (colored panel + label). No full Unity sponsor pack import, no chroma, no boat name catalogue.

## Acceptance criteria

- [x] Demo sponsors JSON loads; **≥2** billboards visible in 3D under default mock (3 panels in fixture)
- [x] Placement uses GEO `gpsToEnuAmsl` only; water Y = 0 documented
- [x] Missing texture → procedural labeled panel
- [x] Config `sponsorsUrl` default `/fixtures/sponsors/demo-istanbul.json`
- [x] No chroma; no 2.7 boat name catalogue work
- [x] Course + fleet + POV still work (not broken by this DSP)
- [x] `npm test` + `npm run build` green — SCN re-verified **106/106** (2026-07-27)
- [x] `npm run dev`: sponsors readable toward course edges (worker manual)
- [x] Unity untouched; no large binary surprise (procedural only)

## Worker report (summary)

3 demo panels (west/north/east); `sponsorsUrl`; water Y=0; facing = flatten(A→B)×up (left of A→B); procedural labels. Optional map ticks skipped.

## Files delivered

- `public/fixtures/sponsors/demo-istanbul.json`, `README.md`
- `public/config.json` (`sponsorsUrl`)
- `src/scene/sponsors/*`
- `src/scene/createScene.ts`, `index.ts`, `README.md`
- `src/main.ts`
- `src/config/{types,loadConfig,loadConfig.test,index,README}`

## Full original dispatch

See git history for full in/out-of-scope text. Scope was SCN 2.5 sponsors subset only.
