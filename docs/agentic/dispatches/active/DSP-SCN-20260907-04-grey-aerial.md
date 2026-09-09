# Dispatch DSP-SCN-20260907-04-grey-aerial

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260907-04-grey-aerial)
- Priority: **P1**
- Phase: **20 look** — greyscale Bing drape so World Terrain matches OSM massing
- Related: `active/DSP-SCN-20260907-03-osm-buildings-visible.md` (**Human Pass 2026-09-07**). Terrain contract: `docs/architecture/geospatial-terrain-cesium.md`.
- **DSP-02 (heroes) stays queued** until this smoke (operator asked to try grey first).
- Worker result: **code done 2026-09-07**. Bing overlay **2** kept; Rec.709 luma in watermask `onBeforeCompile` (`uTerrainGrey`); Ops **aerial** `grey`|`color`; session `bw.terrain.imageryLook`; default **grey**; no remount. Terrain tests **35** + HUD layout **3**. SCN **code-accept**. **Human Fail 2026-09-07** — operator wanted cartographic/road map + heights, not a B&W satellite filter. Follow-up: `DSP-SCN-20260907-05-road-overlay`.
- Hold Gerstner rewrite. Keep Bing ion **2**. No CesiumJS. No Google Photorealistic. No IBB. No MapTiler engine. No NDI/`STUDIO_TICK_FPS`. No SRT.

## Goal

On local **3D**, with terrain **on**, the draped aerial should be able to read **white-grey** (luminance of Bing), so OSM boxes and hills share one look — not green/brown photo-satellite under white extrusion.

## Background

Operator smoke after 03: Historic Peninsula / Bosphorus shore, OSM **white boxes** on **full-color Bing Aerial**. Ask: try the same satellite as grey so it matches the city massing.

Architecture still wants **World Terrain + Bing Aerial** (ion **1** + **2**). Do **not** drop the overlay (`imageryAssetId = 0`) as the grey path — bare quantized-mesh loses streets and coast. **Desaturate the existing drape.**

Water-mask `onBeforeCompile` already chains after fade / Bing wrap (`src/scene/terrain/terrainWaterMask.ts`). Grey belongs in that same chain (uniform, live toggle). Do not remount the tileset when switching color ↔ grey.

## In scope

1. Keep `CesiumIonOverlay` asset **2**. Add a **live** grey/color look: Rec.709 luma of the draped RGB (optional slight lift so it is not muddy). Land stays; watermask discard still works.
2. Ops Environment, on the terrain row: select **`color` | `grey`** (`id="ops-terrain-aerial"` or equivalent). Session key `bw.terrain.imageryLook`. **Default `grey`** for this try (missing key → grey). Switching must not remount ion tiles.
3. Terrain handle: `setImageryLook` / `getImageryLook`. Wire from `stubHud` + `createScene` like lock-tiles / nudge. Status line may mention `grey` vs `color`.
4. AR / chroma / transparent: unchanged (terrain still gated off). Credits overlay still lists Bing — we still use the imagery.
5. Tests: default grey; toggle to color restores chromatic path in the shader/uniform; water-mask discard still injected; source still registers Bing overlay (not `imageryAssetId: 0` as grey). `npm test` for terrain (+ HUD layout if you add a control). Pre-existing `library.test.ts` / OUT `tsc` are **not** yours.
6. README one-liner: grey is desaturated Bing, not a new tileset.

## Out of scope

- Hero glTF (DSP-02)
- OSM Buildings materials / facade shaders
- Skipping Bing, swapping ion imagery assets, CesiumJS, Google Photorealistic
- Ocean / Gerstner / sea color
- NDI, SRT, `STUDIO_TICK_FPS`, lock-tiles persistence bugs

## Likely files

- `src/scene/terrain/terrainWaterMask.ts` (or a sibling `terrainImageryLook.ts` if the shader is cleaner split)
- `src/scene/terrain/createTerrain.ts`
- `src/scene/terrain/constants.ts`
- `src/scene/stubHud.ts` + `src/scene/createScene.ts`
- `src/scene/terrain/terrain.test.ts` (+ stubHud layout test if you add `#ops-terrain-aerial`)
- `src/scene/terrain/README.md` or `src/scene/README.md` one-liner

## Inputs provided

- Operator 3D still: color Bing hills + white OSM boxes + Gerstner. Grey should keep hill shape and street luminance, drop chroma.
- Do not guess a new geoid. Do not change `ReorientationPlugin` / nudge.

## Acceptance criteria

- [ ] Local **3D** + terrain on + **grey**: aerial is white-grey; OSM boxes still visible; coast/streets still readable as luma.
- [ ] Switch to **color**: Bing greens/browns return **without** reloading ion / unchecking terrain.
- [ ] Realistic ocean still hides Cesium water (watermask).
- [ ] Local **AR**: terrain still off.
- [ ] Bing overlay still registered. No new globe engine.

## Report back

1. Where the luma runs (uniform + which `onBeforeCompile` chain).
2. Default + session key.
3. Files, suite counts, anything that still remounts on toggle (must be none).
4. Suggested SCN memo bullets.

## Human smoke (after code-accept)

Hard-refresh. Local **3D** → Environment **realistic** → **terrain on** → **uncheck lock tiles** → **buildings** on. Aerial should boot **grey**. Toggle **color** / **grey** and compare to the previous color satellite shot.

**Good:** grey ground + white boxes, streets still there; color still one click away.  
**Fail:** brown mesh with no streets, or toggle remounts / bricks terrain.

## Worker paste

```
Role: WORKER(DSP-SCN-20260907-04-grey-aerial)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260907-04-grey-aerial.md
3. src/scene/terrain/createTerrain.ts
4. src/scene/terrain/terrainWaterMask.ts
5. src/scene/stubHud.ts (Environment terrain row)

Operator wants Bing aerial as white-grey to match OSM boxes. Keep ion overlay 2; desaturate; live color|grey toggle; default grey.

Implement that dispatch only. No heroes. No CesiumJS. No Google Photorealistic. No ocean rewrite. No NDI/SRT.
```
