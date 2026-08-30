# Dispatch DSP-OUT-20260829-04-independent-channel-clocks

## Meta
- From orchestrator: BW (route to OUT)
- Worker role: WORKER(DSP-OUT-20260829-04-independent-channel-clocks)
- Priority: **P0 ★**
- Phase: 18.11
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active** — wave 3 **released 2026-08-30** after the operator dump. Runs in parallel with `DSP-OUT-20260829-02` (`desktop/` only) and `DSP-OUT-20260830-01` (2D grab helper only).
- Prerequisite: `DSP-PRF-20260829-01` has landed. Live baseline is pasted below.

## Goal

Make AR, 3D, and 2D each hold at least 30 fps on their **own** clock, independent of one another, with no cross-channel arbitration. Operator, verbatim: *"i dont want to see less then 30 fps on all ar 3d 2d… dont slice anything, all of them have min 30 fps independent from each other."*

## Background — two specific defects, both found by reading the code

**(a) The rate gate is phase-locked to a knife edge, and this alone can pin you at 20 fps.**

```297:297:src/output/ndiFramePump.ts
    if (now - lastCaptureMs < minIntervalMs) return
```

`minIntervalMs` is `1000/30 = 33.333 ms`. The studio tick is 60 Hz, so two ticks is *exactly* 33.333 ms. `lastCaptureMs` is stamped with an observed `performance.now()` at capture, not with a position on a fixed grid. The tick comes from a Node `setInterval` relayed over IPC, which jitters by more than the zero margin this comparison leaves. Whenever the second tick lands a fraction early the check fails and the pump waits for the **third** tick.

The consequence is that the achievable rate is quantised and there is nothing between the steps: every second tick is 30 fps, every third is 20, every fourth is 15. An alternation between the second and third tick averages roughly 24, and with real overruns mixed in you land on the observed ~18. Same pattern at `ndi3dChannelPump.ts:206` and `streamMapNdiPump.ts:247,279`.

**(b) The AR/3D stagger forces alternation and leaves zero headroom.**

```48:76:src/output/ndiCaptureStagger.ts
export function tryClaimNdiHeavyCapture(
  channel: NdiHeavyCaptureChannel,
  nowMs: number = performance.now(),
  options?: NdiHeavyCaptureClaimOptions,
): boolean {
  void options
  if (!isFboChannel(channel)) {
    return true
  }
  const otherFboSameTick = /* … 8 ms window … */
```

AR and 3D alternate on a 60 Hz tick, giving each exactly 30 opportunities per second — a budget with no slack at all, where one missed opportunity puts the channel under target immediately. The stagger was introduced when readback was synchronous. With the PBO path, issuing a second 1080p render in the same tick is mostly GPU command submission, and the GPU is at 8%. **BW has approved retiring it.**

## Third defect, found by PRF-01 and verified by BW (2026-08-29) — the burned stagger slot

`DSP-PRF-20260829-01` has landed and reported a defect that was **not** in the original two-defect analysis. BW read the code and confirms it.

`tryClaimNdiHeavyCapture('ar', now, …)` (`ndiFramePump.ts:342`) commits the claim immediately — it sets `lastFboChannel = 'ar'` and `lastFboMs = now`. The pump then renders a full 1080p pass and only afterwards calls `readback.begin(...)` in `captureAirTarget` (`ndiFramePump.ts:307`). If `begin` returns false because the PBO pool is exhausted, the function returns at `if (!ok) return` (L309) **without releasing the claim**.

The cost of one such failure is worse than a lost capture:

1. AR rendered a 1080p scene pass that is thrown away.
2. AR does not update `lastCaptureMs`, so it correctly retries — but the wasted render already happened.
3. 3D, running later in the same tick, calls `tryClaimNdiHeavyCapture('3d', now)`, sees `lastFboChannel === 'ar'` inside the 8 ms window, sets `preferNext = '3d'` and returns false.

So a single PBO exhaustion costs a wasted render **and** both channels' captures for that tick. `preferNext` makes it partially self-correcting on the following tick, but this fires precisely under the load being debugged — pool exhaustion happens when readbacks are not draining fast enough.

**What this means for your work.** You are retiring the stagger, so the AR-blocks-3D half of this disappears. **The wasted render does not.** Whatever replaces the current flow must not commit to a render before it knows a readback slot is available — either check pool capacity before rendering, or make the claim releasable and release it on `begin` failure. The `blocking: true` sync-readback fallback keeps exclusivity per the dispatch, so the release path must exist there too.

Also from PRF-01, so you do not misread the instrument:

