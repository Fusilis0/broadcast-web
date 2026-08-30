# Dispatch DSP-OUT-20260829-05-gpu-swizzle

## Meta
- From orchestrator: BW (route to OUT)
- Worker role: WORKER(DSP-OUT-20260829-05-gpu-swizzle)
- Priority: **P0 ★ (conditional)**
- Phase: 18.12
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **cancelled 2026-08-30**
- Release condition: met in the negative. `DSP-OUT-20260829-02` probed `grandi.FourCC` (2.0.2): **RGBA and RGBX both exist**. Hot path is native RGBA. There is nothing to swizzle.
- Flip leftover: grandi **rejects** `lineStrideBytes < 0`. That is **not** this dispatch. See `DSP-OUT-20260830-02-ndi-capture-flip` (GPU Y-flip on the AR/3D capture pass).
- Also blocked on: `DSP-OUT-20260829-04` (both touch the capture pass in `src/output/`)

## Goal

If the NDI binding will only accept BGRA, move the colour-order swap — and the vertical flip if `-02` could not handle it with a negative line stride — off the CPU and into the capture pass on the GPU, so the main process never runs a per-pixel loop.

## Background

`rgbaToBgra` in `desktop/ndiSender.cjs` L98–112 costs about 187 million pixels per second at three channels × 30 fps, on the Electron main thread. `DSP-OUT-20260829-02` tries to delete it outright by declaring a native RGBA format to the NDI SDK, which supports RGBA and RGBX video types. This dispatch is the fallback for the case where the `grandi` binding does not expose them.

The GPU is the obvious place for the work: it sits at 8% utilisation on an RX 6750 XT while the JS threads are saturated, which is precisely the "pipeline the work, do not drop a channel" position BW locked on 2026-08-28.

## In scope

1. Emit the bytes in the order the sender wants, from the capture pass itself. A small fullscreen pass into the readback target that writes `.bgra` is the straightforward approach; if the scene can instead write that order directly at negligible cost, that is better still. Whichever you choose, say why.
2. If `-02` reported that the vertical flip could not be done with a negative line stride, fold the flip into the same pass rather than leaving a row-reversed CPU copy behind.
3. Remove the conversion from the main-process hot path and leave it only as an announced fallback, in the style of `NDI_SYNC_READBACK_NOTE`, for the case where the GPU pass is unavailable.
4. Confirm the extra pass costs what you expect: measure GPU frame time before and after with the PRF instrumentation. A fullscreen copy at 1080p should be well under a millisecond; if it is not, stop and report rather than shipping it.
5. Make sure this composes with `DSP-OUT-20260829-01`, which sets the capture targets' colour space. The swizzle must not disturb the sRGB encode, and the encode must not be applied twice. Verify against the 2D channel, which does not go through this path and is therefore your reference for correct exposure.

## Out of scope

- `desktop/` — owned by `-02`.
- The rate gate, the stagger, buffer pooling in the renderer — owned by `-04`.
- Any change to what the scene renders.
- 4:2:2 or any subsampled packing. If payload volume is still the wall after this, that is a separate BW decision.

## Likely files

- `src/output/ndiFramePump.ts`, `src/output/ndi3dChannelPump.ts` — capture pass
- `src/output/ndiAsyncReadback.ts` — if the readback format changes
- possibly a small shared shader/material module under `src/output/`
- `desktop/ndiSender.cjs` — only to demote the CPU loop to a fallback, coordinated with whoever ran `-02`
- `docs/architecture/multi-output-streaming.md`

## Inputs provided

- The `grandi.FourCC` probe result from `DSP-OUT-20260829-02` — this dispatch does not exist without it.
- GPU headroom: 8% utilisation on an RX 6750 XT at the time the fps problem was measured.
- Colour-space context: `DSP-OUT-20260829-01` sets the AR/3D capture targets to sRGB; 2D is a canvas grab and is the known-correct reference.

## Acceptance criteria

- [ ] The main process runs no per-pixel loop on the hot path; the fallback exists and announces itself.
- [ ] Colour is still correct — AR and 3D match the 2D channel and the app preview in OBS. Not double-encoded, not channel-swapped.
- [ ] Alpha on the AR plate is unchanged.
- [ ] GPU frame-time cost of the added pass is measured and reported.
- [ ] Combined with `-02` and `-04`, all three channels hold ≥30 fps.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** all three NDI sources in OBS, correct colour, no channel swap (skies blue, not orange), sustained 30.

## Report back

1. Where the swizzle now happens and why you chose that approach
2. Measured GPU cost of the pass
3. Colour verification against the 2D reference
4. Files touched
5. Suggested memo bullets for OUT
