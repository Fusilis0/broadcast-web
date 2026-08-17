# Dispatch DSP-SCN-20260817-01-cesium-ion-terrain

## Meta
- From orchestrator: BW → SCN (lead) + GEO (alignment) + PLT (token in config)
- Worker role: WORKER(DSP-SCN-20260817-01-cesium-ion-terrain)
- Priority: P1
- Phase: Phase 14.1
- **Prerequisite:** `DSP-GEO-20260817-01` **accepted** 2026-08-17 — scene is `z = −North`.
  Work from a branch that includes that landing.
- Parallel-safe with: `DSP-SCN-20260817-02-gerstner-ocean`, `DSP-TEL-20260817-01-wind-bus`.
  Coexistence: you own `src/scene/terrain/`. Do not rewrite `src/scene/environment/`.
  `createScene.ts` / `main.ts` — add hooks only; rebase if the ocean worker touched the same region.
- Design: `docs/architecture/geospatial-terrain-cesium.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (`3d-tiles-renderer@0.5.1`; ion 1+2; `npm test` 512+23; `npm run build` green)

## Goal

Stream **Cesium ion World Terrain + draped aerial imagery** into the existing Three.js
scene via `3d-tiles-renderer` (not CesiumJS). Race origin sits at scene `(0,0,0)` using
`ReorientationPlugin` + `amslToHae` for height. Terrain is opaque-only (reuse
`setEnvironmentOpaqueClearSafe`). Our ocean (sibling 14.2) will draw on top of Cesium's
baked water — you provide the tileset in the depth buffer and a small documented Y
relationship; you do **not** build the ocean.

## Background

- Unity used Cesium World Terrain + aerial, static. We want the same data, live, in Three.
- **CesiumJS the engine is rejected** (own renderer/camera — fatal for NDI). Consume 3D Tiles
  via `3d-tiles-renderer@0.5.1` (Apache-2.0, `three >= 0.167`, we are on `^0.178.0`).
- User lock: ion, **not** Google Photorealistic (attribution burn-in). Attribution overlay
  on **3D channel + ops preview only, never the AR plate**.
- Token: **reuse the Unity project's Cesium ion account**. Asset IDs may arrive after you
  start — default to Cesium World Terrain **asset `1`**. Token from config / env, **never
  committed**.
- Altitude trap: ion / `ReorientationPlugin.height` is **HAE**. `config.origin.altMsl` is
  **AMSL**. Istanbul geoid N ≈ +36 m. Contract:
  `height = amslToHae(origin.lat, origin.lon, origin.altMsl)`.
- `ReorientationPlugin` docs: origin at `(0,0,0)` with **X west, Z north**. After 14.0 our
  frame is **X east, Z −north**. Expect a **180° azimuth** term — derive it, pin with a test,
  do not guess in production code without a comment.
- Residual vertical error is normal. Expose a per-project **terrain altitude nudge** (metres,
  operator-adjustable). Saving it on `RaceProject` is in scope if cheap; otherwise keep it
  runtime + session and note follow-up.
- Ocean-on-top: Cesium's baked sea is ~0 m. Ocean worker will put an animated surface at
  `y ≈ 0` + a small lift (0.1–0.5 m). Do not clip/mask the tileset. Land stays visible
  because it is above MSL.
- Hard AR constraint: same gate as realistic env. Terrain must **never** draw into
  transparent/chroma.

## In scope

1. Add npm dep `3d-tiles-renderer` (justify version in report; prefer current 0.5.x).
2. New module `src/scene/terrain/` — create / update / dispose a `TilesRenderer` group:
   - `CesiumIonAuthPlugin({ apiToken, assetId })`
   - `QuantizedMeshPlugin({ generateNormals: true })`
   - `ImageOverlayPlugin` + ion/Bing (or XYZ) aerial if you can do it without blocking
     first render of bare terrain. Bare World Terrain **is** an acceptable first slice;
     imagery overlay can be a documented follow-up **only if** auth/imagery is blocked
     on missing Bing asset id — say so in the report, do not stall the whole DSP.
   - `ReorientationPlugin` from current `GeoOrigin` (radians; HAE height via `amslToHae`)
   - `TilesFadePlugin`, `UnloadTilesPlugin` with an explicit VRAM budget
   - Re-run alignment on `GeoOrigin.onChanged`
3. Scene API (names may vary, document them):
   - `setTerrainEnabled(boolean)` / `getTerrainEnabled()` — default **off**
   - Nudge: `setTerrainAltitudeNudgeM(number)` / get
   - Reuse `setEnvironmentOpaqueClearSafe` — if opaque-unsafe, **unmount/hide** terrain
     (do not invent a second gate)
4. Register **both** preview camera and active POV camera with the tiles renderer
   (`setCamera` / `setResolution` as the library requires) so NDI LOD is not whatever
   the operator window last asked for.
5. **Lock-tiles** ops control (checkbox is enough): freeze LOD updates once the shot is
   framed (`UpdateOnChangePlugin` + a freeze flag, or equivalent).
6. Attribution: a small DOM overlay fed by `CesiumIonAuthPlugin` credits. Visible in ops
   and when local focus is **3D**. **Never** on the AR plate (do not burn into the WebGL
   framebuffer that NDI AR captures). If credits only exist as strings, a DOM line in the
   overlay host is correct.
7. Config: `cesiumIonToken` (and optional `cesiumIonAssetId`) on `AppConfig` /
   `public/config.json` / `.env.example` as `VITE_CESIUM_ION_TOKEN`. Empty token → terrain
   stays off with a clear ops message, no throw. **Do not commit a real token.**
8. Toggle in Ops (next to Environment) — “Terrain: off | on”.
9. Tests: gate (transparent → not drawn); origin at 0 after reorient (with a mocked or
   stubbed tileset if network-less CI cannot hit ion — do not skip the HAE height contract
   test); nudge moves the group in Y.
10. Docs: `src/scene/README.md`; short note in `docs/ops/air-runbook.md` (token + 3D-only
    attribution). Design doc status line → in progress / landed.

## Out of scope

- Google Photorealistic tiles / `GoogleCloudAuthPlugin`.
- Ocean / Gerstner / wind (sibling DSPs).
- CesiumJS. Second WebGL context. WebGPU.
- Offline tile cache (follow-up).
- Changing NDI resolution, FPS caps, or pumps (OUT).
- Pre-baked self-hosted tilesets.

## Likely files

- New: `src/scene/terrain/*` (+ test)
- Edit: `src/scene/createScene.ts`, `src/scene/index.ts`, `src/main.ts`,
  `src/scene/stubHud.ts` or Ops sidebar, `src/style.css` (attribution + toggle)
- Config: `src/config/types.ts`, `src/config/loadConfig.ts`, `.env.example`,
  `public/config.json` only if you add empty keys (no secrets)
- `package.json` / lockfile
- Docs listed above

## Inputs provided

- `docs/architecture/geospatial-terrain-cesium.md`
- `docs/architecture/enu-frame-handedness.md` (frame after 14.0)
- `amslToHae` in `src/geodesy/egm96.ts`
- Scene gate: `setEnvironmentOpaqueClearSafe` / `shouldShowRealisticEnvironment`
- Default ion terrain asset id: `1` (Cesium World Terrain)
- Token: operator will paste from Unity; until then empty = off

## Acceptance criteria

- [ ] Starts **after** 14.0 is on the branch you work from (do not re-implement the mirror)
- [ ] With a valid token, World Terrain appears at the race origin in `preview` / local 3D
- [ ] `transparent` / `chroma`: terrain not drawn (AR alpha clean)
- [ ] Default boot: terrain **off**
- [ ] Reorient height uses `amslToHae`, not raw `altMsl`
- [ ] Azimuth/frame relationship documented + tested
- [ ] Attribution is DOM, not on the AR framebuffer
- [ ] No ion token in git
- [ ] `npm test` + `npm run build` green (tileset network optional in CI)

## Report back
When done, reply with:
1. Summary of changes (include exact scene API names + ion asset ids used)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (imagery overlay? missing Bing id? VRAM numbers?)
5. Suggested memo bullets for SCN (+ GEO/PLT if you touched their files)
