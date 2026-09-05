# Dispatch DSP-SCN-20260901-02-save-load-status

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260901-02-save-load-status)
- Priority: P1
- Phase: **19.9** — Save / Load logs
- Related: `docs/architecture/phase19-senexus-qol.md` §19.9
- Sequencing: **after** `DSP-SCN-20260829-03` (`main.ts` / `stubHud.ts`). Not parallel with 19.2.

## Goal

Under the Project Save / Load controls, show last-action text: **`loading` → `loaded`**, **`saving` → `saved`**, plus a short error line on failure. No modal.

## Background

- `mountLocalProjectControls` already has `data-ops="save-status"` + `setSaveStatus`. Callers mostly set folder/download strings (`formatPersistStatus`) or `'save failed'` / `'download'`.
- Load path uses `hud.setBootMessage('project: loading …')` in `switchRace` — status under the buttons is what the operator asked for.
- Keep `setRootHint` (`saving to: …/public/races`) as the folder path hint; do not replace it with the lifecycle word.

## In scope

1. Drive the existing status node (or a sibling under the Save/Load row) through:
   - Load start → `loading`; success → `loaded`; fail → short error (keep id in the line if useful).
   - Save / Save as start → `saving`; success → `saved` (optional: keep a compact persist suffix after `saved` if it helps ops; primary words must appear).
   - Export-only download may say `saved` or `downloaded` — pick one and test it; failure still an error line.
2. Wire `switchRace`, `saveCurrentRaceProject` / save-as, and existing fail paths so the operator never only sees boot-strip text.
3. Tests on the formatter / control: setStatus shows `loading`/`loaded`/`saving`/`saved`; error path.
4. Tiny README note on the Project section row.

## Out of scope

- Instant project switch / 3D remount (19.17 — PLT+SCN later)
- PiP (19.2), World toggle (19.6), inspector (19.7)
- Changing persist/Electron `races.save` contracts
- Modals

## Likely files

- `src/projects/localProjectControls.ts` + `localProjectControls.test.ts`
- `src/scene/stubHud.ts` (`setSaveStatus` passthrough)
- `src/main.ts` (`switchRace`, save/export)
- `src/style.css` only if the status line needs wrapping (keep compact)

## Inputs provided

- `LocalProjectControlsHandle.setSaveStatus`
- `formatPersistStatus` — may remain as detail after `saved`

## Acceptance criteria

- [ ] Click Load → status shows `loading` then `loaded` (or error) under the controls.
- [ ] Click Save → `saving` then `saved` (or error). Same for Save as.
- [ ] No extra modal.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Exact strings used; whether persist path still appears
2. Files touched
3. Tests run
4. Follow-ups / blockers
5. Suggested SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260901-02-save-load-status).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260901-02-save-load-status.md
2. docs/architecture/phase19-senexus-qol.md §19.9
3. src/projects/localProjectControls.ts
4. src/main.ts switchRace + saveCurrentRaceProject

Show loading→loaded and saving→saved under Save/Load. Error line on failure. No modal. Do not change remount speed (19.17), PiP, or World Authoring.
Report back per dispatch.
```
