# Ocean rendering — waves, sea state, and the "can an AI generate it" question

**Status:** 14.2a landed (2026-08-17) — Gerstner clipmap + shared-clock time
(`DSP-SCN-20260817-02`). **14.2b landed (2026-08-17)** — Gerstner follows `windBus`
(`DSP-SCN-20260817-03`): `windTravelSceneXZ` → `atan2`, from-000° travels **+Z**,
direction/speed ramp 3 s, foam from `speedMs`, mild amplitude scale (no named
preset UI). **14.2c landed (2026-08-17)** — shore foam + shallow tint
(`DSP-SCN-20260817-04`): half-res terrain-only depth FBO when terrain **and**
realistic ocean are both mounted; Gerstner fragment uses reconstructed land Y
(neighbourhood taps). No tileset clip, no extra `readPixels`. Extra cost: one
terrain draw at ½ resolution per ocean-visible pass (skipped when terrain off
or the env is unmounted / chroma).
**15.2 landed (2026-08-18)** — `DSP-SCN-20260818-01`: clipmap rings overlap ≥ one
finer cell (T-junction hairlines gone); glitter cut to a single Blinn lobe
(`intensity 0.16`, `sharpness 78`); default inner **32** segs / **7** rings
(rim 6144 m past fogFar 5200 — inner 48→32 is the cost cut; 7→5 as default
would show the rim at 1536 m). `seaQuality` **high** \| **low** (Ops **sea** or
`?sea=low`): low is 5 rings + quarter-res foam. Follow stays `uClipmapCenter`.
**16.1 landed (2026-08-18)** — `DSP-SCN-20260818-04`: foam/streak/glitter use a
256² tileable mipmapped noise texture + `fwidth()` edges + distance/graze fade
(high-frequency shading gone before the outer rings). Sample **world XZ** so
clipmap recenter does not shift patterns. Ocean `liftY` is **0.08 m** (z-fight
only). Cesium water is discarded in the tileset shader while realistic ocean is
mounted — see [`geospatial-terrain-cesium.md`](./geospatial-terrain-cesium.md) §4.
**Owner:** SCN.
**Replaces:** the `three/examples/jsm/objects/Water` surface shipped in Phase 13.2
([`realistic-3d-environment.md`](./realistic-3d-environment.md)).
**Related:** [`geospatial-terrain-cesium.md`](./geospatial-terrain-cesium.md) §4 (who draws the
water where terrain meets sea) · [`wind-data-and-vfx.md`](./wind-data-and-vfx.md) (what drives the
wave direction).
**Locked by user 2026-08-17:** stay on **WebGL2**. Wave **direction must follow the wind** (P0).
Wave height/period following the wind is nice-to-have — **cut it if it is expensive** in either
development or runtime cost.

---

## 1. Why today's water is not enough

Phase 13.2 shipped `three/examples/jsm/objects/Water`: a **flat plane** with a scrolling normal
map, a mirror reflection render target and a sun-specular term. It has no vertex displacement — the
geometry never moves. That reads acceptably from a high drone shot and not at all from a low one,
and it has no concept of a wave direction to lock to the wind.

The reference image the user supplied shows what we are aiming past: a shaded sea with visible
directional structure, sun glitter, wakes, and real terrain on the horizon. The stated goal is
"even better than this".

## 2. Recommendation: build our own, Gerstner first

| Option | Verdict |
| --- | --- |
| Keep `Water` and add displacement | Dead end — the shader is not built for it, and we would fork it anyway |
| **Own module: Gerstner (P0) → optional FFT cascade (P1)** | **Recommended** |
| SeedOcean (open source, WebGPU-first with a WebGL2 Gerstner fallback) | Good reference to read; adopting it means inheriting a WebGPU-shaped API for the fallback path we would actually run |
| Three.js Water Pro (commercial) | **WebGPU only** — rejected by the renderer lock (§5) |
| OceanThreejs (WebGL2 Tessendorf FFT + Gerstner) | Not a library — a demo app. Excellent reference for the FFT path in 14.2b; check its licence before lifting code |

**Why our own:** the three things that make this project unusual are exactly the things an
off-the-shelf ocean does not do. It must (a) couple its direction to a live wind source, (b) obey
the `opaqueClearSafe` gate so it never leaks into the AR alpha plate, and (c) hold a predictable
cost at 1920×1080 across three NDI channels. All three are integration constraints, not rendering
research.

