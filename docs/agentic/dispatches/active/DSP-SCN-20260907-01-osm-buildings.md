# Dispatch DSP-SCN-20260907-01-osm-buildings

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260907-01-osm-buildings)
- Priority: **P0**
- Phase: **20.1a + 20.1c** — Cesium OSM Buildings tileset + ops on/off + 3D credits
- Related: `docs/agentic/handoffs/HO-BW-SCN-20260907-01.md`. Design: `docs/architecture/3d-environment-buildings.md`. Terrain contract (reuse, do not rewrite): `docs/architecture/geospatial-terrain-cesium.md`. Memo: `docs/agentic/memos/SCN_MEMO.md`.
- Sibling `DSP-SCN-20260907-02-hero-gltf` is **blocked** until this DSP has Human Pass. You may expose an empty occupancy API; do **not** load hero glTF here.
- Hold Gerstner/ocean rewrite. No CesiumJS. No Google Photorealistic. No IBB. No MapTiler/Mapbox GL. No NDI pump rewrite. No `STUDIO_TICK_FPS`. No SRT. No commercial video.
- Worker result: **code done 2026-09-07** — second `TilesRenderer` ion **96188**; no quantized-mesh / Bing; occupancy `setOccupancyHoles`; buildings checkbox default ON. Buildings tests **14/14**. SCN **code-accept**.
- **Human Fail 2026-09-07** — local 3D, buildings checked: terrain + aerial only, **no extruded volumes**. Follow-up `DSP-SCN-20260907-03-osm-buildings-visible`.

## Goal

Mount **Cesium OSM Buildings** (ion asset **96188**) as a **second** `TilesRenderer` in the existing Three.js scene, using the same ion token and `ReorientationPlugin` origin (`amslToHae`) as World Terrain. Buildings are city **massing** (extruded OSM boxes), opaque/3D only. Ops gets a buildings on/off control. Credits stay a DOM overlay, never the AR plate.

## Background

World Terrain (`src/scene/terrain/createTerrain.ts`) is ion asset **1** + Bing **2**, quantized-mesh, water discard, default **off**. OSM Buildings is a **different product and format**: batched **3D Tiles** of building meshes, not terrain. Copy the **auth / reorient / fade / unload / lock / camera-register / opaque gate** pattern. Do **not** copy `QuantizedMeshPlugin`, Bing `ImageOverlayPlugin`, or the watermask `onBeforeCompile` path.

`ReorientationPlugin` still wants HAE height and the 180° azimuth (`REORIENTATION_AZIMUTH_RAD` / `src/scene/terrain/reorient.ts`). `GeoOrigin.onChanged` must re-align this tileset too.

Opaque gate: reuse `shouldShowTerrain` from `src/scene/terrain/terrainGate.ts` (or an identical helper). One switch: `setEnvironmentOpaqueClearSafe`. Buildings must **never** draw into transparent/chroma AR.

## In scope

1. **New module** `src/scene/buildings/` (sibling of `terrain/`, do not dump this into `createTerrain.ts`):
   - Constant `CESIUM_ION_OSM_BUILDINGS_ASSET_ID = 96188`.
   - `createBuildings({ renderer, token, tilesFactory?, skipIonPlugins? })` → handle with `root`, `setEnabled` / `getEnabled`, `setOpaqueClearSafe`, `setAltitudeNudgeM` (same metres as terrain), `setTilesLocked` / `getTilesLocked`, `getCredits`, `getStatusMessage`, `tick(preview, air, renderer)`, `dispose`.
   - Plugins: `CesiumIonAuthPlugin` with asset **96188**; `TilesFadePlugin`; `UnloadTilesPlugin` with its **own** `bytesTarget` (default **256 MiB**, named constant); `UpdateOnChangePlugin`; `ReorientationPlugin` from current `GeoOrigin` via existing `reorientationFromOriginAmsl` / `GeoOrigin.altitudeHAE` — same contract as terrain.
   - **Do not** register `QuantizedMeshPlugin` or imagery overlay on this renderer. If `assetTypeHandler` runs, accept 3D Tiles (`3DTILES` / equivalent); **warn** if ion reports `TERRAIN`.
   - Empty token → buildings stay off, status string, **no throw** (mirror terrain).
   - 401 / root load-error → status extra, `console.warn`, no throw.
2. **Occupancy stub** for 02: `setOccupancyHoles(holes: readonly { x: number; z: number; radiusM: number }[])` in scene ENU (x=East, z=−North). Default `[]` = no clip. Implement a real clip (fragment discard and/or hide tile meshes whose XZ falls inside a disk). Unit-test with a mock mesh / stub tileset — do not require ion. Do not clip World Terrain. Do not clip the ocean.
3. **Scene wiring** (`createScene.ts` hooks only):
   - Same ion token as terrain (`terrainToken`). No second token field.
   - `ensureBuildings` / `syncBuildings` parallel to terrain. Tick buildings next to `terrain.tick` (preview + air cameras). Respect **shared** `terrainTilesLocked`.
   - Apply the **same** `terrainNudgeM` to the buildings group Y.
   - API: `setBuildingsEnabled` / `getBuildingsEnabled`. Default **ON** (sessionStorage `bw.buildings.enabled`; missing → on). Still hidden when token empty or opaque-unsafe.
   - Merge buildings credits into the existing credits listener / `getTerrainCredits` (or a documented merge). `main.ts` overlay: show when local focus is **3D** and (terrain **or** buildings) is on and lines exist. **Never** draw credits into the WebGL framebuffer / AR plate.
