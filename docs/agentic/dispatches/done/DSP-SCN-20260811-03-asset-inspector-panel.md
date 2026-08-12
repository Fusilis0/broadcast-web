# Dispatch DSP-SCN-20260811-03-asset-inspector-panel

## Meta
- From orchestrator: BW → SCN (Phase 11.7)
- Worker role: WORKER(DSP-SCN-20260811-03-asset-inspector-panel)
- Priority: P1
- Phase: Phase 11 — Unified ops sidebar & universal asset pipeline
- Prerequisites: `DSP-SCN-20260811-01-ops-sidebar-shell` (Assets section host),
  `DSP-SCN-20260811-02-2d-map-authoring` (new `buoy`/`billboardChain` types this panel lists)
- Soft dependency: `DSP-PLT-20260811-01-asset-library` (texture/model swap in Details — stub if not
  landed yet)
- Design doc: `docs/architecture/unified-ops-sidebar.md` §7
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

One **Assets** sidebar section listing every entity in the current project — boats, POVs/drones,
sponsors, billboard chains, buoys, marks/gates/start-finish — each with **Focus** (3D free-cam +
2D map center), independent **Show/Hide 3D** and **Show/Hide 2D** toggles, and a **Details** button
opening a type-specific edit form.

## Background

- `src/scene/createScene.ts` — `frameFleet` already frames the free cam on all boats; generalize the
  underlying `freeCam.frameTarget` call to accept a single target's bounding box/point instead of
  only "all boats" for the per-row Focus action.
- `src/scene/boatVisibility.ts` — existing `solid`/`ghost`/`hidden` per-boat 3D mode + the ghost
  behavior of "still tracked on map when 3D-hidden" is exactly the show/hide-3D-vs-2D split this
  panel needs to generalize to non-boat feature types.
- `src/scene/features/types.ts` (as extended by `DSP-SCN-20260811-02`) — `WorldFeature`/
  `LayoutFeature` gain `buoy`/`billboardChain`; this panel is the consumer that lists them.
- Camera/POV detail fields (FOV, calibration offsets) belong to CAL's `offsetsStore` — this panel
  should **display** them (read-only mirror), not re-implement calibration editing; link out or
  embed a minimal read-only view, and leave actual offset editing wherever CAL already exposes it
  today (check `src/calibration/` for any existing UI vs. config-only today — if there is no
  existing UI, a read-only display here is still in scope; a full editable calibration UI is not).

## In scope

1. **Assets list data model**: derive rows from current runtime state — fleet registry (boats/POVs),
   `layoutFeatures` (sponsors/billboardChain/buoy/marks/gates/start-finish). Group by type; simple
   flat list with a type filter/grouping header is enough for v1 (no drag-reorder, no nesting).
2. **Focus**: per-row button — switches ops view to free cam (if not already) and calls a
   generalized `frameTarget`-style call centered on that entity's ENU position/bounds; also
   pans/zooms the 2D map to center on it (reuse `DSP-SCN-20260811-02`'s pan/zoom).
3. **Show/Hide 3D**: boats reuse existing `boatVisibility` (`solid`/`ghost`/`hidden` — expose the
   existing modes here rather than reinventing a boolean). Other feature types get an equivalent
   per-id 3D-visible boolean (extend `LayoutFeature` consumers additively — do not remove/rename
   existing fields).
4. **Show/Hide 2D**: independent per-id boolean for map-dot/icon visibility, generalizing the
   existing "ghost boats still show on map" concept to all types.
5. **Details panel**: type-specific forms —
   - Sponsor / billboard chain: size (`heightM`)/rotation if applicable/texture (library picker,
     stub if PLT-01 hasn't landed)/label.
   - Buoy: telemetry id binding (if TEL channel available), static fallback point (editable
     lat/lon).
   - Boat: name/category (already editable in `fleetLivePanel` — this can simply deep-link/open that
     existing row's edit state rather than duplicating the form).
   - POV/drone camera: read-only FOV + calibration offset summary (see Background note above).
   Edits apply immediately to runtime state (same "no Save-button-required" pattern as
   `onBoatVisibilityChange` today); Save/Save as (Project section) persists them into the
   `RaceProject` as usual.
6. Persist the new per-feature visibility flags through Save/Load — additive fields on
   `LayoutFeature`/`WorldFeature`/`RaceProject` (mirror how `boatVisibility` already round-trips via
   `RaceProjectFleet.boatVisibility`).
7. Tests: rendering/toggle behavior, focus wiring (mock free cam), persistence round-trip for the
   new visibility fields.
8. Docs: `src/scene/README.md`, `src/scene/features/README.md`, `docs/contracts/race-project.md`
   (new optional visibility fields).

## Out of scope

- 2D map authoring tools themselves (`DSP-SCN-20260811-02`).
- Universal asset library (`DSP-PLT-20260811-01`) — Details only *consumes* its picker.
- Editable calibration UI beyond a read-only summary (CAL's domain if/when they build one).
- Any RaceProject breaking change — every new field additive/optional.

## Likely files

- New: `src/scene/sidebar/assetInspector.ts` (or wherever the shell contract expects sections;
  follow `DSP-SCN-20260811-01`'s README), `+test`
- Edit: `src/scene/createScene.ts` (generalize `frameFleet`/`frameTarget` for single-entity focus),
  `src/scene/boatVisibility.ts` (reuse, possibly generalize types), `src/scene/features/types.ts`
  (additive visibility fields), `src/projects/types.ts` (`RaceProject` additive fields),
  `buildRaceProject.ts`/`parseRaceProject.ts`/`applyRaceProjectToConfig.ts` (round-trip new fields)
- Docs: `docs/contracts/race-project.md`, `src/scene/README.md`

## Inputs provided

- `docs/architecture/unified-ops-sidebar.md` §7 (per-asset inspector spec).
- Existing boat visibility pattern (`src/scene/boatVisibility.ts`,
  `RaceProjectFleet.boatVisibility`) as the template to generalize.
- `src/scene/createScene.ts` `frameFleet` as the template for single-entity `Focus`.

## Acceptance criteria

- [ ] Assets section lists every boat/POV/sponsor/billboard-chain/buoy/mark/gate/start-finish in
      the current project, grouped by type
- [ ] Focus switches to free cam and centers on the selected entity in both 3D and 2D map
- [ ] Show/Hide 3D and Show/Hide 2D toggle independently per row; boats reuse existing
      solid/ghost/hidden modes
- [ ] Details opens a type-appropriate form; edits apply immediately to runtime state
- [ ] New visibility fields round-trip through Save → Load without breaking old packs that lack them
- [ ] `npm test` + `npm run build` green
- [ ] `npm run dev`: toggle a non-boat feature's 3D/2D visibility independently and confirm both
      views reflect it correctly

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (note explicitly whether the library picker was stubbed, and CAL
   calibration display status)
5. Suggested memo bullets for SCN

## Worker paste block

```
You are WORKER(DSP-SCN-20260811-03-asset-inspector-panel).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260811-03-asset-inspector-panel.md
2. docs/architecture/unified-ops-sidebar.md (§7)
3. src/scene/boatVisibility.ts, createScene.ts (frameFleet), features/types.ts
4. src/projects/types.ts, buildRaceProject.ts, parseRaceProject.ts

Build the Assets sidebar section: list every project entity with Focus / Show-3D /
Show-2D / Details, generalizing the existing boat-visibility pattern to all feature
types. New visibility fields must round-trip through Save/Load additively. Report back
per dispatch.
```