**Gerstner first, and possibly Gerstner only.** Sums of Gerstner (trochoidal) waves in the vertex
shader give directional swell with sharp crests and round troughs, run comfortably in WebGL2, and
have an explicit per-wave direction vector — which is precisely the P0 requirement. Cost scales
with wave count, so it is tunable down to whatever the frame budget allows. FFT/JONSWAP is more
physically faithful and better at fine chop, but it is a ping-pong compute pipeline with float
render targets, it is a much bigger build, and its wind coupling is indirect (through a spectrum).
**Ship Gerstner, evaluate on the real reference shot, and only then decide whether FFT is worth
it.**

### Surface geometry

An LOD'd surface, not one big plane: a **clipmap / concentric-ring grid centred on the camera**,
so vertex density is high near the boats and sparse at the horizon. This is what makes displacement
affordable and what stops the horizon edge from being visible. Reuse the existing scene `Fog` to
blend the far ring into the sky. **15.2:** coarser rings overlap the finer level by ≥ one finer
cell so T-junctions after Gerstner displacement sit inside the denser patch (no white hairlines).
Follow is a quantized `uClipmapCenter` uniform, not `mesh.position.xz`.

### Shading

The wave *shape* is only half the look. Budget real time for:

- Fresnel-weighted mix of sky reflection and depth-tinted refraction.
- Sun glitter (a **mild** Blinn specular against the `Sky` sun direction — must stay consistent with
  the existing `sun` directional light; 15.2 cut the dual high-powered glint that bleached a
  quadrant of the frame).
- **Whitecaps from the Gerstner Jacobian** — foam where the surface compresses. Cheap, and it is
  the single biggest cue that sells "windy" versus "calm". **16.1:** Jacobian/crest/streak/glitter
  masks are band-limited (mipmapped 256² noise + `fwidth()` + fade with distance and grazing
  angle) so they do not boil under camera motion.
- **Shore foam and shallow tint from the terrain depth buffer** (see
  `geospatial-terrain-cesium.md` §4). Free once terrain exists. Discarded Cesium water no longer
  writes that depth, so foam reads land edges instead of baked sea.
- Boat wakes — deferred to 14.2c; a wake needs a separate dynamic texture written per boat and is
  its own slice.

## 3. Sea state: what the wind actually drives

Requirement priority, per the user:

| | Driven by wind | Priority |
| --- | --- | --- |
| Wave **direction** | Yes — the whole swell train aligns to the wind vector | **P0** |
| Whitecap / foam amount | Yes — scales with wind speed | P0 (nearly free once foam exists) |
| Wave **height** | Optionally | P1 — cut if costly |
| Wave **period / wavelength** | Optionally | P1 — cut if costly |

Direction is the cheap one: it is a uniform, and changing it costs nothing at runtime. Height and
period are *also* just uniforms in a Gerstner sum — the expense is not GPU cost but **look-dev and
tuning time**, because a naive height change makes the sea look like jelly unless wavelength,
steepness and foam threshold move together. So the honest framing is: direction and foam are
in scope; height/period should be exposed as **operator presets** (calm / moderate / choppy) that
move all the coupled parameters together, with automatic wind→preset mapping as a stretch.

**Transitions must be smooth.** Wind data updates in steps (an API poll, an operator edit). Ramp
the direction and amplitude uniforms over several seconds — a sea that snaps 40° between frames is
an obvious on-air artefact.

## 4. Can an LLM generate the sea model? — direct answer

**Not as a 3D model, and that framing is the trap.** A realistic ocean is not an asset; it is a
simulation plus a shader. Generative 3D tools (Meshy, Tripo, and similar) output static meshes with
baked normals. A static mesh cannot animate, cannot tile seamlessly to the horizon, cannot LOD, and
cannot rotate its wave train to follow the wind. Buying or generating a "sea model" would give us
something strictly worse than what already ships.

**Where AI genuinely helps:**

- Writing the GLSL — Gerstner sums, Jacobian foam, Fresnel/specular terms, and the clipmap geometry
  are extremely well-represented in training data. This is a good use.
- Producing look-dev targets: reference frames of "Bosphorus, afternoon, 12 kt from the north" to
  tune against.
- Generating the *ancillary* textures (foam masks, detail normals, spray sprites), where a static
  image is genuinely the right output format.

