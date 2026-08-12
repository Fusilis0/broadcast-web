# Dispatch DSP-PLT-20260804-01-auth-roles-lan



## Meta

- From orchestrator: BW → PLT (Phase 9.1 / was 6.5)

- Worker role: WORKER(DSP-PLT-20260804-01-auth-roles-lan)

- Priority: P0

- Phase: Phase 9 — Project LAN

- Related: `server/`, `projectsApiBase`, `docs/architecture/project-api-and-database.md`

- **Status: DONE** — PLT accepted 2026-08-04



## Goal



LAN-ready **auth stub**: distinguish **editor** (can write RaceProject) vs **air-only** (read/load only). Bearer token enough — not full IdP.



## Background

- API stub exists; writes may already check a token.

- v1 needs clear roles for studio PCs without public cloud.



## In scope

1. Roles: at least `editor` | `air` (names flexible; document).

2. Server: reject unauthorized writes (401/403); reads remain open for air `?race=` unless you document otherwise.

3. SPA: wire Save / Save as / API write to send bearer; air-only mode hides or disables write UI (config or query flag OK).

4. `.env.example` + `docs/ops/projects-api.md` update for LAN.

5. Server + SPA tests; build green.



## Out of scope

- OAuth / multi-tenant

- Console deep-link token (Phase 10 / CON)

- Offline pack cache (DSP-02)

- Calib schema (CAL DSP)



## Acceptance criteria

- [x] Write without token fails; with editor token succeeds against local stub

- [x] Air-only config cannot Save as to API (UI and/or client guard)

- [x] Docs; tests green



## Report back



1. **Summary:** LAN editor vs air bearer stub. Server: `PROJECTS_API_EDITOR_TOKEN` (legacy `PROJECTS_API_TOKEN`) required for writes; optional `PROJECTS_API_AIR_TOKEN` → 403 on write; reads stay open. SPA: `projectsRole` / `projectsApiToken` + `?role=air`; air disables Save/Save as UI and skips API write; editor sends bearer on POST/PUT.

2. **Files:** `server/src/auth.ts`, `config.ts`, `app.ts`, `index.ts`, `server/test/auth.test.ts`, `api.test.ts`, `src/projects/projectsAuth.ts` (+ test), `writeRaceProject.ts` (+ test), `index.ts`, `src/config/types.ts`, `loadConfig.ts` (+ test), `src/main.ts`, `src/scene/stubHud.ts`, `features/editor/editorPanel.ts`, `.env.example`, `docs/ops/projects-api.md`, `server/README.md`, `src/projects/README.md`, `src/config/README.md`, `docs/architecture/project-api-and-database.md` §7

3. **Tests:** `npm test` — SPA 320 + server 15 passed; `npm run build` green

4. **Follow-ups:** Offline pack (DSP-02); console deep-link token (CON/Phase 10); no OAuth

5. **PLT memo bullets:** `DSP-PLT-20260804-01` DONE — editor/air bearer roles; air `?role=air` / `projectsRole: air` disables Save; `PROJECTS_API_EDITOR_TOKEN` locks writes



## Worker paste block



```

You are WORKER(DSP-PLT-20260804-01-auth-roles-lan).



Mandatory reads:

1. docs/agentic/dispatches/active/DSP-PLT-20260804-01-auth-roles-lan.md

2. docs/architecture/project-api-and-database.md

3. docs/ops/projects-api.md

4. server/ + src/projects/writeRaceProject.ts



Implement LAN editor vs air-only bearer stub. No OAuth, no offline pack, no calib profiles.

Report back per dispatch.

```

