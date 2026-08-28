# Geospatial terrain — Cesium ion 3D Tiles inside Three.js

**Status:** Landed (2026-08-17, `DSP-SCN-20260817-01`). Phase 14.1.
**Owner:** SCN (scene mount) + GEO (frame alignment) + PLT (token/config plumbing).
**Blocked by:** [`enu-frame-handedness.md`](./enu-frame-handedness.md) — **landed** 2026-08-17 (`z = −North`).
**Supersedes the "no Cesium" note in:** [`realistic-3d-environment.md`](./realistic-3d-environment.md)
(Phase 13.2 deliberately shipped a stylized `Water` + `Sky` with no terrain; this is the next step).
**Locked by user 2026-08-17:** Cesium **ion** (World Terrain + aerial imagery), **WebGL2** renderer,
venue is **online**.

---

## 1. Can we use Cesium with Three.js? Yes — but not CesiumJS

There are two different things called "Cesium" and only one of them fits:

| | What it is | Verdict here |
| --- | --- | --- |
| **CesiumJS** | A complete 3D globe *engine* with its own renderer, scene graph, camera and shader system | **Reject.** Running it beside Three.js means either two WebGL contexts (two GPU readbacks, two clears — fatal for the NDI pipeline) or a fragile shared-context hack. It also owns the camera, which our POV/calibration system must own. |
| **3D Tiles** — the *data format* (OGC standard) that Cesium ion serves | An open streaming format for terrain, imagery and photogrammetry | **Accept.** We consume the data, not the engine. |

The bridge is **[`3d-tiles-renderer`](https://github.com/NASA-AMMOS/3DTilesRendererJS)** (NASA-AMMOS
/ JPL, Apache-2.0, maintained by Garrett Johnson under a Cesium Ecosystem Grant). It is a native
Three.js implementation of 3D Tiles: tiles become ordinary `THREE.Mesh` objects under a
`THREE.Group` in *our* scene, lit by *our* lights, rendered by *our* `WebGLRenderer`, framed by
*our* calibrated POV camera.

**Compatibility:** `3d-tiles-renderer@0.5.1` declares `three: ">=0.167.0"`; we are on
`three@^0.178.0`. Its only runtime deps are `@mapbox/vector-tile`, `pbf`, `pmtiles`. No WebGPU
requirement. This is the one new production dependency Phase 14.1 needs.

## 2. Which Cesium ion data (matches the Unity setup)

The Unity project used Cesium World Terrain + aerial imagery, which is a *terrain + draped
imagery* pipeline rather than photogrammetry. The same combination is reachable from
`3d-tiles-renderer` via plugins:

| Plugin | Role |
| --- | --- |
| `CesiumIonAuthPlugin({ apiToken, assetId })` | ion token handling, asset endpoint resolution, token refresh, **and attribution collection** (§6) |
| `QuantizedMeshPlugin` | Decodes Cesium World Terrain's quantized-mesh format into tile geometry. Options that matter: `generateNormals: true` (needed for our lighting), `skirtLength`, `smoothSkirtNormals` |
| `ImageOverlayPlugin` + an image source (`XYZ` / `TMS` / `WMTS`) | Drapes aerial imagery onto the terrain. Bing via ion, or any XYZ provider |
| `ReorientationPlugin({ lat, lon, height, recenter: true })` | Places our race origin at scene `(0,0,0)` with the local surface pointing +Y (§3) |
| `TilesFadePlugin` | Cross-fades LOD changes. **Important for broadcast** — raw LOD pop is very visible on air |
| `UnloadTilesPlugin({ bytesTarget })` | GPU memory budget; frees hidden tiles |
| `UpdateOnChangePlugin` | Skips `update()` when nothing moved |

**Photogrammetry as an option, not the default.** Google Photorealistic 3D Tiles is also reachable
through the same renderer (`GoogleCloudAuthPlugin`) and looks dramatically better for a city like
Istanbul. It was **not** chosen because its licence requires the Google logo plus aggregated,
sorted per-tile data attributions to be displayed *whenever the content is shown*, with no
exceptions granted — a permanent burn-in on the broadcast plate. Keep the provider layer abstract
(§5) so this stays a per-venue decision rather than a rewrite.

