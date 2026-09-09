# Dispatch DSP-GEO-20260908-01-cinematic-globe

## Meta
- From orchestrator: GEO (BW issued 2026-09-08)
- Worker role: WORKER(DSP-GEO-20260908-01-cinematic-globe)
- Priority: **P0**
- Phase: **21** — globe keyframes
- Related: `docs/agentic/handoffs/HO-BW-GEO-20260908-01.md`. Design: `docs/architecture/commercial-video.md`
- Hold tileset mount, ocean, MP4, CesiumJS, NDI/SRT. Do not guess a second geoid.
- Worker result: **code-accept 2026-09-08** (BW). `src/geodesy/cinematicFrame.ts`. Exports: `geodeticToEcefMeters`, `ellipsoidUpEcef`, `ecefLookAt`, `enuKeyframeToScene`, `ECEF_LOOK_AT_EPSILON_M`. Degenerate look → **nadir**. Istanbul N ≈ 37.43 m. Geodesy tests **8/8**. Full `npm test`/`tsc` still red on unrelated WIP (`library.test.ts`, `main.ts`, `videoDecodePipeline.ts`) — not this DSP. **SCN-01 unblocked.**

## Goal

SCN cinematic player must convert **geodetic keyframes** in two domains: existing **ENU** (`gpsToEnuAmsl`) and **ECEF** for a globe camera (no `ReorientationPlugin`). Export tested helpers. Do not mount Cesium.

## Background

Race origin is an Istanbul tangent plane. World / Chicago / London shots are wrong in ENU. Locked: globe domain = WGS84 ECEF metres + ellipsoid up. Altitude in keyframes is **AMSL** — convert with existing `amslToHae` before ellipsoid radius.

## In scope

1. Pure functions (suggested `src/geodesy/cinematicFrame.ts` or next to `egm96.ts`):
   - `geodeticToEcefMeters(latDeg, lonDeg, altMsl)` → `{ x, y, z }` in metres (WGS84).
   - `ellipsoidUpEcef(latDeg, lonDeg)` unit vector (geodetic normal).
   - `ecefLookAt(eyeEcef, targetEcef)` → eye + orthonormal basis (forward toward target, up = ellipsoid up at **eye**, right = cross). Degenerate look (eye≈target) → documented fallback.
   - `enuKeyframeToScene(lat, lon, altMsl)` → existing `gpsToEnuAmsl` (wrapper only if it documents the cinematic contract).
2. **Tests:** known points (equator / Istanbul lat-lon) within a few metres of a published WGS84 ECEF; up roughly radial; look-at forward points at target; AMSL vs HAE uses `amslToHae` (Istanbul geoid ~+36 m must show up vs ellipsoid-only).
3. **Docs:** one paragraph in `src/geodesy/README.md` (or equivalent): globe = ECEF, ENU = race. SCN owns tiles.

## Out of scope

- `TilesRenderer`, ReorientationPlugin on/off
- Cloud overlay, fog, ocean
- Sequence JSON, player, MP4
- Changing race `GeoOrigin` defaults
- CesiumJS

## Likely files

- `src/geodesy/*` (+ tests)
- `src/geodesy/README.md` or `src/geodesy/index.ts` exports

## Inputs provided

- Keyframe fields: `lat, lon, altMsl, lookLat, lookLon, lookAltMsl`
- Existing `amslToHae` / `gpsToEnuAmsl`

## Acceptance criteria

- [x] ECEF + look-at + up are unit-tested; no Three.js required in the math module (plain numbers OK).
- [x] ENU path still `gpsToEnuAmsl` (no second geoid).
- [x] Geodesy cinematic tests green (full repo `npm test`/`tsc` red on unrelated WIP — accepted).
- [x] Report the export names SCN must call.

## Report back

1. Summary  
2. Files  
3. Tests  
4. Export names for SCN-01  
5. Memo bullets for GEO
