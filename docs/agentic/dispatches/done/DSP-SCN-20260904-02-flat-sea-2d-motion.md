# Dispatch DSP-SCN-20260904-02-flat-sea-2d-motion

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-02-flat-sea-2d-motion)
- Priority: **P0**
- Phase: **19.15** look-dev — flat sea still looks alive; camera-locked glitter split
- Related: `done/DSP-SCN-20260904-01-flat-sea-alt-level.md` **human Pass** on assets / sea m / Alt. Operator 2026-09-04 pm: water **static**; **half-screen texture** that **moves with the camera**
- Worker result: **code done 2026-09-04** — suite **1179 + 26**, build green. SCN **code-accept**. **Partial Pass 2026-09-04** (motion + boards). Look-dev Fail (sun vs matte, gust curtains) → `done/DSP-SCN-20260904-03-sea-look-unify.md`.

## Goal

Keep the **flat mesh** (vertex displacement stays **0** so start/finish/sponsors stay visible). Make the sea **look dynamic** with **fragment / 2D motion** (scrolling foam, streaks, fake-wave normals) — not bouncing verts. Kill the **camera-following half-sea** (smooth vs grainy) that is a lighting/specular terminator on a perfectly flat normal.

## Background

Operator screenshot: START/FINISH, buoys, logos **visible** (04-01 Pass). Sea is a still plane. A **vertical split** (left smooth, right noisy glitter) **tracks the camera**, not a world-fixed patch.

**Why it is static:** `applyWaveAmplitudes` multiplies Gerstner amps by `displacementScale` (**0**). Vertex `disp.y`, `vNormal`, `vJacobian`, `vWaveHeight` are all rest-pose. Fragment foam from fold/crest is **dead**. Wind streaks still scroll `uTime`, but they are too weak to read as “alive” without foam/normals.

**Why half the sea follows the camera:** fragment glitter is Blinn-Phong on `vNormal`:

```glsl
vec3 N = normalize(vNormal); // always (0,1,0) when disp=0
vec3 H = normalize(L + V);
float spec = pow(max(dot(N, H), 0.0), uGlitterSharpness); // sharpness 78
```

With a **constant up normal**, that is a **huge view-dependent sun blob** — a terminator that slides across the viewport. Comment in `gerstnerOcean.ts` already notes an old glint “blew out a quadrant.” Flat sea made it a hard half-screen. Not a clipmap seam, not Cesium, not a world-space texture region.

**Lock:** do **not** restore vertex Gerstner (would bury boards again). Do **not** “fix” it by only turning glitter off (sea stays dead). Do **not** switch Cesium / globe vendor.

**Preferred approach (cheapest that matches the lock):** keep vertex amps at 0. Evaluate the **same Gerstner train in the fragment** (world XZ + `uTime`) with **shading amplitudes** (authored × wind, **not** × `displacementScale`) to get **N, jacobian, waveHeight for lighting/foam only**. Mesh Y stays rest. Streaks already scroll — they should read against animated normals/foam. Shared `gerstner()` chunk is fine; extra FBO / `readPixels` / stencil is not.

If fragment Gerstner cost is too high on outer rings, band-limit shading amp with the existing `OCEAN_DETAIL_FADE` (already fades glitter/streaks). Do not add a new ocean mesh.

## In scope

1. Vertex `displacementScale` remains **0** (product lock). Tests keep asserting that.
2. Fragment shading: animated normals + foam/crest from Gerstner (or equivalent 2D normal/foam scroll). Visible motion at rest camera.
3. Glitter/spec uses the **perturbed N**, so there is **no** camera-locked half-plane of sparkle. No world-fixed “two textures.”
4. Sea m / Alt MSL / no discard holes — do not regress 04-01.
5. AR/chroma still no ocean. No NDI pumps. No `STUDIO_TICK_FPS`.
6. Tests: disp scale 0; fragment shader (or uniforms) has shading amp / gerstner-in-frag (or documented 2D normal path); README one-liner. `npm test` + `npm run build`.

## Out of scope

- Bringing vertex waves back
- MapTiler / Cesium vendor
- 19.2b / 19.17
- Rewriting boards, wakes geometry, inspector

## Likely files

- `src/scene/environment/gerstnerOcean.ts` (+ tests)
- `src/scene/README.md` or environment README if one exists
- `docs/agentic/memos/SCN_MEMO.md` (worker bullets)

## Acceptance criteria

- [x] Realistic 3D: boards still **above** a **flat** mesh (no bounce burying START/FINISH). *(code: disp scale 0)*
- [x] Water **moves** (foam/streaks/glints travel) with a parked camera. *(code: frag Gerstner + shading amps — human smoke)*
- [x] No half-viewport lighting split that **slides with the camera**. *(code: glitter on perturbed N — human smoke)*
- [x] Sea m / Alt / Cesium hide / AR-no-ocean unchanged.
- [x] `npm test` + `npm run build` green. *(1179 + 26)*

## Report back (worker 2026-09-04)

1. **Shading vs vertex:** `uWaves` = authored × `displacementScale` × wind (stays 0). New `uShadingWaves` = authored × wind only. Fragment runs shared `gerstner()` on world XZ + `uTime` for N / jacobian / crest; mesh Y stays rest. `OCEAN_DETAIL_FADE` flattens shading on outer rings.
2. **Half-screen kill:** glitter/spec no longer uses constant `vNormal` up — Blinn on fragment-perturbed N so the terminator is broken into world-space wave motion.
3. **Memo:** SCN worker bullets + roadmap row → code done; await human smoke.

## Worker paste block

```
You are WORKER(DSP-SCN-20260904-02-flat-sea-2d-motion).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260904-02-flat-sea-2d-motion.md
2. src/scene/environment/gerstnerOcean.ts (VERTEX gerstner, FRAGMENT glitter on vNormal, applyWaveAmplitudes × displacementScale 0)
3. docs/agentic/memos/SCN_MEMO.md

P0: keep vertex displacement 0. Animate the sea in the fragment (Gerstner N/foam from shading amps, not mesh bounce). Kill the camera-following half-sea glitter terminator. No Cesium vendor, no NDI pumps, no STUDIO_TICK_FPS, do not bury boards.
Report back per dispatch.
```
