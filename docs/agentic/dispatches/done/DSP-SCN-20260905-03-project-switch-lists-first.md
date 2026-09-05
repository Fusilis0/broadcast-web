# Dispatch DSP-SCN-20260905-03-project-switch-lists-first

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260905-03-project-switch-lists-first)
- Priority: **P0**
- Phase: **19.17** — lists + 2D before 3D remount
- Related: `docs/agentic/handoffs/HO-PLT-SCN-20260905-01.md` (PLT investigation). Incoming `HO-SCN-PLT-20260905-01.md`. Keep `done/DSP-SCN-20260902-01-explicit-race-load.md` (Load button only). Keep `done/DSP-SCN-20260903-01-ar-3d-white-after-load.md` (`remountGen` stale abort).
- Hold Cesium vendor. Do not re-seed library. No NDI pump rewrite. No `STUDIO_TICK_FPS`.
- Worker result: **code done 2026-09-05** — packed Load: clone features → 2D + chrome + Fleet/Assets → yield paint → remount; `void restartIngest` after `setState`. Boot still awaits remount. Suite **1223 + 26**, build green. SCN **code-accept**. Await operator smoke.

## Goal

When the operator clicks **Load** to switch pack, **project chrome, 2D map, fleet list, and Assets list paint before** `await remountWorldFromFeatures`. 3D may fill in after. Do **not** `await restartIngest` before `fleetPanel.setState`.

Load stays **button-only**. Dropdown `change` must not `switchRace`.

## Background

PLT `DSP-PLT-20260905-01` (Vite `?debug1917=1`, Load, `demo-istanbul` ↔ `30agustos`):

| Stage | Wall |
| --- | --- |
| `loadRaceProject` | 5–84 ms (not the stall) |
| Electron `races.read` | 1–5 ms |
| `loadBoatNamesFromUrl` | 2–3 ms |
| **`remountWorldFromFeatures`** | **579–755 ms** — **primary** |
| `applyWorldFeatures` | 4–9 ms (today **after** remount) |
| `restartIngest` | 281–1713 ms — **after** `setBoatIds`, **before** `fleetPanel.setState` |

Today `loadWorldForProject` awaits remount (packed `features`) **then** `applyWorldFeatures` + HUD lists. `restartIngest` sits in front of `fleetPanel.setState`. Inner remount cost is sequential `mountSponsors` `Image()` + `mountBillboardChains` — **do not** rewrite those in this DSP; **reorder** `applyLoadedRaceProject` only.

`applyWorldFeatures` only needs GPS→ENU layout from world JSON. It does not need 3D meshes. Packed packs (`resolveWorldLoadSource` kind `features`, including `[]`) already have that JSON.

Cesium `createTerrain` is **not** on this Load chain (boot only).

## In scope

1. **Split read vs remount** in `src/main.ts`:
   - Packed `features`: clone world JSON **without** remount.
   - Then `applyWorldFeatures` (2D + editor) + project chrome (`setProjectMeta`, stream title, `setActiveRaceId`) + `setFleetAllowLists` + `hud.setBoatIds` / `setPovIds` + **`fleetPanel.setState`** + `assetInspector?.refresh` + map/hull sync.
   - **Then** start `remountWorldFromFeatures` (packed: one remount of that list; do not remount `[]` first). Do **not** await remount before the UI steps above.
   - URL fallback (`features` omitted): fetch/parse course/sponsors/flags JSON for 2D **without** mounting 3D if that is a small split; then remount later. If URL loaders always mount (`loadCourseFromUrl` disposes+mounts), do not expand this DSP into a loader rewrite — packed Load is the acceptance path (`demo-istanbul` / `30agustos` both embed `features`).
2. **Yield a paint** after the UI steps (double `requestAnimationFrame` or equivalent) **before** starting remount so the browser can show lists/2D while 3D is still the previous pack. Remount on the same turn as `setState` will still hitch the first frame.
3. **`restartIngest`:** must not run (awaited) before `fleetPanel.setState`. Start ingest after lists (fire-and-forget or await **after** setState). Keep Disconnect hold (`retainSlots` / do not reopen sockets on explicit Disconnect).
4. **Stale remount:** keep `remountGen` in `createScene.ts`. A second Load while remount is in flight must abort the old gen — do not leave AR/3D white (`DSP-SCN-20260903-01`). Prefer releasing `switchingRace` after UI schedule so Load is not stuck for 755 ms; do not overlap two full `applyLoadedRaceProject` config writes unsafely (serialize UI apply; remount uses gen).
5. **Boot** (`startScene` still calls `loadWorldForProject`): first boot may still **await** remount so 3D exists on first frame. Do not leave boot with an empty world forever.
6. Keep `?debug1917=1` `[19.17]` logs. Add/adjust stages so UI paint vs remount are distinct. Default off.
7. Tests: source-order (or a tiny extracted helper) proving `applyLoadedRaceProject` does not `await remountWorldFromFeatures` / `await loadWorldForProject` before `fleetPanel.setState`; `restartIngest` is not awaited before `setState`. Load-button-only tests stay green. README one-liner. `npm test` + `npm run build`.

## Out of scope

- Rewriting `mountSponsors` / ribbon textures / Cesium / `createTerrain`
- Auto-load on dropdown (`DSP-SCN-20260902-01`)
- Electron `races.read` / `loadRaceProject` (PLT named those fast)
- Library re-seed, NDI pumps, `STUDIO_TICK_FPS`, 19.2b chrome
- World-origin Apply path (`applyWorldOrigin` may still await remount)

## Likely files

- `src/main.ts` (`loadWorldForProject`, `applyLoadedRaceProject`, `applyWorldFeatures`, boot call ~2510)
- `src/projects/worldLoadSource.ts` (reuse; packed vs URLs)
- Tests near `worldLoadSource.test.ts` / `localProjectControls.test.ts` / a `main` source-order test
- `src/projects/README.md` or `src/scene/README.md` one-liner
- Keep `?debug1917=1` helper in `main.ts` / `loadRaceProject.ts`

## Inputs provided

- `HO-PLT-SCN-20260905-01` wall times above.
- Packed path: `resolveWorldLoadSource` kind `features`.
- `remountGen` already skips stale remount after dispose / after course / after sponsors.

## Acceptance criteria

- [x] Load pack A → Load pack B: Fleet + Assets + 2D map show pack B **before** 3D finishes (old 3D for a beat is OK). *(code)*
- [x] `fleetPanel.setState` is not behind `await restartIngest`. *(code)*
- [x] Dropdown pick still does not load; only **Load** / Enter. *(code; existing tests)*
- [x] Rapid Load A then B does not leave AR/3D white (stale remount aborted). *(code; remountGen kept)*
- [x] `?debug1917=1` still logs stage ms; remount is **after** a UI-paint stage. *(code)*
- [x] `npm test` + `npm run build` green. *(1223 + 26; build green)*
- [ ] Operator smoke: Load `demo-istanbul` ↔ `30agustos`; lists+2D before 3D; no white on rapid Load.

## Report back

1. New order of `applyLoadedRaceProject` (bullet list)
2. How remount is started without blocking UI (yield + gen)
3. Ingest vs `setState`
4. Boot path still awaits remount? URL fallback?
5. Suite counts
6. Suggested SCN memo bullets