4. **Ops (20.1c):** Environment row — **buildings** checkbox, default checked. Independent of the terrain off/on select. Tooltip: OSM Buildings, 3D/opaque only, needs ion token. Wire to `setBuildingsEnabled`. Status line may mention buildings (keep it short).
5. **Tests:** opaque-unsafe → `root.visible === false`; enabled+opaque+token stub → visible; occupancy hole hides/discards a point inside the disk and leaves a point outside; asset id 96188; no `STUDIO_TICK_FPS` / NDI changes. `npm test` + `npm run build`.
6. **Docs:** one-liners in `src/scene/README.md` (and `src/scene/buildings/README.md` if you add a folder readme). Do not rewrite the buildings architecture doc except a status line if you already touch it.

## Out of scope

- Hero glTF / landmark catalogue (DSP-02)
- CesiumJS, Google Photorealistic, IBB, MapTiler/Mapbox GL, DIY city mesh
- Rewriting Gerstner, shore foam, terrain watermask, `createTerrain.ts` internals
- New ion token UI (reuse Ops **ion token** + Apply)
- Second lock-tiles checkbox
- Facade/window shaders
- NDI pumps, SRT, commercial video, library re-seed, `STUDIO_TICK_FPS`

## Likely files

- New: `src/scene/buildings/*` (+ tests)
- Edit: `src/scene/createScene.ts` (mount / tick / credits merge / nudge / lock)
- Edit: `src/scene/stubHud.ts` (buildings checkbox)
- Edit: `src/main.ts` (`syncTerrainAttribution` show condition)
- Edit: `src/scene/README.md`; optional `src/scene/index.ts` re-export
- Reuse only: `src/scene/terrain/reorient.ts`, `terrainGate.ts`, `ionToken.ts`, `attribution.ts` (`creditsToLines`)
- CSS: existing `.terrain-attribution` is enough unless the overlay is unreadable

## Inputs provided

- Ion asset **96188** = Cesium OSM Buildings.
- Token already in `public/config.json` `cesiumIonToken` / Ops Apply (`SceneHandle.setCesiumIonToken` remounts terrain today — remount **buildings** on token Apply too).
- Opaque gate already used by terrain + realistic env.
- Lock-tiles session key `bw.terrain.tilesLocked` — share it; do not invent `bw.buildings.tilesLocked`.

## Acceptance criteria

- [ ] Environment **realistic** + local **3D** + ion token + buildings checked: Bosphorus / Historic Peninsula shows **building massing** (boxes), not photo-draped flat roofs only.
- [ ] Local **AR** (transparent/chroma): **no** OSM buildings (and still no terrain).
- [ ] Buildings checkbox off: massing gone; terrain can stay on.
- [ ] **lock tiles** freezes buildings LOD as well as terrain.
- [ ] Token Apply remounts buildings with the new token; empty token → off, no throw.
- [ ] Credits DOM on 3D includes OSM/ion when the tileset reports them (fallback line **© OpenStreetMap contributors** if ion omits OSM). Never on the AR plate.
- [ ] `setOccupancyHoles` is callable with `[]` and with a disk; tests cover inside vs outside. No heroes required.
- [ ] `npm test` + `npm run build` green.

## Report back

When done, reply with:

1. How the second `TilesRenderer` is created (plugins list — confirm **no** quantized-mesh / Bing on buildings).
2. Default ON behaviour + session key + opaque gate.
3. Occupancy API shape (even if holes stay empty in the app).
4. Files touched; suite counts; `npm run build`.
5. Suggested SCN memo bullets.
6. Blockers (401 ion, hitch, buried boxes on low terrain LOD).

Do **not** start DSP-02 in the same chat.

## Human smoke (after code-accept)

Load `30agustos` or `demo-istanbul` → Environment **realistic** → **terrain on** (optional but useful) → **buildings** checked → local **3D**. Orbit the European shore / Historic Peninsula. Expect grey/tan **boxes** for the city. Switch local **AR**: buildings gone. Uncheck buildings: boxes gone, sea/terrain remain. Check **lock tiles**, orbit: LOD should stop refining.

**Good:** city massing, AR clean, ops still usable.  
**Fail:** still a draped photo with no volumes; AR plate shows buildings; white/context-lost; 401 with no status.

## Worker paste

```
Role: WORKER(DSP-SCN-20260907-01-osm-buildings)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260907-01-osm-buildings.md
3. docs/architecture/3d-environment-buildings.md
4. docs/architecture/geospatial-terrain-cesium.md
5. src/scene/terrain/createTerrain.ts (pattern only — do not rewrite)
6. src/scene/terrain/reorient.ts
7. src/scene/terrain/terrainGate.ts

Implement that dispatch only. No hero glTF. No CesiumJS. No Google Photorealistic. No IBB. No MapTiler engine. No ocean rewrite. No NDI/SRT. Report back in the dispatch format.
```
