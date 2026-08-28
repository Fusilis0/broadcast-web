# Dispatch DSP-TEL-20260826-01-pts-ntp-map

## Meta
- From orchestrator: BW → TEL
- Worker role: WORKER(DSP-TEL-20260826-01-pts-ntp-map)
- Priority: P0
- Phase: Phase 17.1 — PTS → NTP mapping
- Design: `docs/architecture/ar-video-underlay-ntp-sync.md` §4.2
- Prerequisite reading: `docs/architecture/ntp-matching.md` §2.3, §3.2, §4.a, §4.d
- Parallel-safe with: TEL-02, OUT-03, OUT-04, CAL-05. **You own** `src/telemetry/ptsNtpMap.*`. Do not touch `pipeline.ts`, `ingest.ts`, `router.ts`, or any file another wave-1 dispatch owns.
- Shared-file note: TEL-02 also appends to `src/telemetry/index.ts` and `README.md`. Append your exports at the **end**; do not reorder existing lines.
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` 741+23, `npm run build` green). Live extrapolation via 30 s OLS; JS wrap is mod `2^33` (not `&`).

## Goal

A pure, dependency-free module that answers one question: **given a decoded video frame's 90 kHz PTS on stream `S`, what NTP millisecond instant was that frame captured?**

No bus subscription, no I/O, no timers. A data structure with `addAnchor` / `toNtp` / `health` that a later dispatch wires to `telemetryBus`. Fully testable under the existing vitest-node setup.

## Background

`stream_anchor` messages already arrive on `telemetryBus` (`src/telemetry/ingest.ts` emits them; `stubHud.ts` counts them). **Nothing consumes them.** `src/pose/pipeline.ts` line 163 says so explicitly: `// stream_anchor intentionally ignored for ENU`.

Each anchor pairs a muxer PTS with the producer's NTP estimate of capture. Read `ntp-matching.md` §2.3 for the wire shape and §3.2 for what DJI actually guarantees. `StreamAnchorMessage` is already declared in `src/telemetry/types.ts`.

### Why not the algorithm in `ntp-matching.md` §4.a

That section specifies pairwise linear interpolation between bracketing anchors, and says to **reject** a PTS newer than the last anchor. That is correct for a recording and **wrong for live** — the frame we want to present is *always* newer than the last periodic anchor, which arrives at ~1 Hz. Implemented literally, we could never present a frame.

**BW decision: use a sliding-window robust linear fit instead.** It extrapolates naturally (the thing live needs), tolerates a single bad `ntp_capture_ms` without hinging a segment, and does not produce a 1 Hz discontinuity in the matched time. The source doc will be amended; you are implementing the amended behaviour.

Note `L7` from the user: **we do not know whether DJI ships `sendPerAuFrameAnchors = true`.** So the ~1 Hz periodic path is the *primary* path and must be good on its own. Per-AU `kind:frame` anchors are a bonus when present, never a requirement.

## In scope

1. New `src/telemetry/ptsNtpMap.ts`:
   - `createPtsNtpMap(options?)` → handle. One instance **per `stream_id`**; also provide a small registry (`getPtsNtpMap(streamId)` / `clearPtsNtpMaps()`) or equivalent so callers do not hand-roll a Map.
   - `addAnchor(anchor: StreamAnchorMessage): void`
     - Route by `kind`: `dji` / `periodic` / `gopro` → **pacing series** (feeds the fit). `frame` → **truth series** (validation only, never in the fit). Unknown kinds → ignore, count.
     - PTS field: prefer `pts_90khz`; fall back to `pts_basis_90khz`. Mask to unsigned 33-bit.
     - Reject when `ntp_synced === false`, when `ntp_capture_ms` is not finite, or when neither PTS field is usable. Count rejections by reason.
   - **33-bit unwrap.** Maintain a monotonically unwrapped PTS counter internally (shortest signed 33-bit difference — helper given in `ntp-matching.md` §4.a). Everything downstream — fit, extrapolation, `toNtp` input — works in unwrapped space. MPEG-TS wraps every ~95443 s (~26.5 h); a show can straddle it.
   - `toNtp(pts90k: number): PtsNtpResult` where the result carries the resolved `ntpMs` **and** a quality signal — at minimum `{ ntpMs, mode: 'interpolated' | 'extrapolated' | 'unavailable', extrapolatedByMs }`. Callers must be able to badge degradation without guessing.
   - **The fit:** least-squares line over the pacing series within a sliding window (default ~30 s of anchor time), with outlier rejection (a simple residual-threshold second pass is fine — do not build RANSAC). Slope should land near 1.0; expose it.
   - **Forward extrapolation** bounded at a configurable default **2000 ms** past the newest pacing anchor. Beyond that → `mode: 'unavailable'`.
   - Reject / reset on clock step (a pacing anchor whose `ntp_capture_ms` goes backwards relative to the fit by more than a threshold) — drop the window and rebuild rather than fitting across the discontinuity.
   - Bounded memory: cap the retained anchor count (the window already bounds it by time; add a hard count cap too). See C8 — DJI per-AU anchors can arrive at 30/s per drone.
   - `health()` → `{ pacingCount, frameCount, slope, lastAnchorNtpMs, lastAnchorAgeMs?, rejected: {...}, residualMs }`. `residualMs` = agreement between the fit and the `kind:frame` truth series when it exists; this is how ops learns the mapping is sane. Shape is consumed by OUT-07's sync HUD — keep it a plain serialisable object.
   - `reset()` / `dispose()`.
