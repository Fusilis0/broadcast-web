# Dispatch DSP-PLT-20260812-02-electron-project-save-ux

## Meta
- From orchestrator: BW → PLT
- Worker role: WORKER(DSP-PLT-20260812-02-electron-project-save-ux)
- Priority: P0
- Phase: Phase 13.8 follow-up
- Prerequisites: `done/DSP-PLT-20260812-01` (`races:*` IPC exists)
- Related: user 2026-08-12 — Project tab shows no useful change; Save should write straight into
  the repo projects folder with the **name visible**; Load = dropdown (or folder list) of that
  folder
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 476+23; human Electron Save checklist recommended)

## Goal

In **Electron studio**, make Project UX match the ask:

1. **Current project name** clearly shown next to Save.
2. **Save** writes immediately to the races folder (`public/races/` in `desktop:dev`) via
   `broadcastStudio.races.save` — primary path, not “download-first / maybe file”.
3. **Load** is a **dropdown** (or list) of projects in that folder; picking one loads it.
4. Project sidebar section must work for this **without** requiring `projectsApiBase` / SQLite.

## Background

- File write already exists (`races.save` / `list` / `read`) but UI still emphasizes download +
  API manager (`projectManagerPanel` is API-oriented; HUD hint still “Save=download”).
- `listLocalRaceIds` already merges static index + races bridge when present — wire that into an
  obvious Load control and refresh after Save.

## In scope

1. **Project section UI (Electron when `getRacesBridge()` present):**
   - Label/field: **Project name** (and id) for the active pack.
   - **Save** button: overwrite current id → `races.save` (+ keep download as optional secondary
     or “Export…” if you want; primary click = folder write). Show success/fail status
     (path or error).
   - **Save as** / new name: prompt id+name (existing `promptModal`) → save new file → refresh
     dropdown → switch active to new id.
   - **Load** dropdown: ids/names from `races.list` + static fallback; on change → `races.read` /
     `loadRaceProject` → existing apply path.
2. When **not** in Electron (no races bridge): keep download / static `/races` behavior; don’t
   pretend folder write works.
3. Refresh dropdown after every successful local save; show `getRoot()` path in a small hint
   (e.g. `saving to: …/public/races`).
4. Align/disable conflicting copy (“Save=download only”) when bridge is present.
5. Docs: `src/projects/README.md`, `docs/ops/projects-api.md` (Electron folder vs API).
6. Tests: mocked races bridge — Save calls `save`, list populates select, load calls read/apply
   hook.

## Out of scope

- Redesigning SQLite API archive/rename (keep working when API configured).
- NDI / SCN map bugs.
- Gitignore policy for scratch saves.

## Likely files

- `src/projects/projectManagerPanel.ts` and/or Project section in `stubHud.ts` / `main.ts`
- `src/projects/listLocalRaces.ts`, `racesBridge.ts`, `writeRaceProject.ts`
- `src/style.css` (minimal)
- Docs above

## Acceptance criteria

- [ ] Electron: Project UI shows active **name**; Save writes under races root without needing API
- [ ] Electron: dropdown lists folder projects; selecting one loads that pack
- [ ] Save as creates new id folder + appears in dropdown
- [ ] Chrome without bridge: no broken “folder save”; download/static still works
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (Electron Save → `public/races/<id>/` checklist)
4. Follow-ups / blockers
5. Suggested memo bullets for PLT