- **Renderer-side `busy` is almost never true**, because `sendFrame` is fire-and-forget. Do not tune against the renderer `busy` skip counter; the meaningful drop counter is `main … dropBusy`, which belongs to `DSP-OUT-20260829-02`.
- **2D `rateCap` can double-count** (once at schedule, once in the deferred `runCapture`) when a grab completes between the two. That is a measurement artefact in the dump, not a cap defect. Do not "fix" the cap because the skip number looks high.

## Live dump 2026-08-29 — the phase-lock was real and *not* the wall

Operator paste, all three senders live. Send **AR 15 / 3D 15 / 2D 3**. Full block in `BW_MEMO`.

```
window ~10s  ticks=495  mean=20.2ms  max=109.5ms  >20ms=225
tickIntervalMs  14:3 15:2 16:7 17:2 18:4 19:6 20:4 ≥34:113 ≤13:246 21-24:38 25-33:70
captureTicks ar  1:14 2:12 3:18 4:15 5:14 6+:39  mixed
captureTicks 3d  1:12 2:17 3:26 4:19 5:24 6+:26  mixed
captureTicks 2d  6+:31  mixed
```

**The 60 Hz clock is not delivering 60.** 495 ticks in ~10 s is ~50 Hz. Mean interval 20.2 ms, max 109.5 ms, 225 intervals over 20 ms. This is not a broken `setInterval` — the renderer tick handler is blocking, so `studio:tick` messages queue. Do **not** change `STUDIO_TICK_FPS`. Restore the clock by getting work *off* the tick.

**Named walls, with numbers:**

| Stage | Mean | What it is | Owner |
| --- | --- | --- | --- |
| `arEnqueueIpc` / `3dEnqueueIpc` | **17–23 ms** | `ArrayBuffer.slice` + sync `ipcRenderer.send` of 8 MB. Two of these on one tick is why `totalTick` max is 73–85 ms. | **you** |
| `arReadbackBegin` | 9–16 ms (max 62) | PBO `readPixels` + `flush`. Asymmetric: 3D begin is ~0.5–1.5 ms. | you, do not make it worse; check pool **before** render |
| `2dGrab` | **120–193 ms** | Worker `getImageData(1920,1080)` after 520→1080 upscale. | **`DSP-OUT-20260830-01` — not you** |
| `rgbaToBgra` | 7 ms, `dropBusy=0` | Main process, keeping up with the 15 fps that arrive. | `DSP-OUT-20260829-02` |

**Stagger is confirmed as a limiter, not *the* limiter.** Snapshot 4: `ar stagger=30` / `3d stagger=11` in one second — AR lost the slot more often than it captured. Retire it on the PBO path as planned. The burned-slot defect (claim before `begin`) still stands.

**Phase-lock is visible but drowned.** `captureTicks` is a smear from 1 through 6+, not a clean 2-vs-3. Fix the gate anyway; a jittery 20 ms clock makes the 33.3 ms knife-edge even worse.

**Arithmetic you cannot ignore.** 22 ms of sync clone × 30 fps × 2 FBO channels = 1.3 s of renderer work per second. Killing the `slice` and deferring `send` off the tick **restores the clock** but does **not** by itself create 30+30 if the clone stays at 22 ms. After those two changes, if `*EnqueueIpc` mean is still **>12 ms**, stop and report — that is the 4:2:2 / payload-size decision. Do not invent a codec.

## In scope

1. **Defer `ipcRenderer.send` off the studio tick.** `enqueueRgba` currently runs inside `drainReadback` inside the tick subscriber. The 22 ms structured clone therefore holds the tick (and delays the next `studio:tick`). Copy/pool the pixels if you still must, then `queueMicrotask` / `setTimeout(0)` the actual `sendFrame`. The tick must return after FBO + `readback.begin` / `poll`, not after IPC. Prove with a test or a dump that `totalTick` no longer includes the 20 ms enqueue. Keep-newest if two frames queue before the deferred send runs.
2. **Drop the renderer-side `ArrayBuffer.slice`.** `ndiFramePump.ts` L262–265 and `ndi3dChannelPump.ts` L183–186. IPC serializes synchronously, so a pooled buffer can be reused once `send` returns. Small ring; prove reuse is safe against PBO `poll` overwriting the slot. This is the other half of the 22 ms.
3. **Fix the rate gate in all three pumps.** Phase accumulation: `nextDueMs`, admit when `now >= nextDueMs - tolerance` (~half a tick), resync if more than one interval behind (no catch-up burst). Target **~32 fps nominal** so the trailing-1 s readout never shows 29. Declared NDI rate stays 30/1 (`desktop/`).
4. **Retire the AR/3D stagger on the PBO path.** Both channels may capture in the same tick when each is due. Keep `ndiCaptureStagger.ts` in-repo; use it **only** when `readback.mode === 'sync'`. Check PBO slot capacity **before** the 1080p render so a failed `begin` cannot waste a pass (the burned-slot defect).
5. **Independent clocks.** A test drives a jittery 60 Hz tick and asserts all three pumps can reach target concurrently. 2D's *grab cost* is the other worker — your job is that 2D's *gate and send* no longer wait on AR/3D.
6. Re-measure. Healthy: `tickIntervalMs` clustered on **16**, `captureTicks ar/3d` clustered on **2**, `*EnqueueIpc` no longer inside `totalTick`. Paste those three lines.

