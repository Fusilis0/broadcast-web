# Dispatch DSP-PRF-20260829-01-ndi-stage-timing

## Meta
- From orchestrator: BW (route to PRF)
- Worker role: WORKER(DSP-PRF-20260829-01-ndi-stage-timing)
- Priority: **P0 ★**
- Phase: 18.2 — lands **before** the wave-3 fps dispatches
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active** — wave 2. `DSP-OUT-20260829-02` and `-04` are both blocked on this landing, because your instrumentation call sites touch every pump *and* the sender, and they would collide with you.

## Goal

Measure, per stage, where the studio tick's time actually goes, so the fps optimisation that follows (`DSP-OUT-20260829-02`) can name the stage it removed instead of guessing. The operator needs **all three NDI channels on simultaneously at a minimum of 30 fps** and currently sees about **18**. This dispatch does not make it faster. It makes the loss visible.

## Background

BW has since read the code and identified two specific defects, so this is no longer a fishing expedition — but the instrumentation still lands first, for two reasons. It touches every pump and the sender, so it would collide with both wave-3 dispatches if it ran alongside them; and those dispatches need it in order to *prove* they reached 30 rather than assert it.

**The two known defects your instrumentation must be able to see** (do not fix either — that is wave 3):

- **The rate gate is phase-locked.** `if (now - lastCaptureMs < minIntervalMs) return` compares an observed delta against `1000/30 = 33.333 ms`, which is exactly two ticks of the 60 Hz clock. Any negative jitter makes the pump wait for the third tick instead. The rate is therefore quantised — second tick is 30 fps, third is 20, fourth is 15 — and the observed ~18 sits where an alternation between third and fourth would land. **Scope item 8 below exists specifically to confirm or refute this.**
- **The per-pixel conversion in main** (`rgbaToBgra`, `desktop/ndiSender.cjs` L98–112) is roughly 187 M pixels/s at three channels × 30 fps. Scope item 4 must measure it.

What is already known from the read-only trace, so you do not have to rediscover it:

- The clock is a **60 Hz** `setInterval` in `desktop/main.cjs` L90, L467–483, pushing `studio:tick` to the renderer.
- Per tick, in registration order (`src/main.ts`): `previewFrameClock` (L2061) → `videoStreamManager.present()` (L2224–2226) → AR pump (L2254) → 3D pump (L2282) → 2D pump (L2301).
- AR and 3D alternate: `tryClaimNdiHeavyCapture` in `ndiCaptureStagger.ts` L29, L48–75 allows one heavy FBO capture per **8 ms** window. 2D always claims (L54–55). Each pump also caps itself at `1000/30 ≈ 33.33 ms`.
- So the design targets 30 per channel. Seeing 18 means either ticks are not arriving at 60, or the work inside a tick overruns and pushes the next capture past its slot.
- Suspected cost, unmeasured: roughly 8 MB per frame copied four times — `ArrayBuffer.slice` in `enqueueRgba` (`ndiFramePump.ts` L253–256) → structured clone across `ipcRenderer.send` (`desktop/preload.cjs` L31–33, **no transfer list**) → `Buffer.from` in main → a synchronous scalar `rgbaToBgra` loop (`desktop/ndiSender.cjs` L98–112). Three channels at 30 fps is on the order of 700 MB/s of JS memcpy across two threads that also run demux and the preview render.
- `ndiSender.cjs` L224 **drops** a frame outright if the previous `grandi.video` for that channel has not resolved. There is no queue. Dropped frames never reach `sendFps.record`, so a slow sender shows up as low Send fps with no other signal.
- Two silent fallbacks would each wreck the tick if they fire: `NDI_SYNC_READBACK_NOTE` (PBO unavailable → synchronous `readRenderTargetPixels`) and `NDI 2D capture: async worker unavailable` (→ synchronous 8 MB `getImageData` on the main thread).

Existing instrumentation is coarse: `perfCounters.ts` counts sends in a 1 s trailing window, and hitch/s counts preview frames with `dt > 50 ms`. Neither tells you which stage ate the time.

## In scope

1. **Per-stage timers inside the renderer tick.** Accumulate elapsed ms and call counts for at least: `videoStreamManager.present()`, AR FBO render, AR readback begin, AR readback drain/poll, AR enqueue+IPC send, the same three for 3D, 2D schedule → grab → send, and total tick handler duration. Report as a 1 Hz rolling summary (mean and max per stage). Accumulate cheaply; the instrument must not become the bottleneck — budget well under 0.2 ms per tick of overhead and state the measured overhead in your report.
2. **Actual tick delivery rate.** Measure the observed interval between `studio:tick` arrivals in the renderer (mean, max, and count of intervals over 20 ms). If main's 60 Hz interval is not actually delivering 60, everything downstream is a red herring and that is the headline finding.
3. **Claim / skip / drop accounting.** Count per channel per second: captures skipped by `minIntervalMs`, captures skipped by losing the stagger claim, captures skipped because `busy` was set, and — in the **main process** — frames dropped by the `state.busy` guard in `ndiSender.cjs`. Surface the main-process drop count back to the renderer HUD (a low-rate IPC summary, not per frame).
4. **Main-process stage timing.** Time `rgbaToBgra` and the `grandi.video` promise duration per channel, aggregated at 1 Hz. This is the half of the pipeline currently invisible to the ops HUD.
5. **Fallback visibility.** Make it unmistakable in the HUD when the sync readback path or the sync 2D `getImageData` path is active, rather than a one-time console note that scrolls away.
6. **A one-shot dump.** Provide a way to capture ~10 s of the above into a copyable block (ops button or a `window.__perfDump()` style hook) so the operator can paste numbers into a chat. Pasting a screenshot of a HUD is not good enough for the next dispatch.
7. Update `docs/architecture/performance-budgets.md` with the measurement playbook: what to turn on, what to read, what each number means, and what "healthy" looks like.
8. **Capture-interval histogram — the single most diagnostic number in this dispatch.** For each channel, record how many studio ticks elapsed between consecutive successful captures, as a distribution rather than a mean. A healthy 30 fps channel is a tight cluster on **2**. The phase-lock defect predicts a split between **2 and 3**, or a cluster on **3** and **4**. Report the histogram. A mean would hide exactly the thing we need to see, so do not average it away.
9. Also report the observed jitter of the tick interval itself as a distribution, for the same reason — a mean of 16.7 ms tells you nothing about whether the second tick lands at 33.1 ms or 33.5 ms, and that distinction is the entire defect.

