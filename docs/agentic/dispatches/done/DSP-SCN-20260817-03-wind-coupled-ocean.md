# Dispatch DSP-SCN-20260817-03-wind-coupled-ocean

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260817-03-wind-coupled-ocean)
- Priority: **P0** (user: wave direction follows wind)
- Phase: Phase 14.2b
- Prerequisite: 14.0, 14.2a, 14.3a all **accepted** (this branch)
- Parallel-safe with: `DSP-TEL-20260817-02-open-meteo-wind` (if issued). Not parallel with
  another SCN `environment/` worker (14.2c shore foam waits).
- Design: `docs/architecture/ocean-waves-and-sea-state.md` §3 ·
  `docs/architecture/wind-data-and-vfx.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (windBus → Gerstner; 3 s ramp; from-000° +Z; suite 518+23, later 529+23 with TEL)

## Goal

Drive the Gerstner ocean from `windBus`. Operator (and later API/sensor) changes to
`directionFromDeg` / `speedMs` must rotate the swell train and scale foam. **Ramp** over
several seconds — no 40° snap on air. Do not fetch weather. Do not rewrite the Gerstner
shader from scratch.

## Background

- TEL 14.3a: `windBus.subscribe` / `getSnapshot`, `windTravelSceneXZ(directionFromDeg)`,
  default **6 kt from 000°**. Ops row already publishes. Field name is `directionFromDeg`.
- SCN 14.2a: `GerstnerOceanHandle.setDirectionRad` / `setWindSpeed`. Direction: `0` = +X
  (east); default `−π/2` = toward −Z (north). **That default disagrees with default wind.**
  Wind from north (`0°`) travels **+Z** (`windTravelSceneXZ(0) = { x: 0, z: +1 }`). After
  this DSP the sea must follow the bus, not the old northward swell. Do not “fix” travel
  back to −Z.
- Conversion: travel `{ x: tx, z: tz }` → `directionRad = Math.atan2(tz, tx)`
  (matches `(cos θ, sin θ)` in the Gerstner shader). Use `windTravelSceneXZ` — do not
  re-derive from/to math.
- `createRealisticEnvironment` currently does **not** forward `setDirectionRad` /
  `setWindSpeed`. SceneHandle neither. Wire them.
- Height/period auto-from-wind is **P1 / droppable**. Foam from speed is in scope (already
  a uniform). Named calm/moderate/choppy presets: only if cheap (a small table scaling
  amplitude/foam from `speedMs`); do not build a weather UI.

## In scope

1. Forward `setDirectionRad` / `setWindSpeed` on `RealisticEnvironmentHandle` and
   `SceneHandle` (or subscribe inside `createScene` so main does not need new methods —
   either is fine; document the choice).
2. Subscribe to `windBus` while realistic ocean is mounted (and on mount, apply snapshot).
   Unsubscribe on unmount/`stop`.
3. Map `directionFromDeg` → `windTravelSceneXZ` → `atan2` → `setDirectionRad`.
4. Map `speedMs` → `setWindSpeed` (foam). Optional: mild amplitude scale with speed
   (clamped) if it does not destabilize the look.
5. **Ramp:** lerp current → target direction (shortest arc) and speed over ~2–5 s.
   Wind updates are stepwise (operator, later poll). A snap is an on-air artefact.
6. Tests: publish from-north → travel +Z on the ocean uniform; publish 90° → −X; ramp
   does not jump a 90° change in one call (inject `now` / dt). Use the real helper.
7. Docs: one paragraph on `src/scene/README.md` + design 14.2b status.

## Out of scope

- Open-Meteo / anemometer (TEL).
- Shore foam from terrain depth (14.2c).
- FFT, wakes, 2D map wind arrow, 3D wind ribbon.
- Changing Gerstner clipmap resolution or the shared-clock time path.
- `src/scene/terrain/` except you must not break it.
- Config seed fields (optional leftover from TEL).

## Likely files

- `src/scene/environment/realisticEnvironment.ts` (+ test)
- `src/scene/createScene.ts` (subscribe; rebase-safe with terrain hooks)
- `src/scene/environment/gerstnerOcean.ts` only if you need a getter or ramp helper
- New small test for the wind→rad mapping / ramp
- `src/main.ts` only if SceneHandle wiring lives there
- `src/scene/README.md`, `docs/architecture/ocean-waves-and-sea-state.md`

## Inputs provided

- `src/telemetry/windBus.ts`, `windTravelSceneXZ`, `WindFrame`
- `GerstnerOceanHandle.setDirectionRad` / `setWindSpeed`
- Default wind: 6 kt from 000° → travel **+Z**
- Gerstner: `directionRad` 0 = +X, −π/2 = −Z

## Acceptance criteria

- [ ] Changing Ops wind **from-deg** rotates the Gerstner travel vector (test: 0° → +Z,
      90° → −X)
- [ ] Speed changes reach `setWindSpeed` (foam)
- [ ] Direction/speed ramps; a large step is not applied in a single update
- [ ] `simple` / `opaqueClearSafe` gate unchanged; no ocean when transparent
- [ ] No new weather fetch
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary (ramp seconds, whether amplitude scales with speed)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
