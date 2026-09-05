# Dispatch DSP-SCN-20260903-07-sea-over-assets

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260903-07-sea-over-assets)
- Priority: P1
- Phase: **19.15** — Gerstner overlapping platforms / sponsors / line signs
- Related: 04/05/06 **human Pass 2026-09-03**. **Human Fail 2026-09-04** (assets missing/glitchy). Follow-up: `done/DSP-SCN-20260904-01-flat-sea-alt-level.md`. Do **not** switch Cesium / globe vendor (GEO 19.18 parked).

## Goal

In **realistic** environment (3D; AR keeps ocean off as today), Gerstner clipmap waves must **not bury** authored **sponsors**, **start/finish line signs**, and similar **flat water platforms**. Terrain stays **land only**; our ocean is the water. Environment **water m** (Cesium discard, now −20…+5) stays the operator knob — do not replace it.

## Background

Design: `docs/architecture/phase19-senexus-qol.md` §19.15 (operator image 2).

Today: sponsors + line signs sit at `WATER_PLANE_Y + 0.08` (`waterPlanePlacement.ts`) with polygon offset. Gerstner `liftY` is also **0.08 m**, but **vertex displacement** is much larger, so waves render **over** the boards.

Phase 16.1 already discards Cesium **water** on tiles. Do not raise `liftY` to cover Cesium’s baked sea. Do not wait for MapTiler.

**Pick the cheapest** that still reads in 3D NDI `directRender` (same Gerstner mesh; no extra full-frame FBO / `readPixels`):

- Local ocean **suppress / flatten** in the Gerstner shader for world-XZ footprints of those assets, or
- Bias / stencil that does not break AR opaque-clear gating.

Boat **wakes** (19.13) stay on the water **outside** those footprints. Do not hide the whole ocean.

## In scope

1. Diagnose: confirm displacement (not z-fight) buries the boards.
2. Implement local suppress (or equivalent) for `sponsor` + `start` / `finish` footprints. Include other **flat-on-water** authored types if they share `applyFlatOnWaterPlacement` and are obviously buried (do not invent a new globe).
3. Feed footprints from the current world layout on remount (cap count if uniforms are limited; document the cap).
4. Tests: helper “point in footprint → ocean flattened/discarded”; ocean still draws away from assets. README one-liner.
5. `npm test` + `npm run build`.

## Out of scope

- Cesium / MapTiler vendor switch
- Changing Environment water m semantics
- NDI pumps, `STUDIO_TICK_FPS`, inspector, ribbon rewrite, buoy mesh flags
- Making boards follow Gerstner verts (they stay planar)

## Likely files

- `src/scene/environment/gerstnerOcean.ts` (+ tests)
- `src/scene/createScene.ts` / remount: pass layout AABBs
- `src/scene/waterPlanePlacement.ts` only if lift must stay shared
- `src/scene/README.md`

## Acceptance criteria

- [x] Realistic 3D: sponsor boards and start/finish bands stay **on top of** (or in a hole in) the waves — not flickering under clipmap water.
- [x] Open water away from assets still waves.
- [x] AR transparent/chroma: ocean still forced off (existing opaque-clear gate).
- [x] Water m slider still only Cesium discard.
- [x] `npm test` + `npm run build` green.

## Report back

1. Approach (flatten vs discard vs bias)
2. Footprint cap / types covered
3. Files / tests
4. SCN memo bullets

## Worker result 2026-09-03

- **Diagnose:** peak Gerstner amplitude **~0.66 m** vs board lift **0.08 m** — displacement, not z-fight. Did not raise `liftY`.
- **Approach:** rest-pose XZ OBB **flatten** (2.5 m pad) + fragment **discard** (0.4 m pad) on the same clipmap mesh. No extra FBO / `readPixels` / stencil. Boards stay planar. Wakes unchanged outside holes. AR ocean still gated off.
- **Cap / types:** `OCEAN_SUPPRESS_CAP` **16**. **start / finish first**, then **sponsor**. Only types that use `applyFlatOnWaterPlacement`. Extras beyond 16 are skipped.
- Files: `oceanSuppress.ts` + tests, `gerstnerOcean.ts` / `realisticEnvironment.ts`, `createScene.ts` remount + URL boot, `src/scene/README.md`. Suite **1177 + 26**, `npm run build` green.
- Human: Load a pack → Environment **realistic** on 3D → sponsor boards and START/FINISH sit in a hole / on top of the sea; open water still waves. AR/chroma: no ocean. Water m still only Cesium discard.

## Worker paste block

```
You are WORKER(DSP-SCN-20260903-07-sea-over-assets).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260903-07-sea-over-assets.md
2. docs/architecture/phase19-senexus-qol.md §19.15
3. src/scene/environment/gerstnerOcean.ts, waterPlanePlacement.ts
4. src/scene/README.md realistic sea notes

19.15: Gerstner must not bury sponsor / start / finish platforms. Local ocean suppress or cheapest equivalent. Terrain land-only stays. Water m = Cesium discard only. No Cesium vendor, no NDI pumps, no STUDIO_TICK_FPS, no inspector.
Report back per dispatch.
```
