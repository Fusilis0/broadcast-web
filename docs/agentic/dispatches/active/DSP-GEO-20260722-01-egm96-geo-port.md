# Dispatch DSP-GEO-20260722-01-egm96-geo-port

## Meta
- From orchestrator: GEO
- Worker role: WORKER(DSP-GEO-20260722-01-egm96-geo-port)
- Priority: P0
- Phase: Phase 0.6 + Phase 1.1 / 1.2 (EGM96 copy + GeoOrigin/GeoUtils/EGM96 port + tests)
- Related handoffs: none
- Status: **active / awaiting worker**

## Goal

Copy Unity’s EGM96 grid into `public/`, port `EGM96Geoid` + `GeoOrigin` + `GeoUtils` into `src/geodesy/` with Unity-compatible ENU math, and add unit tests for known points. Library + tests only — no scene graph, no WebSocket, no canvas wiring.

## Background

- Architecture: `docs/architecture/system-architecture.md` §5.2 (axes, HAE/AMSL/relative, EGM96)
- Charter: `docs/agentic/orchestrators/GEO_Geodesy_World_Frame_Orchestrator.md`
- Axis contract (locked): Three.js `x = East`, `y = Up`, `z = North`
- Boat altitude: **HAE provisional**
- Unity reference (read-only — do not modify):
  - `C:\Users\PC\Documents\GitHub\broadcast\Assets\Scripts\EGM96Geoid.cs`
  - `C:\Users\PC\Documents\GitHub\broadcast\Assets\Scripts\GeoOrigin.cs`
  - `C:\Users\PC\Documents\GitHub\broadcast\Assets\Scripts\GeoUtils.cs`
  - Source bin: `C:\Users\PC\Documents\GitHub\broadcast\Assets\StreamingAssets\EGM96_1deg.bin` (~130 326 bytes; confirmed present)
- Scaffold is green: `src/geodesy/` stub exists; `public/config.json` has `origin: { lat, lon, altMsl }` placeholders
- Web has **no** Cesium / `GlobalWorldAnchor` — origin is set explicitly (`setOriginHAE` / `setOriginAMSL`), not via Unity scene lookup

## In scope

1. **Copy EGM96 binary**
   - Copy `../broadcast/Assets/StreamingAssets/EGM96_1deg.bin` → `public/EGM96_1deg.bin`
   - File must be served as a static asset (Vite `public/`)
   - Do not invent or regenerate the grid; binary copy only
   - If source path is missing on the worker machine: **stop and report** (do not substitute a fake grid)

2. **Port `EGM96Geoid` → TypeScript** (`src/geodesy/`)
   - Same grid params as Unity: 181×360, 6-byte big-endian UInt16 header, Int16 cm values / 100 → meters, bilinear undulation
   - Browser load via `fetch('/EGM96_1deg.bin')` (or equivalent URL relative to app root) — async `load()` / `ensureLoaded()`
   - API parity: `getUndulation(lat, lon)`, `amslToHae(...)`, `relativeToHae(...)`
   - If load fails: undulation `0` (match Unity fallback behavior)

3. **Port `GeoOrigin` → TypeScript**
   - Cache lat/lon/HAE, ECEF, ECEF→ENU matrix (`m00`…`m22`) with Unity WGS84 constants (`A`, `E_SQ`) and same `RebuildCache` formulas
   - `setOriginHAE`, `setOriginAMSL` (AMSL path uses EGM96), `isValid`, change callback/event optional but useful
   - **Do not** port Cesium / `GlobalWorldAnchor` / `FindFirstObjectByType` — callers must set origin explicitly
   - Optional thin helper to apply `public/config.json` `origin` (`altMsl` → AMSL) for tests/demo — keep out of `main.ts` scene loop

