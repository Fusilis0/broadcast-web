# PLT_MEMO

**Last updated:** 2026-08-12  
**Status:** Idle — `DSP-PLT-20260812-02` **accepted** (Electron Project Save UX)

## Phase 13 follow-up — PLT-02 accepted 2026-08-12
- `done/DSP-PLT-20260812-02-electron-project-save-ux` — Electron Save primary = `races.save`;
  Export = download; Load dropdown on change; name + root hint; works without API.
  Suite 476+23. Human checklist: Save → `public/races/<id>/` in `desktop:dev`.

## Phase 13 — PLT-01 accepted 2026-08-12
- `done/DSP-PLT-20260812-01-electron-local-races-save` — `races.save|list|read|getRoot`;
  dev→`public/races/`, `--file`→`userData/races/`; Save = download + local (+ API if set).
  Suite green. Human checklist: Save as → folder + dropdown → Load; Save overwrite; optional
  `desktop:file` userData path.
- PLT idle until BW opens further platform work.

## Phase 13 — wave 1 issued 2026-08-12 — superseded by accept above
User asked for a "project saves" folder (Save overrides on same name, creates new file on new
name) + a dropdown listing what's in it. **That folder already exists**: `public/races/` —
`listLocalRaceIds` (`src/projects/listLocalRaces.ts`) already drives the Project sidebar dropdown
from `public/races/index.json`, and `loadRaceProject` already reads `public/races/<id>/project.json`.
The only gap: nothing writes back into it today (Save only `downloadRaceProject()`s to the browser
Downloads folder). Added `docs/architecture/project-api-and-database.md` §10 — new **`races:*`**
Electron IPC (same shape as the existing `ndi:*` channels in `desktop/preload.cjs`/`main.cjs`) so
Save/Save as write straight into `public/races/` when running inside the studio shell, additive to
the existing download. **No new prompt/UI logic needed** — `promptSaveAsMeta`/`promptIdName`
already implement "same id → overwrite, new id → new file" exactly as asked; this is purely a new
write destination. Open question flagged in the doc: dev (`:5173`, writes straight into the repo)
vs. built `--file` mode (own `dist/races/` copy) need a decision on where writes land. Roadmap:
**13.8**. Do not start until BW dispatches.

## Phase 11 follow-up #3 — accepted 2026-08-12
- `done/DSP-PLT-20260811-03-electron-prompt-fixes` — **Save as** (`promptSaveAsMeta` in
  `src/main.ts`) and **Rename**/**Duplicate** (`promptIdName` in
  `src/projects/projectManagerPanel.ts`) now `await promptModal(...)` from
  `src/ui/promptModal.ts` (built by sibling `DSP-SCN-20260811-07`). Both helpers are `async`;
  callers updated. `window.alert` / `window.confirm` left alone (those work in Electron).
- `npm test` + `npm run build` green.
- BW accepted after driving the real Electron shell (not a browser tab) via
  `webContents.executeJavaScript`: clicked **Save as**, hit the id `promptModal`, **Cancel** →
  clean abort, no leftover modal; re-ran, submitted the id modal, hit the name `promptModal`,
  **Escape** → clean abort, no crash either time. Rename/Duplicate share the same `promptIdName` →
  `promptModal` primitive proven above; not separately re-driven live (needs a configured
  `projectsApiBase`) — accepted on code review + green suite. Full write-up:
  `docs/architecture/world-authoring-workspace.md` § "Follow-up #3".

## Phase 9 (done)
- **9.1** auth roles LAN — `done/DSP-PLT-20260804-01`
- **9.2** offline venue pack — `done/DSP-PLT-20260804-02`

## Phase 11 (accepted)
Design: `docs/architecture/unified-ops-sidebar.md`

| # | DSP | Result |
| --- | --- | --- |
| 11.3 | `done/DSP-PLT-20260811-01` | `/api/assets` + `public/assets/library/` + Library sidebar |
| 11.4 | `done/DSP-PLT-20260811-02` | Rename=dup+delete; archive=`labels:archived`; Save warns on catalogue orphans |

### Notes
- Default `GET /api/races` excludes archived; `?includeArchived=1` / `?label=archived`
- PUT accepts `{ project, labels }` wrapper
- Static-only: manager controls disabled; download Save/Save as unchanged
