# Handoff HO-BW-20260804-03 — Open Phase 9 (Project LAN)

## To
**PLT** (primary) + **CAL** (9.3 calib profiles)

## From
BW — 2026-08-04

## Context
- Phase **8 complete** — Milestone **V1-A** (SCN) met.
- **No Hetzner** (Phase 12 deferred). Venue = local studio + LAN `server/` stub + static packs.
- Stream map stays DOM-only.

## Issue workers

| # | Owner | DSP | Topic |
| --- | --- | --- | --- |
| 9.1 | PLT | `DSP-PLT-20260804-01-auth-roles-lan` | Editor vs air-only bearer stub |
| 9.2 | PLT | `DSP-PLT-20260804-02-offline-venue-pack` | Offline / venue pack cache |
| 9.3 | CAL (+ PLT schema) | `DSP-CAL-20260804-01-calib-profiles-on-project` | Per-POV calib on RaceProject |

Paths under `docs/agentic/dispatches/active/`.

## Orchestrator setup
1. **PLT chat:** `BOOTSTRAP_PLT.md` → this handoff → update `PLT_MEMO` → open workers for 9.1 + 9.2.
2. **CAL chat:** `BOOTSTRAP_CAL.md` → this handoff → update `CAL_MEMO` → open worker for 9.3 (coordinate RaceProject field with PLT).
3. Parallel OK for all three.
4. Accept → `done/` → report BW for Milestone V1-B.

## Out of scope
Phase 10 cutover, console 3.6 ack, Phase 12 cloud, SCN visual polish.
