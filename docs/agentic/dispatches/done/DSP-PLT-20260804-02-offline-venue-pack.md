# Dispatch DSP-PLT-20260804-02-offline-venue-pack

## Meta
- From orchestrator: BW → PLT (Phase 9.2 / was 6.6)
- Worker role: WORKER(DSP-PLT-20260804-02-offline-venue-pack)
- Priority: P0
- Phase: Phase 9 — Project LAN
- Related: RaceProject download, `public/races/`, service worker optional
- **Status: DONE** — PLT accepted 2026-08-04 → `done/`

## Goal

**Venue / offline pack**: operator can cache a race pack (project + linked fixtures/assets needed for that race) and reopen it without internet (local static or downloaded bundle).

## Background
- Save already downloads `project.json`.
- Air PCs may lose WAN but still have LAN or local files.
- No Hetzner — local folder / Electron `file` / browser cache are OK.

## In scope
1. Define pack bundle format (zip or folder manifest) OR documented “download pack” that includes project + referenced fixture URLs content.
2. Load path: open cached pack when offline / `?race=` miss (document precedence vs API/static).
3. HUD or PLT helper: “Download venue pack” / “Load pack file”.
4. Docs in `src/projects/README.md` + ops note.
5. Tests for manifest/parse; build green.

## Out of scope
- Auth roles (DSP-01)
- Calib profiles (CAL)
- Full PWA install UX polish
- Cloud sync

## Acceptance criteria
- [x] Can export a venue pack for `demo-istanbul` (or current race)
- [x] Can load that pack with network disabled (or simulated) and scene boots
- [x] Docs; tests green

## Worker paste block

```
You are WORKER(DSP-PLT-20260804-02-offline-venue-pack).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260804-02-offline-venue-pack.md
2. docs/contracts/race-project.md
3. src/projects/* (load/build/download)
4. docs/roadmap/phases-roadmap.md Phase 9.2

Implement offline/venue pack export + load. No auth roles, no calib schema.
Report back per dispatch.
```
