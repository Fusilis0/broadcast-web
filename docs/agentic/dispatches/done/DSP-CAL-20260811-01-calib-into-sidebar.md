# Dispatch DSP-CAL-20260811-01-calib-into-sidebar

## Meta
- From orchestrator: BW → CAL (Phase 11 follow-up)
- Worker role: WORKER(DSP-CAL-20260811-01-calib-into-sidebar)
- Priority: P0
- Phase: Phase 11 follow-up — floating chrome cleanup
- Design: `docs/architecture/world-authoring-workspace.md` §A
- Parallel OK with `DSP-OUT-20260811-02` and `DSP-SCN-20260811-04`
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

Remove the floating top-left **calib** panel (`.calib-panel`, `position: fixed`) that collides
with the ops sidebar. Remount the existing offset sliders into a new sidebar **Calib** section so
yaw/pitch/roll/FOV/alt editing lives in the left menu. Slider behavior and `offsetsStore` wiring
unchanged.

## Background

- `src/calibration/offsetSliders.ts` — `startOffsetSliders({ container: app })` in `main.ts`
  (near boot) creates fixed top-left chrome.
- CSS: `.calib-panel { position: fixed; top: 8px; left: 8px; … }`.
- Assets inspector already shows **read-only** `getOffsets` for POV Details and points users at
  “CAL offset sliders” — after this move, that hint should say **sidebar → Calib** (SCN can fix
  the string in a drive-by if you touch that file; otherwise note it for SCN).
- Design lock: new section **Calib**, order ~35 (between Assets 30 and Library 40).

## In scope

1. Register (or have `main.ts` register) sidebar section `id: 'calib'`, label `Calib`, order `35`.
2. Mount `startOffsetSliders` into that section’s container instead of `app`.
3. CSS: neutralize `.calib-panel` fixed positioning inside `.ops-sidebar` (mirror fleet-live /
   output-mode pattern). No leftover fixed panel at top-left.
4. Keep device select, Reset, and all five knobs working; `setPovIds` / `setDeviceId` wiring in
   `main.ts` unchanged in behavior.
5. Docs: `src/calibration/README.md`, sidebar README section table.
6. Optional one-line fix to Assets POV Details hint text if you already edit that area — else
   call out in follow-ups.

## Out of scope

- Making Assets Details editable for calib (read-only display stays; this panel remains the editor).
- Output mode move (OUT).
- World authoring workspace (SCN).
- New calibration math / CV.

## Likely files

- Edit: `src/calibration/offsetSliders.ts` (layout only if needed), `src/main.ts` (register
  section + mount), `src/style.css`, `src/calibration/README.md`,
  `src/scene/sidebar/README.md`
- Optional: `src/scene/sidebar/assetInspector.ts` (hint string)

## Acceptance criteria

- [x] No fixed calib panel at top-left of the canvas
- [x] Sidebar has a **Calib** section with the existing sliders (device + yaw/pitch/roll/FOV/alt + Reset)
- [x] Changing a slider still updates live pose / FOV for the selected POV
- [x] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for CAL

## Worker paste block

```
You are WORKER(DSP-CAL-20260811-01-calib-into-sidebar).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-CAL-20260811-01-calib-into-sidebar.md
2. docs/architecture/world-authoring-workspace.md (§A)
3. src/calibration/offsetSliders.ts
4. src/main.ts (startOffsetSliders)
5. src/scene/sidebar/README.md (how to registerSection)

Move calib sliders into a new sidebar Calib section (order ~35); remove fixed top-left chrome.
Report back per dispatch.
```
