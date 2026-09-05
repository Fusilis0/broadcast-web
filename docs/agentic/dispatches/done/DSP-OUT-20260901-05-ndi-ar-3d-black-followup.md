# Dispatch DSP-OUT-20260901-05-ndi-ar-3d-black-followup

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260901-05-ndi-ar-3d-black-followup)
- Priority: P0
- Phase: Phase **19.3** — after OUT-04, AR + 3D still **black** in OBS; **2D still fine**
- Related: `done/DSP-OUT-20260901-04-ndi-ar-3d-black.md` · operator Fail 2026-09-01
- **Status: DONE (code)** — worker 2026-09-01; suite **1038 + 23** / build green. **Human OBS gate open.**

## Goal

Restore live **`broadcast-web`** and **`broadcast-web-3d`** in OBS. Keep **`broadcast-web-2d`**. Do **not** bring back vertical green/purple stripes. **Do not fail-closed drop every AR/3D frame.**

## Acceptance criteria

- [x] Code: Electron-like stub (no `properties`, no RT `__webglFramebuffer`, null `FRAMEBUFFER_BINDING`) still captures via `readRenderTargetPixels`
- [x] No systematic `begin() === false` when Three can read the RT
- [x] Default FB is never advertised as UYVY (null binding → sync of the **same** `target` RT)
- [x] 2D helper unchanged (`createNdi2dAsyncCapture`; no `createNdiAsyncReadback`)
- [x] `npm test` + `npm run build` green — **1038 + 23**
- [ ] **Human OBS:** AR + 3D picture (not black, no stripes); 2D still OK — awaiting operator

## Worker report (summary)

OUT-04 required `renderer.properties.get(target).__webglFramebuffer` or a hang on the RT. Stock Three keeps that map in a constructor closure (`readRenderTargetPixels` uses it). Tests stubbed both seams → green. Electron: resolver always null → PBO `begin()` false.

Second smoking gun: `packPbo` false already called `fallToSync()` then `beginSync()`, but `beginSync` reused the same fail-closed READ bind → still dropped. Picture first: after `setRenderTarget`, copy `FRAMEBUFFER_BINDING` / `DRAW_FRAMEBUFFER_BINDING` onto READ for PBO when non-null and complete; else sync `readRenderTargetPixels(target)` (known non-stripe). Log once `NDI_PUBLIC_FBO_MISSING_NOTE`. Never pack the default (null) FB as UYVY. 2D untouched.

## Files delivered

- `src/output/ndiAsyncReadback.ts`, `ndiAsyncReadback.test.ts`
- `src/output/README.md` (do not use `renderer.properties`)
- `src/output/ndi3dChannelPump.ts` (comment only)

## Human OBS checklist

1. Electron studio, all three senders on. OBS: `broadcast-web`, `broadcast-web-3d`, `broadcast-web-2d`.
2. **Pass:** AR keys (UYVA), 3D matches in-app (UYVY, no vertical green/purple stripes), 2D still letterboxed.
3. **Fail black:** AR/3D stay black. **Fail stripes:** 3D/AR show scene-corner RGB as 4:2:2. Do not change OBS colour format.
4. Optional console: `[output] NDI readback: public FBO missing — sync readRenderTargetPixels` means this frame used sync (hitch OK). No line + live picture means PBO bound from `FRAMEBUFFER_BINDING`.
