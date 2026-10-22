# Dispatch DSP-OUT-20260826-06-ts-demux-decode

## Meta
- From orchestrator: BW → OUT
- Worker role: WORKER(DSP-OUT-20260826-06-ts-demux-decode)
- Priority: P0
- Phase: Phase 17.2 — TS demux + WebCodecs decode + presentation queue
- Design: `docs/architecture/ar-video-underlay-ntp-sync.md` §3.1, §3.3, §3.5, §4.3
- **Wave 2 — OUT-03 and OUT-04 accepted 2026-08-26.** Consume `srt:data` and `setTexture`. Do not modify those modules.
- Parallel-safe with: OUT-07. **main.ts:** you may add one boot/teardown block for the stream manager **below** `startVideoBackground`. OUT-07 owns Fleet UI, URL compose, and the `opaqueClearSafe` video gate — stay out of `fleetLivePanel.ts` and `applyLocalChannelFocus`.
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` 795+23, `npm run build` green). Live SRT picture **not smoked** (no relay token). HEVC HW probe true on RX 6750 XT in Chromium.
- Live example (do **not** commit the token): host `127.0.0.1:9000` or operator relay, `streamid=read:cam{srtId}:pub{srtId}:<session-token>`. OUT-07 builds the URL; you decode whatever bytes arrive.

## Goal

Turn the raw MPEG-TS byte stream into decoded frames that carry their **original muxer PTS**, and present the right one each tick.

This is the technically hardest dispatch in the phase. Read the whole thing before starting.

## Background

### The invariant

**PTS must round-trip untouched.** OUT-03 delivers bytes with the muxer's PTS intact; TEL-01 maps that PTS to NTP; TEL-08 samples telemetry at that NTP. You are the middle link. If you lose or rewrite PTS, everything upstream and downstream is wasted.

WebCodecs is the chosen path precisely because it lets us carry PTS ourselves: we set `EncodedVideoChunk.timestamp` and read it back on `VideoFrame.timestamp`. MSE was rejected because it exposes only `currentTime`; WHEP/WebRTC was rejected because it re-stamps with RTP clocks. Do not reintroduce either.

### Why write our own demuxer

Prefer a **minimal, video-only MPEG-TS demuxer in-repo** over a library. It is a few hundred lines, pure and synchronous, and it tests beautifully under the existing vitest-node setup. `mpegts.js` and its relatives are built around MSE and will fight us on exactly the thing we care about. PTS fidelity is the entire point of the feature — we should own that code.

If you conclude a dependency is genuinely better, stop and report before adding it.

### The footguns, in the order they will bite you

1. **`VideoFrame.close()` is mandatory.** Every frame the presentation policy drops must be closed explicitly. Miss it and the decoder pool exhausts and decode stalls within seconds — and it presents as a network problem, so you will debug the wrong layer. Track outstanding frames and assert the count in tests.
2. **`chunk.timestamp` is microseconds; PTS is 90 kHz ticks.** Unwrap the 33-bit counter to a monotonic value *before* converting, or the first wrap (~26.5 h) corrupts everything. Coordinate with TEL-01, which unwraps the same way — same convention on both sides or the LUT lookup misses.
3. **Annex-B needs no `description`.** In-band SPS/PPS (H.264) or VPS/SPS/PPS (HEVC) means you configure `VideoDecoder` **without** a `description` field. Supplying one switches Chromium to AVCC/HVCC and it rejects the stream.
4. **Colour.** `THREE.SRGBColorSpace` on the texture and BT.709 limited range, or the picture reads grey and flat next to the AR overlay.

### User locks

- **L6 — HEVC on the wire today** (user lock 2026-08-26). H.264 remains a working fallback. HEVC in Chromium is GPU/driver dependent. Probe `VideoDecoder.isConfigSupported` before opening; unsupported → explicit ops error ("HEVC not supported on this GPU/driver — this studio PC cannot decode the DJI SRT"), not a black frame. Software HEVC at 1080p30 × 4 is not a fallback.
- **L5 — 4 warm streams.** All enabled POVs stay decoding; switching swaps which texture drives the composite. Reconnect-per-switch costs 0.5–2 s of black and is not acceptable for a live switcher. Evict least-recently-active beyond the cap.
- **L4 — adaptive presentation latency, clamped 100–400 ms.**

## In scope

1. **`src/output/tsDemux.ts`** (new) — pure, video-only:
   - TS packet sync (0x47, 188 bytes), PAT/PMT to find the video PID and stream type, PES assembly, PTS extraction from the PES header (33-bit).
   - Emit `{ data: Uint8Array (Annex-B AU), pts90k: number, keyframe: boolean, codec: 'h264' | 'hevc' }`.
   - Keyframe detection per codec (H.264 IDR NAL 5; HEVC IRAP 16–23).
   - Robust to mid-stream join, partial packets across chunk boundaries, and discontinuity — this is a live UDP-derived stream, it will be imperfect.
2. **`src/output/videoDecodePipeline.ts`** (new) — per stream:
   - `VideoDecoder` config from the demuxed parameter sets; `isConfigSupported` probe first.
   - Wait for the first keyframe before feeding (mid-stream join is the normal case).
   - Feed `EncodedVideoChunk` with the unwrapped PTS as timestamp; collect `VideoFrame`s into the presentation queue.
   - Error/reset handling: on decoder error, flush and re-arm at the next keyframe rather than dying.
3. **Presentation queue + policy** (§4.3):
   - **Adaptive default:** present the newest frame whose resolved `t_ntp` is already covered by received drone pose, clamped to 100–400 ms behind newest. On telemetry stall, pin at 400 ms and flag degraded rather than drifting.
   - Fixed-latency mode as an operator-selectable alternative.
   - Video stall → repeat the last frame. **NDI cadence must never break** — `studio:tick` keeps sending regardless.
   - Close every skipped frame.
4. **Texture upload** into OUT-04's `setTexture`. Prefer uploading the `VideoFrame` directly; avoid a per-frame `createImageBitmap` round trip if you can. Reuse one texture per stream — do not allocate per frame.
5. **Multi-stream manager**: `{ povId → { demux, decoder, queue, texture } }`, warm cap 4, LRU eviction, clean disposal.
6. Tests. The demuxer is fully unit-testable against synthetic TS bytes and that is where most of your test value is — build a small synthetic TS generator in the test file. WebCodecs is not available in vitest-node, so decoder wiring needs an injectable decoder interface; test the policy and lifecycle against a fake.
7. Docs: `src/output/README.md`.

## Out of scope

- SRT transport, IPC, Electron main — OUT-03, fixed contract.
- The background quad and `arBackground` mode — OUT-04, fixed contract. You call `setTexture`; you do not modify the compositor.
- PTS→NTP mapping — TEL-01. You consume `toNtp`; do not reimplement it.
- Pose sampling and the render-time cutover — TEL-08.
- Per-POV SRT URL config UI and the sync HUD — OUT-07. Expose the counters it needs; do not build the UI.
- Audio. Video-only; audio stays on vMix's camera path.
- GoPro (L2).

## Likely files

- `src/output/tsDemux.ts` (+ test, new)
- `src/output/videoDecodePipeline.ts` (+ test, new)
- `src/output/videoStreamManager.ts` (+ test, new)
- `src/output/index.ts`, `src/output/README.md`

## Inputs provided

- Byte source + status: `srt:data` / `srt:status` via `src/output/srtBridge.ts` (OUT-03)
- Texture sink: `setTexture` on `src/output/videoBackground.ts` (OUT-04)
- PTS→NTP: `createPtsNtpMap` / `toNtp` / `health` in `src/telemetry/ptsNtpMap.ts` (TEL-01) — match its 33-bit unwrap convention exactly
- PTS semantics, DJI 3000 ticks/frame at 30 fps, 33-bit wrap — `ntp-matching.md` §3.2, §4.a
- Frame clock (do not change it): `src/output/previewFrameClock.ts`

## Acceptance criteria

- [ ] Synthetic TS in → correct AUs out with **exact** PTS values, including across chunk boundaries that split a PES packet.
- [ ] 33-bit wrap produces a continuous unwrapped PTS, matching TEL-01's convention.
- [ ] Mid-stream join waits for a keyframe and then decodes cleanly.
- [ ] `VideoFrame` accounting: every frame is closed exactly once. **Assert zero outstanding frames after a soak in the test.**
- [ ] HEVC unsupported → explicit, actionable ops error, not a black frame or a silent failure.
- [ ] Adaptive policy picks the newest pose-covered frame and respects both clamps; telemetry stall pins at 400 ms and flags degraded.
- [ ] Video stall repeats the last frame; NDI keeps sending at its normal cadence.
- [ ] 4 concurrent streams decode without crosstalk; POV switch swaps texture with **no black frame**.
- [ ] LRU eviction beyond the cap disposes cleanly (no leaked decoders).
- [ ] Live smoke against a real SRT source **if one is reachable** (`srt://127.0.0.1:9000` or operator relay caller; HEVC): recognisable moving picture behind the AR scene, present in the NDI frame. If the relay is down or HEVC is unsupported on this GPU, report that as a blocker with the probe result — do not fake a pass.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (demuxer scope, decoder lifecycle, policy implementation, measured cost per stream)
2. Files touched
3. Tests run / how verified — and explicitly, how you proved PTS is exact end to end
4. Follow-ups / blockers — HEVC support on the studio machine, and anything the live smoke could not cover
5. Suggested OUT memo bullets
