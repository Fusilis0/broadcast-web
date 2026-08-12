# Dispatch DSP-CAL-20260804-01-calib-profiles-on-project

## Meta
- From orchestrator: BW → CAL (+ PLT schema touch) (Phase 9.3 / was 6.7)
- Worker role: WORKER(DSP-CAL-20260804-01-calib-profiles-on-project)
- Priority: P0
- Phase: Phase 9 — Project LAN
- Related: `offsetsStore`, RaceProject, Save/Load
- **Status: DONE** (CAL worker + BW accepted 2026-08-04 � Phase 9 / V1-B)

## Goal

Persist **per-POV calibration offsets** on the RaceProject so Load / `?race=` restores yaw/pitch/roll/FOV/alt (etc.) for each `povIds` entry — same knobs as the calib panel.

## Background
- Sliders write `offsetsStore` by device id; not yet in `project.json`.
- Soft field on RaceProject preferred (parse must not break old packs).

## In scope
1. Schema: e.g. `calibration: { byPovId: { "1": { yaw, pitch, roll, fov, alt, … } } }` — match store fields; document in `race-project.md`.
2. Save / Save as / `buildRaceProject`: embed current offsets for known POV ids.
3. Load / applyRaceProject: hydrate `offsetsStore` before/with pose apply.
4. Soft-ignore unknown keys; omit empty.
5. Tests parse + round-trip; CAL + projects README notes; build green.

## Out of scope
- CV auto-calib
- Auth / offline zip (PLT)
- Changing FOV default constant

## Likely files
- `src/calibration/offsetsStore.ts`, `offsetSliders.ts`
- `src/projects/types.ts`, `parseRaceProject.ts`, `buildRaceProject.ts`
- `src/main.ts` save/load wire
- `docs/contracts/race-project.md`

## Acceptance criteria
- [ ] Adjust calib on POV 1 → Save as → reload pack → offsets restored
- [ ] Old packs without `calibration` still load
- [ ] Docs + tests; build green

## Worker paste block

```
You are WORKER(DSP-CAL-20260804-01-calib-profiles-on-project).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-CAL-20260804-01-calib-profiles-on-project.md
2. docs/contracts/race-project.md
3. src/calibration/offsetsStore.ts + offsetSliders.ts
4. src/projects/buildRaceProject.ts, parseRaceProject.ts, main.ts save/load

Persist per-POV calib on RaceProject round-trip. Soft field; no CV, no auth, no venue zip.
Report back per dispatch. Coordinate field name with PLT if parse helpers need a tiny PLT touch.
```
