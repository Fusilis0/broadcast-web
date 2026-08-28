# Dispatch DSP-OUT-20260828-03-present-wait-lut

## Meta
- From orchestrator: BW → OUT
- Worker role: WORKER(DSP-OUT-20260828-03-present-wait-lut)
- Priority: P0
- Phase: Phase 17.6 — AR video must not run live while pose is held
- Related: `HO-BW-OUT-20260828-03` · `done/DSP-OUT-20260826-06` · `done/DSP-TEL-20260826-10`
- Parallel with: `DSP-TEL-20260828-02-match-no-vanish` (TEL owns overlay hold; you own which video frame is shown)
- **Status: DONE** — worker complete + BW accepted 2026-08-28 (merged tree `npm test` **896 + 23**, `npm run build` green). LUT miss stall-pins 400 ms; PTS map ±32 µs or null. Human smoke still open.

## Goal

Stop the AR underlay from playing the **newest** decoded frame when PTS→NTP is missing or garbage. That is the operator symptom “SRT comes before telemetry”: picture is live, overlay is held or empty. Presentation must wait on a real muxer PTS and a LUT, same as L4 stall-pin.

## Background

Operator 2026-08-28: AR bg video and pose are not synced. Producer NTP note is already our design (`ntp-matching.md`). The live break is in **this** decoder/present path, not a missing interpolator.

Two concrete bugs in `src/output/videoDecodePipeline.ts`:

1. **`onFrame` (~L405):** `pts90k = ptsByTimestamp.get(timestampUs) ?? timestampUs`. WebCodecs often returns a timestamp that is not the exact key we stored (`pts90kToTimestampUs` is rounded). A miss then treats **microseconds** as a 90 kHz PTS. `toNtp` fails or maps nonsense → pose holds; video still presents.

2. **`pickPresentationPts` (~L297–315):** when every `toNtp` is `null` (`!anyMapped`), unmapped frames are treated as `covered` and the **newest** frame is shown. Pose stall (`newestPoseNtp === null`) correctly pins at **400 ms**. LUT-empty must do the same — never “play live” while matching is impossible.

PTS must stay the PES 90 kHz value through demux → chunk → `VideoFrame` → `presentedPts90k`. ffmpeg transcode already uses `-copyts` / `-mpegts_copyts 1` — do not add a restamp.

GoPro / `type=anchor` router is **out of scope** (L2 DJI only).

## In scope

1. **PTS identity:** never substitute `frame.timestamp` (µs) for muxer PTS. If the map misses, recover by nearest timestamp within a small epsilon, or leave `pts90k` unset so `getCounters().presentedPts90k` is **null** (pose pipeline then holds — TEL-10). Add a test that a rounded WebCodecs timestamp still recovers the stored PTS.
2. **Present wait:** `pickPresentationPts` with `!anyMapped` → same path as pose stall (`stall-pin` at `maxLatencyMs`, currently 400). Do not pick newest. Test: all `toNtp` null → pick is not the last frame unless the queue is a single frame already 400 ms deep.
3. Counters: `presentedPts90k` remains real 90 kHz or null. Sync HUD already shows PTS / NTP — do not invent NTP.
4. Docs: one sentence in `src/output/README.md` (LUT miss = delay video, do not free-run the plate).

## Out of scope

- Pose history, Hermite, `pipeline.ts` match policy (TEL-02).
- Raising NDI fps, PBO, chroma.
- Inventing `stream_anchor` from HLS playhead / SRT connect time.
- GoPro.

## Likely files

- `src/output/videoDecodePipeline.ts` + `videoDecodePipeline.test.ts`
- `src/output/README.md`

## Inputs provided

- L4 adaptive present 100–400 ms; stall pins 400.
- Match clock: `videoStreamManager.getCounters(povId).presentedPts90k` (`src/main.ts`).
- TEL-10: picture + no `toNtp` → overlay **hold**, not free-run.

## Acceptance criteria

- [ ] Map miss does not publish µs as `presentedPts90k`.
- [ ] LUT/`toNtp` all-null does not present the newest frame as if live.
- [ ] Existing adaptive 100–400 tests still pass when `toNtp` works.
- [ ] `npm test` + `npm run build` green.

## Report back

1. How PTS is recovered on timestamp mismatch; present behaviour when LUT empty
2. Files touched
3. Tests
4. Whether HEVC→H.264 copyts still looks intact (do not restamp)
5. Suggested OUT memo bullets
