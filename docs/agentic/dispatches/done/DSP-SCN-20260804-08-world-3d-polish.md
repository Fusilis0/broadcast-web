# Dispatch DSP-SCN-20260804-08-world-3d-polish

## Meta
- From orchestrator: BW → SCN (Phase 8.8)
- Worker role: WORKER(DSP-SCN-20260804-08-world-3d-polish)
- Priority: P0
- Phase: Phase 8 — Visual & authoring QoL
- Related: course buoys/gates, Unity materials; no Cesium
- **Status: DONE** (SCN+BW accepted 2026-08-04 � Phase 8 complete)

## Goal

**Mild 3D world polish** for broadcast look: buoy/gate materials, start/finish already ported — refine scale/materials; add subtle water/shore cue under the race area (plane/shader/simple mesh — not a full globe).

## Background
- 8.5 first slice: S/F bands, sponsors, position markers, inventory.
- Exit V1-A needs “air-ready” not film CG.

## In scope
1. Buoy / gate (and related course meshes) material + scale pass vs Unity reference.
2. Mild water or shore plane near origin / course bounds (tunable colour/opacity; document).
3. Lighting tweak if needed for hull/sponsors readability on transparent/chroma plates.
4. Update `unity-asset-port.md` remaining gaps.
5. Build green; short ops visual checklist.

## Out of scope
- Cesium / real terrain tiles
- Ghost boats / map chrome (other DSPs)
- Full sponsor pack / every Unity prefab

## Acceptance criteria
- [x] Demo race 3D looks clearly better than procedural stubs for buoys/gates
- [x] Water/shore cue present and not breaking alpha air (document clear behaviour)
- [x] Remaining asset gaps listed; build green

## Worker report (2026-08-04)

**Shipped:**
- **Buoys** — float body + mid band + stem + cap (`buoyMarkers.ts`); gate ends use gate-colour accent; scale closer to Unity `BuoyMarker` fat pole.
- **Gates** — MeshStandard horizontal tubes on water (`courseLines.ts`) instead of hairline-only segments; boundary LineLoop kept.
- **Water/shore cue** — AABB pads under course (`course/waterCue.ts`); tunables in `WATER_CUE_DEFAULTS`; `depthWrite: false` + localized footprint for transparent/chroma.
- **Lighting** — ambient/sun/fill bumped + weak bounce in `createScene.ts` for plate readability.
- **Docs** — `unity-asset-port.md` inventory/checklist/clear table; `air-runbook.md` water-cue note; scene + course fixture READMEs.
- **Tests** — water-cue bounds + dispose; `npm test` (294) + `npm run build` green.

**Clear behaviour:** preview = teal pad on dark; transparent = semi-opaque pad only under course (empty sky/sea stay alpha 0); chroma = green outside pad. Lower opacities if pad is too heavy on air.

**Remaining gaps** (see unity-asset-port): map chrome (8.7), arrows/CW icons, BillboardChain, landmarks, category hulls — not this slice.

## Worker paste block

```
You are WORKER(DSP-SCN-20260804-08-world-3d-polish).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260804-08-world-3d-polish.md
2. docs/ops/unity-asset-port.md
3. src/scene/course/*, sponsors/*, createScene lighting
4. docs/ops/air-runbook.md (transparent/chroma clear)

Mild 3D polish: buoys/gates + water/shore cue. No Cesium, no map chrome, no ghost boats.
Report back per dispatch.
```
