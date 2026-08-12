# Handoff HO-PLT-BW-20260804-01 — Phase 9 PLT slice done

## From → To
PLT → BW

## Type
completed-worker-summary (FYI)

## Summary
Phase **9.1** and **9.2** accepted. LAN auth roles + offline venue pack are shipped. Milestone **V1-B** still needs **CAL 9.3** (calib profiles on RaceProject).

## Decisions / facts
- **9.1** `DSP-PLT-20260804-01` → `done/` — editor vs air bearer; writes need `PROJECTS_API_EDITOR_TOKEN`; air via `projectsRole` / `?role=air` disables Save
- **9.2** `DSP-PLT-20260804-02` → `done/` — `broadcast-web-venue-pack` JSON + IndexedDB; Pack ↓/↑; load API → static → cache
- Tests: SPA 320 + server 15; builds green (per worker reports)
- Ops: `docs/ops/projects-api.md`, `docs/ops/venue-pack.md`

## Asks of receiver
- [ ] Track V1-B gate until CAL accepts `DSP-CAL-20260804-01`
- [ ] Optional: roadmap 9.1 / 9.2 → Done when convenient

## Artifacts
- `docs/agentic/dispatches/done/DSP-PLT-20260804-01-auth-roles-lan.md`
- `docs/agentic/dispatches/done/DSP-PLT-20260804-02-offline-venue-pack.md`
- `docs/agentic/memos/PLT_MEMO.md`

## Urgency
P1
