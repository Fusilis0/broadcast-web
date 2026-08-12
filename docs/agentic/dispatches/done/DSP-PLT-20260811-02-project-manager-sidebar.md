# Dispatch DSP-PLT-20260811-02-project-manager-sidebar

## Meta
- From orchestrator: BW → PLT (Phase 11.4 — folds old roadmap 11.2 + 11.4)
- Worker role: WORKER(DSP-PLT-20260811-02-project-manager-sidebar)
- Priority: P1
- Phase: Phase 11 — Unified ops sidebar & universal asset pipeline
- Prerequisite: `DSP-SCN-20260811-01-ops-sidebar-shell` (mounts the Project section)
- Design doc: `docs/architecture/unified-ops-sidebar.md` §3 item 1
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

Turn the sidebar's **Project** section (today just race select + Load/Save/Save as/Pack, migrated
as-is by `DSP-SCN-20260811-01`) into an actual project manager: list all known projects with
rename/duplicate/archive, and validate boat ids against the boat-name catalogue before Save. These
are old roadmap items **11.2** (project list: rename/archive/duplicate) and **11.4** (validate boat
ids vs catalogue), folded into the sidebar per the new design.

## Background

- `server/src/store.ts` — `listProjects`, `createProject`, `updateProject`, `deleteProject` already
  exist for the `/api/races` API (see `server/src/app.ts`). There is currently **no rename** (id is
  immutable by design — PUT requires `project.id === id`) and **no archive** flag.
- `src/projects/index.ts`, `writeRaceProject.ts` — client API wrapper.
- `src/scene/boatNames/index.ts` — `loadBoatNames`/`BoatNamesCatalogue` is the existing "boat
  catalogue" — `DEFAULT_BOAT_NAMES_URL`. `orphanBoatIds` (`src/scene/fleetRegistry.ts`) already
  detects ids with no catalogue entry — reuse it rather than re-deriving validation logic.
- Static-only mode (no `server/`): rename/duplicate/archive of on-disk `public/races/<id>/` packs
  isn't realistically writable from the browser — degrade gracefully (disable with a clear message)
  when `projectsApiBase` isn't configured, same pattern as existing Save/Save as air-role gating in
  `stubHud.ts`'s `applyProjectWritesEnabled`.

## In scope

1. **Rename**: since race ids are immutable in the current schema/API, implement rename as
   "duplicate under new id + name, then optionally delete the old one" (client-orchestrated: POST
   new, DELETE old) rather than changing server semantics — OR, if you judge it cleaner, add a
   dedicated server-side rename that copies-then-deletes atomically. Document whichever you choose
   and why; either is acceptable as long as revision/`If-Match` semantics on the existing project
   aren't broken for other clients mid-op.
2. **Duplicate**: POST a copy of the current project under a new id (prompt for id/name, same UX
   pattern as today's "Save as").
3. **Archive**: add an `archived?: boolean` (or `labels: ['archived']` reusing the existing
   `labels`/`parseLabels` mechanism already in `server/src/app.ts` `POST /api/races` — prefer this,
   it's already there) — archived projects hidden from the default project list/select but still
   loadable directly by id. Confirm `listProjects(db, label)` filtering already supports this or
   extend it minimally.
4. **Boat id validation**: before Save/Save as, run `orphanBoatIds` (or equivalent) against the
   active boat catalogue and surface a non-blocking warning (e.g. "boat ids not in catalogue: 41,
   57 — Save anyway?") rather than a hard block — ops must still be able to save mid-race with a
   late-registered boat.
5. Sidebar **Project** section UI: project list (with archived filter toggle), rename/duplicate/
   archive buttons per row or on the active project, validation warning surfaced on Save.
6. Tests: server-side label/archive filtering (`server/test/api.test.ts` patterns), client-side
   orphan-id warning trigger, duplicate/rename client flow (mock fetch).
7. Docs: `docs/ops/projects-api.md`, `src/projects/README.md`, `src/scene/README.md` (sidebar
   Project section).

## Out of scope

- Revision history / diff viewer (roadmap 11.8, unscheduled).
- Universal asset library (`DSP-PLT-20260811-01`).
- Any change to `RaceProject.id` immutability at the schema level — work within it.
- Hard-blocking Save on invalid boat ids (must stay a warning, not a block).

## Likely files

- Edit: `server/src/store.ts`, `app.ts` (archive/label filtering if it needs extending),
  `server/test/api.test.ts`
- Edit: `src/projects/index.ts`, `writeRaceProject.ts`, `src/scene/fleetRegistry.ts` (reuse, likely
  no changes needed), `src/scene/stubHud.ts` or new sidebar Project section module, `src/main.ts`
  (wiring), `src/style.css`
- Docs: `docs/ops/projects-api.md`, `src/projects/README.md`

## Inputs provided

- `docs/architecture/unified-ops-sidebar.md` §3 (Project section placement).
- Existing `labels`/`parseLabels` mechanism in `server/src/app.ts` and `validate.ts` for the
  archive-as-label approach.
- `orphanBoatIds` in `src/scene/fleetRegistry.ts` for boat-id validation.

## Acceptance criteria

- [x] Project list shows non-archived projects by default; archived ones filterable in/visible on
      request
- [x] Duplicate creates a new project id/name via existing create path; original untouched
- [x] Rename achieves an effective id/name change (via duplicate+delete or dedicated endpoint) —
      documented choice, no data loss on failure mid-op (i.e. don't delete old before new is
      confirmed created)
- [x] Archive hides a project from the default list without deleting it; still loadable by id
- [x] Save/Save as surfaces a non-blocking warning listing boat ids missing from the catalogue
- [x] Static-only mode (no API base): rename/duplicate/archive controls disabled with a clear
      message; existing download-only Save/Save as unaffected
- [x] `npm test --prefix server` + `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for PLT

## Worker paste block

```
You are WORKER(DSP-PLT-20260811-02-project-manager-sidebar).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260811-02-project-manager-sidebar.md
2. docs/architecture/unified-ops-sidebar.md (§3)
3. server/src/store.ts, app.ts, validate.ts
4. src/scene/fleetRegistry.ts (orphanBoatIds), src/scene/stubHud.ts (existing race row)

Turn the sidebar Project section into a real project manager: rename/duplicate/archive +
non-blocking boat-id catalogue validation before Save. Report back per dispatch.
```
