# Dispatch DSP-OUT-20260829-02-ndi-send-path

## Meta
- From orchestrator: BW (route to OUT; `desktop/` changes coordinated with PLT)
- Worker role: WORKER(DSP-OUT-20260829-02-ndi-send-path)
- Priority: **P0 ★**
- Phase: 18.3
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active** — wave 3 **released 2026-08-30** after the operator dump. Runs in parallel with `DSP-OUT-20260829-04` (`src/output/` pumps) and `DSP-OUT-20260830-01` (2D grab helper). You own **`desktop/` only**.
- Prerequisite: `DSP-PRF-20260829-01` has landed. Live baseline is pasted below — do not treat the earlier ~18 fps guess as current.

## Goal

Get the per-frame cost out of the Electron main process so three NDI channels can each sustain 30 fps. Everything you do lives in `desktop/`.

Operator requirement: all three channels on, none ever reading below 30 fps on the ops **Broadcast → Output** rail.

## Background — the arithmetic that makes this P0

Every frame currently passes through a scalar JavaScript loop in the main process:

```242:242:desktop/ndiSender.cjs
    rgbaToBgra(rgba, width, height, frame.bottomUp !== false, out)
```

`rgbaToBgra` (L98–112) does four byte reads and four byte writes per pixel, and walks rows in reverse for the AR/3D vertical flip. A 1920×1080 frame is 2,073,600 pixels. Three channels at 30 fps is **about 187 million pixels per second** through that loop, on the main thread, which is at the same time deserializing roughly 750 MB/s of incoming frame data. That is between a large fraction of a core and more than a whole core, continuously. No scheduling change can make 90 frames/s fit through it.

Note what is **not** a problem, so you do not chase it: `Buffer.from` at L231–234 constructs a **view, not a copy**, on both branches. That part is already zero-copy.

And note why frames are dropped rather than queued:

```224:224:desktop/ndiSender.cjs
  if (!state?.sender || state.busy) return { ok: false, dropped: true, channel: id }
```

`ensureScratch` hands out **one reusable Buffer per channel**, `sender.video()` is asynchronous, and `busy` is what stops the next frame from overwriting bytes the native send is still reading. This is a correctness guard, not laziness. A queue without a buffer pool will corrupt frames on air.

## Live dump 2026-08-29 — what is actually yours (and what is not)

Operator paste, all three senders live. Send **AR 15 / 3D 15 / 2D 3**. Full block is in `BW_MEMO`. Your columns from that dump:

```
main:
  ar rgbaToBgra 7.3/11.9 n=11  video 4.4/12.9 n=11  dropBusy=0
  3d rgbaToBgra 7.0/8.4  n=12  video 3.4/4.9  n=13  dropBusy=0
  2d rgbaToBgra 7.3/8.2  n=3   video 3.1/3.6  n=3   dropBusy=0
```

**`dropBusy=0` on every channel.** The sender is keeping up with the ~15 / 15 / 3 frames that arrive. A keep-newest queue will not raise Send fps *today*. Do it anyway (step 4) so it does not start dropping the moment the renderer sends 30.

**`rgbaToBgra` ~7 ms is real and is your wall at 30 fps, not at 15.** At the current arrival rate it is 7×11 ≈ 80 ms/s of main-thread work. At the target 30×3 it becomes ~630 ms/s — that *will* be the next ceiling if you leave the loop. Step 1 (native RGBA) is still the whole dispatch if the binding allows it.

**What is *not* yours, so you do not chase it:**

- `arEnqueueIpc` / `3dEnqueueIpc` **17–23 ms mean** — renderer `ArrayBuffer.slice` + sync `ipcRenderer.send` clone. `DSP-OUT-20260829-04`.
- `2dGrab` **120–193 ms** — worker `getImageData(1920,1080)` after upscaling a 520 canvas. `DSP-OUT-20260830-01`.
- Tick mean **20.2 ms**, 495 ticks / ~10 s (~50 Hz), `>20ms=225` — the clock is collapsing because the renderer is blocked on those two stages. Not a `setInterval` bug in `main.cjs`. Do not change `STUDIO_TICK_FPS`.

Take a dump after the FourCC change and after the pool/queue. Name the `main … bgra` number you removed.

## In scope — step 1 first, and report it before doing anything else

