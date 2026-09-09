# Dispatch DSP-SCN-20260907-03-osm-buildings-visible

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260907-03-osm-buildings-visible)
- Priority: **P0**
- Phase: **20.1a Fail follow-up** — OSM Buildings must actually draw volumes
- Related: `active/DSP-SCN-20260907-01-osm-buildings.md` (code-accept; **Human Fail 2026-09-07**). Design: `docs/architecture/3d-environment-buildings.md`.
- **DSP-02 (heroes) stays blocked** until this Pass.
- Hold Gerstner/ocean rewrite. No CesiumJS. No Google Photorealistic. No IBB. No MapTiler engine. No NDI/`STUDIO_TICK_FPS`. No SRT.
- Worker result: **code done 2026-09-07**. SCN **code-accept**. **Human Pass 2026-09-07** — operator 3D: white OSM boxes on Bing hills + Gerstner (Historic Peninsula / Bosphorus). Follow-up look: `DSP-SCN-20260907-04-grey-aerial`.

## Goal

On local **3D**, with **buildings** checked and an ion token, the operator must see **extruded OSM massing** (grey/tan boxes) on the İstanbul shore — not only Cesium World Terrain hills with aerial drape.

## Background

Human Fail (same session as 01): Load pack → Environment **realistic** → buildings **checked** → local **3D**. Shot is Bosphorus water + Senexus ribbon + **Bing-draped green hills**. **No building volumes at all.** Terrain on/off is not the bug — terrain is drawing; the second tileset is not.

01 already mounts `src/scene/buildings/` (ion **96188**, no quantized-mesh, occupancy stub, default ON, AR-gated). Unit tests are stubbed (`skipIonPlugins`) so they never proved a 3DTILES mesh appears.

Likely causes (worker must **prove** with logs + a visible mesh; do not shotgun all of them):

