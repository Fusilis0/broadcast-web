# Dispatch DSP-TEL-20260826-02-telemetry-history

## Meta
- From orchestrator: BW → TEL
- Worker role: WORKER(DSP-TEL-20260826-02-telemetry-history)
- Priority: P0
- Phase: Phase 17.1 — NTP-indexed telemetry sampling
- Design: `docs/architecture/ar-video-underlay-ntp-sync.md` §4.4
- Prerequisite reading: `docs/architecture/ntp-matching.md` §4.b, §4.c, §4.d, §2.1, §2.2, §3.3
- Parallel-safe with: TEL-01, OUT-03, OUT-04, CAL-05. **You own** `src/telemetry/telemetryHistory.*`. Do not touch `pipeline.ts`, `convert.ts`, `ingest.ts`, or any file another wave-1 dispatch owns.
- Shared-file note: TEL-01 also appends to `src/telemetry/index.ts` and `README.md`. Append at the **end**; do not reorder existing lines.
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` 741+23, `npm run build` green). `brg === 0` / `spd < 0.3` hold; drone NED vel stays at this boundary.

## Goal

A pure module that answers: **where was every tracked entity at NTP instant `t`?**

Buffer raw telemetry DTOs keyed by their producer NTP stamps, and expose `sampleAt(ntpMs)` returning interpolated **DTO-shaped** values. No bus subscription, no ENU, no Three.js, no timers.

## Background

The pose pipeline today is a **push** smoother: a packet lands, `MidpointLerp.setTarget` aims at it, and the RAF loop renders whatever the smoother currently holds using `performance.now()` (`src/pose/pipeline.ts` L77–94, L151–157; `src/pose/lerp.ts`). `TelemetryData.ts` is copied onto `PoseEvent` and **never read for timing**.

Phase 17 inverts this: we pick a video frame, resolve its capture NTP, and ask telemetry where things were *then*. That needs a time-indexed history, which does not exist. This dispatch builds only the history and the sampler. TEL-08 later rewires the pipeline to use it — **you are not changing the live render path.**

### Why you return DTOs, not ENU

`droneRawPose` / `boatRawPose` (`src/pose/convert.ts`) already own GPS→ENU and calibration. Interpolating *before* that conversion keeps this module free of geodesy and leaves GEO's contracts untouched. Interpolate `lat`/`lon`/`alt`/`gimbal`/etc. and hand back something the existing converters accept.

## In scope

1. New `src/telemetry/telemetryHistory.ts`:
   - `createTelemetryHistory(options?)` → handle. `options.windowMs` default **30000**, plus a hard per-entity sample cap.
   - `addDrone(packet: TelemetryData)` — key on `packet.ts`, bucket by `packet.id`.
   - `addBoat(packet: BoatTelemetry)` / `addBuoy(...)` — key on `packet.time`, bucket by `id`.
   - Out-of-order arrivals must insert correctly (WebSocket reordering is real). Duplicate timestamps → last wins.
   - `sampleDroneAt(id, ntpMs): DroneSample | null`
   - `sampleBoatAt(id, ntpMs): BoatSample | null`
   - Each sample carries the interpolated values **plus** a quality signal: `{ mode: 'interpolated' | 'extrapolated' | 'held' | 'unavailable', sourceAgeMs, degraded: boolean }`. Callers must be able to badge without guessing.
   - `prune(nowNtpMs?)`, `reset()`, `stats()` for the ops HUD (per-entity sample count, oldest/newest NTP, last gap).

2. **Drone sampling** (`ntp-matching.md` §4.b):
   - Find bracketing samples A ≤ t ≤ B; interpolate `pos.lat/lon/alt` linearly and `gimbal` Euler with **shortest-path yaw** (do not lerp 359° → 1° the long way round).
   - No B available → extrapolate from A using `vel` for up to a configurable **150 ms**, then `held`, then `unavailable`. **`vel` is NED** (x north, y east, z down) per §2.1 — document the convention at the boundary but do **not** convert to ENU here; that is the converter's job. If you expose a projected position, expose it in the same lat/lon terms the DTO uses.
   - Do not interpolate across a gap far larger than the 10 Hz pose period (default threshold **500 ms**) — mark `degraded`.

3. **Boat dead reckoning** (`ntp-matching.md` §4.c) — the rules here are non-obvious, follow them exactly:
   - `A` = last fix with `A.time ≤ t`.
   - **If `A.spd < 0.3` or `A.brg === 0`: do not project.** The producer forces `brg` to 0 to mean *"bearing unknown"*, not *"due north"*. Dead-reckoning through it walks boats north across the course. This is the single easiest way to get this dispatch wrong.
   - Otherwise project `dist = A.spd * dt` along `A.brg` (degrees east of true north).
   - If `B` exists, clamp/blend so the projection does not overshoot `B` as `t` approaches `B.time`.
   - **Never wait for a bracketing fix.** Boat GPS runs ~0.5–2 Hz with ~6 s holes when still (§3.3); waiting would cost seconds. Measured median inter-fix step is 0.55 m against 5.1 m GNSS accuracy, so DR error sits well under the noise floor.
   - `fix_age_ms` is on the wire but **not** in the `BoatTelemetry` TS type. Read it defensively off the object; treat `0` as *unknown age*, not *perfect*. Down-weight or skip DR when it is large (> ~200 ms); first-fix was 1585 ms in the reference archive.

4. **Gating** (`ntp-matching.md` §4.d): reject or mark degraded on `ntp_synced === false`, `t_sync === false`, boat `t_err === -1`, drone `ntp_err_ms === 2147483647`. Note `ingest.ts` `isBoatTelemetry` does **not** check `t_sync` — you must.

5. Export from `src/telemetry/index.ts` (append). Tests. Append a section to `src/telemetry/README.md`.

## Out of scope

- **Any bus subscription** — TEL-08 wires it.
- **Any change to `src/pose/`** — not `pipeline.ts`, not `convert.ts`, not `lerp.ts`. The live render path stays exactly as it is this wave.
- ENU conversion, calibration, Three.js.
- PTS→NTP — that is TEL-01.
- Fixing `boatRawPose`'s ignored `spd` (TEL-08 territory).

## Likely files

- `src/telemetry/telemetryHistory.ts` (new)
- `src/telemetry/telemetryHistory.test.ts` (new)
- `src/telemetry/index.ts` (append exports)
- `src/telemetry/README.md` (append)

## Inputs provided

- `TelemetryData` L37, `BoatTelemetry` L52 — `src/telemetry/types.ts`
- Existing scene mapping for `spd`/`brg` → velocity: `src/telemetry/boatToStandardTelemetry.ts` (`vel.x = spd·sin(brg)`, `vel.z = −spd·cos(brg)`) — reference for the bearing convention, but that module is **not** yours to change
- Reference session statistics (rates, `fix_age_ms`, gaps) — `ntp-matching.md` §3.3
- Test precedent — `src/pose/pose.test.ts` (injectable clock, `manualTick`)

## Acceptance criteria

- [ ] Drone: two poses 100 ms apart, sample at the midpoint → position and gimbal are the midpoint values, `mode: 'interpolated'`.
- [ ] Drone yaw interpolation takes the **short way** across the 0°/360° seam (359° → 1° gives ~0°, not ~180°).
- [ ] Drone: sample past the newest with no B → `extrapolated` within 150 ms, then `held`/`unavailable`. Never silently returns a stale value labelled `interpolated`.
- [ ] Drone: gap ≫ 500 ms is flagged `degraded`.
- [ ] **Boat `brg === 0` is never projected through** — assert position is held, not walked north. Same for `spd < 0.3`.
- [ ] Boat DR with valid `spd`/`brg` moves the expected distance along the expected bearing.
- [ ] Boat DR clamps rather than overshooting when `B` exists and `t` is close to `B.time`.
- [ ] Out-of-order inserts still sample correctly.
- [ ] Unsynced samples (`t_sync: false`, `ntp_err_ms: 2147483647`, `t_err: -1`) are gated.
- [ ] Window prunes: after `windowMs` of inserts, retained samples are bounded.
- [ ] Sampling before any data, or for an unknown id, returns `null` — no throw.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (interpolation choices, thresholds picked and why)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers — especially any place `ntp-matching.md` §4.b/§4.c was ambiguous and what you chose
5. Suggested TEL memo bullets
