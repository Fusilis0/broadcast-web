# Dispatch DSP-SCN-20260811-02-2d-map-authoring

## Meta
- From orchestrator: BW → SCN (Phase 11.6 — folds old roadmap 11.5 basemap/4.3)
- Worker role: WORKER(DSP-SCN-20260811-02-2d-map-authoring)
- Priority: P0
- Phase: Phase 11 — Unified ops sidebar & universal asset pipeline
- Prerequisites: `DSP-SCN-20260811-01-ops-sidebar-shell` (World Map section host),
  `DSP-PLT-20260811-01-asset-library` (billboard-chain/buoy texture picker — may start before that
  lands; stub the picker against a hardcoded list and wire the real one when available)
- Soft dependency: `DSP-TEL-20260811-01-buoy-telemetry` (optional live-bind for placed buoys — may
  ship placement without live binding if TEL hasn't landed yet)
- Design doc: `docs/architecture/unified-ops-sidebar.md` §4, §5
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

Upgrade the ops 2D map from a fixed-size ENU readout into a real authoring surface: pan/zoom, an
optional OSM raster basemap (offline-safe fallback), and drag/click placement tools for boats,
drones/POVs, sponsor billboards, **billboard chains** (new), and **buoys** (new). This is the "real
2D map (like Google Maps)" the map-placement half of the request.

## Background

- `src/scene/map2d.ts` — current canvas map: `enuToMapPx`/`mapPxToEnu`, fixed `sizePx`, draws
  boat/drone dots + course marks + layout features. No pan/zoom today.
- `src/scene/mapChrome.ts` — shared draw path for boat/sail icons, S/F pills, arrows — reuse, don't
  fork.
- `src/scene/features/editor/editorPanel.ts` + `featureFactory.ts`/`tools.ts` — existing tool
  palette (mark/gate/sponsor/flag/start/finish/arrow/rotation), two-click tools, snap
  (`snap.ts`), validation (`validateFeatures.ts`). New tools follow this same pattern.
- `src/scene/features/types.ts` — `WorldFeatureType` union; add `'buoy'` and `'billboardChain'`
  additively (existing types/consumers must keep compiling and behaving identically).
- `docs/contracts/race-project.md` — feature shape is embedded in `RaceProject.features`; new
  optional fields (`spacingM` on billboardChain, an optional `telemetryId`/`liveBound` marker on
  buoy) must be additive — old packs without these fields still parse.
- Fleet boat/drone placement is **not** a `WorldFeature** — it's an entry in the existing fleet
  registry (`boatIds`/`povIds`, `FleetBoatRow` in `fleetLivePanel.ts`). Placing one on the map should
  add a registry entry with an approximate GPS point held client-side (e.g. sessionStorage, same
  place fleet state already lives) — live telemetry overriding a placeholder position is already how
  the app behaves once a real packet arrives, so no special-casing should be needed beyond seeding
  an initial position hint if the panel supports showing "planned but not yet live" markers.

## In scope

1. **Pan/zoom**: mouse-drag pan, wheel/pinch zoom on the ops map. Keep `enuToMapPx`/`mapPxToEnu`
   correct under a variable viewport — likely needs a view-transform (offset + scale) layered on
   top of the existing ENU→px math rather than rewriting it.
2. **Optional OSM raster basemap** layer under the existing canvas drawing: toggle in the World Map
   section; tiles fetched from a standard OSM tile endpoint (no API key); on fetch failure (offline
   venue), silently fall back to the current plain grid — never block or error the map when offline.
   Cache fetched tiles in-memory for the session (no persistent tile store needed for v1).
3. **Anchor point picking on the map**: click-to-set world anchor (lat/lon), feeding the existing
   `onOriginApply` flow (`stubHud.ts`/sidebar Project section) — an alternative input path to typing
   lat/lon directly, not a replacement.
4. **Drag-place tools**:
   - Boat / drone: click or drag-drop onto the map → prompts for id (reuse existing add-boat/
     add-drone flow from `fleetLivePanel.ts` if practical, or a lightweight inline form) → registers
     into fleet state at that map point.
   - Sponsor billboard: existing two-point tool, unchanged.
   - **Billboard chain** (new tool): click ≥2 points to draw a polyline; on completion, prompts for
     texture (library picker — stub against a static list if `DSP-PLT-20260811-01` hasn't landed
     yet) and spacing (meters); creates one `WorldFeature` with `type: 'billboardChain'`,
     `points` = the drawn polyline, `spacingM`, `textureUrl`. 3D instancing of the chain (placing
     repeated billboard meshes along the polyline at `spacingM` intervals) is in scope — reuse the
     existing sponsor billboard mesh/material path (`src/scene/sponsors/`) as the per-instance
     visual.
   - **Buoy** (new tool): click to place a point; creates a `WorldFeature` with `type: 'buoy'`; if
     `DSP-TEL-20260811-01` has landed, optionally bind a live telemetry id (dropdown of currently
     seen buoy ids) — if not landed or left unbound, the buoy stays at its static placed point. 3D
     visual: reuse/extend the existing mark/buoy prop from `DSP-SCN-20260804-08` world-3D-polish
     (`docs/ops/unity-asset-port.md` buoy/gate materials) rather than building a new mesh from
     scratch.
5. Update `featureFactory.ts`/`tools.ts`/`validateFeatures.ts`/`layoutFeatures.ts` for the two new
   types (bounds/validation/ENU layout must handle them like existing multi-point types).
6. Update `docs/contracts/race-project.md` with the two new additive feature types + fields.
7. Tests: `map2d.test.ts` (pan/zoom transform math), `editor.test.ts` (new tools), feature
   factory/validate tests for `buoy`/`billboardChain`.
8. Docs: `src/scene/README.md`, `src/scene/features/README.md`.

## Out of scope

- Universal asset library implementation itself (`DSP-PLT-20260811-01`) — this dispatch only
  consumes its picker; if it hasn't landed, stub against a hardcoded texture list and note the TODO
  wiring point clearly in code + report-back.
- Asset inspector list/focus/show-hide/details panel (`DSP-SCN-20260811-03`).
- Buoy live telemetry itself (`DSP-TEL-20260811-01`) — this dispatch only needs to *bind* to an id
  if that channel exists; ship placement-only if it doesn't.
- Any offline vector tile pipeline (raster OSM only, best-effort, per design doc §4).
- Physics-based buoy drag animation.

## Likely files

- Edit: `src/scene/map2d.ts` (+test), `src/scene/mapChrome.ts`, `src/scene/features/types.ts`,
  `featureFactory.ts`, `tools.ts`, `validateFeatures.ts`, `layoutFeatures.ts`,
  `editor/editorPanel.ts` (+test)
- New: basemap tile-fetch helper (e.g. `src/scene/map2dBasemap.ts` + test), buoy 3D mount (extend
  existing course/buoy prop module or add a small new one under `src/scene/`), billboard-chain
  instancing (extend `src/scene/sponsors/` or add `src/scene/billboardChain.ts`)
- Docs: `docs/contracts/race-project.md`, `src/scene/README.md`, `src/scene/features/README.md`

## Inputs provided

- `docs/architecture/unified-ops-sidebar.md` §4 (map upgrade decisions), §5 (buoy design).
- `docs/ops/unity-asset-port.md` — buoy/gate material reference, BillboardChain backlog note (this
  dispatch is that backlog item, finally scheduled).
- Existing two-click tool pattern in `editorPanel.ts`/`tools.ts` as the template for the two new
  tools.

## Acceptance criteria

- [ ] Ops map supports pan (drag) and zoom (wheel); existing dot/course/feature rendering stays
      correct at any pan/zoom state
- [ ] Optional OSM basemap toggle; graceful silent fallback to grid when tiles are unreachable
- [ ] Click-to-set anchor point feeds the existing origin-apply flow
- [ ] New boat/drone placement tool registers a fleet entry at the clicked map point
- [ ] New billboard-chain tool creates a `WorldFeature` (`type: 'billboardChain'`) with ≥2 points,
      renders repeated billboard instances in 3D at `spacingM` along the path
- [ ] New buoy tool creates a `WorldFeature` (`type: 'buoy'`); optional live-id binding when the TEL
      buoy channel is available, static point otherwise
- [ ] `race-project.md` documents both new types as additive/optional; old packs still parse
- [ ] `npm test` + `npm run build` green
- [ ] `npm run dev`: manually place one of each new type and confirm it survives Save → Load

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (note explicitly whether the library picker / TEL buoy-bind were stubbed)
5. Suggested memo bullets for SCN

## Worker paste block

```
You are WORKER(DSP-SCN-20260811-02-2d-map-authoring).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260811-02-2d-map-authoring.md
2. docs/architecture/unified-ops-sidebar.md (§4, §5)
3. src/scene/map2d.ts, mapChrome.ts, features/types.ts, features/editor/editorPanel.ts, tools.ts
4. docs/contracts/race-project.md
5. docs/ops/unity-asset-port.md (buoy/BillboardChain notes)

Upgrade the 2D map: pan/zoom, optional OSM basemap with offline fallback, drag-place
boats/drones/sponsors, new billboard-chain and buoy tools (WorldFeature types). Stub the
library texture picker and TEL buoy live-bind if those dispatches haven't landed yet —
note the TODO wiring points clearly. Report back per dispatch.
```
