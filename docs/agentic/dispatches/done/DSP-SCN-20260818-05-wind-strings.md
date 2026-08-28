# Dispatch DSP-SCN-20260818-05-wind-strings

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260818-05-wind-strings)
- Priority: P1
- Phase: Phase 16.2 — wind streamline VFX
- Design: `docs/architecture/phase16-visual-upgrade.md` §3
- Related: user 2026-08-18 — “still can’t see any wind. I want wind to show up as a moving string VFX.” Lock: visible on **ops preview + 3D NDI only, never the AR plate**.
- Parallel-safe with: SCN-04 (owns `gerstnerOcean.ts` / `shoreFoam.ts` / terrain — stay out), SCN-06/07/08. **You own** `realisticEnvironment.ts` and the new module.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (merged tree `npm test` 640+23, `npm run build` green). 180 additive ribbons, ~0.075 ms/tick.

## Goal

Windy-style **moving strings**: short streamlines drifting above the water along the wind travel direction, obviously animated at typical race wind (5–12 m/s), fading out at calm. Operator glances at the 3D view and reads wind direction + rough strength instantly.

## Background

- 14.3e streaks are a subtle water-shader mask; user does not perceive them as wind. This dispatch adds a **separate, unmistakable** 3D element.
- Wind direction/speed: `windBus` (`windTravelSceneXZ`, from-000° → +Z). The ocean uses a 3 s shortest-arc ramp — reuse the same ramped value if accessible, else implement the same ramp; strings and swell must not disagree during a direction change.
- Realistic environment (`createRealisticEnvironment`) is already forced off on transparent/chroma (AR-safe). Mount strings inside it → the visibility lock comes for free (ops + 3D NDI only).

## In scope

1. New `src/scene/environment/windStrings.ts`:
   - ~100–200 string instances distributed in a disc (~600–1000 m) around the clipmap/camera center, at ~4–10 m above water.
   - Each string = short polyline/thin quad strip (5–8 points) with a gentle waviness, drifting along travel; lifespan with fade-in/out (no popping); respawn upwind.
   - Speed, length, count/opacity scale with `speedMs`; below ~0.5 m/s fully faded.
   - One draw call (single `LineSegments` / merged quads, additive or alpha-blended, `depthWrite: false`). CPU-updated buffer or shader phase animation — worker’s pick; budget ≤ ~0.2 ms.
   - Follow the camera/clipmap center loosely (recenter spawn disc) so strings exist wherever the operator looks.
2. Mount in `createRealisticEnvironment` (subscribe `windBus` snapshot-on-create, unsubscribe on dispose — same pattern as the ocean coupling). Tick from the same shared-clock approach (`onBeforeRender`) so 3D NDI `directRender` animates.
3. Tests: direction mapping (from-000° → strings travel +Z), fade at calm, dispose unsubscribes, no `readPixels`.
4. Docs: `docs/architecture/wind-data-and-vfx.md` (14.3f status), `src/scene/README.md`.

## Out of scope

- Ocean shader changes (SCN-04 owns `gerstnerOcean.ts`).
- The existing wind vane (15.2) stays — do not remove.
- AR plate visibility, per-channel toggles, GPU particle systems, flags/spray.
- `createScene.ts` / frame clock.

## Likely files

- `src/scene/environment/windStrings.ts` (+ test, new)
- `src/scene/environment/realisticEnvironment.ts` (+ test)
- `src/scene/environment/index.ts`
- Docs above

## Inputs provided

- `windBus`, `windTravelSceneXZ`, `setWindSpeed` patterns in `windOceanCoupling.ts` / `windVane.ts`.
- Shared-clock precedent in `gerstnerOcean.ts` header comment.

## Acceptance criteria

- [ ] Realistic env + wind from-deg set → visibly moving strings above the water, direction matches swell/vane.
- [ ] Calm (~0 m/s) → strings gone; strong wind → faster/longer/more.
- [ ] Never on AR/transparent/chroma (inherits realistic-env gate); animates on 3D NDI.
- [ ] One draw call; no extra FBO / `readPixels`; `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (technique, counts, measured cost if smoked)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