2. Export from `src/telemetry/index.ts` (append only).
3. Tests `src/telemetry/ptsNtpMap.test.ts` — see acceptance.
4. Docs: a short section in `src/telemetry/README.md` (append).

## Out of scope

- **Any bus subscription.** TEL-08 wires this to `telemetryBus`. Keep the module pure.
- Pose/GPS sampling — that is TEL-02.
- Video, decoding, presentation — OUT-03/04/06.
- Changing `router.ts` / `tryParseStreamAnchor`. It currently drops `q_delay_ms` / `ema_delay_ms`; that is fine, they are already baked into `ntp_capture_ms`. Do not add them.
- GoPro-specific handling. GoPro is out of scope for the whole phase (L2). Accept `kind: 'gopro'` into the pacing series because it costs one array entry, and stop there.

## Likely files

- `src/telemetry/ptsNtpMap.ts` (new)
- `src/telemetry/ptsNtpMap.test.ts` (new)
- `src/telemetry/index.ts` (append exports)
- `src/telemetry/README.md` (append)

## Inputs provided

- `StreamAnchorMessage` — `src/telemetry/types.ts` L72
- Anchor emission — `src/telemetry/ingest.ts` L216
- Mock anchors already exist: `src/telemetry/mockSource.ts` `buildStreamAnchor()` L267, emitted for `povIds[0]`
- Wrap helper + field semantics — `ntp-matching.md` §4.a, §2.3
- Test precedent — `src/telemetry/live.test.ts`, `src/telemetry/multiPov.test.ts`

## Acceptance criteria

- [ ] Two pacing anchors → a PTS between them resolves to the linearly interpolated NTP, `mode: 'interpolated'`.
- [ ] A PTS **newer than the last anchor** resolves via the fit with `mode: 'extrapolated'` and a correct `extrapolatedByMs`. (This is the live case and the reason we departed from §4.a — it must not return `unavailable`.)
- [ ] Beyond the extrapolation bound → `mode: 'unavailable'`, no fabricated number.
- [ ] **Wrap:** anchors straddling the 33-bit boundary produce a continuous, monotonic NTP mapping. A PTS just after wrap must not jump ~95443 s.
- [ ] `kind: 'frame'` anchors do **not** move the fit — feed a series of periodic anchors, add frame anchors with deliberately noisy NTP, confirm `toNtp` output is unchanged and `health().residualMs` reflects the disagreement.
- [ ] Anchors with `ntp_synced: false` are rejected and counted.
- [ ] A single outlier anchor (NTP off by seconds) does not visibly bend the mapping.
- [ ] A backwards clock step resets the window rather than producing a nonsense slope.
- [ ] Sustained 30 anchors/s does not grow memory without bound (assert retained count is capped).
- [ ] Slope for a clean synthetic 30 fps stream is ≈ 1.0 within tolerance.
- [ ] Per-`stream_id` isolation: two streams with different PTS bases do not contaminate each other.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (fit method, window/outlier params chosen and why, extrapolation bound)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers — especially anything you found in `ntp-matching.md` that conflicts with what you built
5. Suggested TEL memo bullets
