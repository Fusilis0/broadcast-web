# Dispatch DSP-TEL-20260828-04-anchor-id-frame-fit

## Meta
- From orchestrator: TEL (adopted BW draft via `HO-BW-TEL-20260828-04`)
- Worker role: WORKER(DSP-TEL-20260828-04-anchor-id-frame-fit)
- Priority: P0
- Phase: Studio — SRT NTP **not engaging** on live DJI
- Related: `HO-BW-TEL-20260828-04` · `HO-BW-TEL-20260828-04-done` · `done/DSP-TEL-20260826-01` · `done/DSP-TEL-20260826-08`
- Status: **accepted 2026-08-28 (BW)** — `dji-N` aliases onto digit LUT; `kind:frame` is OLS when pacing &lt; 2. Suite **912 + 23**. Extra still 2 s.

## Goal

Make PTS→NTP actually resolve for the live DJI phone when Fleet telem id and SRT id are both **`1`**.

BW live Electron (2026-08-28 23:23 UTC): pose `id: "1"`, `ntp_synced: true`, `ts` NTP. SRT `lutStreamId: "1"`, `presentedPts90k: 28839000`, **`presentedNtpMs: null`**, **`pacingCount: 0`**. Sync: FREE-RUN, `28821000 → —`, last pacing —. Anchor on the **same socket**: `stream_id: "dji-1"`, `kind: "frame"`, `pts_90khz: 28914000`, `ntp_capture_ms` within **~80 ms** of pose `ts`. Wire clocks agree. The LUT never sees them on key `"1"`, and `kind:frame` never enters the OLS fit (`toNtp` requires `pacing.length >= 2`).

Do not log tokens. Do not widen the 2 s extra window.

## Background

`onAnchor` aliases `stream_id` via Fleet SRT↔telem maps only. `"dji-1"` does not map to `"1"`. Flow shows a separate `dronedji-1` anchor card.

`createPtsNtpMap`: `kind ∈ dji|periodic|gopro` → pacing/fit. `kind:frame` → residual only. Live DJI is sending **frame** anchors (per-AU). L7 assumed a 1 Hz periodic series would still exist; tonight’s tap did not show one.

PTS math already looks healthy: presented 28839000 vs anchor 28914000 ≈ **833 ms** of decode/present delay — that should match, not FREE-RUN.

## In scope

1. **Id alias:** when `stream_id` matches `/^dji-?(\d+)$/i`, also `addAnchor` into `getPtsNtpMap(digits)` (and keep the raw key). Pose `onAnchor` existing SRT/telem aliases stay. Tests: `dji-1` + presented lookup on `"1"` / SRT `"1"` → `toNtp` can resolve after enough samples.
2. **Frame fit:** if pacing has **&lt; 2** samples, use `kind:frame` as the fit series (same OLS / unwrap / 2 s extra). When real `dji`/`periodic` pacing exists (≥2), keep today’s split (frame = residual only). Tests: two `kind:frame` anchors 1 s apart → `toNtp` interpolated; mixed periodic+frame → frame still not in the pacing array.
3. Sync/health: `pacingCount` / `lastPacingPts90k` must move when the live path is frame-only (either count frames used for the fit, or document that health uses the fit series). Sync must be able to show `PTS → NTP` not `→ —` in a unit test with `dji-1` + `kind:frame`.
4. Pose README + `src/telemetry/README.md` one paragraph each. `npm test` + `npm run build`.

## Out of scope

- OUT present / stall-pin / ffmpeg / NDI fps.
- Dual worlds. Widening LUT extra.
- Changing Fleet UI ids (operator already sets both to 1).
- GPS lat/lon 0 (no-fix) — not this bug.

## Likely files

- `src/pose/pipeline.ts` (`onAnchor` aliases)
- `src/telemetry/ptsNtpMap.ts` + test
- `src/pose/matchedPipeline.test.ts` (optional: `dji-1` + frame → matched)
- `src/telemetry/README.md`, `src/pose/README.md`

## Acceptance criteria

- [x] Anchor `stream_id: "dji-1"` feeds the LUT used by telem/SRT id `"1"`.
- [x] Two+ `kind:frame` anchors with no periodic still produce `toNtp` (not `unavailable` solely because `pacing.length < 2`).
- [x] Periodic-only path unchanged. Frame-only does not require a fake `kind: dji`.
- [x] `npm test` + `npm run build` green. BW re-ran `npm test`: **912 + 23**.

## Report back

1. Alias rules + whether frame promotes to pacing
2. Files / tests
3. Suggested TEL memo

## Worker result (accepted)

- **Alias:** keep raw `stream_id`; Fleet SRT↔telem aliases stay; `/^dji-?(\d+)$/i` also `addAnchor` on digits. Lookup still SRT id then telem `povId`.
- **Frame:** not pushed into the `pacing` array. When `pacing.length < 2` and ≥2 frames exist, frames are the OLS series (same unwrap, same 2 s extra). Periodic/`dji`/`gopro` ≥2 → frame = residual only. No fake `kind: dji`.
- **Health:** `pacingCount` / `lastPacingPts90k` follow the fit series.
- Tests: `ptsNtpMap` frame-only interpolate + extra still 2 s; `matchedPipeline` `dji-1` + `kind:frame` + LUT `"1"` → matched, `tNtpMs` set.
