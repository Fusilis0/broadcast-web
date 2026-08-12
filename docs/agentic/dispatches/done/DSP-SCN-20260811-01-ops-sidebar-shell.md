# Dispatch DSP-SCN-20260811-01-ops-sidebar-shell

## Meta
- From orchestrator: BW → SCN (Phase 11.1)
- Worker role: WORKER(DSP-SCN-20260811-01-ops-sidebar-shell)
- Priority: P0
- Phase: Phase 11 — Unified ops sidebar & universal asset pipeline
- Prerequisite for: `DSP-SCN-20260811-02`, `DSP-SCN-20260811-03`, `DSP-PLT-20260811-01`, `DSP-PLT-20260811-02`, `DSP-OUT-20260811-01` (all mount a section into this shell)
- Related handoffs: none yet
- Design doc (**read first**): `docs/architecture/unified-ops-sidebar.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

Replace today's three independently-mounted overlays (`stubHud.ts`, `fleetLivePanel.ts`,
`features/editor/editorPanel.ts`, all appended ad-hoc into `.ops-overlay` from `src/main.ts`) with
**one collapsible left sidebar shell** that other dispatches register sections into. This dispatch
is a **lift-and-shift + shell**, not a feature dispatch: behavior must not regress. No new asset
types, no map upgrade, no library — those are separate dispatches.

## Background

- Current mount points: `src/main.ts` lines ~757 (`startStubHud`), ~1006 (`startMapFeatureEditor`,
  container `.ops-overlay`), ~1054 (`startFleetLivePanel`). All three build their own DOM root and
  are visually stacked/overlapping today.
- `stubHud.ts` currently owns: telemetry mode select, POV select, ops view (free/follow) select,
  countdown controls, editor-open checkbox, stream-map checkbox, race select + custom id + Save/
  Save as/Pack↓/Pack↑ buttons, world-anchor origin fields + Apply, status line, the ops 2D map
  (`getMap()`), and the stream/PiP map (`getStreamMap()`).
- `fleetLivePanel.ts` owns: boat/drone registration rows (editable), live WS base URLs, per-id
  enabled checkboxes, Connect/Reconnect, per-id status, boat visibility (solid/ghost/hidden), ops
  view Free/Follow buttons (duplicated with stubHud's — **fine to de-duplicate to one source of
  truth as part of this dispatch**, keep whichever is easier to wire; document the change).
- `features/editor/editorPanel.ts` owns: the world-feature tool palette, snap controls, validation
  summary, Save project fields.
- All three currently read/write independent DOM state; `main.ts` wires callbacks between them
  directly (no shared bus). Preserve this wiring style — just change **where the DOM lives**, not
  how callbacks flow, unless a section boundary makes an obvious simplification.

## In scope

1. New module `src/scene/sidebar/` implementing the shell:
   - `createSidebar(options): SidebarHandle` — one root element, collapsible, docked left,
     overlaying the canvas (same stacking approach as today's `.ops-overlay`; do not reflow/resize
     the canvas when the sidebar opens/closes or collapses).
   - `sidebar.registerSection({ id, label, order, mount(container) => { dispose() } })` — sections
     render lazily/eagerly (worker's choice) into an accordion or tab layout; exact visual chrome is
     the worker's call as long as all sections are reachable from one shell.
   - `sidebar.setCollapsed(collapsed: boolean)` / `sidebar.isCollapsed()` — collapsing hides the
     rail (air/show mode) without disposing sections or stopping telemetry/editor state. Add a
     visible toggle control + one keyboard shortcut (avoid colliding with existing digit-key POV
     shortcuts in `stubHud.ts`).
2. Migrate the three existing panels' DOM into sidebar sections **without changing their public
   options/handle types where avoidable** — i.e. `startStubHud`, `startFleetLivePanel`,
   `startMapFeatureEditor` keep their existing option/callback contracts; only the `container` they
   render into changes (a section's provided container instead of a freestanding
   `document.createElement` root appended straight to `.ops-overlay`). If a function currently does
   `options.container.appendChild(root)`, that still works unchanged when `options.container` is a
   sidebar section's container.
3. Sensible default section grouping for this dispatch only (later dispatches will add/replace
   sections — do not over-build features prematurely):
   - **Project** section: race select/custom id/Load/Save/Save as/Pack↓/Pack↑ (moved from
     `stubHud`'s race row) + world-anchor origin fields/Apply.
   - **World Map** section: today's ops 2D map (`stubHud.getMap()`) + the editor panel content
     together (they already interact — editor draws on the ops map).
   - **Live** section: `fleetLivePanel` content as-is.
   - **Ops** section: mode select, POV select, ops view select, countdown controls, stream-map
     checkbox + stream/PiP map visibility toggle (the PiP map render target itself can stay
     positioned outside the sidebar since it's an on-air overlay, not a control — only its
     show/hide checkbox belongs in the sidebar).
4. Update `src/main.ts` wiring to mount into sidebar sections instead of `.ops-overlay` directly.
   Keep every existing callback (`onModeChange`, `onPovChange`, `onFleetChange`, `onSaveProject`,
   etc.) working exactly as before.
5. `src/style.css`: new sidebar shell styles; keep existing `ops-hud__*`/`ops-editor__*`/
   `fleet-live__*` classes working inside their new containers (avoid a full visual rewrite of every
   control — this dispatch is about the shell, not a redesign of every row).
6. Regression check for the NDI invariant (design doc §2): confirm/keep true that
   `startNdiFramePump` never reads from the sidebar DOM — it already only reads the WebGL
   framebuffer, so this is a verification/doc note, not new code. Add or update one test/comment
   stating this explicitly so future sidebar growth doesn't accidentally introduce a DOM-to-canvas
   dependency.
7. Docs: `src/scene/README.md` (sidebar section), `src/scene/sidebar/README.md` (new, contract +
   how to register a section — other orchestrators' workers will read this).

## Out of scope

- New asset types, 2D map pan/zoom/basemap, billboard chain/buoy tools (`DSP-SCN-20260811-02`).
- Asset inspector (focus/show/hide/details) list (`DSP-SCN-20260811-03`).
- Universal asset library UI (`DSP-PLT-20260811-01`).
- Project rename/duplicate/archive, boat-id catalogue validation (`DSP-PLT-20260811-02`).
- NDI controller tab (`DSP-OUT-20260811-01`).
- Any RaceProject schema change.
- Visual redesign of individual control rows beyond what's needed to fit the new shell.

## Likely files

- New: `src/scene/sidebar/index.ts`, `sidebar.ts` (or split `createSidebar.ts` + types), `sidebar.test.ts`, `README.md`
- Edit: `src/main.ts` (mount points), `src/scene/stubHud.ts` (container usage only, if needed), `src/scene/fleetLivePanel.ts` (same), `src/scene/features/editor/editorPanel.ts` (same), `src/style.css`, `src/scene/index.ts` (export sidebar), `src/scene/README.md`

## Inputs provided

- `docs/architecture/unified-ops-sidebar.md` — full design + section list + sequencing table.
- Existing panel source: `src/scene/stubHud.ts`, `src/scene/fleetLivePanel.ts`,
  `src/scene/features/editor/editorPanel.ts`.

## Acceptance criteria

- [ ] One sidebar shell exists; Project / World Map / Live / Ops sections all reachable from it
- [ ] Collapse toggle hides the whole rail; telemetry/editor state keeps running while collapsed
- [ ] Every existing control (mode, POV, ops view, countdown, editor toggle, stream map, race
      select/load/save/save-as/pack, origin apply, fleet boats/drones/live connect/visibility) still
      works exactly as before — no functional regression
- [ ] `sidebar.registerSection` documented in a README with enough detail for another worker to add
      a section without reading the shell's internals
- [ ] NDI dual-render invariant confirmed unaffected (comment/test); no sidebar DOM read from
      `ndiFramePump.ts` or any render path
- [ ] `npm test` + `npm run build` green
- [ ] `npm run dev`: sidebar visible, collapsible, all migrated controls functional

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for SCN

## Worker report (summary)

1. **Summary:** `src/scene/sidebar/` shell (`createSidebar`/`registerSection`/collapse via button +
   `` ` `` hotkey). Stub HUD split into **Project** (race + origin), **World Map** (ops 2D map +
   editor), **Ops** (mode/POV/view/countdown/editor/stream toggle/status); stream PiP stays outside
   the rail. **Live** = fleet panel; de-duplicated Free/Follow (kept **Frame boats** in Live, moved
   Free/Follow to Ops only). `main.ts` wires all four sections; existing callbacks unchanged.
