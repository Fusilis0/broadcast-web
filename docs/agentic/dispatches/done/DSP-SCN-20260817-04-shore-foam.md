# Dispatch DSP-SCN-20260817-04-shore-foam

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260817-04-shore-foam)
- Priority: P1
- Phase: Phase 14.2c
- Prerequisite: 14.1 terrain + 14.2a/b ocean **accepted**
- Parallel-safe with: `DSP-SCN-20260817-05-map-wind-readout` (that worker owns 2D map chrome;
  you own Gerstner + optional terrain depth). Do not rewrite `map2d.ts` / `mapChrome.ts`.
- Design: `docs/architecture/geospatial-terrain-cesium.md` §4 ·
  `docs/architecture/ocean-waves-and-sea-state.md` (14.2c)
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (half-res terrain depth FBO; no readPixels; suite 546+23)

## Goal

Where the Gerstner ocean meets Cesium land, show **shore foam and a shallow-water tint** so
the coastline reads as a beach, not a plane through a hill. Ocean stays **on top of**
Cesium’s baked sea (no clipping the tileset). When terrain is off, skip the extra work.

## Background

- Ocean lift is **0.25 m** above `COURSE_WATER_Y = 0`. Tileset is unclipped; baked sea ~0 m.
- Intended trick: terrain already in the depth buffer → compare ocean fragment depth to
  terrain depth → foam where they meet, tint where water is shallow.
- Extra **GPU readback is forbidden** (`readPixels` / `getImageData`). One extra **FBO
  render** of terrain (or scene-without-ocean) into a depth target is allowed, and only
  when realistic ocean **and** terrain are both mounted. If that blows the 3D-NDI ~10 fps
  budget, ship a cheaper fallback and say so — do not stall the DSP on a perfect prepass.
- `waterCue` is already hidden while realistic ocean is mounted. Do not bring the pad back.
- AR / `opaqueClearSafe`: no extra pass and no foam when the env is unmounted.

## In scope

1. Shore foam + shallow tint in the Gerstner fragment path, driven by proximity to terrain
   (depth compare **or** a documented cheaper proxy if the prepass is too expensive).
2. Gate: only when terrain is enabled and realistic ocean is mounted.
3. No tileset clipping / `polygonOffset` as the shoreline solution.
4. Tests: foam path off when terrain disabled; dispose of any RT; no `readPixels` in the
   new code.
5. Docs: `src/scene/README.md` + design 14.2c status. Note the extra pass cost.

## Out of scope

- Wind streaks, wakes, FFT, spray (14.3e / 14.2d/e).
- 2D map wind arrow (sibling 14.3d).
- Changing ion assets, reorient azimuth, or NDI pumps.
- Reintroducing `waterCue` as a branded rectangle.

## Likely files

- `src/scene/environment/gerstnerOcean.ts` (+ test)
- `src/scene/environment/realisticEnvironment.ts` / `createScene.ts` (wire depth or skip)
- Possibly a small helper under `src/scene/terrain/` **only** if you need a terrain-only
  render list — do not re-architect `createTerrain.ts`
- Docs listed above

## Inputs provided

- Terrain group already in the scene when enabled; ocean mesh `renderOrder` exists
- `setEnvironmentOpaqueClearSafe` / `shouldShowRealisticEnvironment`
- NDI stagger: do not add synchronous readback

## Acceptance criteria

- [ ] With terrain + realistic on: visible foam/tint near the land/water join (or a
      documented fallback if prepass is too heavy — still must not z-fight a hard line)
- [ ] Terrain off: no extra FBO, ocean looks as 14.2b
- [ ] Transparent/chroma: no extra pass
- [ ] No new `readPixels`
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary (depth prepass vs fallback, extra draw cost)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