Do **not** rewrite `ndi2dAsyncCapture.ts` / the 2D worker. `DSP-OUT-20260830-01` owns that. You may still defer `2dSend` the same way as AR/3D inside `streamMapNdiPump.ts`.

## Context you need but must not act on

`DSP-OUT-20260829-02` is running in parallel in `desktop/` (BGRA loop / pool / queue). `DSP-OUT-20260830-01` is rewriting the 2D grab helper. Measure at the **end** — mid-wave dumps will mix their progress with yours. If `-02` reports that the vertical flip must move into the capture pass, that is a follow-up, not this dispatch.

## Out of scope

- **Everything under `desktop/`.** Owned by `-02` in this same wave.
- **`ndi2dAsyncCapture.ts` / `ndi2dCapture.worker.ts`.** Owned by `DSP-OUT-20260830-01`. Do not "fix" `2dGrab` here.
- The GPU colour-order swizzle — `DSP-OUT-20260829-05`, conditional.
- Raising or lowering `STUDIO_TICK_FPS`. The 60 Hz tick stays. Note that `.cursor/rules/agentic-core.mdc` still says `never STUDIO_TICK_FPS = 60` and `NDI 3D ~10`; both are **stale** — the 60 Hz tick was set deliberately by the accepted `DSP-OUT-20260828-04` (see the comment at `desktop/main.cjs:86–89`) and 3D has been locked at 30 since the studio-30 decision. Do not "fix" either back.
- Turning any channel off or downrating one to help another. Refused twice by the operator.
- Colour space (`DSP-OUT-20260829-01`), SRT decode, the delay buffer, preview rAF behaviour.

## Likely files

- `src/output/ndiFramePump.ts` — rate gate, claim call, `enqueueRgba`
- `src/output/ndi3dChannelPump.ts` — rate gate, claim call
- `src/output/streamMapNdiPump.ts` — rate gate (two sites)
- `src/output/ndiCaptureStagger.ts` — sync-fallback-only arbitration
- `src/output/ndiAsyncReadback.ts` — buffer ring
- tests alongside each; `docs/architecture/performance-budgets.md`

## Inputs provided

- Target: **≥30 fps displayed on all three channels at once**, sustained, with SRT live, all three enabled.
- Baseline ~18 fps; GPU 8% on an RX 6750 XT — the GPU is not the constraint.
- Constants: tick 60 (`desktop/main.cjs:90`), stagger 8 ms (`ndiCaptureStagger.ts:29`), caps 30 (`ndiFramePump.ts:83`, `ndi3dChannelPump.ts:46`, `streamMapNdiPump.ts:40`), PBO count 2 / latency 1 frame (`ndiAsyncReadback.ts:22–26`).
- Prior BW lock: "GPU idle ≠ weak PC" — the answer is to pipeline work across the frame, never to drop a channel.

## Acceptance criteria

- [ ] The rate gate uses phase accumulation with a tolerance; a unit test drives a jittery 60 Hz tick and asserts the pump still achieves its target rate rather than falling to 20.
- [ ] AR and 3D can both capture in the same tick on the PBO path; a test proves it.
- [ ] Arbitration still applies when the synchronous readback fallback is active.
- [ ] The per-frame `ArrayBuffer.slice` is gone, replaced by a pooled buffer with proven-safe reuse.
- [ ] A test drives all three pumps concurrently and asserts each reaches target independently.
- [ ] The ops **Broadcast → Output** rail shows **30 or above on all three channels**, never dipping to 29, sustained over at least 60 s with SRT live.
- [ ] Preview stays at or above 30 and hitch/s stays near 0 while that is true.
- [ ] No channel was disabled or downrated; no file under `desktop/` was modified.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** all three sources live in OBS or vMix for a minute with SRT running; paste the three Send numbers, preview, and hitch.

## Report back

1. The new gate design and the measured tick-count distribution between captures
2. What replaced the stagger, and what still arbitrates on the sync fallback
3. Before/after Send fps for all three channels
4. Files touched, and confirmation nothing under `desktop/` was
5. If 30 was not reached: the measured remaining wall, with numbers
6. Suggested memo bullets for OUT and PRF
