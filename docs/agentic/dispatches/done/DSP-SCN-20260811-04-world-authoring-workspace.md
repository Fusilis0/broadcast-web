# Dispatch DSP-SCN-20260811-04-world-authoring-workspace

## Meta
- From orchestrator: BW → SCN (Phase 11 follow-up / V1-D UX gap)
- Worker role: WORKER(DSP-SCN-20260811-04-world-authoring-workspace)
- Priority: **P0**
- Phase: Phase 11 follow-up — world authoring must be discoverable
- Design: `docs/architecture/world-authoring-workspace.md`
- Related: `DSP-SCN-20260811-02` (tools exist but are hidden/cramped); sidebar shell README
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

Ship a **dedicated World Authoring workspace** — a special DOM window (not WebGL) with a large
2D map and a visible tool palette (billboard chain, start, finish, flags, buoy, sponsor, gates,
place boat/drone, set anchor, …) so ops can build the race world in 2D and see it land in 3D at
the same time. Today the tools already exist in `startMapFeatureEditor` but default to
`panel.hidden` unless `?editor=1`, and live inside a ~340px accordion — users cannot find them.

## Background

- Tools + factory already landed in `DSP-SCN-20260811-02`: see `EDITOR_TOOL_ORDER` /
  `EDITOR_TOOL_LABELS` in `src/scene/features/editor/tools.ts`.
- `startMapFeatureEditor` (`editorPanel.ts`): `open = options.initiallyOpen ?? false` →
  `panel.hidden = !open`. Wired from `main.ts` via `editorQueryOpen()` (`?editor=1`) and Ops
  checkbox `onEditorToggle` → `mapEditor.setOpen`.
- World Map sidebar section (`order: 20`) only hosts the cramped editor container
  (`worldMapSectionEl`).
- Map pan/zoom + OSM + buoy/billboardChain 3D remount already work when the editor is open.
- NDI invariant unchanged: workspace is DOM overlay only (`sidebar.getOverlayHost()` or `app`).

## In scope

1. **Authoring workspace chrome** (new module under `src/scene/` or `src/scene/sidebar/`, e.g.
   `worldAuthoringWorkspace.ts`):
   - Large floating/docked panel over the canvas (right of the sidebar rail), with title
     “World authoring”, Close button, optional maximize.
   - Hosts the **ops 2D map** at a usable size (≥ ~520px edge; reuse pan/zoom from map2d).
   - Hosts the **full tool palette** visibly (readable labels — not only cryptic abbreviations if
     space allows; group: Course / Graphics / Fleet / Anchor).
   - When open: editor tools active; map clicks place features; existing `onApply` remounts 3D.
   - When closed: tools inactive; 3D/live preview unaffected; state retained (features not wiped).
2. **World Map sidebar section** becomes launcher + status:
   - Primary button: **Open authoring** / **Close authoring** (synced with workspace).
   - Short hint: “Place start, finish, flags, billboard chains, buoys on the 2D map — 3D updates
     live.”
   - Keep OSM / Fit / useful map toggles here or on the workspace chrome (worker’s layout call —
     must be findable without `?editor=1`).
3. **Default open:** for editor role (`projectWritesEnabled === true`), open the workspace on boot
   (or after first race load). Air role: closed. `?editor=1` / `?editor=0` may still force.
4. **Deprecate Ops “editor” checkbox as the only gate** — either remove it or make it a mirror of
   workspace open/close (same state). Do not leave two contradictory toggles.
5. Refactor `startMapFeatureEditor` as needed so tools+map can live in the workspace (container
   split is OK). Prefer reuse over rewrite of snap/validate/factory.
6. CSS: workspace styles; ensure sidebar accordion World Map section no longer needs to be the
   sole home of a 420px canvas.
7. Docs: `src/scene/README.md`, `src/scene/features/README.md`, sidebar README (section role
   change), architecture doc if behavior differs from the lock.
8. Manual acceptance path documented in report-back (see criteria).

## Out of scope

- Moving output-mode or calib panels (separate OUT / CAL dispatches).
- New WorldFeature types beyond what already exists.
- NDI burn-in of the 2D map.
- Physics / live buoy remount polish beyond existing SCN-02/03 behavior.
- Rewriting Project Save/Load.

## Likely files

- New: `src/scene/worldAuthoringWorkspace.ts` (or `sidebar/worldAuthoringWorkspace.ts`) + test
- Edit: `src/scene/features/editor/editorPanel.ts`, `tools.ts` (labels/groups if needed),
  `src/main.ts`, `src/scene/stubHud.ts` (editor checkbox mirror/remove), `src/style.css`,
  `src/scene/README.md`, `src/scene/sidebar/README.md`, `src/scene/features/README.md`

## Inputs provided

- `docs/architecture/world-authoring-workspace.md`
- Existing tools list in `src/scene/features/editor/tools.ts`
- Sidebar overlay host: `sidebar.getOverlayHost()` (`src/scene/sidebar/README.md`)

## Acceptance criteria

- [ ] Without `?editor=1`, an editor-role user can open a **large** authoring window from the
      World Map sidebar section and see a tool palette including at least: billboard chain, start,
      finish, flag(s), buoy, sponsor, mark/gate, place boat, place drone, set anchor
- [ ] Placing a start (or finish / buoy / billboard chain) on the 2D map updates the 3D scene via
      existing remount path
- [ ] Closing the workspace hides the window; reopening restores tools + map without wiping features
- [ ] Air role does not force the workspace open; editor role defaults open (or clearly one-click)
- [ ] Ops editor checkbox is removed or strictly mirrors workspace open state (no dual gates)
- [ ] Workspace is DOM-only — no change to NDI capture path
- [ ] `npm test` + `npm run build` green
- [ ] Report includes a short manual smoke checklist (Open authoring → place start + bb chain →
      see 3D → Save)

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for SCN

## Worker paste block

```
You are WORKER(DSP-SCN-20260811-04-world-authoring-workspace).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260811-04-world-authoring-workspace.md
2. docs/architecture/world-authoring-workspace.md
3. src/scene/features/editor/editorPanel.ts, tools.ts
4. src/scene/sidebar/README.md
5. src/main.ts (World Map section + mapEditor wiring)

Build a dedicated World Authoring workspace window (large 2D map + visible tool palette).
Tools already exist — make them discoverable and usable. Do not move output/calib panels
(separate OUT/CAL DSPs). Report back per dispatch.
```
