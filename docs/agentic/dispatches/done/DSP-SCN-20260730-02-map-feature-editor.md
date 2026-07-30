# Dispatch DSP-SCN-20260730-02-map-feature-editor

## Meta
- From orchestrator: SCN (BW: **4.2a** accepted → open **4.2** editor)
- Worker role: WORKER(DSP-SCN-20260730-02-map-feature-editor)
- Priority: P0
- Phase: Phase 4.2 — Map ops + feature editor (V1)
- Related: `docs/architecture/race-projects-and-world-authoring.md` §5; prior `DSP-SCN-20260730-01`
- BW ask: draw/edit world features on the 2D map; update shared layout + refresh 3D; export JSON; no DB/NDI
- **Status: DONE** (worker report accepted by BW 2026-07-30)

## Goal

Add a **V1 map feature editor** so ops can create/edit/delete `WorldFeature`s (marks, gates, sponsors, flags, and stub start/finish/arrow) on an enlarged ops map, push through `layoutFeatures` → `setLayoutFeatures`, refresh 2D immediately and **remount or update 3D** world graphics, and **download** the current feature list as JSON. This is the authoring bridge before RaceProject packs (Phase 6).

## Background

- Shared pipeline ready: adapters, `layoutFeatures`, `getLayoutFeatures` / `setLayoutFeatures`, richer map2d
- 3D still loaded from fixture URLs at boot — editor must either:
  - **A (preferred):** keep an editable `WorldFeature[]` in memory (seeded from adapters at boot), mutate it, re-layout, update map + rebuild 3D feature roots; or
  - **B:** edit layout-only and document that 3D rebuild from ENU is enough for V1
- Do not invent RaceProject DB or `?race=` pack load

## In scope

### 1. Editor mode UX

1. Toggle **editor** on/off (HUD checkbox/button or `?editor=1` — pick one, document).
2. When on: larger map (or dedicated panel); pointer-events for draw/select.
3. Tool palette (minimal): select, add mark, add gate pair (or left/right), add sponsor (two-click A–B), add flag point, add start/finish/arrow stub.
4. Select feature → simple property fields: name/label, type (if safe), colour/height if applicable; **Delete**.
5. Click empty map → place point features in ENU → convert back to lat/lon via inverse geo helper **or** store ENU edits and recompute lat/lon with GEO inverse if available; if no inverse exists, escalate: add thin `enuToGps` in GEO or keep lat/lon by picking from a known origin projection (prefer real GEO inverse — small GEO touch OK with note in report).

### 2. Pipeline wiring

6. Seed editable `WorldFeature[]` from course/sponsors/flags adapters at boot.
7. On every edit: `layoutFeatures` → `setLayoutFeatures` → map redraw.
8. On edit (debounced OK): rebuild 3D course/sponsors/flags (or feature roots) from current world list — **demo must stay visually coherent** after edits.
9. **Export JSON** button → download `world-features.json` (WorldFeature array or small wrapper `{ features: [...] }`).

### 3. Tests / docs

10. Unit tests for pure helpers (pick tool → feature factory; serialize export).
11. Update `src/scene/features/README.md` + scene README: how to use editor.
12. `npm test` + `npm run build` green.

## Out of scope

- Persist to DB / RaceProject API (Phase 6)
- GeoJSON import/export (4.4) — JSON download of our schema is enough
- Stream/on-air PiP map (4.2b)
- Full undo stack / multiplayer
- NDI / Electron / TEL changes
- Polished design-system UI — keep ops monospace chrome

## Likely files

- `src/scene/features/editor/*` or `mapEditor.ts`
- `src/scene/map2d.ts`, `stubHud.ts`, `createScene.ts`, `main.ts`
- Possible thin GEO `enuToLatLon` if missing
- CSS for editor tools

## Acceptance criteria

- [ ] Editor toggle works; can add at least mark + sponsor A–B + delete
- [ ] Edits update 2D map and 3D world (not map-only)
- [ ] Export downloads JSON of current features
- [ ] Boot without editor still works as before
- [ ] `npm test` + `npm run build` green
- [ ] No DB / NDI / GeoJSON round-trip required

## Report back

Standard five sections; note GEO inverse if added; suggested SCN memo bullets.

## Worker paste block

```
You are WORKER(DSP-SCN-20260730-02-map-feature-editor).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260730-02-map-feature-editor.md (full)
2. docs/architecture/race-projects-and-world-authoring.md §5
3. src/scene/features/* (layout store, adapters, README)
4. src/scene/map2d.ts + stubHud.ts + createScene.ts
5. GEO helpers — check if enu→lat/lon inverse exists; add thin helper only if needed

Implement V1 map feature editor. No DB, no NDI, no GeoJSON import.
Report back per dispatch.
```
