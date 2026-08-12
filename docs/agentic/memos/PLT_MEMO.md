# PLT_MEMO

**Last updated:** 2026-08-12  
**Status:** Idle — Phase 11 follow-up #3 accepted (`DSP-PLT-20260811-03`)

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
