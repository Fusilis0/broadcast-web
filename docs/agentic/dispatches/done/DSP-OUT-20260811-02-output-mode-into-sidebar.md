# Dispatch DSP-OUT-20260811-02-output-mode-into-sidebar

## Meta
- From orchestrator: BW → OUT (Phase 11 follow-up)
- Worker role: WORKER(DSP-OUT-20260811-02-output-mode-into-sidebar)
- Priority: P0
- Phase: Phase 11 follow-up — floating chrome cleanup
- Design: `docs/architecture/world-authoring-workspace.md` §A
- Parallel OK with `DSP-CAL-20260811-01` and `DSP-SCN-20260811-04` (different files)
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

Remove the floating bottom-left **output** dropdown (`.output-mode-control`, `position: fixed`)
that collides with the ops sidebar. Remount it inside the sidebar **Ops** section so output mode
lives with the other ops controls. Behavior (preview / chroma / transparent) unchanged.

## Background

- `src/output/outputModeControl.ts` — `startOutputModeControl({ container: app, … })` in
  `main.ts` appends a fixed panel to the app root.
- CSS: `.output-mode-control { position: fixed; left: 8px; bottom: 118px; … }` in `style.css`.
- Sidebar Ops section already hosts telemetry mode, POV, view, countdown, stream-map toggle
  (`opsSectionEl` in `main.ts`). Output mode belongs there (or NDI section if you judge air-clear
  mode closer to NDI — **prefer Ops** per design doc; document if you choose NDI instead).
- Existing pattern: `.ops-sidebar .fleet-live { position: static; … }` neutralizes fixed panels
  inside the rail — mirror that for `.ops-sidebar .output-mode-control`.

## In scope

1. Change mount `container` from `app` to the Ops (or documented) sidebar section element.
2. CSS: when inside `.ops-sidebar`, drop fixed positioning / absolute offsets; flow in the
   accordion body. Remove or neutralize the canvas-corner fixed rules so nothing remains at
   bottom-left when the sidebar hosts it.
3. Keep `onChange` / WHEP status hint behavior identical.
4. Docs: `src/output/README.md`, sidebar README section table if Ops contents change.
5. Quick regression note: NDI still follows air camera lock — output mode control is DOM-only.

## Out of scope

- Calib panel move (CAL).
- World authoring workspace (SCN-04).
- Changing output mode semantics or adding persistence beyond what exists today.

## Likely files

- Edit: `src/output/outputModeControl.ts` (only if needed for in-sidebar layout),
  `src/main.ts` (mount target), `src/style.css`, `src/output/README.md`,
  `src/scene/sidebar/README.md`

## Acceptance criteria

- [x] No fixed output dropdown at bottom-left of the canvas
- [x] Output mode select visible inside sidebar Ops (or documented NDI) section
- [x] Switching preview / chroma / transparent still works
- [x] `npm test` + `npm run build` green

## Worker result (2026-08-11)

- Mounted into Ops (`opsSectionEl`, `mountAt: 'start'` — above mode/POV).
- Dropped base `position: fixed`; sidebar neutralize rule retained.
- WHEP status still attaches to `.output-mode-control` (document lookup when not under video container).
- NDI unchanged (DOM-only control).

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for OUT

## Worker paste block

```
You are WORKER(DSP-OUT-20260811-02-output-mode-into-sidebar).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260811-02-output-mode-into-sidebar.md
2. docs/architecture/world-authoring-workspace.md (§A)
3. src/output/outputModeControl.ts
4. src/main.ts (startOutputModeControl + opsSectionEl)
5. src/style.css (.output-mode-control)

Move the output mode control into the sidebar Ops section; remove fixed canvas chrome.
Report back per dispatch.
```