1. **Probe the binding for a native RGBA format. Do this first and tell BW the answer immediately.** The NDI SDK supports RGBA and RGBX video types. Log `Object.keys(grandi.FourCC)` (or inspect the binding's typings) in the main process and report exactly what is available. If an RGBA/RGBX FourCC exists and the sender accepts it, **the entire conversion loop is deleted** — declare the native format and hand the readback bytes straight through. That is the single largest win in Phase 18 for the smallest change, and it also determines whether `DSP-OUT-20260829-05` (GPU swizzle) is needed at all. Do not proceed silently past this step.
2. **Handle the vertical flip without a CPU pass.** The flip is currently fused into the same loop. If the binding accepts a negative line stride, use it. Otherwise report it, because the flip then has to move to the renderer's capture pass and that belongs to another dispatch — do **not** reintroduce a full-frame CPU pass just to flip rows.
3. **Pool the scratch buffers.** Replace the single `bgraScratch` per channel with a small ring (two or three). This is the prerequisite for step 4 and is required even if step 1 removes the conversion, because the buffer handed to `sender.video()` must stay untouched until the promise resolves.
4. **Queue instead of drop, keep-newest.** With the pool in place, `busy` should no longer discard a frame. Hold at most one pending frame per channel, replace it if a newer one arrives, and send it when the in-flight promise resolves. Never grow unbounded. Count what you discarded and expose it through the summary IPC that `DSP-PRF-20260829-01` added, so a discard is visible rather than silent.
5. **Keep the declared frame rate at 30/1.** `FRAME_RATE_N/D` (L26–27) is metadata receivers use for timing. Even though the renderer will send slightly above 30 (see the note below), the declared rate stays 30.
6. **Keep a working fallback.** If the native RGBA path turns out to be unavailable or broken at runtime, the existing conversion must still work, behind a note in the same style as `NDI_SYNC_READBACK_NOTE` so the operator can see the slow path is active.
7. Re-measure with the PRF dump and report before/after for each step.

## Context you need but must not act on

`DSP-OUT-20260829-04` is running in parallel and will make the renderer send at roughly **32 fps nominal** rather than exactly 30. That is deliberate: the ops readout counts sends in a trailing 1 s window (`perfCounters.ts:42–45`), so an exactly-30 cadence intermittently displays 29. Your sender must not rate-limit, smooth, or "correct" that — pass through whatever arrives.

## Out of scope

- **Everything under `src/`.** `DSP-OUT-20260829-04` owns `src/output/` in this same wave. Touching a pump will cause a merge conflict.
- The GPU-side colour swizzle — that is `DSP-OUT-20260829-05`, conditional on your step-1 answer.
- The renderer-side `ArrayBuffer.slice`, the rate gate, and the AR/3D stagger — all owned by `-04`.
- Attempting to defeat the IPC serialization copy. `ipcRenderer.postMessage` and `MessagePortMain.postMessage` accept only `MessagePort`s in their transfer list; an `ArrayBuffer` cannot be transferred to main. One serialization copy is unavoidable — do not burn the dispatch on it. If measurement afterwards says IPC volume is still the wall, report the number and BW will decide on 4:2:2 packing for the 3D and 2D channels.
- Colour space / gamma (`DSP-OUT-20260829-01`), SRT, NDI naming, the delay buffer.

## Likely files

- `desktop/ndiSender.cjs` — the whole of this dispatch, essentially
- `desktop/preload.cjs` — only if the payload shape must change
- `desktop/main.cjs` — only if the summary IPC needs a field
- `docs/architecture/multi-output-streaming.md`, `docs/architecture/performance-budgets.md`

## Inputs provided

- Target: three channels, **≥30 fps each, simultaneously**, sustained, with SRT live.
- Baseline ~18 fps; CPU 32%, GPU 8% on an RX 6750 XT; Electron 17.3% CPU, ffmpeg 3.3%.
- Binding is `grandi` (`ndiSender.cjs:9`), NDI SDK 6, currently declaring `grandi.FourCC.BGRA` at L250.
- The PRF stage dump from `DSP-PRF-20260829-01`, including main-process `rgbaToBgra` ms and `grandi.video` ms.

## Acceptance criteria

- [ ] The `grandi.FourCC` probe result is reported to BW **before** the rest of the work, with the exact list of available formats.
- [ ] The per-pixel conversion is off the hot path — either deleted in favour of a native RGBA format, or clearly reported as impossible with the reason.
- [ ] The vertical flip no longer costs a full-frame CPU pass, or the report says exactly why it must move to the renderer.
- [ ] Scratch buffers are pooled; no buffer can be overwritten while a send is in flight.
- [ ] A busy sender queues keep-newest instead of dropping, discards are counted, and the count is visible.
- [ ] Declared NDI frame rate is still 30/1.
- [ ] A fallback path exists and announces itself if the fast path is unavailable.
- [ ] No file under `src/` was modified.
- [ ] Main-process time per frame, measured with the PRF instrumentation, is reported before and after.
- [ ] `npm test` and `npm run build` green.

## Report back

1. **The FourCC probe result** — send this as soon as you have it, ahead of everything else
2. What the conversion path looks like now, and where the flip happens
3. The buffer pool and queue design
4. Before/after main-process ms per frame per channel
5. Files touched, and confirmation nothing under `src/` was
6. Suggested memo bullets for OUT and PLT
