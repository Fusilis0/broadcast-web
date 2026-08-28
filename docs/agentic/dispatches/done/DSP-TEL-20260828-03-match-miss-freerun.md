# Dispatch DSP-TEL-20260828-03-match-miss-freerun

## Meta
- From orchestrator: TEL (adopted BW draft via `HO-BW-TEL-20260828-03`)
- Worker role: WORKER(DSP-TEL-20260828-03-match-miss-freerun)
- Priority: P0
- Phase: Studio — flowing telem + SRT, **frozen world**
- Related: `HO-BW-TEL-20260828-03` · `done/DSP-TEL-20260826-10` · `done/DSP-TEL-20260828-02`
- Status: **accepted 2026-08-28 (BW)** — LUT miss free-runs; long unavailable → newest. Suite **910 + 23**.
- Parallel: `DSP-OUT-20260828-08-lut-miss-play-newest` (video plate; do not mix)

## Goal

Packets and SRT are flowing; the 3D/AR world does not move. That is **by design today**, and it is wrong for air.

When `arBackground: 'video'` and a picture exists, `videoClockActive()` **stops upserting** live pose and `tick` either `sampleAt(t_ntp)` or **`emitHeld()` forever**. One pose bus drives AR **and** 3D NDI. LUT miss or `sampleAt` `unavailable` therefore freezes the whole sim, including 3D, while Flow/Sync still update.

**New lock (BW 2026-08-28):** never freeze the world while telemetry and SRT are flowing. Unsynced motion is better than a stuck shot. Match when the LUT + `sampleAt` work; otherwise **free-run**.

Do not vanish meshes (TEL-02). Do not lerp-to-newest **while** `sampleAt` is healthy at `t_ntp`.

## Background

Operator: drone telem no longer goes null (producer now sends on no-change). Both telem and SRT keep flowing. Live stream and 3D stay stuck.

Code (`src/pose/pipeline.ts`):

- `onDrone` / `onBoat` / `onBuoy`: `if (videoClockActive()) return` after history insert.
- `tick`: if `videoClockActive()` and `activeMatchedNtp() == null` → `emitHeld()` (last mesh, no motion).
- `emitMatchedOrLast`: `sampleAt` `unavailable` → re-emit `lastMatched` indefinitely (TEL-02).

`toNtp` unavailable (PTS vs anchors, extra &gt; 2 s) **or** video NTP more than `DEFAULT_HOLD_MS` (2 s) ahead of the pose buffer both look like this. 3D is not a second clock — it shares `poseBus`.

Alpha mode already free-runs (`matchEnabled() === false`). That is the operator workaround, not the fix.

## In scope

1. **LUT / `toNtp` miss:** do **not** `emitHeld` as the steady state. Fall through to the existing lerp/`upsert` path (same as alpha). Packets must upsert again. Tests: the current `single pacing sample (toNtp unavailable) holds, does not free-run` and `presentedPts` with `pacingCount === 0` **must flip** to free-run (yaw follows the new packet). Sync debug: `held: false`, `freeRun: true`, `matched: false`.
2. **`sampleAt` unavailable** (NTP resolved, video ahead of buffer): keep TEL-02 “do not omit the mesh.” After the history hold window (`DEFAULT_HOLD_MS`), **do not** pin `lastMatched` forever — emit the **newest** history sample (free-run / degraded). Short gaps inside extrapolate+hold still use last matched. Tests for both: brief unavailable keeps last; long unavailable follows newest.
3. When `toNtp` + `sampleAt` succeed: unchanged matched path (no lerp stacked on Hermite).
4. Pose README + one line in `docs/architecture/ar-video-underlay-ntp-sync.md`: hold is not the LUT-miss steady state.
5. `npm test` + `npm run build`.

## Out of scope

- Dual worlds (live 3D vs matched AR at two NTPs). Still one `poseBus`.
- Widening LUT extra beyond 2 s.
- ffmpeg / PTS identity / NDI fps.
- Flow `telem: null` card (producer fixed).
- SCN mesh look.

## Likely files

- `src/pose/pipeline.ts` + `src/pose/matchedPipeline.test.ts`
- `src/pose/README.md`
- `docs/architecture/ar-video-underlay-ntp-sync.md` (one paragraph, BW-authorized)

## Acceptance criteria

- [ ] Video on + picture + **no** usable `toNtp` → scene follows new telem (free-run), not a frozen last pose.
- [ ] Video on + good `toNtp` + `sampleAt` ok → still matched at `t_ntp`.
- [ ] Video on + good `toNtp` + `unavailable` longer than hold → newest pose, mesh stays visible.
- [ ] Worker does not touch OUT present / ffmpeg.
- [ ] `npm test` + `npm run build` green.

## Report back

1. When upsert is allowed vs skipped
2. Files / tests flipped from “hold on LUT miss”
3. Suggested TEL memo

## Worker paste block

```
You are WORKER(DSP-TEL-20260828-03-match-miss-freerun).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-TEL-20260828-03-match-miss-freerun.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-BW-TEL-20260828-03.md
4. src/pose/pipeline.ts
5. src/pose/matchedPipeline.test.ts
6. src/pose/README.md

Implement: while SRT+telem flow, never freeze the world on LUT miss. Free-run
lerp when toNtp is unavailable. Keep matched sampleAt when it works. If
sampleAt stays unavailable past the history hold window, emit newest pose
(do not pin lastMatched forever). Do not vanish meshes. Do not touch OUT/ffmpeg.
Report back per dispatch.
```
