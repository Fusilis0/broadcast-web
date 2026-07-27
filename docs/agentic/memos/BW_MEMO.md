# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-27  
**Session role:** BW

## Current phase
**Phase 2 in progress.**  
- **2.1–2.2 done** (glTF boat + tags; TEL multi-boat + SCN fleet-registry; 71/71 tests)  
- **Next (BW pick):** **2.3** course + buoys (SCN-only)  
- **2.7** names deferred unless tags become the pain point  
Remote: https://github.com/Fusilis0/broadcast-web (private, **Fusilis0**)

## What works today
- Vite + TS + Three SPA; `npm run dev` / `test` / `build`
- TEL: mock | replay multi-boat via `boatIds` (default `21–24`); live still single `wsBoatUrl`
- GEO: EGM96 + ENU; pose bus multi-id keyed
- CAL: FOV 66.8832° + offset store + sliders
- SCN: fleet registry clones 2.1 template per id; tags by id; HUD/map multi-boat
- Contract: `poseBus` → `{ id, kind, position, rotation, fovHDeg, ts }`
- Config: `loadConfig().boatIds`; fleet fixture `/fixtures/telemetry/spine-fleet.json`

## Priority queue
1. **Land 2.1–2.2** — commit/push (still uncommitted on `main` locally)  
2. **2.3** course + buoys  
3. **2.4** multi-POV  
4. **2.7** name/colour JSON (after course, unless ops wants tags first)  
5. Parallel later: OUT **3.1** chroma  
6. Optional: live multi-URL TEL follow-up, VPS soak, CON deeplink, CV  

## Compaction recovery
Re-open BW with `docs/agentic/dispatches/BOOTSTRAP_BW.md`, then read this memo + `docs/roadmap/phases-roadmap.md`.

## Blockers
- None for 2.3  
- Live multi-boat soak blocked until TEL follow-up + VPS URLs  
- Remote behind: Phase 2 code not pushed yet
