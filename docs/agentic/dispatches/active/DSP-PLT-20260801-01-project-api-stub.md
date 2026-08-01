# Dispatch DSP-PLT-20260801-01-project-api-stub

## Meta
- From orchestrator: PLT (BW: Phase **6.4** impl — stub server)
- Worker role: WORKER(DSP-PLT-20260801-01-project-api-stub)
- Priority: P0
- Phase: Phase 6.4 — Project API + database (stub)
- Related: `docs/architecture/project-api-and-database.md` (accepted design)
- Prior: `DSP-PLT-20260731-03` design done

## Goal

Implement a **minimal Node + SQLite** projects API matching the accepted design: seed from `public/races/`, REST CRUD with optimistic `revision`, bearer stub on writes, ops proxy snippet, and SPA `projectsApiBase` with **try-API-then-static** fallback so local `?race=` never breaks.

## Background

- Design: [`project-api-and-database.md`](../../architecture/project-api-and-database.md)
- Contract: [`race-project.md`](../../contracts/race-project.md) (API draft)
- Static packs remain the default when API is unset/unreachable
- Auth roles (6.5) later — bearer stub only for writes

## In scope

1. **`server/`** (or equivalent) package:
   - SQLite schema + migrations/bootstrap
   - Endpoints: list / get / create / put / delete per design
   - Seed from `public/races/*/project.json` on first boot (idempotent)
   - Bearer token stub for mutating methods (env `PROJECTS_API_TOKEN` or similar)
   - README: how to run locally (`npm run server` or `npm run --prefix server …`)
2. **Ops:** short addendum in design doc or `docs/ops/projects-api.md` — nginx/Caddy `/api` proxy example
3. **SPA client:**
   - Optional `projectsApiBase` in config types + loadConfig
   - `loadRaceProject` (or equivalent): if base set, try API get → on miss/fail → static `/races/<id>/project.json`
   - List/picker may use API when base set (keep static index fallback)
4. Tests: API unit/integration where practical; SPA fallback tests; `npm test` + build green

## Out of scope

- Production Hetzner deploy of the API (human later)
- Full auth roles (6.5)
- Dropping static packs
- OpenAPI file polish (optional)
- 5.4 egress, NDI changes

## Acceptance criteria

- [ ] Stub server runs locally; seed shows demo race(s)
- [ ] CRUD + revision conflict behavior matches design
- [ ] SPA with `projectsApiBase` loads via API; without it / on API down → static still works
- [ ] Proxy snippet documented
- [ ] `npm test` + `npm run build` green

## Report back

Standard five sections. Suggest follow-up: human VPS deploy of stub + 6.5 auth when needed.

## Worker paste block

```
You are WORKER(DSP-PLT-20260801-01-project-api-stub).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260801-01-project-api-stub.md
2. docs/architecture/project-api-and-database.md
3. docs/contracts/race-project.md
4. src/projects/ (load/list paths)
5. src/config/types.ts

Implement Node+SQLite stub + SPA projectsApiBase try-API-then-static.
Static packs must keep working. Report back per dispatch.
```
