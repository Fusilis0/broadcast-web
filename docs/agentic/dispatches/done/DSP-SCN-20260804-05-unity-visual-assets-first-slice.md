# Dispatch DSP-SCN-20260804-05-unity-visual-assets-first-slice

## Meta
- From orchestrator: BW → SCN (Phase 8.5–8.8 kickoff)
- Worker role: WORKER(DSP-SCN-20260804-05-unity-visual-assets-first-slice)
- Priority: P1 (start after or parallel to 8.1–8.4 if capacity)
- Phase: Phase 8 — Unity visual asset port (first slice)
- Related: Unity sibling `../broadcast`, sponsors, course S/F, position markers
- **Status: DONE** (SCN+BW accepted 2026-08-04)

## Goal

First **visual parity slice** from Unity: replace stub **start/finish**, improve **sponsor billboards**, and add/port **position markers** (and document remaining asset inventory). Prefer real glTF/textures from Unity export over more procedural stubs.

## Background

- Sponsors already vertical quads; S/F are stubs; Unity has polished prefabs.
- Sibling repo: `C:\Users\PC\Documents\GitHub\broadcast` (or workspace `broadcast`).
- Full Phase 8.5–8.8 continues after this slice (ghost boats, map chrome, 3D polish).

## In scope

1. Inventory Unity assets to port (table in `src/scene/README.md` or `docs/ops/unity-asset-port.md`): sponsors, S/F, position, buoys, ghost boat, map.
2. Port **start + finish** visuals (glTF or textured meshes) wired to feature layout.
3. Polish **sponsor** billboard (texture slots / Unity materials parity where feasible).
4. **Position** marker assets if present in Unity; else clear stub + TODO.
5. License/path notes; fixtures updated for demo-istanbul if needed.
6. Build green; screenshots or checklist for ops.

## Out of scope

- Invisible/ghost boat behaviour (follow-up DSP)
- Full water/shore environment
- Editor snap / stream map (other DSPs)
- Hetzner / TEL

## Likely files

- `public/models/*`, `src/scene/sponsors/*`, course/flags feature meshes
- Unity reference paths under sibling `broadcast` (read-only)
- `docs/ops/unity-asset-port.md` (create)

## Acceptance criteria

- [ ] Asset inventory doc exists
- [ ] Start/finish no longer look like raw stubs in demo race
- [ ] Sponsor path improved or textured
- [ ] Build green; remaining gaps listed for next DSP

## Worker paste block

```
You are WORKER(DSP-SCN-20260804-05-unity-visual-assets-first-slice).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260804-05-unity-visual-assets-first-slice.md
2. docs/roadmap/phases-roadmap.md (Phase 8.5–8.8)
3. src/scene/sponsors/*, course/*, features README
4. Sibling Unity repo assets (read-only) under broadcast/

Port first visual slice: inventory + start/finish + sponsor polish + position markers if available.
Report back with remaining asset backlog for ghost boats / map / 3D polish.
```
