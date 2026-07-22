# Dispatch DSP-PLT-20260722-01-scaffold-vite-three

## Meta
- From orchestrator: PLT
- Worker role: WORKER(DSP-PLT-20260722-01-scaffold-vite-three)
- Priority: P0
- Phase: Phase 0 — Foundations (roadmap 0.3, 0.4, 0.7)
- Related handoffs: none
- **Status: DONE** (worker report accepted by BW 2026-07-22)

## Goal

Create a runnable Vite + TypeScript + Three.js app scaffold with architecture module folders, config stubs, and a blank clear canvas via `npm run dev`. No domain logic (telemetry, geodesy, boats, chroma, etc.).

## Acceptance criteria

- [x] `npm install` succeeds
- [x] `npm run dev` serves a page with a WebGL/Three canvas (blank or one rotating primitive)
- [x] `npm run build` succeeds
- [x] Module folders from architecture §4 exist under `src/`
- [x] `public/config.json` and `.env.example` exist and contain no secrets
- [x] Existing `docs/agentic/**` and `.cursor/**` untouched except if accidentally conflicting (must not delete)
- [x] Root README documents how to run locally
- [x] No telemetry/geo/scene domain logic beyond empty stubs

## Worker report (summary)

Vite + TS + Three at repo root; dark canvas + rotating wireframe cube; module stub READMEs; `public/config.json` + `.env.example`; README run section. No commit.
