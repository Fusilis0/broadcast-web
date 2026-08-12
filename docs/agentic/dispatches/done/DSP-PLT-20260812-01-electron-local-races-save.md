# Dispatch DSP-PLT-20260812-01-electron-local-races-save

## Meta
- From orchestrator: BW → PLT (Phase 13.8)
- Worker role: WORKER(DSP-PLT-20260812-01-electron-local-races-save)
- Priority: P1
- Phase: Phase 13 — Local project saves
- Prerequisite: none
- Parallel-safe with: `DSP-OUT-20260812-01`, `DSP-SCN-20260812-01` (OUT also edits
  `desktop/preload.cjs` + `desktop/main.cjs` — **add only `races:*`**; do not refactor NDI)
- Design: `docs/architecture/project-api-and-database.md` §10
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 418+23 green; human Electron Save/Load checklist still recommended)

## Goal

In the Electron studio shell, **Save** / **Save as** write RaceProject JSON into the existing
project-saves folder layout (`<racesDir>/<id>/project.json` + `index.json` upsert) so the Project
dropdown lists real local saves — not only browser Downloads. Plain Chrome stays download-only.

## Background

- Folder already exists conceptually: `public/races/` + `public/races/index.json`.
- Dropdown already exists: `listLocalRaceIds` / Project sidebar.
- Gap: write side. Today Save only `downloadRaceProject()`.
- Prompt flows already correct (override current id vs new id via `promptModal`).

### BW locks (open questions resolved for this DSP)

1. **Write roots**
   - `desktop:dev` / Vite URL mode: write to repo **`public/races/`** (resolve from `desktop/` →
     repo root). Vite serves updates immediately.
   - `--file` / packaged: write to Electron **`app.getPath('userData')/races/`** (writable). Expose
     `races.list` IPC (or equivalent) so the SPA can list/load from userData when not using
     static `/races/…`. Document both paths in `desktop/README.md`.
2. **Coexist with API:** file save is **additive**. If `projectsApiBase` is set, keep existing
   POST/PUT behavior; still write local file in Electron when `races` bridge exists (unless you
   find a clear conflict — then prefer API write + local write both, report if one should win).
3. **Git hygiene:** no new ignore scheme in this DSP. Saving into `public/races/` in dev may dirty
   git — acceptable for studio; document in ops README.

## In scope

1. `desktop/preload.cjs` + `main.cjs`: `broadcastStudio.races.save(project)` → mkdir + write
   `project.json` + upsert `index.json` (never drop other ids). Validate id with same safe-id
   rules as SPA (`isSafeRaceId` equivalent in main or reject bad payloads).
2. Optional but recommended: `races.list()` / `races.read(id)` for userData mode so Load/dropdown
   work when static `/races` is not the write target.
3. SPA: extend studio bridge types; on Save / Save as, if `races` bridge present, await
   `races.save(...)` **in addition to** existing download (download remains fallback). Refresh
   project list after successful local save.
4. Chrome without bridge: unchanged (download only).
5. Docs: `desktop/README.md`, `src/projects/README.md`, `docs/ops/projects-api.md` (short note:
   Electron local folder vs HTTP API).
6. Tests: pure helpers for index upsert / path choice if extracted; SPA unit tests with mocked
   bridge. Manual Electron: Save as new id → appears in dropdown → Load.

## Out of scope

- NDI multi-sender work (OUT).
- SQLite/API schema changes.
- Rename/duplicate/archive semantics changes (already shipped).
- Replacing download entirely.
- SCN/OUT product features.

## Likely files

- `desktop/main.cjs`, `desktop/preload.cjs`, `desktop/README.md` (races only)
- `src/output/studioBridge.ts` **or** a small `src/projects/racesBridge.ts` (prefer projects-owned
  types if that avoids fighting OUT's parallel bridge edits — coordinate on `BroadcastStudioBridge`
  shape)
- `src/main.ts` (save / saveAs paths), `src/projects/writeRaceProject.ts` / panel / list helpers
- `src/projects/README.md`, `docs/ops/projects-api.md`

## Inputs provided

- `docs/architecture/project-api-and-database.md` §10
- Existing `promptSaveAsMeta` / `promptIdName` / `downloadRaceProject`

## Acceptance criteria

- [ ] Electron Save overwrites `<racesDir>/<currentId>/project.json` and keeps id in index
- [ ] Electron Save as creates new folder + index entry; dropdown shows the new id after refresh
- [ ] Chrome path still downloads; no crash if `races` missing
- [ ] `--file` / userData path documented and does not require writing into read-only `dist/`
- [ ] `npm test` + `npm run build` green
- [ ] Manual Electron checklist in report-back

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for PLT