2. **Files:** new `src/scene/sidebar/*` (+tests, README); edit `stubHud.ts`, `fleetLivePanel.ts`,
   `editorPanel.ts` (comment), `main.ts`, `style.css`, `scene/index.ts`, `scene/README.md`,
   `output/ndiFramePump.ts` (NDI invariant comment + regression test).
3. **Verify:** `npm test` — 337 client + 15 server green (incl. `sidebar.test.ts`); `npm run build`
   green; manual `npm run dev` pass (accordion, collapse/expand, controls wired).
4. **Follow-ups:** none blocking. Editor map canvas (420px) inside ~340px rail scales via CSS —
   downstream SCN-02 should sanity-check this doesn't clip controls once pan/zoom lands.
5. **SCN memo bullets:** Phase 11.1 shell landed — `createSidebar` + Project/World Map/Live/Ops;
   contract in `src/scene/sidebar/README.md`; NDI dual-render invariant unchanged.

**BW accept (2026-08-11):** Meets all acceptance criteria; tests/build green. Unblocks
`DSP-SCN-20260811-02/-03`, `DSP-PLT-20260811-01/-02`, `DSP-OUT-20260811-01`.

## Worker paste block

```
You are WORKER(DSP-SCN-20260811-01-ops-sidebar-shell).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260811-01-ops-sidebar-shell.md
2. docs/architecture/unified-ops-sidebar.md
3. src/scene/stubHud.ts, fleetLivePanel.ts, features/editor/editorPanel.ts
4. src/main.ts (current mount points for all three panels)

Build the sidebar shell + migrate existing panels into it. Lift-and-shift only — no new
features, no map/library/inspector/NDI work (separate dispatches depend on this one).
Report back per dispatch.
```
