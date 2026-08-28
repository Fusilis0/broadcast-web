# Dispatch DSP-SCN-20260818-02-buoy-rounding-arrows

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260818-02-buoy-rounding-arrows)
- Priority: P1
- Phase: Phase 15.3 — Unity-like mark rounding arrows
- Related: user 2026-08-18 — buoys need a **circle of two arrows** (Unity CW / RCW), they should **rotate**, and the operator must **set the spin sense**
- Parallel-safe with: SCN-01 (ocean), OUT-01, SCN-03 (fleet). Stay in course/buoy/feature/inspector. If you must touch `createScene.ts`, only the remount hook that already builds buoys — do not rewrite fleet spawn.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (`npm test` 600+23; `npm run build` green).

## Goal

Every course **mark / buoy / gate end** can show a water-level **circular two-arrow** indicator (Unity `CWArrow` / `RCWArrow` look, procedural mesh — do not require Unity PNGs). It **spins** in the chosen sense. The operator can set **CW / CCW / off** per buoy; that persists in the race pack.

## Background

- 3D buoys: `src/scene/course/buoyMarkers.ts` (float + band + stem + cap + label). No rounding glyph.
- Unity ref: `docs/ops/unity-asset-port.md` — CW/RCW are canvas icons; **3D water icons are still stub**. Map already has procedural chevrons for the separate `arrow` / `rotation` feature types — those are **not** this. User asked for the glyph **on the buoys**.
- `WorldFeature` has no rounding field yet (`src/scene/features/types.ts`). Additive optional field; old packs omit → off.

BW locks (2026-08-18):

- Sense is **per feature**, not a global wind-coupled spin.
- Values: `rounding: 'cw' | 'ccw' | 'none'`. Omit = `none`.
- Applies to `mark`, `buoy`, `gateLeft`, `gateRight`.
- Animation: continuous yaw on the arrow ring (a few seconds per revolution). Direction matches `cw` vs `ccw` in **scene XZ** looking down −Y (right-handed, x=East, z=−North). Document which way is CW when viewed from above the water (broadcast convention: looking down, CW = clock).
- Demo Istanbul: set at least the four corner marks to a sensible default (e.g. all CW or a mix) so the operator sees them without hunting the inspector. Other fixtures may stay `none`.

## In scope

1. Additive `rounding` on `WorldFeature`. Parse/export in the existing feature JSON path (world extras + embedded pack features). Unknown strings → `none`.
2. Procedural 3D ring: thin torus/circle on water + **two** arrow heads 180° apart (or Unity-like dual chevrons). Sit slightly above `COURSE_WATER_Y`. Hide when `none` / `visible3d === false`.
3. Spin in `tick` or `onBeforeRender` from a shared clock (same pattern as ocean — 3D NDI `directRender` must still animate).
4. Asset inspector Details for mark/buoy/gate: dropdown **Off / CW / CCW**. Change remounts or updates the glyph without a full world rebuild if cheap; remount is OK.
5. Save/Load: `rounding` round-trips in RaceProject `features` / world JSON. Map glyph optional (cheap chevron already exists for `rotation` type — do not block on map).
6. Tests: parse `rounding`; CW vs CCW yaw sign; `none` has no spinning mesh (or mesh visible=false).
7. Short note in `src/scene/README.md` + `docs/ops/unity-asset-port.md` (3D CW/RCW no longer stub).

## Out of scope

- Ocean seams / FPS / wind vane.
- Fleet persist / boats without telemetry.
- Copying Unity CW/RCW PNGs (optional later).
- Binding rounding to live buoy telemetry heading.

## Likely files

- `src/scene/features/types.ts`
- Feature parse/export (world JSON + `parseRaceProject` only if features are stripped)
- `src/scene/course/buoyMarkers.ts` (or a sibling `roundingArrows.ts` parented to the buoy)
- `src/scene/sidebar/assetInspector.ts`
- Demo world/course fixture for Istanbul marks
- Tests + docs listed above

## Inputs provided

- Unity: `Assets/Prefabs/CWArrow.prefab`, `RCWArrow.prefab` (read-only `../broadcast` if present).
- Buoy builder: `buoyMarkers.ts`.
- Course water Y: `COURSE_WATER_Y`.

## Acceptance criteria

- [ ] Marks/buoys with `rounding: 'cw'|'ccw'` show a circular two-arrow glyph that **rotates** in that sense.
- [ ] Operator can change sense in inspector; Save then Load keeps it.
- [ ] `none` / omitted → no glyph (today’s buoy look).
- [ ] Demo Istanbul corner marks show the glyph so it is visible without setup.
- [ ] `npm test` + `npm run build` green.

## Report back

When done, reply with:
1. Summary (mesh, yaw sign from above, persist field)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
