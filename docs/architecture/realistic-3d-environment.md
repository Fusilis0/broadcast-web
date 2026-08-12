# Realistic 3D environment (toggleable) — sea + sky for the **3D** channel

**Status:** Landed — `DSP-SCN-20260812-01` (toggleable; default `simple`; forced off for transparent/chroma).  
**Owner:** SCN.  
**Depends on:** [`multi-output-streaming.md`](./multi-output-streaming.md) §2 (this is the content
that fills the new **3D** channel's opaque render).  
**API:** `setEnvironmentMode('simple'|'realistic')`, `setEnvironmentOpaqueClearSafe(boolean)` on
`SceneHandle`; Ops select + `?env=realistic`. See `src/scene/environment/` + `src/scene/README.md`.
**Reference:** user-provided broadcast reference image (2026-08-12) — a shaded, waved ocean
surface with realistic lighting under a race graphic overlay (leaderboard, boat name tags,
distance rings). "Not real sea, it's just a model but realistic" — a stylized-but-shaded water
render, not a photoreal ocean sim.

**Scope note (2026-08-12):** this is deliberately **not** a new rendering pipeline or "different
logic" for the 3D channel — it's the existing scene with one thing added: a sea (and sky) model in
the background where today there's just a flat clear color / a small tinted pad. Everything below
is scoped to that.

## 1. Gap vs. today

There is currently **no ocean/sky rendering at all** in the 3D scene. What exists:

| Piece | File | What it actually is |
| --- | --- | --- |
| "Water" | `src/scene/course/waterCue.ts` | A flat, semi-transparent **`MeshBasicMaterial` plane** (`WATER_CUE_DEFAULTS.waterColor = 0x1a5f7a`, opacity 0.4) sized to the course bounding box + padding. No waves, no shading, no reflection — a localized color pad, explicitly documented as "not a globe / Cesium terrain" (`waterCue.ts:5-6`) |
| "Sky" | *(none)* | The renderer's **clear color** is the entire sky/background — `renderer.setClearColor(clearColor, 1)` (`createScene.ts:390`), `0x1a1a1a` dark grey in `preview`, green in `chroma`, **alpha 0 (see-through)** in `transparent`/AR |

This was intentional for Phase 8.8 ("3D world polish") — the whole point of "clear modes keep
empty sky/sea clean" was to make the **AR** plate composite correctly over real camera footage:
anything outside the course pad must stay transparent, or it would paint over the real ocean in
vMix. A full opaque, shaded ocean+sky is the **opposite** of what AR needs — which is exactly why
this only makes sense as **3D-channel-only** content (see §3).

## 2. Proposed approach

Use `three`'s own bundled example modules (already a dependency, `three@^0.178.0` — these ship as
`three/examples/jsm/...` and are commonly imported directly, no new package needed):

- **`Water`** (`three/examples/jsm/objects/Water.js`) — a shader-based animated water surface
  (normal-map-driven ripples, sun reflection, distortion) that already exists as a battle-tested
  Three.js primitive. Replaces (or sits **behind**, further out than) the existing course-bounded
  `waterCue` pad — the cue pad can stay as the crisp, branded "race area" tint on top of the
  large, realistic ocean underneath.
- **`Sky`** (`three/examples/jsm/objects/Sky.js`) — a procedural atmospheric sky dome (sun
  position, turbidity, Rayleigh/Mie scattering) for a horizon and overcast-to-clear look matching
  the reference image's muted grey-blue tone, rather than a flat clear color.
- Both are parametrized (sun elevation/azimuth, water color/distortion scale, fog) so the "just a
  model but realistic" look from the reference — not photoreal, just properly shaded/lit — is a
  tuning pass, not a new rendering technique.
- Optional cheap depth cue: scene `THREE.Fog` fading distant water into the sky dome color, which
  also hides the outer edge of the water plane's finite geometry.

This is additive geometry mounted at scene root (always present, low pixel cost — one large plane
+ one sky dome + a fragment shader each), gated by the toggle in §3 so it costs nothing when off.

## 3. Hard constraint: **3D channel only**

The realistic environment **must never render when the active channel needs a transparent or
chroma clear** (AR / Chrome fallback). An opaque sky dome + opaque water plane sitting at alpha 1
would defeat the entire alpha-key pipeline that lets AR boats/course composite over real camera
footage — this is the same reasoning that kept `waterCue` a small localized pad instead of a full
ocean in Phase 8.8.

Concretely: the toggle in §4 should be **hard-disabled** (or auto-forced off) whenever
`outputMode !== 'preview'` on a channel that isn't the dedicated opaque **3D** channel from
`multi-output-streaming.md`. Once that channel exists, "realistic environment on" is simply its
default dressing; AR keeps today's clean transparent/pad behavior unconditionally.

## 4. Toggle & controls

- **Where:** a new control near the 3-way channel switcher
  (`multi-output-streaming.md` §5) or inside the Ops sidebar's existing Ops section — e.g.
  "Environment: Simple ↔ Realistic" — visible/enabled only while the **3D** channel exists as a
  concept (before then, keep it dev-only behind a query flag so SCN can land the rendering
  primitive without waiting on the OUT multi-channel work). Naming precedent already in the
  codebase for this kind of per-scene visual toggle: `BoatVisibilityMode`
  (`'solid' | 'ghost' | 'hidden'`, `src/scene/boatVisibility.ts`) and feature-level
  `visible2d`/`visible3d` flags — a two-state `'simple' | 'realistic'` environment mode should
  follow the same shape rather than inventing a new pattern.
- **Params worth exposing later** (not all needed for v1): sun azimuth/elevation (time-of-day
  feel), water tint, wave scale/speed, fog density. Start with sane fixed defaults tuned to the
  reference image; do not over-build a full "weather" system in the first pass.
- **Perf guard:** disable/unmount the environment meshes entirely when off (not just hidden) so
  the 2D/AR channels pay zero extra draw cost — matches the existing pattern of disposing
  `waterCue`/`worldBuoys` geometry on remount (`createScene.ts`).

## 5. Suggested slice (for the eventual SCN dispatch — not written yet)

1. Add `Water` + `Sky` behind a scene-level toggle (default **off**, so no behavior change until
   wired up); tune parameters against the reference image.
2. Confirm it renders correctly only in `preview`/opaque contexts; verify `transparent` clear is
   untouched (regression test: alpha stays 0 outside course pad when environment is forced off in
   AR).
3. Wire the toggle into whatever UI lands first — a temporary Ops checkbox is fine before the full
   3-way switcher exists; migrate later.
4. Perf pass: confirm frame time budget is acceptable at the studio's locked NDI resolution
   (`multi-output-streaming.md` §6) with the environment on, since it's now part of the
   continuously-rendered 3D channel, not an occasional preview toggle.

## Open questions

| # | Question |
| --- | --- |
| 1 | Should the realistic environment ever be visible in local **Ops preview** before the 3D channel exists (as a "coming soon" toggle), or strictly gated behind the new channel shipping first? |
| 2 | Any existing brand/art-direction reference beyond the single provided screenshot (color palette, time-of-day, calm vs. choppy water) to lock defaults against? |
