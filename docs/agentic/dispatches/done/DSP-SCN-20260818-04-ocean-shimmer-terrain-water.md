# Dispatch DSP-SCN-20260818-04-ocean-shimmer-terrain-water

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260818-04-ocean-shimmer-terrain-water)
- Priority: P0
- Phase: Phase 16.1 — sea shimmer fix + hide Cesium water
- Design: `docs/architecture/phase16-visual-upgrade.md` §1–2
- Related: user 2026-08-18 — “white things on sea waves glitching when camera moves, stable when still” + screenshot where Cesium’s baked flat sea shows instead of our ocean beyond the clipmap/lift coverage
- Parallel-safe with: SCN-05 (wind strings — owns `realisticEnvironment.ts` + new module; you stay out of it), SCN-06/07/08 (different domains), SCN-09 later. **You own** `gerstnerOcean.ts`, `shoreFoam.ts`, `src/scene/terrain/*`.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (merged tree `npm test` 640+23, `npm run build` green). Water mask path shipped; Ops threshold row deferred into SCN-09.

## Goal

1. Kill the temporal aliasing (“boiling”) of whitecaps / streaks / glitter under camera motion.
2. Cesium terrain must render **land only** while the realistic ocean is mounted — no baked flat sea poking through anywhere; our Gerstner ocean is the only water.

## Background

- Whitecaps (Jacobian), gust streaks (14.3e), glitter are per-fragment **procedural value noise** — no mip chain, so camera motion sweeps sample points across high-frequency detail → boiling. Clipmap recenter (2 m quantized `uClipmapCenter` steps) adds vertex resampling pops on coarse rings.
- Ocean lift (`liftY` 0.45 m) was supposed to cover the tileset’s sea; terrain “sea” is sometimes higher → user screenshot shows terrain water. Lift-based covering is dead; remove the reliance on it (keep a small lift for z-fighting only).
- Cesium World Terrain quantized-mesh supports a **water mask** extension. We load via `3d-tiles-renderer` `QuantizedMeshPlugin` (`src/scene/terrain/createTerrain.ts`; plugins registered after ion auth — do not break that order, see `DSP-…-1e501eb` fix).

## In scope

1. **Shimmer**
   - Band-limit the noise: small tileable noise **texture** (~256², repeat, `LinearMipmapLinear`) replacing/augmenting the procedural taps for foam/streak/glitter masks, and/or `fwidth()`-scaled smoothstep edges.
   - Distance + grazing-angle fades so far/coarse rings carry almost no high-frequency shading (foam/glitter → 0 before the outer rings).
   - Verify every mask samples **world XZ** (not clipmap-local coords) so recentering never shifts patterns.
   - Keep: shared clock, `uClipmapCenter` follow, wind coupling, shore foam, seam overlap (15.2). No extra `readPixels`, at most the one new small noise texture.

2. **Terrain water removal**
   - Preferred: request/read the quantized-mesh **water mask** through the plugin and `discard` water fragments in tile materials (patch via material `onBeforeCompile` on tile meshes; keep the plugin registration order intact).
   - Fallback if the plugin can’t surface the mask with reasonable effort: **height discard** — drop terrain fragments with world Y below a uniform threshold AMSL (default ≈ +0.5 m), adjustable next to the existing terrain altitude nudge (Ops row or config). Document which path shipped and why.
   - Gate: active only while realistic ocean is mounted; `simple` env leaves terrain untouched.
   - Shore foam: discarded water fragments no longer write the depth prepass — confirm foam still detects land correctly (it should improve).

3. Tests: noise-texture/uniform wiring; discard gate on/off with env mode; threshold default. (No GPU screenshot assertions required.)
4. Docs: `docs/architecture/ocean-waves-and-sea-state.md`, `docs/architecture/geospatial-terrain-cesium.md` (water mask decision), `src/scene/README.md`.

## Out of scope

- Wind strings (SCN-05). Do not edit `realisticEnvironment.ts` beyond passing a uniform if unavoidable — prefer not at all.
- Boats, billboards, rounding, ops layout.
- FFT ocean; changing clipmap ring counts (15.2 already set them).
- `createScene.ts` frame clock.

## Likely files

- `src/scene/environment/gerstnerOcean.ts` (+ tests)
- `src/scene/environment/shoreFoam.ts`
- `src/scene/terrain/createTerrain.ts` (+ terrain tests), possibly a new `terrainWaterMask.ts`
- Docs above

## Inputs provided

- User report: sparkle stable when still, boils under motion.
- Screenshot: Bing-drape flat sea visible over large areas; our ocean only near field.
- Ion auth/plugin order constraint (`assetTypeHandler` fix, commit `1e501eb`).

## Acceptance criteria

- [ ] Orbiting/panning the free cam over realistic sea: no boiling/flicker of whitecaps or streaks (calm shading changes only).
- [ ] With terrain + realistic ocean on: no Cesium baked water visible anywhere in a wide orbit; land edges intact.
- [ ] `simple` env unchanged; AR plate unaffected.
- [ ] No new `readPixels`; `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (AA technique chosen; water mask vs height discard and why)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
