# Dispatch DSP-SCN-20260730-01-shared-feature-layout

## Meta
- From orchestrator: SCN (BW: Phase **3.5 Pass** → open Phase **4.2a**)
- Worker role: WORKER(DSP-SCN-20260730-01-shared-feature-layout)
- Priority: P0
- Phase: Phase 4.2a — Shared feature layout (foundation for map editor + RaceProject)
- Related: `docs/architecture/race-projects-and-world-authoring.md` §4
- **Status: DONE** (worker report accepted by BW 2026-07-30) — Phase 4.2a
- BW ask: one ENU feature list feeds **3D and 2D**; keep existing fixture URLs working via adapter; no full draw-editor yet; no DB/NDI

## Goal

Introduce a **shared world-feature model** so course marks/gates, sponsors, and flag poles (and stubs for start/finish/arrow) normalize into one list, convert once via GEO (`gpsToEnuAmsl`), then drive **both** the Three.js scene and an upgraded 2D map. Existing `courseUrl` / `sponsorsUrl` / `flagsUrl` loaders remain the source for V1 via adapters — do not require a RaceProject DB yet.

## Background

- Milestone C met (chroma Pass). Design: race-projects doc — shared layers before editor (4.2) and packs (6.x).
- Today: separate loaders (`src/scene/course|sponsors|flags`) → 3D; map2d only gets course mark dots.
- Sponsors/flags not on 2D map; no `start`/`finish`/`arrow` types yet.
- GEO: use existing `gpsToEnuAmsl` / water Y=0 rules already used by course/sponsors/flags.

## In scope

### 1. Feature types + schema (code + short doc)

1. Define typed features under `src/scene/features/` (or similar), e.g.:
   - `mark` | `gateLeft` | `gateRight` | `sponsor` | `flagP1` | `flagP2`
   - **Stub-ready** (may render simply or as map-only first): `start` | `finish` | `arrow` / `rotation`
2. Document JSON shape in `src/scene/features/README.md` (align with race-projects §4).
3. Normalized ENU record: id/name, type, positions (1–2 points), optional height/colour/label, raw lat/lon kept if useful.

### 2. Adapters from existing fixtures

4. Adapt current course / sponsors / flags fixtures → `WorldFeature[]` (or equivalent) **without** breaking boot.
5. Prefer: load fixtures as today → adapt → single `layoutFeatures(features, origin)` → ENU list.
6. Existing 3D builders may keep working if fed from the shared list **or** thin wrappers; avoid duplicating GPS math in three places.

### 3. Consumers

7. **3D:** scene still shows course + sponsors + flags (parity with today).
8. **2D map:** show marks, gate segments, sponsor footprints (line or rect), flag icons — not only orange mark dots.
9. Export a getter for tests / future editor (`getLayoutFeatures()` or bus).

### 4. Tests

10. Unit tests: adapter from sample fixture slice → expected feature counts/types; map projection still sane.
11. `npm test` + `npm run build` green.

## Out of scope

- Full click-to-draw map **editor** (follow-up 4.2 DSP)
- RaceProject pack / DB / `?race=` pack load (Phase 6)
- GeoJSON import (4.4)
- Stream/on-air 2D PiP (4.2b)
- NDI / Electron
- Changing TEL live multi-URL

## Likely files

- `src/scene/features/*` (new)
- `src/scene/course/*`, `sponsors/*`, `flags/*` (adapters / thin rewire)
- `src/scene/map2d.ts`, `createScene.ts`, `main.ts`, READMEs
- Tests under `src/scene/features/` or adjacent

## Acceptance criteria

- [ ] Shared feature type module exists and is documented
- [ ] Boot still loads demo Istanbul course + sponsors + flags
- [ ] 2D map shows more than mark dots (at least gates and/or sponsors and/or flags)
- [ ] No duplicated lat/lon→ENU logic outside GEO helpers
- [ ] `npm test` + `npm run build` green
- [ ] No editor UI, no DB, no NDI

## Report back

1. Summary  
2. Files touched  
3. Tests / verified  
4. Follow-ups (editor DSP readiness)  
5. Suggested SCN (+ GEO if touched) memo bullets  

## Worker paste block

```
You are WORKER(DSP-SCN-20260730-01-shared-feature-layout).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260730-01-shared-feature-layout.md (full)
2. docs/architecture/race-projects-and-world-authoring.md §4
3. docs/agentic/DISPATCH_PROTOCOL.md
4. src/scene/course/* + sponsors/* + flags/* + map2d.ts
5. GEO gpsToEnuAmsl usage in those loaders

Implement shared feature layout + richer 2D map. Keep demo fixtures working.
No map editor UI, no RaceProject DB, no NDI.
Report back per dispatch.
```
