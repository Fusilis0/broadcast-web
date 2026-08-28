# Dispatch DSP-TEL-20260828-01-pose-smoothing

## Meta
- From orchestrator: BW → TEL
- Worker role: WORKER(DSP-TEL-20260828-01-pose-smoothing)
- Priority: P1
- Phase: Phase 17.5 — C1 sampling between telemetry stamps
- Related: `HO-BW-TEL-20260828-01` · `done/DSP-TEL-20260826-02-telemetry-history.md` · `done/DSP-TEL-20260826-08-matched-pose-cutover.md` · `done/DSP-TEL-20260826-10-matched-hold.md`
- Parallel-safe with: OUT PBO / NDI 30 (do not touch `src/output/`)
- **Status: DONE** — worker complete + BW accepted 2026-08-28 (merged tree `npm test` **887 + 23**, `npm run build` green). `pipeline.ts` untouched. Alpha MidpointLerp not double-smoothed.

## Goal

Smooth hull and camera motion **between already-buffered NTP samples** so a 10 Hz WebSocket does not look like a 10 Hz slideshow on a 30 Hz NDI / 60 Hz preview clock. Sampling stays at the **same NTP instant** the pose pipeline already asks for (matched video time, or the alpha path’s existing tick). Do not chase wall-clock “now.”

## Background

**Yes — ~10 Hz is the live pose WebSocket, not an NDI cap.** DJI pose packets land ~100 ms apart (`ntp-matching.md` §3). Boat GPS is slower (~0.5–2 Hz, holes when still). NDI 3D at 10 fps was a *send* cap; that is OUT, not this dispatch.

History already interpolates when A ≤ t ≤ B (`sampleDroneAt` / `sampleBoatLike` in `src/telemetry/telemetryHistory.ts`): linear lat/lon/alt, shortest-path Euler yaw, linear pitch/roll. **Quaternion `x,y,z,w` is not slerped** — `lerpQuat` copies the nearer sample (`u < 0.5 ? a : b`). That steps body/gimbal if any consumer uses xyzw.

Matched AR (`pipeline.ts` `videoClockActive`): `sampleAt(t_ntp)` then converters. **MidpointLerp is bypassed on purpose** (TEL-08 / TEL-10). Re-enabling lerp-to-newest while video is the clock would make the overlay track the stick again.

Alpha / connecting: push + `MidpointLerp` still runs. This dispatch may improve history sampling for **both** paths (matched pull uses history; alpha still pushes the latest packet into lerp). Do not change hold vs match vs free-run policy.

What this will **not** fix (do not pretend): missing `stream_anchor` → hold; GPS 0,0 / `brg === 0` / `spd < 0.3` hold; `t_sync === false` boats still dropped (TEL-10 leftover). Those stay gates.

## In scope

1. **Drone `sampleDroneAt`:** when A and B exist, replace piecewise-linear position with a **C1** interpolant on lat/lon/alt that uses NED `vel` at A and B (Hermite / cubic Hermite is the intended default). If a sample has no usable vel, fall back to linear for that segment. Do not interpolate toward unusable GPS (keep last-usable-pos rule).
2. **Attitude:** slerp or shortest-path interpolate **both** Euler and `x,y,z,w` (no nearer-copy). Same for `gimbal` and `rot`.
3. **Boats/buoys:** keep TEL-02 DR law (`brg === 0` / `spd < 0.3` never project; `fix_age_ms` skip; blend toward B when present). Optional: cubic only on segments where both ends have usable GPS **and** valid brg/spd. Do not invent northbound walks.
4. **No extra presentation lag:** `sampleAt(t)` at the midpoint of A–B must still be near the linear midpoint (test a straight constant-velocity case). Do **not** add a second low-pass / chase filter in `pipeline.ts` that samples a different time than `t_ntp`.
5. **Extrapolation** (no B): keep ≤150 ms NED vel, then hold, then unavailable. Cubic must not extend the extrapolate window.
6. Tests on `telemetryHistory.test.ts` (and matched pipeline if a nearer-quat step would have failed). Document the interpolant in `src/telemetry/README.md`. One sentence in `docs/architecture/ntp-matching.md` §4.b if that section still says “linear only.”

## Out of scope

- Changing matched hold / free-run / LUT alias (`pipeline.ts` policy).
- Raising WebSocket rate, mock 10 Hz, or NDI fps.
- GEO converters, SCN meshes, MidpointLerp retune unless a test proves alpha path double-smooths badly — then **stop and report** (do not disable lerp on alpha without BW).
- Dropping `brg === 0` hold.
- Flow panel / `flowTap`.

## Likely files

- `src/telemetry/telemetryHistory.ts` + `telemetryHistory.test.ts`
- `src/telemetry/README.md`
- `docs/architecture/ntp-matching.md` (one-paragraph interpolant note)
- `src/pose/` **only if** a converter reads xyzw and tests fail — prefer fixing slerp in history so converters stay unchanged

## Inputs provided

- Packet rates: drone ~10 Hz; boats ~0.5–2 Hz (`ntp-matching.md` §3.3)
- `vel` is NED (x north, y east, z down)
- Matched clock: `t_ntp = toNtp(pts) + syncTrimMs` — sample **that** instant, not `performance.now()`
- Existing linear lerp + `lerpQuat` nearer-copy (the step to remove)

## Acceptance criteria

- [ ] Constant-velocity drone A→B: `sampleDroneAt` at 25%/50%/75% of the span is on the geodesic (Hermite ≈ linear when vel matches the segment).
- [ ] Gimbal/rot xyzw at u=0.5 is a slerp blend, not a snap to A or B.
- [ ] `brg === 0` boat still does not dead-reckon north.
- [ ] Matched-path tests still hold (no lerp-to-newest). No new sample of “wall clock now” in `pipeline.ts`.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Summary (Hermite vs fallback; quat slerp; boats cubic or linear)
2. Files touched
3. Tests
4. Whether alpha MidpointLerp now double-smooths (observe, do not “fix” unless blocked)
5. Suggested TEL memo bullets
