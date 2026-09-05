# Dispatch DSP-SCN-20260902-05-hidden-boat-keeps-tag

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260902-05-hidden-boat-keeps-tag)
- Priority: P1
- Phase: **19.8** — boat visibility
- Sequencing: **parallel OK** with 19.11 / 19.12 (stay in `boatVisibility` / `boatEntity` / fleet panel / materials). Not 19.7 inspector.
- Worker result: **code done 2026-09-02** — hidden keeps tag; `cloneSharedMaterials` after glTF `clone(true)`. `npm test` **1094 + 26**, `npm run build` green. Human smoke: ghost boat 2, save, reload, boat 1 still solid; hidden hull off / tag on.

## Goal

| Mode | 3D hull | Tag | 2D map |
| --- | --- | --- | --- |
| `solid` | on | on | unchanged |
| `ghost` | translucent + ring | **on** | **unchanged** |
| `hidden` (3D off) | off | **on** | **unchanged** |

Per-boat after save/load. Shared hull materials must not leak ghost/solid across boats (clone per instance if that is the leak).

## Background

`applyBoatVisibilityMode` **hidden** currently sets `tagRoot.visible = false`. Operator: 3D off hides tags — tags must stay. 2D dots must not change with ghost/hidden (separate `mapVisible` already exists).

## In scope

1. `hidden`: hull/ring off, **tag on** (leader OK). Ghost: tag on. 2D map icons unchanged by these three modes.
2. Tests: update `boatVisibility.test.ts` hidden case; add clone-per-instance check if you touch materials.
3. Save/load: per-id `fleet.boatVisibility` already exists — verify no shared material state after reload (document if you add `material.clone()`).
4. Fleet/Assets copy: “3D off” still means hidden hull, tag remains.
5. Docs: `src/scene/README.md` / boatVisibility comment.

## Out of scope

- Inspector layout (19.7)
- Map chrome restyle, OSM, billboards, Cesium
- Changing `mapVisible` semantics

## Likely files

- `src/scene/boatVisibility.ts` + test
- `src/scene/boatEntity.ts`
- `src/scene/fleetLivePanel.ts` (help text)
- `src/assets/tintBoatVisual.ts` only if shared material leak is proven

## Acceptance criteria

- [x] Hidden boat: no hull, **tag visible**, 2D dot still tracks.
- [x] Ghost boat 2 only; save; reload; boat 1 still solid (no shared leak).
- [x] `npm test` + `npm run build` green.

## Report back

1. Tag visibility change
2. Material clone yes/no
3. Files / tests
4. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260902-05-hidden-boat-keeps-tag).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260902-05-hidden-boat-keeps-tag.md
2. docs/architecture/phase19-senexus-qol.md §19.8
3. src/scene/boatVisibility.ts, boatEntity.ts, fleetLivePanel.ts

hidden = hull off, tag ON. Ghost/hidden do not change 2D dots. Per-boat after save/load; clone materials if they leak. No inspector, no OSM, no Cesium.
Report back per dispatch.
```
