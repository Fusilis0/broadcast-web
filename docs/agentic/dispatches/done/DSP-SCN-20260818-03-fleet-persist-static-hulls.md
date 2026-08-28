# Dispatch DSP-SCN-20260818-03-fleet-persist-static-hulls

## Meta
- From orchestrator: BW → SCN (PLT schema files in-scope — no separate PLT worker)
- Worker role: WORKER(DSP-SCN-20260818-03-fleet-persist-static-hulls)
- Priority: P0
- Phase: Phase 15.4 — fleet 3D without telem + pack persist
- Related: user 2026-08-18 — added fleet boats set to **solid** are invisible; they want hulls **freely movable without telemetry**; Save then Load restores demo **Bora Aksu** 21–24 instead of the custom list
- Parallel-safe with: SCN-01 (do not edit `gerstnerOcean.ts`), OUT-01 (do not edit frame clock). Rebase if SCN-02 also edits `createScene.ts`.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (`npm test` 600+23; `npm run build` green).

## Goal

1. Every boat in the Live fleet **has a 3D hull** as soon as it is added, even with **zero telemetry**. Solid/ghost/hidden apply to that hull. Operator can **place and move** it (map / planned GPS) to judge look.
2. **Save / Load** persists the fleet **rows** (ids, names, category, visibility, map flag, planned lat/lon), not just `boatIds` plus a pointer at the demo names JSON.

## Background (root causes)

**Invisible hulls.** `createScene.ensureBoat` runs only on `poseBus` `kind: 'boat'`. No packet → no mesh. Visibility mode (`solid`) only tints an existing entity. `DSP-SCN-20260812-03` seeds **map icons** from `plannedLat/Lon` without telem; **3D was never seeded**. Mock/replay also only emit configured spine ids (21–24), so a newly added id never gets a pose.

**Save/Load loses custom boats.** Fleet panel is sessionStorage. `buildRaceProject` writes `fleet.boatIds` + `boatNamesUrl` (still `/fixtures/boats/demo-istanbul-names.json`) + visibility maps — **not** the live name/category/planned rows. `applyLoadedRaceProject` then:

```ts
await scene.loadBoatNamesFromUrl(boatNamesUrl)
fleetPanel.setState({
  boatIds: config.boatIds,
  boats: [...scene.getBoatNamesCatalogue().entries()].map(...)
})
```

The catalogue is the **demo names file** (Bora Aksu, …). The visible list becomes the starter catalogue. New ids/names that only lived in the panel are gone after Load (and after a full restart with no session).

BW locks (2026-08-18):

- Embed `fleet.boats: RaceProjectFleetBoat[]` in the pack (additive). `boatIds` remains required and **must match** `boats[].id` order (or be derived then written — keep both in sync on save).
- On Load, the panel is rebuilt from **`fleet.boats`**, not from dumping the names-URL catalogue. Names URL is **fallback** only for ids in `boatIds` missing from `boats[]`.
- Live telemetry **overrides** the static pose while packets are fresh; after ~2 s with no boat packet, hold last live pose (do not pop back every frame). If the boat **never** had telem, stay on planned/static.
- Planned GPS: map place and inspector lat/lon move the hull immediately. A default grid near origin is fine when no planned GPS exists (offset by index so hulls do not stack).
- Do not require a 3D transform gizmo in this slice (map drag + lat/lon is enough). Optional gizmo = follow-up.
- `solid` is visibility, not “has a glTF”. Default hull remains procedural/glTF as today (`createBoatEntity`). Library visual assignment is out of scope unless already wired on the row — do not invent a new asset field unless it already exists.

## In scope

1. **Types / contract**
   - `RaceProjectFleetBoat`: `id`, `name`, `category`, optional `visibility`, `mapVisible`, `plannedLat`, `plannedLon`.
   - `parseRaceProject` / `buildRaceProject` round-trip. Old packs without `fleet.boats` still parse (`boatIds` + names URL as today).
   - Update `docs/contracts/race-project.md` and `src/projects/types.ts`.

2. **Save**
   - `saveCurrentRaceProject` / snapshot builder must write `fleet.boats` from `fleetPanel.getState().boats` (plus planned POV if already session-only — boats are required; POV planned is nice-to-have if cheap).
   - Do not leave `boatNamesUrl` as the only name source for custom rows. Keep the URL for demo packs; custom names live in `fleet.boats`.

3. **Load**
   - `applyLoadedRaceProject`: `setState.boats` from `project.fleet.boats` when present. Upsert those names into the scene catalogue. **Do not** replace the list with the entire names-URL catalogue.
   - Soft race switch / Load dropdown must keep custom ids after restart (pack on disk is source of truth).

4. **3D spawn without telem**
   - After allow-list change and on add-boat: `ensureBoat(id)` and `applyPose` from planned GPS (GEO `gpsToEnu`) or origin offset.
   - Scene API as needed (`upsertStaticBoat`, `syncFleetHulls`, …). Live `onPose` still updates the same entity.
   - Delete boat: dispose mesh (already via `setFleetAllowLists` orphans).
   - Frame fleet / free cam should see the new hulls (`frameFleet` count > 0 without packets).

5. Tests
   - Parse/build: custom boats survive without names URL.
   - Scene: allow-list id with no poseBus events still has a mesh at planned ENU.
   - Load fixture with `fleet.boats` does not inject extra catalogue-only demo ids into the panel list.

6. Docs: `src/scene/README.md`, fleet panel comment (session is cache; pack is persist), `src/scene/fleetLivePanel.ts` header.

## Out of scope

- Ocean / wind / FPS clocks.
- Buoy rounding arrows (SCN-02).
- Per-boat glTF library picker (unless already on the row).
- Writing `config.json` boatIds (session/pack only, same as today).
- Changing mock spine fixtures (do not force demo replay to emit new ids).

## Likely files

- `src/projects/types.ts`, `parseRaceProject.ts`, `buildRaceProject.ts`
- `docs/contracts/race-project.md`
- `src/main.ts` (`saveCurrentRaceProject`, `applyLoadedRaceProject`, `applyFleetToScene`, `seedPlannedFleetOnMap`)
- `src/scene/createScene.ts`, `src/scene/boatEntity.ts` (only if applyPose needs a static flag)
- `src/scene/fleetLivePanel.ts`
- Tests under `src/projects/` and `src/scene/`

## Inputs provided

- Load bug: `src/main.ts` `applyLoadedRaceProject` catalogue dump (~1083).
- Spawn bug: `src/scene/createScene.ts` `onPose` → `ensureBoat` only.
- Map seed already: `seedPlannedFleetOnMap` + `FleetBoatRow.plannedLat/Lon`.

## Acceptance criteria

- [ ] Add a boat, set solid, no live/mock packets for that id → **hull visible** in 3D (procedural/glTF as today).
- [ ] Move it via map place / planned lat lon → hull follows without telem.
- [ ] Save (Electron folder or download) then Load that pack → **same boat ids and names**, not a reset to Bora Aksu 21–24 unless that pack actually contains them.
- [ ] Demo-istanbul pack without `fleet.boats` still loads as today (names URL).
- [ ] Ghost/hidden still work on static hulls.
- [ ] `npm test` + `npm run build` green.

## Report back

When done, reply with:
1. Summary (static pose policy, JSON shape, Load path fix)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN + PLT memo bullets
