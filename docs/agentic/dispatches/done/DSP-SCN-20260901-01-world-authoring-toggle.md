# Dispatch DSP-SCN-20260901-01-world-authoring-toggle

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260901-01-world-authoring-toggle)
- Priority: P1
- Phase: **19.6** — World Authoring launcher
- Related: `docs/architecture/phase19-senexus-qol.md` §19.6; `docs/architecture/world-authoring-workspace.md`
- Sequencing: **after** `DSP-SCN-20260829-03` (both touch `main.ts` / overlay CSS). Parallel with 19.10 OK; not with 19.2.

## Goal

Remove the left-rail **World** accordion. Put a **small** World Authoring **toggle** on the Race setup **header** (beside the “Race setup” title). The overlay has **no Close** control — a second click on the same header button opens/closes. That clears the collision with LOCAL / 2D / 3D / AR.

## Background

- Accordion id `world-map` is in `OPS_RAIL_SECTIONS` (order 40) and registered in `main.ts`.
- Overlay Close is `world-authoring__close-btn` in `createWorldAuthoringWorkspace`. Hiding uses `[hidden]` + CSS (SCN-05); keep that hide path, just drop the Close **button**.
- OSM / Fit already live on the map toolbar inside the window (`world-map-launcher` note). Do not lose them.
- `mountWorldMapAuthoringLauncher` can shrink to the header chip or be replaced; do not keep a full accordion body.

## In scope

1. Delete `world-map` from `OPS_RAIL_SECTIONS`. Stop `registerSection({ id: 'world-map' … })`. Update `railLayout.test.ts` + `sidebar.test.ts` (no leftover World accordion).
2. Small toggle on the **left rail chrome** next to the “Race setup” title (`createSidebar` `ops-sidebar__title` row). Persist pressed/open state via existing `workspace.isOpen()` / `onOpenChange`. Compact label (e.g. **World** or a map icon + aria-label). Not a full accordion.
3. Remove overlay **Close**. Maximize may stay. Escape-to-close is optional; if kept, document it — primary close is the header toggle.
4. Second click on the header toggle closes; features retained (same as today’s Close).
5. Docs: `src/scene/sidebar/README.md` section table; `world-authoring-workspace.md` launcher sentence if it still says “World Map sidebar section”.
6. Tests: no `[data-ops-section="world-map"]`; overlay has no Close button; toggle round-trip sets `root.hidden`.

## Out of scope

- PiP / stream map (19.2)
- Save/Load status (19.9)
- Authoring inspector / coordinate Add (19.7)
- OSM tile bugs (19.12)
- NDI, Cesium vendor, library picker

## Likely files

- `src/scene/sidebar/railLayout.ts` + `railLayout.test.ts`
- `src/scene/sidebar/createSidebar.ts` + `types.ts` (header action host if needed)
- `src/scene/worldAuthoringWorkspace.ts` + test
- `src/main.ts` (drop world-map section register; wire toggle)
- `src/style.css` (header chip; do not restyle stream-map)
- `src/scene/sidebar/README.md`

## Inputs provided

- `WorldAuthoringWorkspaceHandle.setOpen` / `isOpen` / `onOpenChange`
- Overlay already uses `hidden` + `.world-authoring[hidden] { display: none }`

## Acceptance criteria

- [ ] Left rail has no World accordion section.
- [ ] Small World toggle sits on the Race setup header; click open, click again close.
- [ ] Overlay has no Close button; LOCAL / 2D / 3D / AR remain clickable with authoring open or closed.
- [ ] OSM / Fit still available inside the authoring window.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Where the toggle lives; what happened to `world-map` id
2. Files touched
3. Tests run
4. Follow-ups / blockers
5. Suggested SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260901-01-world-authoring-toggle).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260901-01-world-authoring-toggle.md
2. docs/architecture/phase19-senexus-qol.md §19.6
3. docs/architecture/world-authoring-workspace.md
4. src/scene/worldAuthoringWorkspace.ts, sidebar/railLayout.ts, createSidebar.ts

Remove the World accordion. Small World Authoring toggle on the Race setup header. No Close on the overlay — same button toggles. Keep OSM/Fit inside the window. No PiP, no save-status, no inspector, no Cesium vendor change.
Report back per dispatch.
```