## 3. Aligning the tileset with our ENU frame

This is the part that goes wrong quietly, so it gets its own contract.

`ReorientationPlugin.transformLatLonHeightToOrigin(lat, lon, height, …)` centres the tileset so the
given coordinate sits at the origin **"with X facing west and Z facing north"**. Our frame is
`x = East` (see [`enu-frame-handedness.md`](./enu-frame-handedness.md) — and note the plugin's
"X west, Z north" is itself a *right-handed* frame, which is exactly why our current mirrored frame
must be fixed first). Expect one 180° azimuth term; derive it, don't guess it, and pin it with a
test.

**Altitude is the second trap.** Three different vertical datums are in play:

| Datum | Used by |
| --- | --- |
| **HAE** (height above WGS84 ellipsoid) | Cesium terrain tiles, `ReorientationPlugin.height` |
| **AMSL / EGM96 geoid** | Our race origin (`config.origin.altMsl`, `setOriginAMSL`) |
| Scene `y = 0` | Course layout — `COURSE_WATER_Y = 0`, all marks forced flat |

Around Istanbul the geoid separation is roughly **+36 m**. Feed `origin.altMsl` straight into
`ReorientationPlugin.height` and the terrain sits ~36 m off vertically — enough to bury the course
or float the coastline. The repo already has the bridge: `amslToHae(lat, lon, altMsl)` in
`src/geodesy/egm96.ts`. **Contract: `ReorientationPlugin.height = amslToHae(origin.lat, origin.lon,
origin.altMsl)`.**

Even then, expect a residual offset. Cesium World Terrain is a global model and its sea surface
does not land exactly on the local MSL; the 3DTilesRenderer maintainer explicitly warns that
putting the mesh surface exactly at `(0,0,0)` is "not so straightforward". So:

- Expose a per-project **terrain altitude nudge** (metres, operator-adjustable, saved on the
  `RaceProject`). This is a normal part of venue setup, not a workaround.
- Re-run alignment on `GeoOrigin.onChanged` — the origin is editable at runtime from the ops HUD.

## 4. Terrain meets ocean: who draws the water

Cesium World Terrain has a flat sea surface at ~0 m with imagery draped over it (it is not
bathymetry). Our ocean plane ([`ocean-waves-and-sea-state.md`](./ocean-waves-and-sea-state.md))
wants the same place. Naïvely both render and you get z-fighting across the entire Bosphorus.

**Approach (16.1):** the Gerstner ocean is the only water. Terrain renders **land only**
while realistic ocean is mounted.

- **Water mask (shipped):** Cesium World Terrain quantized-mesh already serves the `watermask`
  extension. `3d-tiles-renderer` `QuantizedMeshLoader` parses it (extension id 2) and stores an
  inverted mask on `material.roughnessMap` (0 = water, 1 = land). We `discard` water fragments
  via `onBeforeCompile` on tile meshes (`src/scene/terrain/terrainWaterMask.ts`). Ion auth /
  `QuantizedMeshPlugin` registration order is unchanged (plugin still registered from
  `assetTypeHandler` after rootURL is the terrain CDN).
- **Height fallback:** tiles with no mask drop fragments whose world Y is below a uniform
  threshold AMSL (default **+0.5 m**, plus the existing altitude nudge). Istanbul has no
  meaningful land below sea level. Adjustable via `SceneHandle.setTerrainWaterDiscardYM` (next
  to the nudge API; Ops row is a later sidebar slice).
- **Gate:** hide is on only while the realistic ocean is mounted. `simple` env and
  transparent/chroma leave terrain materials drawing as before.
- Ocean lift is **~0.08 m** for z-fighting against land skirts only — covering Cesium's baked
  sea by raising the clipmap is dead (terrain water is sometimes higher than the lift).
- **14.2c shore foam:** discarded water fragments do not write the terrain depth prepass, so
  reconstructed land Y is land, not sea. Gated: terrain on + realistic mounted + opaque-clear.
  No `readPixels`, no `polygonOffset`. Extra draw cost is one terrain-only pass at ¼ pixels;
  skipped when terrain is off or AR is transparent/chroma.

## 5. Integration with the existing render architecture

Terrain is heavy and must respect the constraints Phase 13 established.

