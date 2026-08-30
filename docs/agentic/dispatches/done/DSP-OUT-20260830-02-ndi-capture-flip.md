# Dispatch DSP-OUT-20260830-02-ndi-capture-flip

## Meta
- From orchestrator: BW (route to OUT)
- Worker role: WORKER(DSP-OUT-20260830-02-ndi-capture-flip)
- Priority: **P0 ★**
- Phase: 18.14 — follow-up to wave 3 `DSP-OUT-20260829-02`
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active** — wave 4. File-disjoint from `DSP-OUT-20260829-03` (timecode) and `DSP-SCN-20260829-03` (PiP) if those start in parallel
- Cancelled sibling: `DSP-OUT-20260829-05-gpu-swizzle` (RGBA FourCC exists; nothing to swizzle)

## Goal

AR and 3D NDI must be **right-side up** in OBS/vMix after the native-RGBA send path. 2D is already top-down and must stay that way.

`DSP-OUT-20260829-02` deleted the CPU `rgbaToBgra` loop, which was also the only vertical flip. `grandi.validateVideoFrameBuffer` rejects `lineStrideBytes < 0` (`"lineStrideBytes must be >= 0."`). The dispatch forbade putting a second full-frame CPU walk in main. So WebGL bottom-up `readPixels` now goes to NDI as-is. That is an air regression.

## Background

WebGL / three `readRenderTargetPixels` / PBO `readPixels` are **bottom-up**. The old main-process loop reversed rows while swizzling. Native RGBA is a straight `Buffer.copy`. 2D canvas grab is top-down (`bottomUp: false`) and is not inverted.

Do this on the **GPU capture pass**, not in `desktop/ndiSender.cjs`. A CPU row-reverse of 8 MB × 60 frames/s is the class of work we just removed.

## In scope

1. Flip AR and 3D capture **in the renderer** so the bytes handed to `sendFrame` are top-down (`bottomUp: false` after the flip, or keep the flag honest). Prefer a GPU blit / fullscreen triangle with inverted V, or a `copyFramebuffer` into a second target with flipped Y. Apply on create **and** resize, same as `applyNdiCaptureColorSpace`.
2. Do **not** flip 2D. A test or wiring scan must prove `streamMapNdiPump` / `ndi2dAsyncCapture` still send `bottomUp: false` and do not go through the new flip helper.
3. Colour space and alpha stay as `DSP-OUT-20260829-01` left them. The flip is RGB+A together; do not drop or rewrite alpha. Transparent clear stays `(0,0,0,0)`.
4. Do not add a per-pixel JS loop. If a GPU blit is genuinely impossible in this three version, stop and report — do not ship a CPU flip in the pump.
5. Tests: helper (or the pump wiring) flips Y; AR and 3D call it; 2D files do not; `createScene` preview is unchanged (this is NDI-only).
6. `npm test` and `npm run build` green.

## Out of scope

- `desktop/` — `ndiSender.cjs` stays RGBA + pool. Do not restore `rgbaToBgra` as the flip.
- Colour swizzle (cancelled). Rate gate, stagger, 2D grab, IPC deferral.
- Timecode / PiP removals.
- Changing output size or declared frame rate.

## Likely files

- New helper e.g. `src/output/ndiCaptureFlip.ts` + test
- `src/output/ndiFramePump.ts`, `ndi3dChannelPump.ts` — after FBO render, before `readback.begin`
- `src/output/index.ts`, `docs/architecture/multi-output-streaming.md`
- **Not** `ndi2dAsyncCapture.ts`, `streamMapNdiPump.ts` (except a negative wiring test), **not** `desktop/`

## Inputs provided

- `grandi` rejects negative stride (OUT-02, grandi 2.0.2).
- AR/3D pumps currently pass `bottomUp: true`.
- PBO path is live; flip must happen **before** `readback.begin` so the packed PBO is already top-down.
- Wave 3 just landed: `canBegin()` before render, deferred `sendFrame`. Do not undo those.

## Acceptance criteria

- [ ] AR and 3D NDI frames are top-down. Preview canvas is unchanged.
- [ ] 2D is not flipped a second time.
- [ ] No CPU per-pixel walk on the hot path.
- [ ] Alpha plate still keys (A is flipped with RGB, not stripped).
- [ ] Nothing under `desktop/` was modified.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human:** OBS/vMix — AR and 3D right-side up, 2D still right-side up, alpha still keys.

## Report back

1. Where the flip runs (which pass, which target) and why it is GPU
2. What you did with the `bottomUp` flag
3. Files touched
4. Follow-ups
5. Suggested memo bullets for OUT
