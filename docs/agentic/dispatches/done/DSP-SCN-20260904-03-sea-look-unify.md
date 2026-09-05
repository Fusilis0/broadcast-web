# Dispatch DSP-SCN-20260904-03-sea-look-unify

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-03-sea-look-unify)
- Priority: **P1** (look-dev; holds 19.2b)
- Phase: **19.15** sea look — unify sun-blob vs matte; Gerstner-aligned troughs; persistent white foam
- Related: `done/DSP-SCN-20260904-02-flat-sea-2d-motion.md` — **partial Pass** (motion + boards + no hard half-plane). Operator 2026-09-04: sun-blob frame looks good; matte frame looks low-quality; darker fields fight the white waves (third crop)
- Worker result: **code done 2026-09-04** — suite **1181 + 26**, `npm run build` green. SCN **code-accept**. **Human Pass 2026-09-04** with notes → `done/DSP-SCN-20260904-04-sea-plates-soft-light.md`. Hold 19.2b / 19.17.

## Goal

Keep a **flat mesh** (vertex disp **0**). Make the sea look **wet and detailed everywhere**, not only inside the sun highlight. White traveling foam stays (and reads longer). Dark “wave” bands must be the **same Gerstner train** as that foam — not a second, perpendicular gust grid.

## Background

Operator three shots:

1. **Sun blob on** — silvery, high-contrast, preferred. “I like it when sun blob hits.”
2. **Sun blob off** — matte grey-blue, repeating dark/light bands, reads **low quality**. Wants **similar texture** in both.
3. **Close crop** — pale **horizontal** foam bands vs **vertical** darker curtains. “Darker fields … not the same way with dynamic waves.” White waves feel moving **“just for a while.”**

**Do not treat 04-02 as full Pass.** Motion exists. Remaining look bugs:

**A. Quality lives in the spec lobe.** Fragment still does sharp Blinn (`uGlitterSharpness` 78) plus `color += uSunColor * glitterAmt`. Off-lobe water is only `mix(deep, shallow, ndv)` + fresnel — dull. Operator wants the **blob look lifted onto the rest**, not the blob deleted. Do **not** crank sharpness or intensity (old bug: blew out a quadrant). Add a **wide wet sheen** (soft spec / stronger sky fresnel / Gerstner-tinted albedo) so matte water still has crest/trough detail.

**B. Dark fields ≠ foam waves.** `windStreak` is anisotropic along `uDirectionRad` (`along * 0.016`, `cross * 0.22`) then `color *= 1.0 - gust * uStreakContrast * 0.70` (contrast **0.88**). Default travel is −Z, so those curtains run **N–S**. Gerstner crests run **across** travel (**E–W**). Third image is that grid. **Retire or heavily soften gust albedo darkening.** Trough darkening must come from **`waveHeight` / jacobian of `uShadingWaves`**, same as foam.

**C. Foam too brief.** Crest `smoothstep(0.10, 0.36, waveHeight) * 0.4` × `highFreqFade` — flashes at peaks then gone. Broaden/persist traveling white (still fragment-only, still scrolling with `uTime`).

Locks: vertex `displacementScale` **0**. No Cesium vendor. No NDI pumps. No `STUDIO_TICK_FPS`. Do not bury boards. Do not restore independent high-contrast gust grid.

## In scope

1. Albedo trough/crest from fragment Gerstner height (same train as foam).
2. Kill or mute `windStreak` **darkening** so vertical curtains go. Gust may stay as a **subtle** foam/sparkle modulator only if it does not fight wave fronts.
3. Wide wet sheen + keep a **mild** sun glitter (operator likes blob). Matte view must still show the same wave texture, not a flat grey field.
4. White foam more persistent / traveling; still 2D (no vertex bounce).
5. Tests + README one-liner. `npm test` + `npm run build`.

## Out of scope

- Vertex Gerstner back on
- 19.2b / 19.17 / inspector / boards / Cesium vendor
- New ocean mesh / extra FBO / `readPixels`

## Likely files

- `src/scene/environment/gerstnerOcean.ts` (+ tests, `WIND_STREAK_DEFAULTS`)
- `src/scene/README.md`
- `docs/agentic/memos/SCN_MEMO.md`

## Acceptance criteria

- [x] Vertex disp still **0**; START/FINISH still above the plane. *(code: `displacementScale` 0; `uWaves` amps 0)*
- [x] Parked cam: white foam **travels** and stays readable (not a one-frame flash). *(code: crest window −0.02…0.18 × 0.62 — human smoke)*
- [x] Dark bands travel **with** the foam (same orientation / same train). No perpendicular gust curtains. *(code: gust albedo multiply removed; trough from `waveHeight` — human smoke)*
- [x] Orbit into/out of the sun: water **texture** stays similar (wet/detailed both ways). Blob may still brighten, must not be the only “good” region. *(code: sky sheen + slope wet + Gerstner albedo; glitter 78/0.16 kept — human smoke)*
- [x] AR still no ocean. `npm test` + `npm run build` green. *(1181 + 26; AR gate untouched)*

## Report back (worker 2026-09-04)

1. **Gust albedo:** retired. Removed `color *= 1.0 - gust * uStreakContrast * 0.70` and the gust shallow add. `WIND_STREAK_DEFAULTS.contrast = 0`; `uStreakContrast` uniform gone. `windStreak` still scrolls and chops glitter only (`* 0.35`), not foam (would fight wave fronts).
2. **Troughs = foam train:** fragment `waveHeight` from `uShadingWaves` Gerstner (`shadeDisp.y`). Trough darkens albedo (`smoothstep` −0.20…0.06); crest foam uses the same `waveHeight` with a wider window (−0.02…0.18 × 0.62, was 0.10…0.36 × 0.4). Jacobian fold kept.
3. **Sheen without blowout:** glitter stays **78 / 0.16**. Added sky-tinted `wetSheen` at sharpness **7** / intensity **0.2** (`OCEAN_SHEEN_DEFAULTS`), stronger fresnel (0.10 / exp 4), and `slopeWet` (N.y → sky) so matte still reads wet. Sheen uses `skyCol`, not `uSunColor`.
4. **Memo:** worker bullets + roadmap row → code done; await human smoke. Hold 19.2b / 19.17.

## Worker paste block

```
You are WORKER(DSP-SCN-20260904-03-sea-look-unify).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260904-03-sea-look-unify.md
2. src/scene/environment/gerstnerOcean.ts (FRAGMENT: windStreak darkening, glitter sharpness 78, crest foam)
3. docs/agentic/memos/SCN_MEMO.md

P1 look-dev: keep vertex disp 0. Unify sun-blob vs matte (wet sheen everywhere; do not delete glitter). Dark troughs from Gerstner height, not perpendicular gust curtains. White foam more persistent. No Cesium vendor, no NDI pumps, no STUDIO_TICK_FPS, do not bury boards.
Report back per dispatch.
```
