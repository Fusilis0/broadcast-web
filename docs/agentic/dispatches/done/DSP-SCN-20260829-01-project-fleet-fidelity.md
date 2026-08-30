# Dispatch DSP-SCN-20260829-01-project-fleet-fidelity

## Meta
- From orchestrator: BW (route to SCN)
- Worker role: WORKER(DSP-SCN-20260829-01-project-fleet-fidelity)
- Priority: **P0 ★**
- Phase: 18.4
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active**

## Goal

Saving a project must record exactly the fleet that exists, and loading a project must produce exactly the fleet in that file — no more, no fewer. Today, loading a project brings back the demo boats 21/22/23/24 even when the saved file does not contain them.

Operator lock, verbatim: **"if project have boats on save inject them dont inject any other boat."**

## Background

BW traced the injection before dispatching; it is not a stale-scene-cleanup bug.

`parseRaceProject` runs the fleet ids through `normalizeBoatIds`, which is a **config** helper, not a project helper:

```111:132:src/config/loadConfig.ts
export function normalizeBoatIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_BOAT_IDS]
  // ... filter to band 21–52 ...
  return out.length > 0 ? out : [...DEFAULT_BOAT_IDS]
}
```

`DEFAULT_BOAT_IDS` is `['21','22','23','24']` (`loadConfig.ts` L16). Two consequences:

1. Any id outside the **21–52** band is silently stripped. Live work now uses ids like `"1"` and `"2"`, so those vanish.
2. Once stripping (or an intentionally empty fleet) leaves the list empty, the four demo ids are substituted. This runs on **load** and again on **save**, because `buildRaceProject` ends by re-parsing its own output (`buildRaceProject.ts` L135).

The untracked `public/races/test/project.json` in the working tree is this bug frozen in amber: `fleet.boats[]` describes ids `"1"` and `"2"`, while `fleet.boatIds` says `["21","22","23","24"]`. On load, reconstruction is keyed off `boatIds`, so the real boats are ignored and four demo boats appear with catalogue names from `public/fixtures/boats/demo-istanbul-names.json`.

Two secondary paths make it worse and are in scope:

- `buildRaceProject.ts` L78–92 writes `fleet.boats` **only if** the array is non-empty, so an emptied fleet is saved as an omission, which the loader then treats as a legacy pack and refills from `boatIds` + the catalogue.
- At boot, session storage can override the loaded pack: `main.ts` L2456–2465 prefers `sessionFleet.boats` over the pack's boats when the session has any. A stale session therefore beats the file.

## In scope

1. **Stop using the config normaliser for project fleets.** Give project parsing its own fleet reader that accepts **any non-empty string id**, preserves author order, deduplicates, and allows an **empty** fleet to stay empty. `normalizeBoatIds` keeps its current behaviour for `config.boatIds` when no project is loaded, and for the mock source — do not change those defaults.
2. **Save writes the truth.** Always emit `fleet.boats` (including as `[]`), and keep `fleet.boatIds` in exact sync with `boats[].id` — same membership, same order. A save must round-trip through the parser without any id being added, removed, or reordered.
3. **Load applies the file, nothing else.** When `fleet.boats` is present it is the complete fleet; do not top up from the names catalogue or from `boatIds`. When `fleet.boats` is absent (legacy packs), keep today's behaviour of deriving rows for each `boatIds` entry from the catalogue — that path must not regress. Never substitute `DEFAULT_BOAT_IDS` during a project load, including when the file's fleet is empty.
4. **Session storage must not override a loaded pack.** When a project is loaded (deeplink `?race=` at boot, or `switchRace` later), the pack's fleet wins over the session snapshot. The session snapshot remains the source only when no project has been loaded.
5. **Scene cleanup on load.** Loading project B after project A must leave no boat, hull, map dot, or tag from A. `setFleetAllowLists` and `syncFleetHullsFromPanel` look correct already; add coverage rather than assuming.
6. Update `docs/contracts/race-project.md` — the `fleet.boatIds` band-21–52 requirement is no longer true, `fleet.boats` is now always written, and an empty fleet is legal.

## Out of scope

- Any other asset type. The operator explicitly said the rest of the assets are fine: **do not** touch features, sponsors, buoys, course, calibration, or output settings in save/load.
- Telemetry-driven boat creation semantics. The scene's `isAllowedBoatId` gate stays as it is.
- The Flow / Live JSON panel showing deleted ids — that is `DSP-TEL-20260829-02`.
- Fleet panel visual redesign.

## Likely files

- `src/projects/parseRaceProject.ts` — fleet reading
- `src/projects/buildRaceProject.ts` — always write `boats`, keep ids in sync
- `src/projects/fleetBoats.ts` — `snapshotFleetBoats` / `resolveLoadedFleetBoats`
- `src/config/loadConfig.ts` — leave `normalizeBoatIds` behaviour intact; only stop project code from calling it
- `src/main.ts` — `applyLoadedRaceProject`, boot session-vs-pack precedence (L2456–2465)
- `src/projects/applyRaceProjectToConfig.ts`
- tests alongside each, `docs/contracts/race-project.md`

## Inputs provided

- Broken artefact to use as a fixture: `public/races/test/project.json` (untracked) — `boats[]` for `"1"`/`"2"`, `boatIds` `["21".."24"]`. Loading it today shows four demo boats; after this dispatch it must show exactly the boats the file describes.
- Demo catalogue that supplies the misleading names: `public/fixtures/boats/demo-istanbul-names.json`.
- Known test gaps to close: no round-trip test for an empty fleet, none for out-of-band ids, none for load clearing a previous project's fleet, none for the session-override-at-boot path.

## Acceptance criteria

- [ ] Save a fleet of ids `["1","2"]` → reload → exactly `["1","2"]`, correct names, and no id 21–24 anywhere.
- [ ] Save a fleet with **zero** boats → reload → zero boats. No defaults appear.
- [ ] A legacy pack with `boatIds` and no `boats[]` still loads with catalogue names, unchanged from today.
- [ ] `boatIds` and `boats[].id` are identical in membership and order in every file this code writes.
- [ ] Load project A (4 boats) → load project B (1 boat) → exactly one boat in the fleet panel, in the 3D scene, and on the 2D map.
- [ ] A stale session fleet does not override a project loaded via `?race=` at boot.
- [ ] `normalizeBoatIds` still returns the four defaults for a missing/empty **config** `boatIds`, and mock mode is unchanged.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** in Electron, delete every default boat, add one boat with id `1`, Save, restart the app, Load — one boat, id `1`, nothing else.

## Report back

1. Where the injection was cut and what now governs the fleet on load
2. Files touched
3. Tests added, especially the empty-fleet and out-of-band round-trips
4. Follow-ups / blockers — in particular, whether any pack already on disk needs migrating
5. Suggested memo bullets for SCN
