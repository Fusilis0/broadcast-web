# Dispatch DSP-SCN-20260818-01-ocean-seams-cost-wind

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260818-01-ocean-seams-cost-wind)
- Priority: P0
- Phase: Phase 15.2 — ocean look + cost + readable wind
- Related: user 2026-08-18 screenshot — white hairlines on the sea, huge specular bloom, no visible wind VFX, low FPS
- Parallel-safe with: `DSP-OUT-20260818-01` (clock). **Do not edit** `createScene.ts` frame-clock / `tick` wiring. Stay in `gerstnerOcean.ts`, shore foam, wind coupling, a small 3D vane module, tests, READMEs.
- Parallel-safe with: SCN-02 (buoys) and SCN-03 (fleet) if you do not touch `createScene.ts`.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (`npm test` 600+23; `npm run build` green). Human look-dev still recommended.

## Goal

Remove the white **clipmap seam lines**, tone down the blown specular, make **wind direction readable in 3D**, and drop ocean GPU cost enough that 60 fps preview is plausible after OUT-01.

## Background

- Clipmap: `createClipmapGeometry` in `src/scene/environment/gerstnerOcean.ts` builds an inner grid plus four independent `addGrid` patches per ring. Rings **do not share vertices** with the inner patch or each other → T-junctions / cracks, visible as thin white lines (especially grazing, near marks).
- Glitter: `GERSTNER_OCEAN_DEFAULTS.glitterSharpness = 220`, `glitterIntensity = 0.55` plus a second glint term. User screenshot: large washed-out white field. BW lock: **cut this**; it is not “needed” and is a plausible FPS + look problem.
- Wind streaks (14.3e) already exist as a fragment gust mask, faded at calm `speedMs`. They are too subtle on grey water (operator reported **no** wind visuals). Map pills (14.3d) do not count as 3D. Ship **stronger streaks + a cheap 3D vane** (14.3f lite). No particles, flags, or spray.
- Clipmap was authored for ~30 preview / 10 fps NDI (inner 48×48, 7 rings, shore-foam half-res FBO). Budget for 60 fps preview: fewer rings and/or a quality preset.

## In scope

1. **Seams**
   - Eliminate T-junction cracks: overlapping 1-cell skirts, shared edge verts, or stitch strips so inner/ring boundaries share positions after Gerstner displacement.
   - Keep clipmap follow as `uClipmapCenter` (quantized). Do not revert to `mesh.position.xz` fighting dual cameras.
   - Test: geometry helper asserts adjacent rings share boundary samples (or overlap ≥ one cell). Human: no white hairlines at grazing angle across marks.

2. **Specular**
   - Drop default glitter to a mild sun sparkle (order of `glitterIntensity ≈ 0.12–0.20`, `glitterSharpness ≈ 60–90`). Must not bleach a quadrant of the frame.
   - If glitter is a measurable fragment cost, a single Blinn term is enough.

3. **Cost**
   - Default rings **7 → 5** (outer still past fog) **or** inner segments 48 → 32 — pick one, measure in comments/README.
   - Optional `seaQuality: 'high' | 'low'` (Ops environment row or `?sea=low`): low skips or quarter-res shore-foam prepass and/or drops two rings. Default `high` unless FPS still dies after OUT-01; then default `low` when realistic + terrain on, with one-click High.
   - No FFT, no extra FBO beyond the existing shore-depth target.

4. **Wind readable in 3D**
   - Crank streak contrast / anisotropy so travel direction is obvious at typical Bosphorus speeds (~5–12 m/s). Still fade at ~0 m/s.
   - Add a **cheap 3D wind vane** (shaft + two-sided arrow, tens of tris) at the geo origin (or a fixed offset so it does not sit under a mark). Driven by `windBus` / existing `windTravelSceneXZ`. Yaw follows travel; length scales with kt with a **minimum length** so a set from-deg is never invisible.
   - Do not add GPU particles or cloth flags.

5. Docs: `src/scene/README.md`, `docs/architecture/ocean-waves-and-sea-state.md`, `docs/architecture/wind-data-and-vfx.md` (14.3f lite landed).

## Out of scope

- Preview/NDI frame clock (`DSP-OUT-20260818-01`).
- Fleet boats, Save/Load, buoy rounding arrows.
- Changing ion terrain.
- Unity CW/RCW PNG dump.

## Likely files

- `src/scene/environment/gerstnerOcean.ts` (+ tests)
- `src/scene/environment/shoreFoam.ts` (only if quality preset skips/resizes)
- `src/scene/environment/realisticEnvironment.ts` (mount vane; quality)
- New small `src/scene/environment/windVane.ts` (or similar)
- Scene README + architecture docs above

## Inputs provided

- User screenshot: horizontal white seams, blown highlight left of frame, no streaks/vane.
- Clipmap comment in `gerstnerOcean.ts` (inner ±48 m, 7 rings, 24 segs).
- `windTravelSceneXZ`, `setWindSpeed`, `uDirectionRad` (from-000° → +Z).

## Acceptance criteria

- [ ] No white hairline seams at clipmap ring joins (grazing + near-field).
- [ ] Specular no longer washes out a large region of the sea.
- [ ] Wind travel is obvious in 3D (streaks and/or vane) when from-deg / API wind is non-zero.
- [ ] Default ocean is cheaper than 7-ring + heavy glitter; quality preset documented.
- [ ] No extra `readPixels`; `npm test` + `npm run build` green.

## Report back

When done, reply with:
1. Summary (seam fix, new glitter numbers, ring count, vane)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
