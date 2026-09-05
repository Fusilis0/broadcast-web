# Dispatch DSP-SCN-20260902-02-pack-features-replace-world

## Meta
- From orchestrator: SCN (operator: empty pack + leftover 3D chain)
- Worker role: WORKER(DSP-SCN-20260902-02-pack-features-replace-world)
- Priority: P0
- Phase: 19.9 / pack load — world replace
- Related: `loadWorldForProject` in `src/main.ts`; fleet.boats `[]` is already complete (do the same for `features`)
- Worker result: **code done 2026-09-02** — `features` present (incl. `[]`) remounts only; URL path remounts empty first. Human Electron smoke still needed for 3D/AR chain gone.

## Goal

Loading a RaceProject that **has a `features` array** (including **`[]`**) must show **only** that world. Do not pull demo-istanbul course / sponsors / flags / extras. Switching from a pack with a billboard chain to an empty pack must **remove** the chain from 3D and AR, not only from Assets / World Authoring.

## Background — two bugs, one root

Operator pack `empty` has `"features": []` plus leftover `courseUrl` / `sponsorsUrl` / `flagsUrl` pointing at `/fixtures/…/demo-istanbul.json`.

`loadWorldForProject` today:

```ts
if (packFeatures && packFeatures.length > 0) {
  remountWorldFromFeatures(world)
} else {
  loadCourseFromUrl(courseUrl)
  loadSponsorsFromUrl(sponsorsUrl)
  loadCountdownFlagsFromUrl(flagsUrl)
  loadWorldExtrasFeatures()
}
```

`[]` is truthy-length-fail → **fixture merge**. Editor/map then show those demo marks. Save keeps writing the URLs, so it never heals.

Second bug: the URL branch **does not** call `remountWorldFromFeatures`, so it never `billboardChains?.dispose()`. After 30agustos → empty, Assets/authoring have no chain (map got the merged-or-empty list) but **3D/AR still show the previous chain**.

Contract (`docs/contracts/race-project.md`): fixture URLs are **compat when `features` omitted**. Same pattern as `fleet.boats` including `[]`. The footnote “non-empty features” is wrong — **present `features` (any length) is complete**.

## In scope

1. If `project.features` is an **array** (including empty): `clone` + `remountWorldFromFeatures` only. **Do not** load `courseUrl` / `sponsorsUrl` / `flagsUrl` / `loadWorldExtrasFeatures` / default `loadPositionMarkersFromUrl`.
2. `remountWorldFromFeatures([])` must dispose course, sponsors, flags, line signs, world buoys, **billboard chains**, position markers (verify dispose order; empty for3d must still run dispose).
3. Fixture URL path **only** when `features` is `undefined` (old packs). That path must still **dispose leftover 3D** (chains included) before mounting URLs — e.g. remount empty first, or dispose chains in the URL loaders. No orphan meshes from the previous pack.
4. Tests: helper or `loadWorldForProject` extract — `features: []` + demo URLs → `[]` and remount, not fixtures. `features` omitted → URL path. Billboard dispose on empty remount (unit if you can without GPU; otherwise assert dispose called / handle null).
5. Docs: `race-project.md` footnote; `src/projects/README.md` / features README one line.
6. Optional but useful: Save may keep writing URLs (compat); do **not** require stripping them. Load must ignore them when `features` is present.

## Out of scope

- Cesium vendor, 19.17 remount split, library picker, explicit Load button (already shipped)
- Rewriting operator JSON by hand (code must respect `features: []`)
- Clearing `boatNamesUrl` / `replayUrl` (not world geometry)

## Likely files

- `src/main.ts` (`loadWorldForProject`, `applyWorldFeatures`)
- `src/scene/createScene.ts` (`remountWorldFromFeatures` dispose on empty)
- `src/scene/billboardChain.ts` if dispose is incomplete
- `docs/contracts/race-project.md`
- tests next to projects or scene

## Acceptance criteria

- [ ] Load pack with `features: []` and demo `courseUrl`/`sponsorsUrl`/`flagsUrl` → World Authoring, Assets, 3D, AR show **no** demo marks/gates/sponsors/S/F/flags.
- [ ] Load 30agustos (chain in 3D) then Load `empty` → chain **gone** from 3D and AR; not only missing from Assets.
- [x] Old pack **without** `features` key still loads from fixture URLs.
- [x] `npm test` + `npm run build` green.

## Report back

1. Exact `features` present vs omitted branch
2. How empty remount disposes chains
3. Files / tests
4. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260902-02-pack-features-replace-world).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260902-02-pack-features-replace-world.md
2. src/main.ts loadWorldForProject (length > 0 vs URLs)
3. src/scene/createScene.ts remountWorldFromFeatures (billboardChains.dispose)
4. docs/contracts/race-project.md features vs courseUrl

If project.features is an array (including []), remount that world only — ignore demo fixture URLs. remount([]) must dispose billboard chains and other 3D. URL fallback only when features is omitted. Same completeness rule as fleet.boats []. No Cesium vendor change.
Report back per dispatch.
```
