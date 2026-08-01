# Dispatch DSP-PLT-20260731-03-project-api-db-design

**Status:** Done / archived (2026-08-01) — accepted; next `DSP-PLT-20260801-01` stub

## Meta
- From orchestrator: PLT (BW: Phase **6.4** first slice — design + API contract)
- Worker role: WORKER(DSP-PLT-20260731-03-project-api-db-design)
- Priority: P1
- Phase: Phase 6.4 — Project API + database (design)
- Related: `docs/contracts/race-project.md`; local packs under `public/races/`
- BW ask: **design + contract first** — no full production DB stack unless a tiny local spike proves the shape

## Goal

Define how RaceProjects move from **static `public/races/` packs** to a **persistable API + database** so another studio PC can load the same project over HTTPS. Deliver schema/API contract and recommended stack; implementation is a follow-up DSP unless a minimal in-repo stub is needed to validate the contract.

## Background

- V1 local packs work (`?race=`, save/download, picker) — Milestone path toward F.
- Hetzner serves static SPA only today; API will live on a VPS (same or sibling host).
- Auth (6.5) comes later — design may note “open write for studio LAN / token later”.
- Do not break local static packs; API is additive.

## In scope

1. Design doc `docs/architecture/project-api-and-database.md` (or under `docs/ops/` if better):
   - Goals / non-goals for 6.4
   - Resource model (project id, revision, JSON body, updatedAt, optional labels)
   - REST (or equivalent) endpoints: list / get / put / create / delete (minimal set)
   - Storage recommendation (e.g. SQLite file on VPS vs Postgres) + rationale
   - How SPA loads: `GET /api/races/:id` vs static `/races/:id/project.json` fallback
   - Migration path from existing `public/races/` packs
   - Security note: no public anonymous write in production; stub auth placeholder OK
2. Update `docs/contracts/race-project.md` with **API section** (status draft → “API draft”)
3. Links from race-projects architecture § + roadmap 6.4 note
4. Optional: OpenAPI-ish YAML snippet in docs (not required)

## Out of scope

- Full auth roles (6.5)
- Production deploy of the API on Hetzner (human/CI later)
- Rewriting SCN editor
- 5.4 egress
- Dropping static `public/races/` support

## Acceptance criteria

- [ ] Design doc answers: stack, endpoints, revision, static fallback
- [ ] Race-project contract updated with API draft section
- [ ] No breaking change to local `?race=` static load
- [ ] Clear “next DSP = implement stub server” suggestion

## Report back

Standard five sections. If a minimal `server/` stub is clearly smaller than arguing the contract, call it out as optional follow-up — do not expand scope without noting it.

## Worker paste block

```
You are WORKER(DSP-PLT-20260731-03-project-api-db-design).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260731-03-project-api-db-design.md
2. docs/contracts/race-project.md
3. docs/architecture/race-projects-and-world-authoring.md
4. docs/ops/hetzner-static-deploy.md

Deliver project API/DB design + contract update. Prefer docs-only. Report back per dispatch.
```
