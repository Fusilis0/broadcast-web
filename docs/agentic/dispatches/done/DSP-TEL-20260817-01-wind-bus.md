# Dispatch DSP-TEL-20260817-01-wind-bus

## Meta
- From orchestrator: BW → TEL (lead); SCN may mount a tiny Ops row
- Worker role: WORKER(DSP-TEL-20260817-01-wind-bus)
- Priority: P1
- Phase: Phase 14.3a
- **Prerequisite:** `DSP-GEO-20260817-01` **accepted** 2026-08-17 — helper must target
  `z = −North` (from-north → travel **+Z**).
- Parallel-safe with: `DSP-SCN-20260817-01-cesium-ion-terrain`,
  `DSP-SCN-20260817-02-gerstner-ocean`. You own `src/telemetry/wind*`. Prefer
  `src/telemetry/windDirection.ts` — do not edit `src/geodesy/` (14.0 just landed there).
- Design: `docs/architecture/wind-data-and-vfx.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (`npm test` 492+23 at report; suite later **512+23** after siblings)

## Goal

Land a **`windBus`** (same shape as pose/telemetry buses): typed wind frame, set/get,
subscribe. Operator can enter speed + **direction-from** in Ops. One **unit-tested** helper
converts meteorological “from” degrees (true north, clockwise) into a scene XZ travel
vector under the **post-14.0** axis contract. This unblocks ocean 14.2b. **No weather API
and no anemometer socket in this slice.**

## Background

- User: wave **direction follows wind = P0**. Source of truth is undecided — build the
  abstraction, test operator / API / sensor later. This DSP is operator + bus only.
- Convention trap (will cause a 180° on-air error if unnamed):
  - Sailing / Open-Meteo: direction is where the wind blows **from**. “270” = from the west
    = air travelling **east**.
  - Renderer wants a **to** / travel vector for the swell train.
  - Field name: `directionFromDeg`. Never a bare `direction`.
  - True north, not magnetic (declination stays 0 until GEO says otherwise).
- After 14.0: scene `x = East`, `y = Up`, `z = −North`.
  Example: wind **from north** (`directionFromDeg = 0`) → air travels south → scene travel
  along **+Z**. Pin this with a test; do not invert it “to look nicer”.
- Speed: store SI (`speedMs`) internally; Ops may show **knots**. Convert in one place.
  `kt * 0.514444 ≈ m/s`. Label the unit in the UI.
- Failure: no operator input → configured default (e.g. 6 kt from 000°) and a visible
  “default / stale” hint. Never silently blank the sea.
- Open-Meteo / anemometer are **14.3b / 14.3c**. Design the frame so those providers can
  `publish` onto the same bus later (`source: 'operator' | 'api' | 'sensor' | 'default'`).

## In scope

1. Types, e.g. `src/telemetry/windTypes.ts`:

   ```ts
   type WindSource = 'operator' | 'api' | 'sensor' | 'default'
   type WindFrame = {
     directionFromDeg: number // [0, 360)
     speedMs: number          // m/s, >= 0
     gustMs?: number
     source: WindSource
     updatedAtMs: number
   }
   ```

2. `windBus`: `publish`, `subscribe`, `getSnapshot` (last frame or null).
3. Helper `windTravelSceneXZ(directionFromDeg) => { x: number, z: number }` (unit vector).
   Document the from→to + axis mapping next to the function. Tests:
   - `0` (from N) → travel +Z (south)
   - `90` (from E) → travel −X (west)
   - `180` (from S) → travel −Z (north)
   - `270` (from W) → travel +X (east)
4. Operator UI: a small Ops row (speed + from-deg + unit label + source/age). Mounting in
   `stubHud` / Ops sidebar is in scope. Publishing on change. Empty/invalid → keep last or
   default, do not throw.
5. Optional seed from config (`windDirectionFromDeg` / `windSpeedKt`) if cheap; otherwise
   hardcoded default and note follow-up. **Do not** add Open-Meteo fetch.
6. Export from `src/telemetry/index.ts`. README note.
7. Design doc status line for 14.3a.

## Out of scope

- Open-Meteo HTTP (14.3b) — no `fetch` to `open-meteo.com`.
- Anemometer WS channel (14.3c).
- Gerstner uniforms / ocean shader (SCN 14.2b will subscribe).
- 2D map wind arrow (14.3d), streaks, flags, spray.
- Magnetic declination.
- Commercial API keys.

## Likely files

- New: `src/telemetry/windTypes.ts`, `windBus.ts`, `windDirection.ts`, `wind.test.ts`
- Edit: `src/telemetry/index.ts`, `src/telemetry/README.md`
- UI: `src/scene/stubHud.ts` and/or Ops sidebar + `src/main.ts` + `src/style.css` (minimal)
- Optional: `src/config/types.ts` / `loadConfig.ts` for a default seed
- `docs/architecture/wind-data-and-vfx.md` status

## Inputs provided

- `docs/architecture/wind-data-and-vfx.md` §1–3, §6 item 14.3a
- Post-14.0 axes: `x=East, y=Up, z=−North`
- Existing bus pattern: `src/telemetry/bus.ts` / pose bus

## Acceptance criteria

- [ ] Starts **after** 14.0 is on the branch you work from
- [ ] `windTravelSceneXZ` tests match the four cardinals above
- [ ] Field is named `directionFromDeg` everywhere in this DSP
- [ ] Operator can set from-deg + speed; bus snapshot updates; default used when unset
- [ ] No Open-Meteo / sensor code
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary of changes (export names, default wind, UI location)
2. Files touched
3. Tests run / how verified (quote cardinal helper results)
4. Follow-ups / blockers (ready for SCN 14.2b to `subscribe`?)
5. Suggested memo bullets for TEL
