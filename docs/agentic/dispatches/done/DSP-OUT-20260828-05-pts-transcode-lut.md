# Dispatch DSP-OUT-20260828-05-pts-transcode-lut

## Meta
- From orchestrator: OUT (adopted BW draft via `HO-BW-OUT-20260828-05`)
- Worker role: WORKER(DSP-OUT-20260828-05-pts-transcode-lut)
- Priority: P0
- Phase: 17.6 follow-up — presented PTS must be the PES value anchors use
- Related: `HO-BW-OUT-20260828-05` · `done/DSP-OUT-20260828-03` · parallel `DSP-SRT-20260828-01-h264-keep-pts`
- **Status: DONE** — worker complete 2026-08-28. `presentedPts90k` = `maskPts33` PES; H.264 fallback resets that POV LUT (not others); Sync `last pacing` PTS. `npm test` **900 + 23**, `npm run build` green. SRT-01 still required if encoder restamps.
- Parallel (do not expand into): `DSP-OUT-20260828-04-one-ndi-fbo-per-tick` (separate worker); ffmpeg argv = SRT-01

## Goal

Operator Sync (POV 1 / SRT 1, 2026-08-28): `pacing 20`, slope 1, **PTS 10650000 → —**, `unavailable · extra 33965ms`, pose **held**. Anchors exist; LUT will not map because presented PTS is **~34 s** past last pacing PTS. Match cannot start.

Two consumer bugs to close here (ffmpeg keep-PTS is SRT-01):

1. Counters/`matchClock` use **decoder-unwrapped** PTS (`presented.pts90k`). LUT `toNtp` unwraps **again** with a different start (anchors from session start; decode often starts later after HEVC drop / H.264 fallback). Publish **33-bit PES** from demux (`maskPts33(au.pts90k)`) as `presentedPts90k`.
2. `beginFfmpegH264Fallback` resets the decoder unwrap (`resetForH264Fallback`) but **does not reset** `getPtsNtpMap(lutId)`. Old HEVC-era pacing stays; new H.264 PES is a different ruler. **Clear the LUT** for that stream id (and telem alias) when transcode starts.

## In scope

1. Queue/present: store `pesPts33` from demux; `getCounters().presentedPts90k` and `getPresentedPts90k` are **PES 33-bit**, not unwrap-for-WebCodecs. WebCodecs timestamp map stays as today.
2. On H.264 fallback: `clear` / `reset` the PtsNtpMap for `lutStreamIdForPov(povId)` and telem `povId` (export already on `ptsNtpMap.ts`). Do not clear other POVs.
3. Sync Pose/PTS row: show **last pacing PTS** (`health` may need `lastPacingPts90k` — add on the map if missing) next to presented PTS so extra-ms is explainable. One kv, no rail rewrite.
4. Tests: presented PTS is masked 33-bit; fallback resets map (`pacingCount` 0 after); existing lookupPts90k tests still pass.
5. Docs: one sentence in `src/output/README.md` + `src/pose/README.md` if you touch pose debug plumbing.

## Out of scope

- ffmpeg argv (SRT-01). If PES still lags anchors by tens of seconds after this, report “consumer PTS identity fixed; remainder is encoder restamp.”
- NDI fps / stagger (OUT-04).
- Extending LUT extra window to 34 s (that hides the bug).

## Likely files

- `src/output/videoDecodePipeline.ts` + test
- `src/main.ts` (`beginFfmpegH264Fallback`)
- `src/telemetry/ptsNtpMap.ts` (optional `lastPacingPts90k` on health)
- `src/output/syncDebugPanel.ts` (one line)

## Acceptance criteria

- [x] `presentedPts90k` is `maskPts33` PES, not a second unwrap.
- [x] H.264 fallback resets that stream’s LUT.
- [x] Sync can show last pacing PTS vs presented.
- [x] `npm test` + `npm run build` green.

## Report back

1. PES vs unwrap; LUT reset
2. Files / tests
3. Whether SRT-01 is still required
4. OUT memo bullets

## Worker paste block

```
You are WORKER(DSP-OUT-20260828-05-pts-transcode-lut).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260828-05-pts-transcode-lut.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-BW-OUT-20260828-05.md
4. src/output/videoDecodePipeline.ts, syncDebugPanel.ts
5. src/telemetry/ptsNtpMap.ts
6. done/DSP-OUT-20260828-03-present-wait-lut.md (prior LUT contract)

Implement: presentedPts90k = maskPts33 PES (not second unwrap);
clear PtsNtpMap for that POV on H.264 fallback; show last pacing PTS in Sync.
No ffmpeg argv (SRT-01). No NDI/OUT-04. Report back per dispatch.
```