4. **Port `GeoUtils` → TypeScript**
   - `gpsToEnu` / `gpsToEnuAmsl` / `gpsToEnuRelative` (+ optional batch) matching Unity math
   - Return type: `THREE.Vector3` with `(east, up, north)` **or** a small `{ x, y, z }` typed as ENU — document axis mapping in module README
   - Require valid origin; if unset, return zero / throw clearly (prefer documented zero + warn like Unity, or throw — pick one and test it)

5. **Unit tests**
   - Add a minimal test runner if missing (prefer **Vitest**; add `test` script + devDependency — allowed for this DSP)
   - Cover at least:
     - Origin set + ECEF/ENU sanity (point at origin ≈ `(0,0,0)`; small east/north offsets have correct sign)
     - EGM96: after load, Istanbul-area undulation at `(41.0, 29.0)` is finite and non-zero (Unity logs this as a smoke check)
     - AMSL ↔ HAE bridge uses undulation consistently
     - Relative altitude path: `takeoffAMSL + relativeAlt + N`
   - Tests must not require WebGL, Three scene, or network beyond loading local `public/EGM96_1deg.bin` (Vitest may need `fs`/path read of the bin for Node — acceptable; document how)

6. **Docs touch**
   - Replace `src/geodesy/README.md` stub with a short owner note: public API list + axis contract + how to run tests

## Out of scope

- Any `src/scene/`, `src/telemetry/`, WebSocket, mock/replay/live
- Wiring geodesy into `main.ts` / canvas / HUD
- Calibration offsets (CAL), declination service
- Changing Unity project files
- Real race origin coordinates (keep config placeholders unless needed for a single test fixture; do not claim Cesium match yet)
- Git LFS setup, GitHub remote, deploy
- SCN boats/course meshes

## Likely files

- `public/EGM96_1deg.bin` (new, copied)
- `src/geodesy/egm96.ts` (or equivalent names)
- `src/geodesy/geoOrigin.ts`
- `src/geodesy/geoUtils.ts`
- `src/geodesy/index.ts` (barrel export optional)
- `src/geodesy/README.md`
- `src/geodesy/*.test.ts` (or `src/geodesy/__tests__/`)
- `package.json` / `vitest.config.*` / `tsconfig` only as needed for Vitest
- Do **not** edit `docs/agentic/**` except if GEO later updates memo from report-back (worker: suggest bullets only)

## Inputs provided

- Workspace: `C:\Users\PC\Documents\GitHub\broadcast-web`
- Unity bin (absolute): `C:\Users\PC\Documents\GitHub\broadcast\Assets\StreamingAssets\EGM96_1deg.bin`
- Unity scripts listed under Background
- `public/config.json` origin shape already present

## Acceptance criteria

- [ ] `public/EGM96_1deg.bin` exists and matches Unity source (same size / byte-identical)
- [ ] `src/geodesy/` exports working EGM96 + GeoOrigin + GeoUtils ports
- [ ] Axis mapping documented and enforced: `x=East`, `y=Up`, `z=North`
- [ ] No Cesium/scene-lookup code; origin set explicitly
- [ ] `npm test` (or documented equivalent) passes with the undulation + ENU cases above
- [ ] `npm run build` still succeeds
- [ ] No scene/WS/telemetry/canvas feature wiring
- [ ] Unity repo untouched
- [ ] No secrets committed

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (include Istanbul N ≈ value observed)
4. Follow-ups / blockers
5. Suggested memo bullets for GEO

## Paste block (new worker chat)

```
You are WORKER(DSP-GEO-20260722-01-egm96-geo-port).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-GEO-20260722-01-egm96-geo-port.md (full)
2. docs/agentic/DISPATCH_PROTOCOL.md (worker rules)
3. docs/architecture/system-architecture.md §5.2
4. Unity read-only: ../broadcast/Assets/Scripts/{EGM96Geoid,GeoOrigin,GeoUtils}.cs
   and copy from ../broadcast/Assets/StreamingAssets/EGM96_1deg.bin → public/

Implement in scope only. No scene, no WS, no Unity edits.
When finished, report using the dispatch Report back section.
```
