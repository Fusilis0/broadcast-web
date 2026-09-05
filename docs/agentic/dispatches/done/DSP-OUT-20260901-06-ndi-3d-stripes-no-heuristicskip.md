# Dispatch DSP-OUT-20260901-06-ndi-3d-stripes-no-heuristicskip

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260901-06-ndi-3d-stripes-no-heuristicskip)
- Priority: P0
- Phase: Phase **19.3** — OUT-05 OBS: **AR Pass, 2D Pass, 3D still green/purple stripes**
- Related: `done/DSP-OUT-20260901-05-ndi-ar-3d-black-followup.md` · operator 2026-09-01
- **Status: DONE (code)** — worker 2026-09-01; suite **1042 + 23** / build green. **Human OBS gate open** (`broadcast-web-3d` only).

## Goal

Make **`broadcast-web-3d`** match the in-app 3D view (UYVY, **no** vertical green/purple bars). Keep AR and 2D as they are now (Pass). Do not “fix” colour in OBS.

## Acceptance criteria

- [x] 3D no longer sends half-width RGBA as UYVY based on `w*2===srcW` alone
- [x] Live 3D path packs UYVY from full-size scene RGBA (or proven packed dest)
- [x] AR UYVA path unchanged in contract
- [x] 2D unchanged
- [x] `npm test` + `npm run build` green — **1042 + 23**
- [ ] **Human OBS:** `broadcast-web-3d` matches in-app (UYVY, no vertical green/purple stripes). AR/2D already Pass — reconfirm only if 3D Pass.

## Worker report (summary)

The stripe path was `enqueueRgba` treating a half-width read as GPU UYVY because `w*2===lastPackSrcW`. After `gpuPack.pack()`, READ often stayed on the **scene** FBO, so a 960×1080 corner of RGBA was advertised as 1920×1080 UYVY.

Live 3D now matches working AR (minus alpha): render the full-size scene FBO → `readback.begin(fbo, w, h)` / sync `readRenderTargetPixels(fbo)` → CPU `createNdiPackPool('uyvy')`. GPU `ndiGpuUyvy` stays in the repo but is **not** called on the send path. `shouldSkipCpuUyvyPack` requires `verifiedGpuPackRead`; size alone never skips. Live enqueue always passes `verifiedGpuPackRead: false`.

## Files delivered

- `src/output/ndi3dChannelPump.ts` (primary)
- `src/output/ndi3dChannelPump.test.ts`
- `src/output/ndiGpuUyvy.ts` (comment only)
- `src/output/ndiGpuUyvy.test.ts`, `ndiAsyncReadback.test.ts`, `ndiIndependentClocks.test.ts`
- `src/output/README.md`

## Human OBS checklist

1. Electron studio, all three senders on. OBS: **`broadcast-web-3d`** (AR/2D already Pass).
2. **Pass:** 3D matches the in-app 3D view (UYVY, **no** vertical green/purple bars).
3. **Fail stripes:** 3D still shows scene-corner RGB as 4:2:2. Do not change OBS colour format.
4. Hitch vs stripes: hitch is OK this slice. Do not retune fps/PBO here.
