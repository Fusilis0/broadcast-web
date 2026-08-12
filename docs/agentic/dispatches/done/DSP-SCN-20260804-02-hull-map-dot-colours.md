# Dispatch DSP-SCN-20260804-02-hull-map-dot-colours

## Meta
- From orchestrator: BW → SCN (Phase 8.3)
- Worker role: WORKER(DSP-SCN-20260804-02-hull-map-dot-colours)
- Priority: P0
- Phase: Phase 8 — Visual & authoring QoL
- Related: boat names catalogue, `boatEntity`, `map2d`, roadmap 8.3 (was 4.6)
- **Status: DONE** (SCN+BW accepted 2026-08-04)

## Goal

Boat **category colour** from the name catalogue tints both the **3D hull/tag** (already partial on tags) and the **2D map dots** so fleet identity matches Unity spirit.

## Background

- Catalogue: name + category → colour (`boatNames`).
- Tags already use category tint; procedural/glTF hull and map dots may not.

## In scope

1. Apply catalogue colour to boat visual (procedural materials; glTF tint strategy — document if multiply/emissive).
2. Map2d boat dots use same colour by id.
3. Live `upsertBoatName` / Fleet edits refresh hull + dot.
4. Docs in scene README / boatNames README.
5. Tests where colour helpers are pure; build green.

## Out of scope

- Invisible/ghost boat mode (later Phase 8.6)
- Editor snap, stream map, Unity mesh replace
- NDI

## Likely files

- `src/scene/boatEntity.ts`, `boatTag.ts`, `map2d.ts`
- `src/scene/boatNames/*`, `createProceduralBoatVisual.ts`
- `src/assets/*` if tint helpers live there

## Acceptance criteria

- [x] Two boats with different categories show different hull + map-dot colours
- [x] Fleet category edit updates both
- [x] Docs + tests; build green

## Worker report (summary)

1. **Summary:** Catalogue `#rrggbb` now tints procedural/glTF hulls via `applyBoatHullTint` + `setTagIdentity`, and ops map boat squares via `setBoatDotColors` / `boatColorsFromCatalogue` (synced from `main` on load, race switch, Fleet upsert).
2. **Files:** `src/assets/tintBoatVisual.ts` (+test), `createProceduralBoatVisual.ts`, `boatEntity.ts`, `map2d.ts` (+test), `boatNames/categoryColor.ts` (+tests), `main.ts`, READMEs (`scene`, `assets`, `boatNames`).
3. **Verify:** `npm test` (264 + server 8) green; `npm run build` green. Manual: mock demo 21/22 pink vs 23/24 blue on hull + map; change Fleet category → both update.
4. **Follow-ups:** Ghost boats (8.6); optional glTF material whitelist if full-mesh tint is too strong on future assets.
5. **SCN memo bullets:** Phase 8.3 hull+map-dot colours landed; tint strategy = Three colour×map + emissive (procedural hull-only via `userData.categoryTint`).

## Worker paste block

```
You are WORKER(DSP-SCN-20260804-02-hull-map-dot-colours).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260804-02-hull-map-dot-colours.md
2. docs/roadmap/phases-roadmap.md (Phase 8.3)
3. src/scene/boatNames/*, boatEntity.ts, map2d.ts
4. src/scene/README.md fleet / tags

Implement category colours on hull + map dots. No editor snap, no stream map, no ghost boats.
Report back per dispatch.
```
