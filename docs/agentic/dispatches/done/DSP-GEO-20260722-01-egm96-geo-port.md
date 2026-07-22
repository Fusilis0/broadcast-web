# Dispatch DSP-GEO-20260722-01-egm96-geo-port

## Meta
- From orchestrator: GEO
- Worker role: WORKER(DSP-GEO-20260722-01-egm96-geo-port)
- Priority: P0
- Phase: Phase 0.6 + Phase 1.1 / 1.2 (EGM96 copy + GeoOrigin/GeoUtils/EGM96 port + tests)
- Related handoffs: none
- **Status: DONE** (worker report accepted by GEO 2026-07-22)

## Goal

Copy Unity’s EGM96 grid into `public/`, port `EGM96Geoid` + `GeoOrigin` + `GeoUtils` into `src/geodesy/` with Unity-compatible ENU math, and add unit tests for known points. Library + tests only — no scene graph, no WebSocket, no canvas wiring.

## Acceptance criteria

- [x] `public/EGM96_1deg.bin` exists and matches Unity source (130326 bytes; verified)
- [x] `src/geodesy/` exports working EGM96 + GeoOrigin + GeoUtils ports
- [x] Axis mapping documented and enforced: `x=East`, `y=Up`, `z=North`
- [x] No Cesium/scene-lookup code; origin set explicitly
- [x] `npm test` passes (10/10); Istanbul N ≈ 37.43 m at (41, 29)
- [x] `npm run build` succeeds (GEO re-verified 2026-07-22)
- [x] No scene/WS/telemetry/canvas feature wiring
- [x] Unity repo untouched
- [x] No secrets committed

## Worker report (summary)

Ported EGM96 / GeoOrigin / GeoUtils; bin at `public/EGM96_1deg.bin`; Vitest suite; `applyConfigOrigin` helper. Istanbul smoke N ≈ 37.43 m. No scene/WS wiring.

## Files delivered

- `public/EGM96_1deg.bin`
- `src/geodesy/{egm96,geoOrigin,geoUtils,applyConfigOrigin,index,geodesy.test}.ts` + README
- `vitest.config.ts`; `package.json` / lock (vitest); `tsconfig.json` excludes `*.test.ts` from `tsc`
