# Dispatch DSP-SCN-20260804-01-editor-snap-validation

## Meta
- From orchestrator: BW → SCN (Phase 8.2)
- Worker role: WORKER(DSP-SCN-20260804-01-editor-snap-validation)
- Priority: P0
- Phase: Phase 8 — Visual & authoring QoL
- Related: `src/scene/features/editor/*`, roadmap Phase 8.2 (was 4.7)
- **Status: DONE** (SCN+BW accepted 2026-08-04)

## Goal

Map feature editor gets **snap** (grid / vertex / gate) and **validation** (orphan gates, incomplete sponsors, clear errors) plus a **bearing readout** while drawing arrows/gates so ops can author without silent bad geometry.

## Background

- Editor exists (`startMapFeatureEditor`); QoL called out in roadmap Phase 8.2.
- Shared layout: `docs/architecture/race-projects-and-world-authoring.md`.

## In scope

1. Snap while placing/moving: at least vertex-to-vertex and optional grid (document chosen defaults).
2. Bearing / length readout for active segment (gate A–B, arrow, sponsor span).
3. Validation before export/save: orphan gate half, sponsor missing B, empty required fields — block or warn with HUD message.
4. Short `features/README.md` + editor note.
5. Tests for validation helpers; `npm test` / build green for touched paths.

## Out of scope

- Stream on-air 2D map (DSP-SCN/OUT stream map)
- Hull colours, Unity asset port, invisible boats
- NDI / TEL / Hetzner

## Likely files

- `src/scene/features/editor/*`
- `src/scene/features/README.md`
- tests under `src/scene/features/editor/`

## Acceptance criteria

- [x] Snap visibly helps place gates/sponsors
- [x] Bearing (and length if cheap) shown while drawing
- [x] Invalid features surfaced before Save/export
- [x] Docs + tests; build green

## Worker report (summary)

Editor QoL: vertex snap (default on, 14 px) + optional 5 m grid; yellow snap crosshair + dashed A→B draft on map. Bearing/length HUD while drawing gate pair / sponsor / arrow (arrow is now two-click; label stores `brg NNN°`). `validateWorldFeatures` blocks Export/Save on orphan gates, sponsor missing B, empty name; warns on empty sponsor label (confirm). Pure helpers unit-tested.

## Report back

1. **Summary:** Snap + bearing readout + pre-save validation for map feature editor (Phase 8.2).
2. **Files:** `editor/snap.ts`, `segmentReadout.ts`, `validateFeatures.ts`, `featureFactory.ts`, `tools.ts`, `editorPanel.ts`, `editor/index.ts`, `editor.test.ts`, `features/index.ts`, `features/README.md`, `map2d.ts` (pointer move / guides), `style.css`
3. **Tests:** `npm test` 277 + server 8 passed; `npm run build` green
4. **Follow-ups:** No vertex drag/move yet (snap on place only); gate L/R one-click still can create orphans — validation catches on export
5. **SCN memo bullets:** `DSP-SCN-20260804-01` DONE — editor vertex/grid snap, brg/length readout, validate before Save/Export

## Worker paste block

```
You are WORKER(DSP-SCN-20260804-01-editor-snap-validation).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260804-01-editor-snap-validation.md
2. docs/roadmap/phases-roadmap.md (Phase 8)
3. src/scene/features/README.md + editor/*
4. docs/architecture/race-projects-and-world-authoring.md (editor section)

Implement editor snap + validation + bearing readout. No stream map, no Unity asset port, no NDI.
Report back per dispatch.
```
