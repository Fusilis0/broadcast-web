# Dispatch DSP-SCN-20260731-03-geojson-import-export

## Meta
- From orchestrator: SCN (BW: fleet-switch closed → open **4.4** GeoJSON)
- Worker role: WORKER(DSP-SCN-20260731-03-geojson-import-export)
- Priority: P1
- Phase: Phase 4.4 — GeoJSON import/export (geojson.io compatibility)
- Related: `docs/architecture/race-projects-and-world-authoring.md` §4–5; map editor; RaceProject features
- BW ask: round-trip GeoJSON ↔ `WorldFeature[]` for external authoring; wire Import/Export in editor; no DB/NDI
- **Status: DONE** (worker report accepted by BW 2026-07-31)

## Goal

Support **GeoJSON FeatureCollection** import/export mapped to our `WorldFeature` types so ops can draw in geojson.io (or similar), import into the editor, and export back. Keep RaceProject JSON as the native pack format; GeoJSON is an interchange adapter.

## Background

- Unity workflow: geojson.io → billboards
- Editor already exports `{ features: WorldFeature[] }` and RaceProject `project.json`
- Types: mark, gateLeft/Right, sponsor (A–B), flags, start/finish/arrow stubs

## In scope

1. **Mapping doc** in `src/scene/features/geojson.md` or README section: property keys (`type`, `name`, `heightM`, `color`, …); Point vs LineString rules (sponsor = 2-point LineString; gate pair = two Points or one LineString — document choice)
2. **`geojsonToWorldFeatures` / `worldFeaturesToGeojson`** pure functions + unit tests
3. Editor/HUD: **Import GeoJSON** (file input) → merge or replace features → layout + remount; **Export GeoJSON** download
4. Invalid features skipped with `console.warn`; don’t crash
5. `npm test` + `npm run build` green

## Out of scope

- Tiles/basemap (4.3)
- DB/API, NDI, changing RaceProject schema required fields
- Full GeoJSON GeometryCollection / polygons (unless trivial zone stub)

## Acceptance criteria

- [ ] Round-trip test: WorldFeature[] → GeoJSON → WorldFeature[] preserves types/coords for mark + sponsor
- [ ] Import file updates map + 3D
- [ ] Export downloads `.geojson`
- [ ] Docs explain geojson.io property conventions
- [ ] No DB/NDI

## Report back

Standard five sections.

## Worker paste block

```
You are WORKER(DSP-SCN-20260731-03-geojson-import-export).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260731-03-geojson-import-export.md
2. docs/architecture/race-projects-and-world-authoring.md §4
3. src/scene/features/types.ts + editor export/import UX
4. docs/contracts/race-project.md (features field)

GeoJSON ↔ WorldFeature adapter + editor Import/Export. No DB/NDI.
Report back per dispatch.
```