**Channel gating — reuse, don't reinvent.** Terrain is opaque, so it is subject to the exact same
rule as the realistic environment: it must **never** render into the AR transparent/chroma plate,
or it paints over the real camera footage in vMix. Reuse `setEnvironmentOpaqueClearSafe` /
`shouldShowRealisticEnvironment` rather than inventing a second gate — one gate, three consumers
(sky, ocean, terrain).

**Cameras.** `TilesRenderer` picks LOD from registered cameras. The scene has two that matter: the
ops preview camera (may be free cam) and the active POV air camera. Both must be registered via
`setCamera` / `setResolution`, otherwise the NDI pass renders whatever LOD the operator's screen
happened to ask for — including blurry tiles on air while the operator sees sharp ones.

**Frame budget.** The studio runs three NDI channels at 1920×1080 (AR 30 fps, 3D 10 fps, 2D off by
default) and Phase 13 already had to add FPS caps and readback staggering
(`src/output/ndiCaptureStagger.ts`) to keep the UI usable. Terrain adds draw calls, VRAM and — the
real risk — **shader compilation and tile upload hitches**, which show up as dropped NDI frames
rather than as a lower average frame rate. Mitigations, in order:

1. `TilesFadePlugin` for LOD transitions.
2. `UnloadTilesPlugin({ bytesTarget })` with an explicit VRAM budget.
3. A **"lock tiles" air mode**: once the shot is framed, stop LOD updates entirely
   (`UpdateOnChangePlugin` + a manual freeze). A broadcast camera is on a mostly-fixed drone
   position; continuously re-evaluating LOD buys nothing and costs frame stability.
4. A pre-warm pass at project load: fly the tile loader over the course bounds before air.

**Measure before tuning.** Terrain on/off frame-time deltas at 1080p with all three channels live
is an acceptance criterion, not an afterthought.

## 6. Attribution — open decision

Cesium ion + Bing imagery also carries attribution obligations (Bing logo and data copyrights);
`CesiumIonAuthPlugin` collects the strings for us. The user has not yet confirmed whether a
permanent on-screen credit is acceptable on the broadcast output.

Design so the answer can change late:

- Attribution is a **separate overlay component**, per channel, not something baked into the
  terrain material.
- Default: shown on the **3D** channel and in ops preview; **never** on the AR plate (which must
  stay a clean alpha key).
- If the answer comes back "no credit at all", the provider choice changes, not the architecture —
  fall back to a pre-baked per-venue tileset we generate and host ourselves.

**Action:** confirm with the rights holder / broadcaster before 14.1 ships.

## 7. Offline / caching

Venue is online, so this is not blocking. Still worth noting: `3d-tiles-renderer` fetches over
plain HTTP, so an Electron `session` cache or a custom protocol handler can persist tiles to disk
with modest effort. Recommend deferring to a Phase 14 follow-up and keeping the fetch layer
injectable so it can be added without touching the mount code.

## 8. Suggested slice (14.1)

1. **Prerequisite:** confirm and fix the ENU handedness finding.
2. Add `3d-tiles-renderer`; mount a `TilesRenderer` under a scene group behind a toggle defaulting
   **off**. Prove one Cesium ion tileset renders at all.
3. Alignment: `ReorientationPlugin` + `amslToHae` height + azimuth term + per-project nudge. Land
   the geodesy tests here.
4. Imagery overlay; lighting/tone match against the existing scene lights.
5. Ocean/terrain depth interaction (with 14.2).
6. Perf pass: multi-camera registration, fade, unload budget, lock-tiles air mode, measured frame
   times.
7. Attribution overlay + config/token plumbing (PLT: token lives in
   `public/config.json` so git shares it; Ops can paste + Apply).

## Open questions

| # | Question |
| --- | --- |
| 1 | Permanent on-screen attribution — acceptable, 3D-channel-only, or not at all? (§6) |
| 2 | Which ion assets exactly — Cesium World Terrain + Bing Aerial, or a specific venue asset the Unity project already used? Can we reuse the same ion account/asset IDs? |
| 3 | Is there budget approval for an ion Commercial plan, and does streaming quota cover a full show day? |
| 4 | Does the drone POV ever get low/close enough that terrain-draped imagery reads as flat and photogrammetry becomes necessary after all? |
