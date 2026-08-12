# Dispatch DSP-SCN-20260812-03-fleet-map-pose-sync

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260812-03-fleet-map-pose-sync)
- Priority: P0
- Phase: Phase 13 follow-up / authoring QoL
- Related: user 2026-08-12 — deleted boats still visible on World Authoring map; newly placed
  boat does not appear
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 476+23)

## Goal

Keep the **World Authoring / ops 2D map fleet icons** in sync with the Live fleet list:
removing a boat/drone removes its map (and stream-map) icon immediately; placing a boat/drone
on the authoring map shows a planned icon at that click immediately (even with no live telemetry).

## Background (root cause)

- Map icons come from `map2d.updatePose` → an internal `points` Map that **never deletes** entries
  (`src/scene/map2d.ts`).
- Live/mock poses keep calling `stubHud` → `map.updatePose` / `streamMap.updatePose` for any id.
- Deleting a row in Fleet updates `boatIds` + 3D allow-list (`applyFleetToScene` / orphan meshes)
  but **does not** remove stale map points.
- `seedPlannedFleetOnMap` only **adds** planned poses; fleet delete does not clear them.
- New place: `onPlaceFleet` → `fleetPanel.addBoat` + `seedPlannedFleetOnMap` — if seed fails, addBoat
  doesn’t persist `plannedLat/Lon`, or map doesn’t redraw / filters wrongly, the icon never shows.
  Investigate and fix end-to-end.

## In scope

1. **`map2d` API:** `removePose(id)` and/or `retainPoseIds(ids: readonly string[])` (drop any point
   whose id is not in the allow set). Wire stream map the same way.
2. **On fleet change / delete / rename:** after `boatIds`/`povIds` update, prune ops map + stream
   map to the current fleet (+ buoy poses if those are independent — don’t wipe buoy/feature
   overlays). Also stop treating deleted ids as “seen” in HUD if applicable.
3. **Pose subscribe filter (recommended):** ops/stream map updates for `boat`/`drone` only when
   id is in current fleet allow-lists (buoys unchanged). Prevents mock/live from re-adding deleted
   ghosts.
4. **Place boat/drone:** after place, icon must appear at click ENU on the **authoring map**
   (same instance as `hud.getMap()` today). Ensure `plannedLat/Lon` saved on the fleet row and
   `seedPlannedFleetOnMap` (or equivalent) runs; force redraw. If `addBoat` no-ops on duplicate id,
   surface that to the user.
5. Tests: removePose / retainPoseIds; fleet delete clears map point; place seeds a point without
   telemetry.
6. Short note in `src/scene/README.md` / features README.

## Out of scope

- NDI / FPS work (OUT).
- Project Save UX (PLT).
- Changing WorldFeature schema.
- Telemetry socket redesign.

## Likely files

- `src/scene/map2d.ts` (+ test), `src/scene/streamMap.ts` if needed
- `src/scene/stubHud.ts` (pose → map filter)
- `src/main.ts` (`onFleetChange`, `onPlaceFleet`, `seedPlannedFleetOnMap`)
- `src/scene/fleetLivePanel.ts` (planned lat/lon on add; delete path)
- Docs: scene README

## Acceptance criteria

- [ ] Delete boat from Live/Fleet → icon gone from World Authoring map (and stream map) without reload
- [ ] Place boat on authoring map → icon appears at that point immediately (no live packets required)
- [ ] 3D allow-list / orphan mesh behavior unchanged or improved consistently
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for SCN
