# Dispatch DSP-OUT-20260828-08-lut-miss-play-newest

## Meta
- From orchestrator: OUT (adopted BW draft via `HO-BW-OUT-20260828-08`)
- Worker role: WORKER(DSP-OUT-20260828-08-lut-miss-play-newest)
- Priority: P0
- Phase: Studio — SRT flowing, **picture looks stuck**
- Related: `HO-BW-OUT-20260828-08` · `done/DSP-OUT-20260828-03`
- Status: **accepted 2026-08-28 (BW)** — empty LUT → `lut-miss-live` newest. Suite **910 + 23**.
- Parallel: `DSP-TEL-20260828-03-match-miss-freerun` (pose; do not mix)

## Goal

When the PTS→NTP LUT cannot map the presented frame, **keep playing the newest decoded SRT picture**. Do not stall-pin the plate on one (or a 400 ms-behind) frame as the steady state so the live stream looks frozen while AUs/kbps keep moving.

Match when `toNtp` works (adaptive 100–400 ms unchanged). LUT extra window stays **2 s**.

## Background

`pickPresentationPts`: all `toNtp` null **or** no pose-covered mapped frame → `stall-pin` at 400 ms (`DSP-OUT-20260828-03`). That was to avoid “live stick + frozen overlay.” Overlay freeze is now TEL-03 (free-run on miss). A pinned plate plus a held pose is what the operator sees as “live stream stuck.”

`latencyMsOf` already falls back to PTS ticks when NTP is null, so stall-pin can still *advance* — but a short queue + repeat presented frame looks stuck. Play **newest** on LUT miss so motion is obvious.

## In scope

1. Adaptive mode: if **every** `toNtp(pts)` is null, pick **newest** queued frame (`reason` e.g. `lut-miss-live`, `degraded: true`). Do **not** stall-pin as the LUT-empty path.
2. Pose NTP null but some frames **do** map: keep today’s stall-pin / adaptive (telemetry stall ≠ LUT miss).
3. When any frame maps and pose covers: unchanged L4 100–400.
4. Tests: LUT empty → newest, not 400 ms pin. Mapped + pose → still not newest if that violates min latency.
5. Output README one line. `npm test` + `npm run build`.

## Out of scope

- Pose pipeline (TEL-03).
- ffmpeg argv, PES `maskPts33`, NDI fps, 2D worker.
- Widening `DEFAULT_EXTRAPOLATE_MAX_MS`.

## Likely files

- `src/output/videoDecodePipeline.ts` + test
- `src/output/README.md`

## Acceptance criteria

- [ ] All `toNtp` null → present newest decoded frame, not stall-pin.
- [ ] Healthy LUT + pose → still adaptive 100–400, not a free-run newest.
- [ ] `npm test` + `npm run build` green.

## Report back

1. New `reason` string
2. Files / tests
3. Suggested OUT memo

## Worker paste block

```
You are WORKER(DSP-OUT-20260828-08-lut-miss-play-newest).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260828-08-lut-miss-play-newest.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-BW-OUT-20260828-08.md
4. src/output/videoDecodePipeline.ts (pickPresentationPts)
5. src/output/videoDecodePipeline.test.ts
6. src/output/README.md

Implement: when every toNtp is null, present the newest decoded frame
(lut-miss-live), not stall-pin 400 ms. When the LUT maps, keep adaptive
100–400. Do not touch pose/ffmpeg/NDI. Report back per dispatch.
```
