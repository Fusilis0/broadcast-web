# Dispatch DSP-PLT-20260803-01-project-save-as-load

## Meta
- From orchestrator: BW (ops feedback 2026-08-03)
- Worker role: WORKER(DSP-PLT-20260803-01-project-save-as-load)
- Priority: P1
- Phase: 6.2+/6.4 — Save as / Load with fleet + origin
- Related: `src/projects/*`, `server/`, SCN HUD Save/picker, world-anchor UI DSP
- BW ask: Save As (boats, drones, world anchor, …) and Load that config again
- **Status: DONE** (BW accepted 2026-08-03)

## Goal

Clear **Save** / **Save as** / **Load** so a project includes fleet ids/names, POV ids, world origin, features URLs, and can be reopened later (download + optional API stub write).

## Background

- Save today = download `project.json` (SCN 6.2). Load = `?race=` / HUD picker / static `/races/<id>/`.
- API stub exists (`server/`) but SPA path is still primarily static + download.
- Ops need Save as new id including runtime Fleet edits + origin.

## In scope

1. **Save as:** prompt/fields for new `id` + `name`; build RaceProject from runtime (origin, boatIds, povIds, boat name catalogue if available, features, URLs); download JSON; if `projectsApiBase` available, `PUT`/`POST` to stub.
2. **Save:** overwrite current project id (download + optional API).
3. **Load:** keep picker + typed id; after load, Fleet panel + origin fields reflect pack.
4. Ensure `buildRaceProject` pulls Fleet session boats/names + origin from world-anchor UI when present.
5. Docs: Save = download (git drop) vs Save as; API optional when server running.
6. Tests for build payload including origin + fleet; build green.

## Out of scope

- Auth (6.5)
- Free cam / NDI
- Live socket hygiene
- Hetzner production DB

## Acceptance criteria

- [x] Save as downloads JSON with origin + boatIds + povIds from current session
- [x] Load restores those fields into runtime (and Fleet/origin UI if present)
- [x] Optional API write works against local stub when configured
- [x] `npm run build` green; projects + server tests green (`src/telemetry/live.test.ts` failures are TEL DSP hygiene — out of scope)

## Worker paste block

```
You are WORKER(DSP-PLT-20260803-01-project-save-as-load).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260803-01-project-save-as-load.md
2. docs/contracts/race-project.md
3. src/projects/*
4. server/ README + projects API
5. DSP-SCN-20260803-02-world-anchor-ui (origin fields)

Implement Save / Save as / Load loop for RaceProject including fleet + origin. Coordinate SCN HUD buttons.
Report back per dispatch.
```
