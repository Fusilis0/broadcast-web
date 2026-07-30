# Dispatch DSP-PLT-20260730-01-race-project-local-pack

## Meta
- From orchestrator: PLT (BW: **4.2** editor done → open Phase **6.1** local packs)
- Worker role: WORKER(DSP-PLT-20260730-01-race-project-local-pack)
- Priority: P0
- Phase: Phase 6.1 — RaceProject schema + local static pack (no DB yet)
- Related: `docs/architecture/race-projects-and-world-authoring.md` §3; CON deeplink `race`
- BW ask: load a race pack from `public/races/<id>/` via `?race=`; merge into boot; SCN/CON thin wire OK; no database, no NDI

## Goal

Define a **RaceProject** JSON schema and ship **one demo pack** on disk so `?race=demo-istanbul` (or similar) loads origin, fleet ids/names URLs, povIds, feature list (or fixture URLs), and output defaults. Persist path is still static files — API/DB is a later DSP. Editor export should be document-compatible with the pack’s `features` field where practical.

## Background

- Map editor exports `{ features: WorldFeature[] }` as `world-features.json`
- Deeplink already parses `race` but does not load a pack
- Today boot uses many `*Url` keys in `config.json`
- Design: pack folder or single JSON under `public/races/<id>/`

## In scope

### 1. Schema + docs

1. `docs/contracts/race-project.md` (or `src/projects/README.md`) — RaceProject fields, version, examples
2. TypeScript types in `src/projects/types.ts` (new module owned PLT+SCN)

### 2. Demo pack on disk

3. `public/races/demo-istanbul/` (or single `project.json`) including at least:
   - id, name, origin, boatIds, povIds
   - `features` array **or** pointers to existing course/sponsors/flags fixtures
   - optional boatNamesUrl / replayUrl / output defaults
4. Prefer embedding or referencing current demo Istanbul content so visual parity holds

### 3. Loader + boot wire

5. `loadRaceProject(id)` fetches pack; validate lightly; return typed project
6. CON/main: if `parseConsoleDeeplink().race` set → load pack → apply origin / boatIds / povIds / features (via SCN `setLayoutFeatures` + remount) and any URL overrides
7. If `race` missing or load fails → existing `config.json` boot (warn, don’t crash)
8. Document example: `http://127.0.0.1:5173/?race=demo-istanbul`

### 4. Tests

9. Unit tests: parse/validate minimal project; reject garbage
10. `npm test` + `npm run build` green

## Out of scope

- Database / CRUD API (6.4)
- Full project list UI create/duplicate (6.2) — optional tiny “loaded project=…” HUD label OK
- GeoJSON (4.4), stream PiP (4.2b), NDI
- Auth

## Likely files

- `src/projects/*`, `docs/contracts/race-project.md`
- `public/races/demo-istanbul/**`
- `src/console/*` or `main.ts` apply path
- `src/config` merge helpers if needed

## Acceptance criteria

- [ ] Schema documented + typed
- [ ] Demo pack exists under `public/races/`
- [ ] `?race=<id>` loads pack and affects boot (origin and/or features/fleet)
- [ ] Missing race → normal config boot
- [ ] `npm test` + `npm run build` green
- [ ] No DB / NDI

## Report back

Standard five sections; suggested PLT + CON + SCN memo bullets.

## Worker paste block

```
You are WORKER(DSP-PLT-20260730-01-race-project-local-pack).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260730-01-race-project-local-pack.md (full)
2. docs/architecture/race-projects-and-world-authoring.md §3
3. docs/contracts/console-deeplink.md (race param)
4. src/console/* + src/main.ts boot
5. src/scene/features (WorldFeature export shape from editor)

Implement local RaceProject pack + ?race= load. No DB, no NDI, no editor rewrite.
Report back per dispatch.
```
