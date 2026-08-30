# Dispatch DSP-OUT-20260829-01-ndi-color-space

## Meta
- From orchestrator: BW (route to OUT)
- Worker role: WORKER(DSP-OUT-20260829-01-ndi-color-space)
- Priority: **P0 ★**
- Phase: 18.1
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active**

## Goal

NDI output must look the same as the on-screen preview. Today the AR and 3D NDI channels arrive in OBS visibly **too dark** with wrong colours, while the 2D map channel looks correct. Fix the colour space of the AR/3D capture render targets so the bytes handed to the NDI sender are sRGB-encoded, exactly like the bytes the canvas shows.

## Background

BW traced this before dispatching. The evidence is an asymmetry the operator confirmed in OBS: **2D is correctly exposed, AR and 3D are dark.**

- The 2D channel does **not** use WebGL. `streamMapNdiPump.ts` grabs a 2D canvas (`getImageData` / `createImageBitmap` in `ndi2dCapture.worker.ts`), and a 2D canvas is already sRGB. It looks right.
- AR and 3D render into a `WebGLRenderTarget` and `readPixels` it:

```203:212:src/output/ndiFramePump.ts
  function ensureAirTarget(w: number, h: number): WebGLRenderTarget {
    if (!airTarget || airTargetW !== w || airTargetH !== h) {
      airTarget?.dispose()
      airTarget = new WebGLRenderTarget(w, h, {
        depthBuffer: true,
        stencilBuffer: false,
      })
```

  `ndi3dChannelPump.ts` creates its target the same way.
- Nothing in `src/` ever sets `renderer.outputColorSpace`, `outputEncoding`, `toneMapping`, or a render-target `colorSpace`. Grep confirms zero matches.

On three `^0.178.0` the renderer applies its output colour-space conversion based on the **destination**: the default framebuffer uses `renderer.outputColorSpace` (which defaults to `SRGBColorSpace`), while a bound render target uses **that target's `texture.colorSpace`**, which defaults to no conversion. So the preview canvas gets an sRGB encode and the NDI FBO keeps **linear-light** values. `readPixels` then hands NDI linear bytes, OBS displays them as sRGB, and mid-grey lands around 55 instead of 128 — a dark, desaturated, contrast-crushed picture. That is the reported symptom.

Nothing downstream compensates: `ndiAsyncReadback.ts` does a raw RGBA8 `readPixels`/`readRenderTargetPixels` with no processing, and `desktop/ndiSender.cjs` only reorders channels (`rgbaToBgra`) and flips rows before handing BGRA to `grandi.video`. There is no colour matrix, no gamma, and no declared colour space anywhere in the chain.

## In scope

1. Set the capture render targets to sRGB output so the FBO receives the same encode the canvas gets. Apply to **both** the AR target (`ndiFramePump.ts`) and the 3D target (`ndi3dChannelPump.ts`), including on every recreate/resize path.
2. Factor the one-liner into a tiny shared helper in `src/output/` (e.g. `applyNdiCaptureColorSpace(target)`) so the two pumps cannot drift apart and so it is unit-testable without a GPU.
3. Set `renderer.outputColorSpace` explicitly in `createScene.ts` rather than relying on the three default, so a future three upgrade cannot silently change preview behaviour. It must remain `SRGBColorSpace` — this is a pin, not a change.
4. Verify the **alpha** channel is untouched. The AR plate is the locked alpha contract (`ndi-alpha-electron.md` §2): an sRGB encode applies to RGB only. If the fix disturbs alpha in transparent mode in any way, stop and report — do not ship a changed alpha plate.
5. Confirm the 2D channel is unaffected. It must not be double-encoded; if the same helper is applied there by accident the 2D output will go *bright*.
6. Add a note to `docs/architecture/multi-output-streaming.md` recording that AR/3D capture targets are sRGB-encoded and why, so nobody "cleans up" the line later.

## Out of scope

- Tone mapping, exposure, LUTs, or any look change. The target is **parity with preview**, not a nicer picture. If preview itself is judged too dark that is a separate SCN look-dev item.
- NDI colour-space metadata / HDR signalling in `desktop/ndiSender.cjs`.
- The RGBA→BGRA swizzle and the frame-copy path — that is `DSP-OUT-20260829-02`. Do not touch `enqueueRgba`, preload IPC, or `ndiSender.cjs` here; the two dispatches must not collide.
- `videoBackground.ts` sampled-texture colour space (already `SRGBColorSpace`, correct).

## Likely files

- `src/output/ndiFramePump.ts` — AR target creation
- `src/output/ndi3dChannelPump.ts` — 3D target creation
- new small helper + test under `src/output/`
- `src/scene/createScene.ts` — pin `renderer.outputColorSpace`
- `docs/architecture/multi-output-streaming.md`

## Inputs provided

- three version: `^0.178.0` (`package.json`)
- Operator observation 2026-08-29: in OBS, `broadcast-web-2d` is correctly exposed; `broadcast-web` (AR) and `broadcast-web-3d` are dark.
- Readback is RGBA8 bottom-up: `ndiAsyncReadback.ts` L38–42, L273–283, L318.
- Sender is BGRA with no conversion: `desktop/ndiSender.cjs` L98–112, L244–255.

## Acceptance criteria

- [ ] Both AR and 3D capture targets carry an sRGB texture colour space, on first create **and** after a resize/recreate.
- [ ] A unit test asserts the helper sets it, and asserts the helper is applied by both pumps (or that both pumps route target creation through it).
- [ ] `renderer.outputColorSpace` is explicitly `SRGBColorSpace`; preview appearance is unchanged.
- [ ] Transparent/AR-plate mode still produces alpha 0 where it did before; chroma mode still produces the same green.
- [ ] 2D channel output is byte-identical to before this change.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke (report the result, it is the real gate):** restart Electron, open all three sources in OBS. AR and 3D should now match the app preview and match the 2D source in brightness. Include what you saw; if AR/3D are now *too bright*, say so — that would mean a double encode.

## Report back

1. What you changed and where the encode now happens
2. Files touched
3. Tests run / how verified, plus the OBS comparison
4. Follow-ups / blockers — in particular, if any residual mismatch remains after the fix, describe it rather than chasing it
5. Suggested memo bullets for OUT
