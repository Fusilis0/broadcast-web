# Dispatch DSP-TEL-20260817-02-open-meteo-wind

## Meta
- From orchestrator: BW → TEL
- Worker role: WORKER(DSP-TEL-20260817-02-open-meteo-wind)
- Priority: P1
- Phase: Phase 14.3b
- Prerequisite: 14.3a accepted (`windBus` + `directionFromDeg`)
- Parallel-safe with: `DSP-SCN-20260817-03-wind-coupled-ocean` (SCN owns the sea; you only
  `publish` on the bus). Do not edit `src/scene/environment/` or `src/scene/terrain/`.
- Design: `docs/architecture/wind-data-and-vfx.md` §2
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (Open-Meteo → windBus; operator hold; mock fetch; suite 529+23)

## Goal

Add an **Open-Meteo** wind provider that `publish`es onto the existing `windBus`. Poll ~10
min, cache last good, never blank the display on fetch failure. Operator entry still wins
over API. No anemometer. No ocean shader work.

## Background

- Bus already has `source: 'operator' | 'api' | 'sensor' | 'default'`.
- Priority (design): sensor → operator → API → last known → default. Sensor does not exist
  yet — skip it. **Operator override beats API** until the operator clears back to auto
  (a small “use API” / “hold operator” control is enough).
- Forecast: `https://api.open-meteo.com/v1/forecast` with
  `current=wind_speed_10m,wind_direction_10m,wind_gusts_10m` at `config.origin` lat/lon.
- Optional marine (nice, not blocking):
  `https://marine-api.open-meteo.com/v1/marine` wave height/direction/period — store on
  the frame only if you extend `WindFrame` **additively** (optional fields). Do not break
  14.2b subscribers.
- Free tier is **non-commercial**. Fine for studio/dev. Empty/missing key is OK — no
  `customer-` URL required this slice. Document the licence in README.
- Directions are **from**, true north — already our `directionFromDeg`.
- Speed from API is m/s — publish `speedMs` directly (Ops already converts to kt for display).
- Poll ~10 minutes. Failed fetch: keep last snapshot, show stale in the existing Ops age
  line if you can do it without rewriting the row.

## In scope

1. Provider module `src/telemetry/windOpenMeteo.ts` (name flexible): start/stop, poll,
   map JSON → `WindFrame` with `source: 'api'`.
2. Wire start from `main` / ingest boot when origin is valid. Re-fetch on origin change
   (debounce).
3. Priority: if last publish was `operator` and recent (e.g. < 30 min, or until user
   clicks “follow API”), do not overwrite with API. Default/API can update when operator
   is not holding.
4. Tests with a **mocked fetch** (no live network in CI): cardinal direction mapping,
   failure keeps last, operator hold.
5. README + design 14.3b status. Attribution: Open-Meteo CC BY — a one-line comment in
   Ops or README is enough this slice (not a broadcast burn-in).

## Out of scope

- Anemometer WS (14.3c).
- Gerstner uniforms / 14.2b (SCN).
- Paid `customer-` endpoint / committed API key.
- 2D map arrow (14.3d).

## Likely files

- New: `src/telemetry/windOpenMeteo.ts` (+ test)
- Edit: `src/telemetry/index.ts`, `README.md`, `windOpsRow.ts` (hold/follow control)
- `src/main.ts` (start/stop with origin)
- `docs/architecture/wind-data-and-vfx.md`

## Inputs provided

- `windBus`, `WindFrame`, `directionFromDeg`, `knotsToMs` / `msToKnots`
- Origin: `config.origin` / `GeoOrigin` after apply
- Open-Meteo forecast `current` wind fields (m/s, degrees from)

## Acceptance criteria

- [ ] Successful mock fetch publishes `source: 'api'` with `directionFromDeg` + `speedMs`
- [ ] Failed fetch does not publish a blank/zero frame over a good last snapshot
- [ ] Operator publish is not immediately overwritten by a poll
- [ ] No live network required for `npm test`
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary (poll interval, hold rule, whether marine fields were added)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested TEL memo bullets
