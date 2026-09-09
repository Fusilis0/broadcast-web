# Dispatch DSP-SCN-20260907-05-road-overlay

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260907-05-road-overlay)
- Priority: **P0**
- Phase: **20 look** — cartographic map + heights (not a B&W satellite filter)
- Related: `active/DSP-SCN-20260907-04-grey-aerial.md` (**Human Fail 2026-09-07** — wrong look). Terrain: `src/scene/terrain/createTerrain.ts`. Contract: `docs/architecture/geospatial-terrain-cesium.md`.
- **DSP-02 (heroes) stays queued** until this Pass.
- Worker result: **code done 2026-09-07**. Default overlay Bing Road **4** on World Terrain **1**; Aerial **2** is Ops **map aerial**. Overlay switch remounts terrain only. Rec.709 grey removed. Session `bw.terrain.overlay` default **road**. ion **4** fail → warn + aerial **2**. Terrain tests **36** + HUD **3**. SCN **code-accept**. **Human Pass 2026-09-07** — operator keeps **both** road and aerial for now; decide default later. Heroes (`DSP-02`) unblocked.
- World Terrain ion **1** stays. Overlay default becomes **Bing Maps Road ion 4**. Aerial **2** remains as an ops compare. No CesiumJS. No Google Photorealistic. No Google 2D Map Tiles. No IBB. No MapTiler engine. No NDI/`STUDIO_TICK_FPS`. No SRT.

## Goal

Local **3D** terrain must look like a **street map on hills** (Cesium “World Terrain + Bing Maps Road”), not satellite photo and not a greyscale filter of satellite. Heights stay. Streets/labels/land-use colors come from the **road** imagery tileset.

## Background

Operator after 04: “I didn’t mean add a black-and-white filter. I mean use Cesium map that is not satellite — default map view like Google Maps + heights.”

04 desaturated Bing Aerial **2** (`uTerrainGrey` Rec.709). That is the wrong product. Cesium’s matching preset is **World Terrain (1) + Bing Maps Road (4)** — cartographic/road tiles draped on quantized-mesh. Same `ImageOverlayPlugin` + `CesiumIonOverlay` path; **different overlay asset id**.

Do **not** use Google Photorealistic or Google 2D Map Tiles (logo / terms). “Like Google Maps” is the *look* of a road map, not a Google tileset.

## In scope

1. **Default overlay = ion 4** (`CESIUM_ION_BING_ROAD_ASSET_ID`). Keep World Terrain **1**. Keep Aerial **2** as the other option. Grey Rec.709 is **not** the look — **remove** `uTerrainGrey` / `terrainImageryLook` grey|color as the operator control (delete the luma GLSL; watermask discard stays).
2. Ops Environment: replace **aerial** `grey`|`color` with **map** `road`|`aerial` (`id="ops-terrain-overlay"` or equivalent). Session **new** key `bw.terrain.overlay` (`road` | `aerial`). Default **`road`**. Ignore leftover `bw.terrain.imageryLook`.
3. Switching overlay **may remount the terrain handle** (same as token Apply: `dispose` + `ensureTerrain` with the new `imageryAssetId`). Do **not** remount OSM Buildings. Do **not** drop watermask / nudge / lock-tiles / opaque gate.
4. If ion **4** 401s or is not `IMAGERY`, status + `console.warn`, fall back to aerial **2** for that session — do not throw. Still no CesiumJS.
5. Credits overlay still DOM on 3D; Bing/ion lines as the overlay returns them.
6. Tests: default overlay 4; aerial still 2; no Rec.709 grey as default look; watermask still injected; buildings still have no Bing overlay. HUD layout: `#ops-terrain-overlay` present, `#ops-terrain-aerial` gone (or unused). `npm test` for terrain + HUD layout. Pre-existing `library.test.ts` / OUT `tsc` are **not** yours.
7. README: road = Bing Maps Road ion **4** on World Terrain **1**; aerial = Bing Aerial **2**; grey filter removed.

## Out of scope

- Hero glTF (DSP-02)
- OSM Buildings materials
- Google Photorealistic, Google 2D, CesiumJS, MapTiler, IBB
- Ocean / Gerstner
- NDI, SRT, `STUDIO_TICK_FPS`

## Likely files

- `src/scene/terrain/constants.ts` (road asset **4**; drop grey default)
- `src/scene/terrain/createTerrain.ts`
- `src/scene/terrain/terrainImageryLook.ts` / `terrainWaterMask.ts` (remove luma; keep water discard)
- `src/scene/createScene.ts` / `src/scene/stubHud.ts`
- Tests + `src/scene/README.md` one-liner

## Inputs provided

- Today: `imageryAssetId` default **2** (`CESIUM_ION_BING_AERIAL_ASSET_ID`). `createTerrain` already takes `imageryAssetId`. `ensureTerrain()` in `createScene.ts` is the remount seam.
- Cesium Unity preset name: “Cesium World Terrain + Bing Maps Road” = overlay asset **4**.

## Acceptance criteria

- [ ] Local **3D** + terrain on + **map road**: cartographic/street map on hills (pastel land, roads, labels) — **not** satellite, **not** B&W photo.
- [ ] OSM boxes still visible. Gerstner still hides Cesium water.
- [ ] **map aerial**: Bing satellite returns (compare). Buildings stay mounted.
- [ ] Local **AR**: terrain still off.
- [ ] No Google tilesets. No Rec.709 grey control.

## Report back

1. Overlay asset ids after the change; remount vs live swap.
2. Grey shader removed? Session key?
3. Files, suite counts, ion **4** load evidence if you hit the network.
4. Suggested SCN memo bullets.

## Human smoke (after code-accept)

Hard-refresh. Local **3D** → Environment **realistic** → **terrain on** → uncheck **lock tiles** → **buildings** on. **map** should boot **road**. Expect Google-Maps-like streets on 3D hills, white OSM boxes on top. Toggle **aerial** to confirm satellite is still there.

**Good:** road map + heights + boxes.  
**Fail:** still satellite, or still B&W filter, or brown mesh with no streets.

## Worker paste

```
Role: WORKER(DSP-SCN-20260907-05-road-overlay)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260907-05-road-overlay.md
3. src/scene/terrain/createTerrain.ts
4. src/scene/createScene.ts (ensureTerrain / imageryAssetId)
5. src/scene/stubHud.ts (Environment terrain row)

Human Fail on 04: operator did not want Rec.709 B&W satellite. They want Cesium World Terrain + Bing Maps Road (ion 4) — street map + heights. Keep aerial 2 as a compare. Remove the grey filter.

Implement that dispatch only. No heroes. No CesiumJS. No Google Photorealistic. No Google 2D. No ocean rewrite. No NDI/SRT.
```
