# Dispatch DSP-SCN-20260727-01-fleet-registry

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260727-01-fleet-registry)
- Priority: P0
- Phase: Phase 2.2 — SCN half (fleet registry)
- Related handoffs: `HO-TEL-SCN-20260724-01` (green — `boatIds` contract locked; TEL mock/replay multi-id done)
- BW ask: `Map<id, boat entity>` from `poseBus`; clone 2.1 template + tags; cap via `loadConfig().boatIds` (default 21–24); fix HUD single-boat ENU; verify with mock or `/fixtures/telemetry/spine-fleet.json` — **no** live multi-URL wait
- **Status: DONE** (worker report accepted by SCN 2026-07-27)

## Goal

Replace the single hard-wired boat (`21`) with a **fleet registry**: create/update boat entities keyed by `poseBus` boat `id`, cloning the Phase 2.1 glTF/procedural template and per-id tags. Cap/filter with **`loadConfig().boatIds`**. Fix stub HUD so status does not assume a single boat ENU forever. Verify under **mock** (default) or replay of `spine-fleet.json`. No TEL live multi-socket work, no chroma, no geo formulas.

## Acceptance criteria

- [x] `Map` (or equiv.) of boat entities driven by `poseBus` boat poses
- [x] Entities clone 2.1 glTF/procedural template; each has a tag with its `id`
- [x] Only ids in `boatIds` get entities; others ignored
- [x] Default config shows multiple boats (21–24) under mock (code path; human browser smoke optional)
- [x] HUD does not assume a single boat ENU line forever (`formatBoatEnuStatus`)
- [x] 2D map shows multiple boat ids (existing Map; unchanged)
- [x] No live multi-URL / no chroma / no geo formula changes in SCN
- [x] `npm test` + `npm run build` green — SCN re-verified **71/71** (2026-07-27)
- [x] `npm run dev` (mock): ≥2 boats — worker could not browser-smoke; code + tests meet gate; human confirm optional

## Worker report (summary)

Fleet `Map` in `createScene`; `boatIds` allow-list; `main` awaits config before `startScene`; HUD multi-boat ENU; `fleetRegistry.ts` helpers + 6 tests. Worker: [fleet-registry](960384da-b853-4396-adc0-fcc7d1b784ba).

## Files delivered

- `src/scene/createScene.ts`, `fleetRegistry.ts`, `fleetRegistry.test.ts`, `stubHud.ts`, `boatEntity.ts` (comment), `index.ts`, `README.md`
- `src/main.ts`

## Full original dispatch

See git history / prior active copy for full in/out-of-scope text. Scope was SCN 2.2 registry only.
