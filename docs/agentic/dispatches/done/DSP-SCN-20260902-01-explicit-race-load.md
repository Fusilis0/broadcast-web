# Dispatch DSP-SCN-20260902-01-explicit-race-load

## Meta
- From orchestrator: SCN (operator follow-up after 19.9)
- Worker role: WORKER(DSP-SCN-20260902-01-explicit-race-load)
- Priority: P0
- Phase: 19.9 follow-up — Load applies only on button (not list pick)
- Related: `done/DSP-SCN-20260901-02-save-load-status.md`

## Goal

Choosing a race in the Load **dropdown / list must not** switch the live project. **Click Load** is the only apply: then load **everything** (chrome, 2D, fleet/boats, 3D) in that one `switchRace`. No two-step “pick loads some, Load loads boats.”

## Background

Electron `folderMode` currently calls `onRaceLoad` on `<select>` `change` (`localProjectControls.ts`). Chrome already waits for the Load button. Operator: pick = nothing; Load click = full apply, immediately.

This is **not** 19.17 (paint lists before Cesium). Do not split remount. Do not auto-load on select.

## In scope

1. Select `change`: copy id into the text field only. **Never** `onRaceLoad`.
2. Load button (and Enter in the id field) → `onRaceLoad` → existing `switchRace` (full pack).
3. Fix folderMode tests that expect `change` → `onLoad`. Hint text: dropdown does **not** load on change.
4. Same rule if any other Project list click currently calls `switchRace` without Load (do not make API Dup/Rename load the canvas).

## Out of scope

- 19.17 remount / Cesium-later
- PiP, World toggle, inspector, library picker, Cesium vendor
- Changing `loadRaceProject` / persist APIs

## Likely files

- `src/projects/localProjectControls.ts` + `localProjectControls.test.ts`
- `src/projects/README.md` / `src/scene/README.md` one line
- `src/main.ts` only if a second auto-load path exists (prefer not)

## Acceptance criteria

- [ ] Changing the race `<select>` does not call `onRaceLoad` (folderMode **and** Chrome).
- [ ] Load click (and Enter in id field) calls `onRaceLoad` once with the chosen id.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Which listeners no longer auto-load
2. Files / tests
3. Follow-ups
4. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260902-01-explicit-race-load).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260902-01-explicit-race-load.md
2. src/projects/localProjectControls.ts (select change vs Load button)
3. src/main.ts switchRace / onRaceLoad

Select race = pick only (sync the id field). Click Load = full switchRace. No load on dropdown change in Electron folderMode. No 19.17 remount split, no Cesium vendor.
Report back per dispatch.
```
