# Dispatch DSP-SCN-20260817-02-gerstner-ocean

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260817-02-gerstner-ocean)
- Priority: P1
- Phase: Phase 14.2a (Gerstner surface; wind coupling is 14.2b, not this DSP)
- **Prerequisite:** `DSP-GEO-20260817-01` **accepted** 2026-08-17 — scene is `z = −North`
  (default swell toward −Z = geographic north).
- Parallel-safe with: `DSP-SCN-20260817-01-cesium-ion-terrain`, `DSP-TEL-20260817-01-wind-bus`.
  You own `src/scene/environment/` ocean replacement. Do not create `src/scene/terrain/`.
  `createScene.ts` / `main.ts` — add hooks only; rebase if the terrain worker touched the same region.
- Design: `docs/architecture/ocean-waves-and-sea-state.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (Gerstner clipmap; shared-clock; `npm test` green; build was sibling-blocked then unblocked by 14.1)

## Goal

Replace the flat `three/examples/jsm/objects/Water` plane with a **WebGL2 Gerstner** ocean:
clipmap (or concentric-ring) geometry, vertex displacement, Fresnel/sky mix, sun glitter,
Jacobian whitecaps. Wave **direction is a uniform** (hardcoded default this slice). Keep the
existing `'simple' | 'realistic'` mode and `opaqueClearSafe` gate. Fix the known bug that
the 3D NDI ocean can freeze because time is accumulated only on the scene `tick()`.

## Background

- Phase 13.2 (`DSP-SCN-20260812-01`) shipped `Water` + `Sky`. `Water` has **no vertex
  displacement**. User P0: swell must follow wind direction. Height/period following wind
  is **P1 and droppable** — not this DSP.
- Renderer lock: **WebGL2**. Do not add WebGPU, SeedOcean, or Three.js Water Pro.
- Do **not** import a “sea 3D model”. An ocean is a shader + sim, not a mesh.
- User lock: **our ocean draws on top of Cesium's baked water**. Put the surface at local
  MSL (`y ≈ 0`) plus a small lift (0.1–0.5 m, exposed as a constant/option). Terrain sibling
  does not clip you; you do not clip terrain. Shore foam from the terrain depth buffer is
  **14.2c — out of scope here**.
- `Sky` stays. Do not rip it out.
- `waterCue` (`src/scene/course/waterCue.ts`): **retire it when realistic ocean is mounted**
  (hide/unmount the pad). Leaving both produces a visible rectangle on the sea. When mode is
  `simple`, keep today's pad.
- 3D NDI tick gap (`realistic-3d-environment` / OUT-02 follow-up): `realisticEnv.tick(dt)`
  runs in `createScene.tick()` but the 3D pump `directRender`s without that path, so water
  can freeze on `broadcast-web-3d` while AR is transparent. **Fix in this DSP** by making
  wave time a function of a **shared clock** (`performance.now()` / studio tick timestamp),
  not per-pass `dt` accumulation. Do not rewrite OUT pumps if a shared clock is enough.
- Cross-channel determinism: AR and 3D must show the same sea for a given timestamp.

## In scope

1. New (or replacement) module under `src/scene/environment/` — Gerstner ocean:
   - Clipmap / concentric rings centred on the camera (vertex density near boats, sparse
     at horizon). Reuse existing scene fog to hide the far edge.
   - Sum of Gerstner waves in the vertex shader. Direction = one uniform (radians, scene
     XZ). Default a visually calm swell **toward −Z** (geographic north after 14.0) so the
     wind bus can later replace the uniform without a convention fight.
   - Fragment: Fresnel mix of sky reflection + depth-tinted color; sun glitter using the
     existing `Sky` sun direction / scene `sun` light — stay consistent.
   - Jacobian (or equivalent cheap crest metric) → whitecap foam. Foam amount may scale
     with a `windSpeed` uniform even if speed is still a constant this slice.
   - `tick` or clock sample; `dispose` matching `RealisticEnvironmentHandle`.
2. Wire through existing `createRealisticEnvironment` / `setEnvironmentMode('realistic')`.
   When realistic + opaque-safe: Gerstner ocean + Sky. When not: unmount, same as today.
   Remove the `Water` example object from the realistic path (do not leave it under the
   Gerstner mesh).
3. Shared-clock time (see Background). Confirm with a short comment in the module + README
   so OUT does not re-open the “call tick from the 3D pump” follow-up unless this is not
   enough.
4. Keep `simple` identical: no ocean, `waterCue` still mounts with the course.
5. Tests: mode/gate unchanged (transparent → ocean not drawn); dispose; direction uniform
   rotates travel (unit-test the CPU side of the direction vector, not a GPU screenshot);
   time is clock-based (two ticks with dt=0 still advance if wall time advanced — or
   inject a `now()`).
6. Docs: `src/scene/README.md`, `src/scene/environment/` comments,
   `docs/architecture/ocean-waves-and-sea-state.md` status line.
7. Perf: this runs in the 3D NDI path at ~10 fps and the preview path at ~30. Do not add
   extra `readPixels`. If clipmap resolution is tunable, pick a conservative default and
   document it.

## Out of scope

- Wind bus subscription / Open-Meteo (TEL 14.3a / 14.2b).
- Sea-state presets UI (calm/moderate/choppy) — 14.2b.
- Terrain depth shore foam — 14.2c.
- FFT cascade, boat wakes, spray particles, WebGPU.
- Cesium / `3d-tiles-renderer`.
- Changing NDI pumps beyond relying on shared clock (if you *must* touch
  `ndi3dChannelPump.ts`, only to pass a timestamp — coordinate in the report).

## Likely files

- `src/scene/environment/realisticEnvironment.ts` (replace Water)
- New: Gerstner shader/geometry module + test
- `src/scene/createScene.ts` (clock / waterCue hide when realistic)
- `src/scene/course/waterCue.ts` (only if you add a hide hook)
- `src/scene/README.md`, design doc status
- **Not** `src/scene/terrain/`

## Inputs provided

- `docs/architecture/ocean-waves-and-sea-state.md`
- Existing API: `setEnvironmentMode`, `setEnvironmentOpaqueClearSafe`,
  `RealisticEnvironmentHandle.tick/dispose`
- After 14.0: scene `−Z` = north
- `COURSE_WATER_Y = 0`

## Acceptance criteria

- [ ] Starts **after** 14.0 is on the branch you work from
- [ ] `realistic` + opaque-safe: displaced Gerstner sea (not a flat normal-mapped plane)
- [ ] `simple` unchanged; `transparent`/`chroma`: ocean not drawn
- [ ] `Water` example object gone from the realistic path
- [ ] `waterCue` pad hidden while realistic ocean is mounted
- [ ] Wave time is shared-clock, not only accumulated `dt` on the preview tick
- [ ] Direction uniform documented (scene XZ; default toward geographic north)
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary of changes (wave count, clipmap rings, default direction, lift Y)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (did shared-clock kill the 3D-NDI freeze without pump edits?
   Ready for 14.2b wind uniform?)
5. Suggested memo bullets for SCN
