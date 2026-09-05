# Dispatch DSP-SCN-20260902-06-osm-zoom-coverage

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260902-06-osm-zoom-coverage)
- Priority: P1
- Phase: **19.12** — OSM tiles on zoom
- Sequencing: **parallel OK** with 19.11 / 19.8. Stay in `map2dBasemap.ts` / ops `map2d.ts` tile path. Do not restyle stream/NDI 2D.
- Worker result: **code done 2026-09-02** — pad 1; coarsen `z` instead of truncating (`maxTiles=24` was the SE hole); keep previous-z + parent underlay until the new z loads. Stream still skips OSM. `npm test` **1105 + 26**, `npm run build` green.

## Goal

World Authoring OSM: tiles **cover the visible map**; they must **not vanish** on zoom in/out. If ops map shares the helper, same fix. Stream/NDI 2D does **not** need OSM.

## Background

`map2dBasemap.ts` computes visible tiles from ENU bounds + geo bridge. Operator: buggy on zoom (tiles missing / disappear). Likely zoom integer, padding, or cache keyed wrong so a zoom step drops coverage.

## In scope

1. Diagnose: tile set for a bounds/zoom must cover the canvas (pad 1 tile if needed).
2. Zoom in/out: request new z, keep drawing cached neighbors until new tiles load (no full blank).
3. Tests: given a viewport, `visibleTiles` includes corners; zoom change does not yield empty set for a non-degenerate bounds.
4. One-line README. OSM attribution stays.

## Out of scope

- Basemap on stream/NDI 2D
- Inspector, billboards, boat visibility, Cesium / other globe
- Changing OSM tile server unless the current URL is the bug (prefer math/cache fix)

## Likely files

- `src/scene/map2dBasemap.ts` + tests
- `src/scene/map2d.ts` only if redraw/cache hook is missing
- World Authoring uses the same ops map instance — do not fork a second OSM stack

## Acceptance criteria

- [x] OSM on in World Authoring: pan/zoom, map stays covered (no empty holes at viewport center). *(worker browser + tests; human Pass still required)*
- [x] Ops map with OSM shares the fix.
- [x] Stream map still has no OSM requirement.
- [x] `npm test` + `npm run build` green.

## Report back

1. Root cause (zoom, padding, cache)
2. Files / tests
3. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260902-06-osm-zoom-coverage).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260902-06-osm-zoom-coverage.md
2. docs/architecture/phase19-senexus-qol.md §19.12
3. src/scene/map2dBasemap.ts, map2d.ts OSM path

OSM must cover the visible World Authoring / ops map on zoom in/out. No stream OSM, no inspector, no Cesium vendor.
Report back per dispatch.
```
