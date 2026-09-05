# Dispatch DSP-SCN-20260903-06-buoy-mesh-tag-visibility

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260903-06-buoy-mesh-tag-visibility)
- Priority: P1
- Phase: 19.7 / 19.8-style visibility for **marks / buoys / gates**
- Sequencing: **Open now.** `DSP-SCN-20260903-05` is in `done/`. Reuse inspector; do not revert sponsor logo/alpha.

## Goal

Buoys (and course marks that use the same prop): independent 3D toggles —

1. **Buoy mesh** (the float in the middle) on/off — without forcing arrows or tag.
2. **Tag** (name sprite) on/off.
3. Keep **full hide** (`visible3d` false = nothing in 3D).

Rounding arrows stay the existing Off / CW / CCW control (`rounding: 'none'` hides arrows only).

## Background

Today: one `visible3d` on the feature; rounding ring is separate; `buoyLabel` sprite lives on the same group (`buoyMarkers.ts`). Operator wants to kill the 3D buoy, or the tag, without the all-or-nothing hide.

Suggested additive flags (omit = on):

| Flag | Default | Effect |
| --- | --- | --- |
| `visible3d` | true | Full 3D off (mesh + tag + arrows) |
| `visibleBuoyMesh` | true | Float body on/off |
| `visibleTag` | true | Label sprite on/off |
| `rounding` | existing | Arrows only |

2D map dots: **unchanged** unless `visible2d` already exists (do not tie mesh/tag to 2D). Persist on RaceProject. Assets Details + authoring inspector checkboxes.

Applies to `buoy`, `mark`, `gateLeft`, `gateRight` if they share the prop.

## In scope

1. Flags + remount honour them.
2. Inspector: three controls (full 3D / mesh / tag) + existing rounding.
3. Tests. README. `npm test` + `npm run build`.

## Out of scope

- Sponsor logo/alpha (05), boat alt (04), 19.15, Cesium, NDI
- Changing 19.8 boat hidden/tag rules

## Likely files

- `src/scene/course/buoyMarkers.ts`, `src/scene/worldBuoys.ts`
- `src/scene/features/types.ts`, parse/build
- `src/scene/sidebar/assetInspector.ts`, `authoringInspector.ts` after 05 merges

## Acceptance criteria

- [x] Mesh off, tag on, arrows off: only the tag (or empty water if tag off too).
- [x] Tag off, mesh on: buoy without name.
- [x] Full 3D off: nothing; 2D dot still there unless `visible2d` false.
- [x] `npm test` + `npm run build` green.

## Report back

1. Flag names
2. Files / tests
3. SCN memo bullets

## Worker result 2026-09-03

- **Flags (omit = on):** `visibleBuoyMesh`, `visibleTag`. Full hide stays `visible3d` (remount skip). Rounding unchanged (`none` hides arrows only). 2D still `visible2d` only.
- **Types:** `buoy` / `mark` / `gateLeft` / `gateRight` (same racing-mark prop). Threaded through parse, layout, course waypoints, `createBuoyMarkers`, `mountWorldBuoys`.
- **Inspector:** Assets Details + authoring extras: Full 3D / Buoy mesh / Tag checkboxes + existing Off/CW/CCW. Did not change 19.8 boat hidden/tag.
- Suite **1171 + 26**, `npm run build` green.

## Worker paste block

```
You are WORKER(DSP-SCN-20260903-06-buoy-mesh-tag-visibility).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260903-06-buoy-mesh-tag-visibility.md
2. src/scene/course/buoyMarkers.ts
3. src/scene/sidebar/assetInspector.ts (DSP-05 already merged)
4. docs/architecture/phase19-senexus-qol.md (do not revert 19.8 boats)

Buoys/marks: toggle 3D mesh, toggle tag, keep full visible3d hide. Rounding arrows stay Off/CW/CCW. Do not change 2D unless visible2d. No sponsors, no boat alt, no Cesium, no NDI.
Report back per dispatch.
```
