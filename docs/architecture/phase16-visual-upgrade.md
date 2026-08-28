# Phase 16 — Visual upgrade & ops QoL (design)

**Owner:** BW (design) → SCN workers
**Requested:** 2026-08-18 (user, after Phase 15 accept). Reference images: SailGP broadcast frame (billboard band + mast flags), cruising sailboat render, circular two-arrow icon.
**Status:** Locked; dispatches `DSP-SCN-20260818-04…09`.

## User locks (2026-08-18)

| Topic | Lock |
| --- | --- |
| Sea shimmer | Bug — whitecap/streak sparkle is stable when still, glitchy when camera moves. Fix in shader (AA), not by hiding foam. |
| Wind VFX | **Moving string/streamline VFX in 3D.** Visible on **ops preview + 3D NDI only, never the AR plate** (same gate as the realistic environment). |
| Terrain sea | Our Gerstner ocean must cover **all** water; Cesium's baked sea must not poke through. User acknowledges the lift-Y idea was wrong (terrain "sea" is sometimes higher). Solution = hide terrain **water**, keep land. Prefer Cesium capability; else lightweight shader; no new service required. |
| Buoy arrows | **Universal**: every mark/buoy/gate end shows the two-arrow ring **by default**; Details can set direction (CW/CCW) or Off. (Phase 15.3 shipped opt-in; user's own packs showed nothing.) |
| Billboards | Sponsor panels need a **frame/background** (SailGP style board), not a bare floating logo. |
| Boat model | **Procedural sailboat** from primitives (hull, mast, boom, main + jib). Sail (the fabric) tintable by color; optional flag/texture slot. glTF can replace later. |
| Category colors | Fleet category gets a **preset color palette** (pick from ~10 named colors) instead of free-text-only. |
| Nametags | Tag plate connects to the **sail/mast top with a leader line** (SailGP mast-flag look). |
| Ops layout | BW decides the grouping (below). |

## 1. Sea shimmer under camera motion (SCN-04)

Whitecaps (Jacobian), gust streaks, and glitter are procedural value-noise evaluated per fragment. Procedural noise has no mip chain, so under camera motion the sample points sweep across high-frequency detail → temporal aliasing ("boiling"). Clipmap recentering (2 m quantized steps) adds vertex-level resampling pops on the coarse rings.

Fix directions (worker picks the cheapest combination that kills the boil):

- Replace/augment procedural noise with a small tileable noise **texture** (e.g. 256², `LinearMipmapLinear`, repeat) so GPU mips band-limit it automatically.
- `fwidth()`-scaled smoothstep edges on foam/streak masks (wider transition at grazing/distant pixels).
- Distance/angle fades: whitecap + glitter contribution → 0 well before the far rings; coarse rings carry almost no high-frequency shading.
- Verify all noise/foam sampling is anchored in **world XZ** (not clipmap-local), so recentering does not shift patterns.

## 2. Terrain water removal (SCN-04)

Cesium World Terrain (quantized-mesh) can serve a per-tile **water mask** (`extensions=watermask`). Preferred: request/read it via the `3d-tiles-renderer` QuantizedMesh plugin and `discard` water fragments in the tile material (patched via `onBeforeCompile` traversal, same place any tile-material patch would live).

Fallback (if the plugin cannot surface the mask cheaply): **height discard** — drop terrain fragments whose world Y is below a threshold AMSL (uniform, default ≈ +0.5 m, adjustable per venue next to the existing terrain altitude nudge). Istanbul has no meaningful land below sea level; acceptable artifact is a sliver of our ocean overlapping the very shoreline, which the existing shore foam masks visually.

Gate: only active while the realistic ocean is mounted (simple env keeps terrain untouched). Note: discarded water fragments also stop writing the shore-foam depth prepass — that is correct (sea must not read as land).

## 3. Wind strings (SCN-05)

Windy-style animated streamlines: ~100–200 short polyline "strings" drifting above the water along the wind travel vector, fading in/out over their life, speed/length scaling with `speedMs`, gone at calm. One draw call (`LineSegments` or thin quads), CPU-updated or shader-phase-animated; no particles framework, no extra FBO.

Visibility: mounted inside the realistic environment (already never on AR/transparent/chroma) → ops preview + 3D NDI only. Direction from `windBus` / `windTravelSceneXZ` (from-000° → +Z); reuse the ramped direction the ocean uses so strings and swell agree.

## 4. Universal buoy rounding (SCN-08)

`effectiveRounding(undefined)` becomes **`'cw'`** for mark/buoy/gate features (was `none`). Explicit `'none'` hides. Old packs and the user's saved packs now show rings everywhere without editing. Inspector Details default shows CW; only non-default (`ccw`/`none`) needs persisting. Ring visibility polish: bigger default radius vs. buoy body and high-contrast color so it reads from drone height.

## 5. Billboard frame/background (SCN-07)

SailGP-look board: opaque background panel (default white), inner logo area, dark border frame, small margin — for **both** textured and procedural sponsors (today a `textureUrl` replaces the whole panel with a floating logo). Optional additive fields `panelColor` / `frameColor` on sponsor features; defaults need no data change.

## 6. Procedural sailboat + category colors + tag leader (SCN-06)

- New `createProceduralBoatVisual`: hull with bow taper + deck + keel, mast, boom, **mainsail + jib** as curved double-sided planes. Named materials: `hull`, `sail`. ~a few hundred tris.
- Sail tint = boat color (category palette); hull keeps existing tint path. Optional additive `sailTextureUrl` per boat row (flag on the sail) — slot only, no picker UI required this phase.
- **Category palette:** fleet row color picked from ~10 presets (red, blue, green, orange, pink, purple, yellow, cyan, white, slate). Stored as `color` on the fleet row; persisted additively as `color` in `RaceProject.fleet.boats[]`; feeds hull/sail tint, map dot, tag accent (existing `mergeBoatName` color path).
- **Tag leader line:** thin line from the mast-top anchor (named node) up to the tag sprite; tag rides above mast height. Line color = boat color; `depthWrite: false`.

## 7. Ops layout (SCN-09) — BW grouping

Two-rail layout; grouping by task, not by module history:

| Zone | Contents |
| --- | --- |
| **Left rail — Race setup** | Project (picker/Save/Load/rename) · Fleet & Live (boats, drones, connect) · Assets inspector · World authoring open button |
| **Right rail — Broadcast** | Output (mode, NDI channels, delay) · Calibration · Environment (simple/realistic, sea quality, ion token, terrain water-discard m) · Wind (source, from-deg, hold) |
| **Top strip (exists)** | Local view switcher · status: preview fps, boot message |

- Rails are collapsible accordions; open/closed state persisted (sessionStorage). Sections keep their existing DOM modules — this is a **re-homing**, not a rewrite of panel internals.
- Both rails resizable (reuse existing left-rail drag).
- Stream/authoring map overlay behavior unchanged.

## Out of Phase 16

FFT ocean, boat wakes, glTF sailboat, sail flag picker UI, 2D map Unity PNG arrows, 60 fps NDI 3D, dockable floating panels.