So: **no third-party sea model; yes to AI-assisted shader authoring.** The one thing worth buying
would be a WebGPU ocean library, which the renderer lock rules out.

## 5. Renderer: staying on WebGL2 (and why that is right)

The best-looking ocean libraries available today are WebGPU-first. We are staying on WebGL2, which
is the correct call for this codebase for reasons beyond preference:

- **The NDI capture path depends on synchronous readback.** The pumps call `readPixels` /
  `readRenderTargetPixels` inline on the studio tick. WebGPU has no synchronous readback — buffer
  mapping is promise-based. Moving to `WebGPURenderer` means rebuilding all three pumps, the
  opaque/transparent pass switching (`ndiOpaquePass.ts`) and the capture stagger around async
  frames. That is a Phase-sized project with real on-air regression risk, for a rendering upgrade.
- **Electron's WebGPU story still needs flags** and is hardware/driver-sensitive — on a machine
  where we are *already* fighting integrated-vs-discrete GPU selection, that is not a fight worth
  picking mid-project.
- `3d-tiles-renderer` works fine on WebGL2, so terrain does not push us the other way.

WebGL2 can absolutely carry this: float render targets, MRT and instancing are all available, so
even the FFT path stays open. Revisit WebGPU only if look-dev proves WebGL2 is the binding
constraint — and if so, do it as a deliberate migration phase, not as a side effect.

## 6. Integration constraints (non-negotiable)

- **Alpha gate:** opaque ocean must never render on the AR transparent/chroma plate. Same
  `setEnvironmentOpaqueClearSafe` gate as sky and terrain — one gate, three consumers.
- **Animation clock:** there is a known Phase 13 gap — `realisticEnv.tick` runs on the scene tick
  but *not* inside the 3D NDI pump's `directRender`, so when AR is transparent the water can appear
  frozen on the `broadcast-web-3d` output. **Fix this as part of 14.2**, not as optional polish;
  a static ocean on air is worse than no ocean.
- **`waterCue` overlap:** the existing course-bounded tinted pad (`src/scene/course/waterCue.ts`)
  sits at `y = -0.12`. Decide explicitly whether it survives as a branded "race area" tint on top
  of the real ocean or is retired. Leaving both un-reconciled produces a visible rectangle on the
  sea.
- **Determinism:** two channels render the same frame from different cameras. Wave state must be a
  function of a shared clock, not of per-pass accumulation, or AR and 3D will show different seas.

## 7. Suggested slice (14.2)

1. **14.2a — Gerstner surface.** Clipmap geometry + Gerstner vertex displacement + Fresnel/sky
   reflection + sun glitter + Jacobian whitecaps. Wave direction as a uniform, driven by a hardcoded
   value initially. Behind the existing environment mode; `simple` unchanged.
2. **14.2b — Wind coupling + sea-state presets.** Subscribe to the wind bus
   ([`wind-data-and-vfx.md`](./wind-data-and-vfx.md)); ramped direction; foam scaling with
   speed. **Landed** (`createRealisticEnvironment` subscribes; 3 s shortest-arc ramp;
   mild amplitude scale from `speedMs`; no operator preset UI).
3. **14.2c — Terrain interaction.** Depth-based shore foam and shallow tint; reconcile `waterCue`.
   **Landed** (`DSP-SCN-20260817-04`): ocean `onBeforeRender` depth-prepasses the
   Cesium tileset group into a half-res FBO (only while terrain + realistic +
   opaque-safe). Shader: reconstruct terrain Y, foam/tint where nearby pixels
   are land. `waterCue` stays hidden while Gerstner is mounted.
4. **14.2d (optional) — FFT cascade** for fine chop, only if look-dev says Gerstner is short.
5. **14.2e (optional) — boat wakes.**

Fix the 3D-NDI tick gap in 14.2a, and treat measured frame time with all three channels live as an
acceptance criterion in every slice.

## Open questions

| # | Question |
| --- | --- |
| 1 | **Resolved 14.2a:** `waterCue` is hidden while realistic ocean is mounted; kept for `simple`. |
| 2 | **Resolved 14.2b:** automatic mild amplitude/foam from `speedMs` (clamped). No named preset UI. |
| 3 | Is there a target look reference beyond the supplied image — specifically a *calm* Bosphorus morning versus the choppier reference frame? |
| 4 | Are boat wakes in scope for v1 of this phase, or explicitly deferred? |
