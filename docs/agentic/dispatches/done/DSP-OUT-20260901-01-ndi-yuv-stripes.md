# Dispatch DSP-OUT-20260901-01-ndi-yuv-stripes

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260901-01-ndi-yuv-stripes)
- Priority: P0
- Phase: Phase **19.3** — 3D NDI green/purple stripes (diagnose AR too)
- Related: `docs/architecture/phase19-senexus-qol.md` §3 · `briefs/phase19/OUT_PHASE19.md`
- **Status: DONE (code)** — worker 2026-09-01; suite **1032 + 23** / build green. **Human OBS picture gate still open.**

## Goal

Fix operator OBS view of **3D** NDI showing classic **vertical green/purple (pink) stripes**. Diagnose AR too. Correct packing + FourCC — not OBS reinterpret.

## Acceptance criteria

- [x] Code: 3D PBO binds packed dest; sender never RGBA-falls-back packed formats
- [x] AR path reviewed: already correct (full RGBA → UYVA worker pack) — no same-class stripe bug
- [x] `npm test` + `npm run build` green — **1032 + 23**
- [ ] **Human OBS:** 3D matches in-app (no stripes); AR keys; 2D sanity — **awaiting operator**

## Worker report (summary)

3D: after GPU UYVY pack, `pack()` restored scene FBO; PBO `readPixels` sampled bound FB → RGB bytes as FourCC UYVY → stripes. Fix: rebind packed RT before PBO (`ndi3dChannelPump` + `ndiAsyncReadback.begin` `setRenderTarget`). Sender drops packed frames if UYVY/UYVA FourCC missing (no RGBA advertise). No SCN handoff.

## Files delivered

- `src/output/ndi3dChannelPump.ts`, `ndiAsyncReadback.ts`, `ndiPixelFormat.test.ts`, `ndiGpuUyvy.test.ts`, `ndiAsyncReadback.test.ts`, `README.md`
- `desktop/ndiPixelFormat.cjs`, `ndiSender.cjs`
- `docs/ops/air-runbook.md`

## Full original dispatch

See git history for issued in-scope / paste-block text.