## `src/main.ts` region lock (BW, 2026-08-29)

You are one of **three** wave-2 workers editing `src/main.ts` in parallel. The original wave plan called wave 2 disjoint; it is not, and BW is resolving that with region locks rather than by serialising the wave.

**Your region only:** the studio-tick subscriber registrations and the tick handler itself (~L2061–2301), for total-tick-duration timing.

**Do not touch, even to tidy:** the fleet-registry rebuild sites (~L1780–1783), the `buildFlowCards` call site, and `pushSrtFlowSnapshots` (~L997–1022) — `DSP-TEL-20260829-02`. `onSrtApply` (~L2580–2614), `maybeFallbackSrtDecodeStall` (~L790–835), `beforeunload` (~L2730–2757) — `DSP-SRT-20260829-01`.

Prefer putting timing inside `src/output/*` modules over `src/main.ts` wherever you have the choice, precisely because the other two workers are in that file. No import reordering, no reformatting, no drive-by renames.

## Out of scope

- **Any optimisation.** Do not remove a copy, change a cap, change the stagger, change `STUDIO_TICK_FPS`, or reorder subscribers. If you find something obviously wrong, write it in the report; `DSP-OUT-20260829-02` will fix it. Shipping a fix inside the measurement dispatch destroys the baseline.
- Changing NDI channel enablement or defaults. All three channels stay on.
- Colour space (that is `DSP-OUT-20260829-01`).

## Likely files

- `src/output/perfCounters.ts` — extend with a stage-timer primitive
- `src/output/ndiFramePump.ts`, `ndi3dChannelPump.ts`, `streamMapNdiPump.ts`, `ndiAsyncReadback.ts`, `ndi2dAsyncCapture.ts` — instrumentation call sites only
- `src/output/previewFrameClock.ts` — tick interval stats
- `desktop/ndiSender.cjs`, `desktop/main.cjs`, `desktop/preload.cjs` — main-side timing + summary IPC
- `src/scene/ndiControllerPanel.ts` or `stubHud.ts` — readout + dump
- `docs/architecture/performance-budgets.md`

## Inputs provided

- Operator target: **three NDI channels on at once, never below 30 fps each**.
- Operator measurement 2026-08-29: all three on, Send ≈ **18 fps**. Task Manager at the time: CPU 32%, GPU 8%, Electron 17.3% CPU, `ffmpeg.exe` 3.3% CPU. GPU is an AMD RX 6750 XT.
- Prior lock (BW 2026-08-28): "GPU idle ≠ weak PC" — low GPU with a busy JS thread is the expected shape here, and dropping a channel is **not** an acceptable answer.
- Constants: tick 60 (`desktop/main.cjs:90`), stagger 8 ms (`ndiCaptureStagger.ts:29`), per-channel cap 30 (`ndiFramePump.ts:83`, `ndi3dChannelPump.ts:46`, `streamMapNdiPump.ts:40`), output 1920×1080 (`studioOutput.ts:5–6`).

## Acceptance criteria

- [ ] With all three channels on, the HUD/dump reports per-stage mean and max ms for every stage listed in scope item 1, plus total tick duration.
- [ ] Observed `studio:tick` interval statistics are reported as a **distribution**, so "is the 60 Hz clock real, and how much does it jitter?" is answerable from data.
- [ ] The per-channel capture-interval histogram (ticks between captures) is reported, and the report states plainly whether it shows the predicted 2-versus-3 split.
- [ ] Skip and drop counts are separated by cause (rate cap / stagger / busy / main-process sender busy).
- [ ] Main-process `rgbaToBgra` ms and `grandi.video` ms appear in the same readout as the renderer stages.
- [ ] Sync-readback and sync-2D-capture fallbacks are visible in the HUD while active.
- [ ] A 10 s dump can be copied as text.
- [ ] Instrument overhead measured and stated; Send fps with instrumentation on is within ~1 fps of Send fps with it off.
- [ ] `npm test` and `npm run build` green.
- [ ] **Deliverable for BW:** a pasted 10 s dump from a live Electron session with all three channels on and SRT live, plus your one-sentence reading of which stage is the wall.

## Report back

1. The dump, and which stage dominates
2. Whether the 60 Hz tick is actually arriving at 60
3. Files touched and measured instrument overhead
4. Anything you found that looks wrong but that you deliberately did **not** fix
5. Suggested memo bullets for PRF
