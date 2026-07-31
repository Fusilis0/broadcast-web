# Dispatch DSP-SCN-20260731-01-race-project-save-picker

## Meta
- From orchestrator: SCN (BW: **6.1** accepted → open **6.2** local pack UX)
- Worker role: WORKER(DSP-SCN-20260731-01-race-project-save-picker)
- Priority: P0
- Phase: Phase 6.2 — Local pack CRUD UX (save + picker; no DB)
- Related: `docs/contracts/race-project.md`, PLT `src/projects/*`, map editor export
- BW ask: close the loop — save current scene as RaceProject JSON download; pick among known local races; no database
- **Status: DONE** (worker report accepted by BW 2026-07-31)

## Goal

Let ops **download a full RaceProject** (not only `world-features.json`) from the current editor/boot state, and **switch** among discovered local packs under `/races/` (or a small hardcoded list including `demo-istanbul`) without a server DB. PLT owns schema/load; SCN owns editor/HUD UX; thin PLT helpers OK.

## Background

- 6.1: `loadRaceProject`, `applyRaceProject`, `?race=`
- Editor: exports `{ features }`; project also needs origin, boatIds, povIds, optional *Url fields
- Static hosting cannot write into `public/races/` from the browser — **download JSON** is the V1 “save”; human drops file into repo or future API

## In scope

1. **Build RaceProject from runtime state**
   - Helper (PLT or SCN): gather origin, boatIds, povIds, current `WorldFeature[]` (from editor store if present, else adapters), plus sensible URL fields from config/project
   - `downloadRaceProject(project)` → `project.json` (RaceProject schema)
2. **HUD / editor actions**
   - **Save project** button (editor mode or always) → download
   - Optional: id/name fields before download (defaults `edited-<timestamp>` / current name)
3. **Race picker**
   - Dropdown or list: at least `demo-istanbul` + any ids from a lightweight manifest
   - Manifest options (pick simplest that works):
     - `public/races/index.json` listing ids, **or**
     - hardcode `demo-istanbul` + allow typing an id
   - On pick: `loadRaceProject` → apply → remount features (same as `?race=`)
4. Document in `src/projects/README.md` + features editor README: save = download; put file in `public/races/<id>/` to persist in git
5. Tests for project-build helper; `npm test` + `npm run build` green

## Out of scope

- Writing files into `public/` from the browser
- Database / API (6.4)
- Auth, GeoJSON, NDI, stream PiP
- Full rename/archive library UI

## Likely files

- `src/projects/buildRaceProject.ts` (or similar), tests
- `public/races/index.json` (optional)
- `src/scene/stubHud.ts` / editor panel, `main.ts`
- READMEs

## Acceptance criteria

- [ ] Save downloads valid RaceProject JSON including features when editor has them
- [ ] Can switch to `demo-istanbul` (and typed/manifest id) at runtime
- [ ] `?race=` still works
- [ ] Docs explain download → folder drop workflow
- [ ] `npm test` + `npm run build` green
- [ ] No DB / NDI

## Report back

Standard five sections; suggested SCN + PLT memo bullets.

## Worker paste block

```
You are WORKER(DSP-SCN-20260731-01-race-project-save-picker).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260731-01-race-project-save-picker.md (full)
2. docs/contracts/race-project.md
3. src/projects/* (load/apply/types)
4. src/scene/features/editor/* + layout store
5. src/main.ts boot / ?race= path

Implement save-download + local race picker. No DB, no NDI, no API write.
Report back per dispatch.
```