1. **3DTILES load path unlike terrain.** Terrain uses `QuantizedMeshPlugin`. OSM Buildings is **b3dm / glTF**. Register `GLTFExtensionsPlugin({ rtc: true })` from `3d-tiles-renderer/plugins` on the buildings renderer (not on World Terrain). Built-in `B3DMLoader` already applies `RTC_CENTER`; the plugin still covers glTF/glb + `CESIUM_RTC`. **Do not** register `QuantizedMeshPlugin` or Bing overlay on buildings.
2. **Globe ADD refinement.** Cesium OSM Buildings is a **planet-sized** tileset with **ADD** refinement + REGION bounds. Upstream: [NASA-AMMOS/3DTilesRendererJS#662](https://github.com/NASA-AMMOS/3DTilesRendererJS/issues/662) / [#663](https://github.com/NASA-AMMOS/3DTilesRendererJS/issues/663) — empty picture until SSE/cache is right. On **this** `3d-tiles-renderer@0.5.1` the API still has `loadSiblings`. Set **`loadSiblings = false`** on the buildings `TilesRenderer` only. If tiles still never appear, raise buildings `errorTarget` (try **16**, Cesium-like) and log it. Do **not** set LRU to 6000 (VRAM). Keep 256 MiB `UnloadTilesPlugin`.
3. **Occupancy `onBeforeCompile` on every mesh even when holes are `[]`.** If that injection fights `TilesFadePlugin` shaders, **every** building mesh can fail silently. **Skip occupancy patch + mesh-hide when hole count is 0.** Test that a fade-like shader still has a working `main` after optional patch.
4. **Blind status.** Environment hint / `[buildings]` logs must show ion 401 vs `visibleTiles.size === 0` vs credits. Operator could not tell “off” from “empty globe”.

Reorientation / `amslToHae` / shared nudge stay as in 01. If meshes load but sit **under** the hills by many metres, log world Y vs terrain and **stop** — that is GEO, not a guessed geoid.

## In scope

1. Make OSM Buildings **visible** on local 3D with the existing checkbox + token + opaque gate. Keep AR/chroma **off**.
2. `GLTFExtensionsPlugin({ rtc: true })` on the buildings tileset only.
3. Buildings `TilesRenderer`: `loadSiblings = false`; optional `errorTarget` bump with a named constant + comment citing ADD/REGION. Still no quantized-mesh / Bing on this renderer.
4. Occupancy: no shader patch / hide when `normalizeOccupancyHoles` is empty. `setOccupancyHoles` still works for DSP-02.
5. Diagnostics (default quiet except `console.info`/`warn` on load-root, load-error, and a periodic or first-visible `visibleTiles` count). Surface a short buildings clause on the existing Environment status line (`Buildings: on · tiles N` / `ion load failed`).
6. Tests: source still has **no** `QuantizedMeshPlugin` / Bing on `createBuildings.ts`; **does** register `GLTFExtensionsPlugin`; occupancy skip when `[]`; `loadSiblings` false (source or stub). `npm test` + `npm run build` as far as this DSP owns (pre-existing `library.test.ts` / OUT `tsc` are **not** yours).
7. README one-liner: why 01 showed no boxes.

## Out of scope

- Hero glTF (DSP-02)
- Rewriting `createTerrain.ts` internals, Gerstner, watermask
- CesiumJS, Google Photorealistic, IBB, MapTiler, facade shaders
- NDI pumps, SRT, `STUDIO_TICK_FPS`, library re-seed
- Upgrading `3d-tiles-renderer` unless 0.5.1 cannot draw 96188 after (1)–(3) — if you must bump, justify in report and do not break World Terrain

## Likely files

- `src/scene/buildings/createBuildings.ts`
- `src/scene/buildings/occupancy.ts` (+ tests)
- `src/scene/buildings/constants.ts`
- `src/scene/createScene.ts` / `stubHud.ts` only if status line needs a hook
- `src/scene/buildings/README.md`, `src/scene/README.md`

## Inputs provided

- Fail shot: terrain heights + aerial, **no** extruded boxes, buildings checked, realistic 3D, Senexus chain on the water.
- Ion **96188**, same token as terrain (terrain **is** working).
- Plugin list today: IonAuth 96188, fade, unload 256 MiB, UpdateOnChange, Reorientation. **No** GLTFExtensionsPlugin.

## Acceptance criteria

- [ ] Local **3D** + realistic + buildings on + token: Historic Peninsula / Beşiktaş / Üsküdar shows **3D boxes**, not photo-only roofs.
- [ ] Local **AR**: still no buildings.
- [ ] Buildings checkbox off: boxes gone; terrain/sea remain.
- [ ] Empty occupancy still does **not** hide the city. `setOccupancyHoles` still clips a disk in tests.
- [ ] Console or Environment status distinguishes 401 vs “tiles 0” vs tiles loading.
- [ ] No quantized-mesh / Bing on the buildings renderer. No ocean rewrite.

## Report back

1. Root cause (one sentence) + evidence (network / `visibleTiles` / shader).
2. Plugins + `loadSiblings` / `errorTarget` after the fix.
3. Occupancy skip-when-empty.
4. Files, suite counts, remaining blockers (buried volumes → GEO).
5. Suggested SCN memo bullets.

## Human smoke (after code-accept)

Hard-refresh. Load `30agustos` or `demo-istanbul` → Environment **realistic** → **buildings** checked → local **3D**. Orbit the European shore / Historic Peninsula **close** (street scale, not space). Expect grey/tan **building boxes** standing on the hills. AR: gone. Uncheck buildings: boxes gone.

**Good:** city massing.  
**Fail:** still only draped terrain (this DSP failed again).

## Worker paste

```
Role: WORKER(DSP-SCN-20260907-03-osm-buildings-visible)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260907-03-osm-buildings-visible.md
3. docs/agentic/dispatches/active/DSP-SCN-20260907-01-osm-buildings.md
4. docs/architecture/3d-environment-buildings.md
5. src/scene/buildings/createBuildings.ts
6. src/scene/buildings/occupancy.ts
7. node_modules/3d-tiles-renderer/src/three/plugins/GLTFExtensionsPlugin.js

Human Fail: buildings checkbox on, local 3D, only terrain heights — no extruded volumes.

Implement that dispatch only. Prove the tileset draws. No heroes. No CesiumJS. No Google Photorealistic. No ocean rewrite. No NDI/SRT.
```
