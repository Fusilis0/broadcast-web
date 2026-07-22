# GEO_MEMO

**Last updated:** 2026-07-22  
**Status:** Active — geodesy port DSP issued; awaiting worker

## Focus
Phase 0.6 + Phase 1.1/1.2 — EGM96 copy + GeoOrigin / GeoUtils / EGM96Geoid port + unit tests.

## Decisions
- Axis contract: Three.js `x=East`, `y=Up`, `z=North` (Unity ENU parity) — locked
- Boat altitude: HAE provisional (architecture §5.2)
- Declination default `0` (true-north MSDK assumption)
- Origin: explicit `setOriginHAE` / `setOriginAMSL` only (no Cesium / GlobalWorldAnchor port)
- Port fidelity: match Unity WGS84 constants + ECEF→ENU + EGM96 bilinear
- EGM96 served from `public/EGM96_1deg.bin` via fetch (browser) / fs in Vitest
- Vitest allowed in this DSP for acceptance tests (minimal PLT tooling touch)

## Issued dispatches
- **DSP-GEO-20260722-01-egm96-geo-port** — `docs/agentic/dispatches/active/DSP-GEO-20260722-01-egm96-geo-port.md`  
  Status: **active / awaiting worker**  
  Scope: copy Unity `EGM96_1deg.bin` → `public/`; port EGM96 + GeoOrigin + GeoUtils; unit tests. No scene/WS.

## Handoffs
—

## Blockers
- Waiting on human to open a **new worker chat** with the DSP paste block
- Unity bin confirmed on disk (~130 326 bytes) — prior “missing” was tool visibility only

## Next after worker reports
1. Accept report; move DSP to `done/` if green
2. Tick roadmap 0.6 / 1.1 / 1.2 (or ask BW)
3. Notify BW + peers (TEL/SCN): ENU library ready for consumers
4. Later DSP: real Cesium-matched origin values in config
