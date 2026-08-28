# Dispatch DSP-SRT-20260828-01-h264-keep-pts

## Meta
- From orchestrator: SRT (issued by BW via `HO-BW-SRT-20260828-01`; SRT owns the worker)
- Worker role: WORKER(DSP-SRT-20260828-01-h264-keep-pts)
- Priority: P0
- Phase: 17.6 — HEVC→H.264 must keep muxer 90 kHz PTS
- Related: `HO-BW-SRT-20260828-01` · `desktop/srtHelpers.cjs` · parallel `DSP-OUT-20260828-05-pts-transcode-lut`
- Status: **accepted 2026-08-28 (BW)** — `-copytb 1` + `-enc_time_base 1:90000` on transcode only. File round-trip kept muxer PTS; live air still operator. Suite **900 + 23**.

## Goal

`stream_anchor.pts_90khz` is the **DJI muxer** PTS. After Electron ffmpeg HEVC→H.264, demuxed PES was **~34 s ahead** of the last periodic anchor (Sync: extra 33965 ms, PTS → —). `-copyts` / `-mpegts_copyts 1` are already on the argv; **libx264 still often restamps**. Make the transcoded TS carry the **same 90 kHz PTS** as the input access units.

## Background

Operator 2026-08-28: `codec: h264`, `accessUnits: 1823`, `framesDecoded: 10`, `pacing 20`, slope 1. Anchors live; LUT correctly refuses &gt;2 s extra. Same-device pose `ts` is fine. The break is **video PTS vs anchor PTS**.

Do not invent NTP from SRT connect time. Do not widen the 2 s LUT extra.

Copy path (`-c copy`) is already PTS-safe. This dispatch is **only** the `transcodeToH264` branch.

## Inputs provided

Current `buildFfmpegArgv(..., { transcodeToH264: true })` in `desktop/srtHelpers.cjs` already has:

- `-copyts` (input head **and** after libx264)
- `-mpegts_copyts 1` `-muxdelay 0` `-muxpreload 0` `-avoid_negative_ts disabled`
- `-fps_mode passthrough`
- libx264 ultrafast / zerolatency / `repeat-headers=1`

That set is **not enough**. Live still showed ~34 s extra. Tests today only grep `-copyts` on the transcode argv — they will pass while restamp continues. You must add a **keep-input-PTS** mechanism beyond hoping libx264 honors `-copyts`.

Copy path must stay: `-map 0` `-c copy` plus the existing tail. Do not add transcode-only flags onto copy.

## In scope

1. `buildFfmpegArgv` transcode path: input 90 kHz PTS must appear on output PES. Try in this order until argv is defensible (document which one you ship):
   1. `-copytb 1` and `-enc_time_base -1` (or explicit `1:90000`) so the encoder uses the demuxer 90 kHz ruler, not a new origin.
   2. Identity `setpts=PTS` **only if** it does not zero the timeline. Never `PTS-STARTPTS`.
   3. `-bsf:v setts=…` that copies input PTS onto output AUs, if (1)/(2) are documented as insufficient.
   Keep `-copyts` `-mpegts_copyts 1` `-muxdelay 0`. `-fps_mode passthrough` stays unless it fights PTS.
2. Tests in `src/output/srtBridge.test.ts`: copy path still `-c copy` and **no** `libx264` / `genpts`; transcode is **not** `-c copy`; assert every extra keep-PTS flag you add (`-copytb`, `-enc_time_base`, `setpts=PTS`, `setts`, …). No GPU fps.
3. `desktop/README.md` one sentence on the HEVC fallback paragraph: transcode must not start a new PTS origin (same 90 kHz as the input AUs).
4. If ffmpeg **cannot** preserve PTS on libx264: stop and report — then consumer cannot match while transcoding (must WebCodecs HEVC or a different pipeline). Do not fake NTP. Do not widen the LUT extra window.

## Out of scope

- NDI fps / `STUDIO_TICK_FPS` (PRF / OUT-04).
- LUT math / Hermite / `sampleAt` (TEL). `syncTrimMs` (CAL).
- Consumer PES 33-bit vs unwrap, or clearing the LUT on fallback (OUT-05). Do not edit `videoDecodePipeline.ts` / `ptsNtpMap.ts` / `main.ts`.
- GoPro. Catalog URLs. WHEP.

## Forbidden flags

- `setpts=PTS-STARTPTS`
- `-start_at_zero`
- `-fflags +genpts`
- routing SRT through WHEP

## Likely files

- `desktop/srtHelpers.cjs` + `src/output/srtBridge.test.ts` (argv greps)
- `desktop/README.md`

## Acceptance criteria

- [ ] Transcode argv has an explicit keep-input-PTS mechanism beyond hoping libx264 honors `-copyts`.
- [ ] Copy path (`-c copy`) unchanged.
- [ ] `npm test` + `npm run build` green.

## Report back

1. How PTS is preserved (or blocked) — name the flag(s), and whether ffmpeg can actually keep muxer PTS on libx264.
2. Files / tests
3. Suggested SRT memo bullets (do not edit `OUT_MEMO` / `TEL_MEMO`)
