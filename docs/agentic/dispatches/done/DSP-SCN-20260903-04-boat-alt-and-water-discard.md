# Dispatch DSP-SCN-20260903-04-boat-alt-and-water-discard

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260903-04-boat-alt-and-water-discard)
- Priority: **P0**
- Phase: 19.7 follow-up (boat alt actually moves the hull) + Environment water m
- Sequencing: **parallel OK** with DSP-05 (stay out of sponsor compose / inspector sponsor fields). Not 19.15 Gerstner clip.
- Worker result: **code done 2026-09-03** — planned Alt MSL → hull ENU y (stopped `y: 0` seeds). Water m clamp **−20…+5** (default 0.5). Boat `heightM` = uniform hull scale (omit → 1). Suite **1149 + 26**, build green. Stayed out of sponsors / 19.15 / Cesium vendor / NDI.

## Goal

1. **Boat Alt MSL** in Assets Details / authoring **must move the 3D hull** (demo-istanbul boats sit under the sea today).
2. Environment **water m** must accept **negative** values (today clamp is **0–5**).

## Background

Callers pass `upsertStaticBoat(id, { x: enu.x, y: 0, z: enu.z })` in `src/main.ts` (planned GPS, authoring place, map click). GEO `gpsToEnu(..., plannedAlt)` already returns **y**; it is discarded. `resolveStaticHullPosition` would honour `position.y` if callers sent it.

Live TEL poses still win (`canApplyStaticHull`). Static / mock / no-packet hulls must use planned ENU **including y**.

Environment `clampTerrainWaterDiscardYM` in `stubHud.ts`: `Math.max(0, …)` → min **0**. Operator needs minus to push Cesium water-hide down. This knob is **terrain discard AMSL**, not Gerstner amplitude. Hull Y from alt is the primary “boats under sea” fix. Do **not** add a second ocean-height slider in this DSP. Do not switch Cesium vendor. Do not raise `STUDIO_TICK_FPS`.

Also finish the 19.7 leftover: **`heightM` on a boat** should **uniform-scale** the hull (ratio locked). Alt = ENU **y**; heightM = mesh scale. Do not mix them.

## In scope

1. Every static/planned hull path: `y` from `gpsToEnu(lat, lon, plannedAlt ?? 0).y` (map click with alt 0 stays y from GEO). Stop hardcoding `y: 0`.
2. Tests: planned alt change moves hull Y; live packet still blocks snap-back.
3. `clampTerrainWaterDiscardYM`: allow negatives (suggested **−20 … +5**, keep default 0.5). Update stubHud tests + Environment input `min`. Shader already uses the uniform — do not invent a new ocean.
4. Boat `heightM` → uniform hull scale (default 1 when omitted).
5. README one-liner. `npm test` + `npm run build`.

## Out of scope

- Sponsor logo/plate/alpha (DSP-05)
- Buoy mesh/tag toggles (DSP-06)
- 19.15 sea-over-platforms, Cesium vendor, NDI, inspector layout rewrite

## Likely files

- `src/main.ts` (all `y: 0` hull seeds)
- `src/scene/staticFleetHulls.ts` + tests (only if y=0 is forced inside)
- `src/scene/boatEntity.ts` (heightM scale)
- `src/scene/stubHud.ts` + `stubHud.test.ts`

## Acceptance criteria

- [ ] demo-istanbul (or any pack): change boat **Alt MSL** → hull rises/falls in 3D/AR; wakes can appear on the water when moving.
- [x] Environment **water m** can be set below 0 (e.g. −2). (HUD min −20; clamp tests.)
- [x] Boat **Height m** uniformly scales the hull. (entity tests; human smoke still needed)
- [x] `npm test` + `npm run build` green.

## Report back

1. Where y was forced to 0
2. Water m new range
3. Files / tests
4. SCN memo bullets

## Worker result 2026-09-03

**y forced to 0** in `src/main.ts` only (not inside `resolveStaticHullPosition`):

- `syncFleetHullsFromPanel` — `gpsToEnu(..., 0)` then `{ y: 0 }` (also dropped `plannedAlt`)
- `seedPlannedFleetOnMap` boat poses `{ y: 0 }`
- `onPlaceFleet` map click `upsertStaticBoat(..., { y: 0 })`
- `onPlaceFleetGps` / `onEditFleetGps` discarded `enu.y`
- `onBoatPlannedGpsChange` discarded `enu.y`

Now `hullEnuFromPlannedGps` → GEO `gpsToEnuAmsl` including y. Map click keeps click XZ, y from GEO at alt 0. Grid fallback in `staticFleetHulls` still y=0 (no GPS). Live TEL still blocks snap-back.

**Water m:** `clampTerrainWaterDiscardYM` **−20…+5**, default **0.5**. HUD `min="-20"`. Shader uniform unchanged.

**Files:** `src/main.ts`, `src/scene/boatEntity.ts` + test, `src/scene/createScene.ts` (`setBoatHeightM`), `src/scene/stubHud.ts` + tests, `src/scene/staticFleetHulls.test.ts`, `src/scene/README.md`, `src/scene/index.ts`.

**Tests:** planned y moves hull; live blocks snap-back; heightM uniform scale; water −2 / −20 / +5. Suite **1149 + 26**. Build green.

## Worker paste block

```
You are WORKER(DSP-SCN-20260903-04-boat-alt-and-water-discard).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260903-04-boat-alt-and-water-discard.md
2. src/main.ts (search y: 0 near upsertStaticBoat / planned GPS)
3. src/scene/stubHud.ts clampTerrainWaterDiscardYM
4. GEO gpsToEnu — use it; do not fork

P0: planned Alt MSL must set hull ENU y (stop y:0). Water m allow negatives (−20..+5). Boat heightM = uniform hull scale. No sponsor rewrite, no 19.15 Gerstner clip, no Cesium vendor, no NDI.
Report back per dispatch.
```
