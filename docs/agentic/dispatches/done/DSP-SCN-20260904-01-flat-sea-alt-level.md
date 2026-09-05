# Dispatch DSP-SCN-20260904-01-flat-sea-alt-level

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-01-flat-sea-alt-level)
- Priority: **P0**
- Phase: **19.15 Fail** follow-up — visible sea + Alt MSL + sea height
- Related: operator 2026-09-04 — cannot see start/finish/assets (glitch); Environment **water m** does nothing to the sea; **Alt MSL** on assets does nothing
- Worker result: **code done 2026-09-04** — suite **1179 + 26**, build green. SCN **code-accept**. **Human Pass 2026-09-04** on assets / sea m / Alt. Look-dev Fail (static + camera glitter) → `done/DSP-SCN-20260904-02-flat-sea-2d-motion.md`. Hold 19.2b / 19.17.

## Goal

1. **See** start/finish, sponsors, and other world assets in realistic 3D (no glitchy missing boards).
2. Sea is a **flat plane** that still **looks** 3D (colour, foam, glitter, wind) — **no Gerstner vertex displacement** burying meshes.
3. An Environment **sea height** control **actually lowers/raises the visible ocean** so assets sit above it.
4. Asset **Alt MSL** moves 3D **Y** (GEO `gpsToEnu` y). Stop forcing every feature to `y = 0`.

## Background

**19.15 Fail (operator):** flatten + fragment `discard` holes under boards. Line signs/sponsors use `depthWrite: false`. Discarding the ocean under them punches a hole to sky/terrain and the boards vanish or flicker. Do **not** keep fragment discard as the product answer.

**Displacement:** peak Gerstner ~0.66 m vs board lift 0.08 m. Operator lock: sea **like 2D** (no bouncing verts) but **shaded like 3D**. `gerstnerOcean.ts` already has an amplitude scale uniform — drive displacement to **0**; keep fragment trains.

**Water m today:** Cesium **tile discard AMSL** (`clampTerrainWaterDiscardYM`). It does **not** move Gerstner `mesh.position.y`. Operator thought it was sea level. Add **sea m** (or clearly retarget a **sea height** row) that sets:

- Gerstner rest Y
- Shared water plane for flat boards / line signs / wakes (`WATER_PLANE_Y` / `FEATURE_WATER_Y`)

Keep Cesium discard as a **separate** labelled control (`Cesium hide m` / existing water m title). Do not leave one slider that only hides tiles.

**Alt MSL:** `layoutFeatures` **throws away** GEO y:

```12:28:src/scene/features/layoutFeatures.ts
 * AMSL→ENU `y` is ignored so Istanbul geoid offset does not lift features.
export const FEATURE_WATER_Y = 0
      return { x: enu.x, y: FEATURE_WATER_Y, z: enu.z }
```

`applyFlatOnWaterPlacement` also pins Y to `WATER_PLANE_Y + 0.08`. Inspector Alt therefore cannot lift marks, buoys, sponsors, start/finish. Use GEO `enu.y` (relative to origin). Geoid: origin Apply already remounts — do not zero y.

Boats already use `hullEnuFromPlannedGps` (DSP-04). Do not regress live TEL.

No Cesium vendor. No NDI pumps. No `STUDIO_TICK_FPS`.

## In scope

1. **Disable 19.15 fragment discard** (and the hole look). Amplitude 0 makes local flatten optional — remove discard for sure; flatten uniforms may go unused.
2. Gerstner **vertex displacement = 0**; fragment look stays (foam/streak/glitter/colour). Open water is a shaded **plane**.
3. Environment **sea m** (range e.g. **−20…+20**, default **0**): moves ocean + water-plane graphics together. Lower sea → boards/START/FINISH readable above it.
4. `layoutFeatures` + water placement: 3D Y from GEO alt (plus sea height + small lift so they do not z-fight the plane). Buoys/marks/chains too if they read layout y.
5. Tests: displacement scale 0; sea m moves mesh Y; feature alt changes layout y; no `discard` in the ocean hole path. README: water m vs sea m.
6. `npm test` + `npm run build`.

## Out of scope

- MapTiler / Cesium vendor
- 19.2b stream-map chrome, 19.17 remount split
- Rewriting board compose / buoy mesh flags

## Likely files

- `src/scene/environment/gerstnerOcean.ts`, `oceanSuppress.ts` (retire discard)
- `src/scene/features/layoutFeatures.ts`
- `src/scene/waterPlanePlacement.ts`, line signs / sponsors if they pin Y
- `src/scene/stubHud.ts` (sea m row)
- `src/scene/createScene.ts`, `boatWake.ts` if wake Y must follow sea

## Acceptance criteria

- [x] Realistic 3D: START/FINISH and sponsors **visible**, not missing/glitchy holes. *(code: discard removed + flat sea — human smoke)*
- [x] Sea is flat (no mesh bounce) but still reads as water (texture/effects). *(displacementScale 0)*
- [x] **Sea m** −2 lowers the visible ocean; assets stay put and look above it.
- [x] Mark/buoy/sponsor **Alt MSL** lifts that object in 3D (GEO y).
- [x] Cesium hide slider still only tiles. AR still no ocean on transparent/chroma.
- [x] `npm test` + `npm run build` green. *(1179 + 26)*

## Report back (worker 2026-09-04)

1. **Displacement:** `displacementScale: 0` default (wave train kept; verts flat). Wind amplitude × 0.
2. **Sea m vs Cesium hide:** new **sea m** (−20…+20) moves Gerstner Y + `WATER_PLANE_Y` (wakes). Former water m → **Cesium hide m** (tiles only).
3. **Layout y:** `layoutFeatures` / `buildCourseLayout` use `enu.y`; boards get `midY` + 0.08 lift.
4. **SCN memo:** updated; dispatch moved to `done/`.

## Worker paste block

```
You are WORKER(DSP-SCN-20260904-01-flat-sea-alt-level).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260904-01-flat-sea-alt-level.md
2. src/scene/features/layoutFeatures.ts (FEATURE_WATER_Y = 0)
3. src/scene/environment/gerstnerOcean.ts, oceanSuppress.ts
4. src/scene/stubHud.ts water m (Cesium discard only)
5. src/scene/waterPlanePlacement.ts

P0: 19.15 Fail — assets missing/glitchy. Flat sea (no Gerstner verts) that still looks 3D via shading. Environment sea m actually moves the ocean. Asset Alt MSL uses GEO y (stop forcing y=0). Remove fragment ocean discard holes. No Cesium vendor, no NDI pumps, no STUDIO_TICK_FPS.
Report back per dispatch.
```
