# Dispatch DSP-SCN-20260817-06-wind-streaks

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260817-06-wind-streaks)
- Priority: P1 (last remaining P1 from the wind VFX design; optional vs Phase 14 core)
- Phase: Phase 14.3e
- Prerequisite: 14.2a/b Gerstner + `windBus` **accepted**
- Parallel-safe with: none on `gerstnerOcean.ts` (14.2c just landed there — start from that HEAD)
- Design: `docs/architecture/wind-data-and-vfx.md` §4 P1 streaks
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (fragment gust mask; from-000° +Z; fade at 0 m/s; suite 549+23)

## Goal

Add **wind streaks** on the Gerstner surface: dark, directional gust patches that travel with
the wind, like the reference broadcast image. Implement as a **scrolling mask in the ocean
shader**, not particles. Scale with `speedMs`. No extra `readPixels`.

## Background

- User reference had linear streaks across the water. Design: animated scrolling noise along
  the wind travel vector, modulating roughness (and optionally albedo) — it *is* the water,
  so it composites with Gerstner displacement.
- Travel vector is already on the ocean (`uDirectionRad` / `windTravelSceneXZ`). Reuse it.
  Do not re-derive from/to.
- Foam/shore (14.2c) and wind coupling (14.2b) already landed in `gerstnerOcean.ts` —
  **add**, do not rewrite those paths.
- Cheap: one extra noise function in the fragment shader, uniforms for scroll speed and
  contrast. No second mesh, no GPU particles, no extra FBO.
- When wind is calm (low `speedMs`), streaks should fade out, not stay as a static texture.

## In scope

1. Streak/gust mask in the Gerstner fragment shader, scrolling along wind travel.
2. Intensity scales with `setWindSpeed` / `speedMs` (fade below a small threshold).
3. Tests: uniform/CPU mapping that travel direction matches `uDirectionRad`; intensity 0
   at ~0 m/s; no `readPixels` in new code.
4. Docs: `src/scene/README.md` + design 14.3e status.

## Out of scope

- 3D world-space ribbons, flags, spray (14.3f).
- FFT ocean, boat wakes.
- Map readout (already 14.3d).
- Changing shore-foam FBO or wind ramp timing.
- `src/scene/terrain/` except do not break `setShoreContact`.

## Likely files

- `src/scene/environment/gerstnerOcean.ts` (+ test)
- Possibly `windOceanCoupling.ts` only if a new uniform needs the bus (prefer existing
  `setWindSpeed` / direction uniforms)
- Docs listed above

## Inputs provided

- `uDirectionRad`, `setWindSpeed`, `windTravelSceneXZ`
- Shore foam already samples a depth RT — do not disable it

## Acceptance criteria

- [ ] Visible directional streaks on realistic ocean that move with wind direction
- [ ] From-000° streaks travel +Z (same as swell)
- [ ] Near-zero wind → streaks gone or negligible
- [ ] Shore foam + wind ramp still work
- [ ] No `readPixels`; `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary (how the mask is made, extra shader cost)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
