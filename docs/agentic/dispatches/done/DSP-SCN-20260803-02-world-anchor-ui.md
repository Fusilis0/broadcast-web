# Dispatch DSP-SCN-20260803-02-world-anchor-ui

## Meta
- From orchestrator: BW (ops feedback 2026-08-03)
- Worker role: WORKER(DSP-SCN-20260803-02-world-anchor-ui)
- Priority: P0
- Phase: Ops authoring (SCN + GEO apply only)
- Related: `config.origin`, `applyConfigOrigin`, RaceProject `origin`, map editor Save
- BW ask: Visible place to set world anchor (lat/lon/alt) = ENU 0,0,0 — same contract as Unity GeoOrigin
- **Status: DONE** (BW accepted 2026-08-03)

## Goal

Ops can **read and edit** the world anchor (WGS84 lat/lon + altMsl). Changing it re-applies GEO origin so telemetry ENU matches Unity-style “anchor → 0,0,0”.

## Background

- Current default / demo pack: `{ lat: 41.0082, lon: 28.9784, altMsl: 0 }` (`public/config.json`, `demo-istanbul`).
- Applied via `applyConfigOrigin` after EGM96 load; no UI fields today (deeplink `?originLat=` only).
- User example anchor near Bosphorus: `41.08673822819249, 29.061803205100848` — must be editable, not hardcoded forever.

## In scope

1. HUD or Fleet/editor fields: **Origin lat / lon / altMsl** (+ Apply button).
2. On Apply: update runtime config origin → `applyConfigOrigin` → refresh course/sponsors/features ENU (same remount path as race switch as needed).
3. Persist into RaceProject on existing Save download (`buildRaceProject` already has origin).
4. Show current values at boot (from pack/config).
5. Docs: `src/config/README.md` + scene/geodesy note — anchor = Unity world origin.
6. Tests for apply path if thin helper; build green.

## Out of scope

- Free cam / NDI
- Live sockets
- Full DB save-as (companion PLT/SCN DSP)
- Recomputing baked Unity assets

## Acceptance criteria

- [x] Can set origin to Bosphorus example coords and see boats/features shift in ENU consistently
- [x] Save project JSON contains the new origin
- [x] Deeplink origin still overrides at boot
- [ ] `npm test` + `npm run build` green — **build green**; full `npm test` blocked by parallel TEL live-status shape change (see report)

## Worker report (summary)

HUD **origin** row (lat / lon / altMsl + Apply) → `config.origin` → `applyConfigOrigin` → remount world features ENU. Fields filled at boot / race switch / after Apply. Save already embeds `config.origin` via `buildRaceProject`. Deeplink path unchanged (`applyDeeplinkToBoot` before origin apply). Helper: `parseConfigOriginFields`. Tests: geodesy parse + Bosphorus ENU-zero. Build green. Full suite: 5 failures in `src/telemetry/live.test.ts` from DSP-TEL live-status extras (`droneIds`/`boatIds`) — out of scope.

## Worker paste block

```
You are WORKER(DSP-SCN-20260803-02-world-anchor-ui).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260803-02-world-anchor-ui.md
2. src/geodesy/applyConfigOrigin.ts, geoOrigin.ts
3. src/config/types.ts, public/config.json
4. src/projects/buildRaceProject.ts
5. src/main.ts origin apply / race switch

Add world-anchor lat/lon/altMsl UI + apply. No free cam, no NDI, no API DB.
Report back per dispatch.
```
