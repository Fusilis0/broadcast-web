# Dispatch DSP-OUT-20260828-07-2d-off-fbo-stack

## Meta
- From orchestrator: OUT (adopted BW draft via `HO-BW-OUT-20260828-07`)
- Worker role: WORKER(DSP-OUT-20260828-07-2d-off-fbo-stack)
- Priority: P0
- Phase: Studio 30 — **last remaining hitch** after OUT-04 / OUT-05 / SRT-01
- Related: `HO-BW-OUT-20260828-07` · `done/DSP-OUT-20260828-04` · `done/DSP-OUT-20260828-06` (**superseded — do not implement 06**)
- Status: **accepted 2026-08-28 (BW)** — 2D deferred off FBO tick; worker + transferable; fail closed to sync. Still on@30. Suite **909 + 23**.

## Goal

vMix must see **AR + 3D + 2D all live at ~30** without freezing Electron.

OUT-04 already staggers WebGL: one FBO per 16 ms tick (`STUDIO_TICK_FPS=60`). **2D does not occupy that slot**, so `streamMapNdiPump.captureAndSend` still runs **on the same `studio:tick` stack** as `directRender` — sync `getImageData` (1920×1080 ≈ 8 MB) plus `ArrayBuffer.slice` plus map `redraw()`. That is why GPU stays ~10% and the app hitchs when all three are on. Move 2D **off that stack**. Do not turn 2D off. Do not recap Send to 10.

Sync (PTS / LUT / ffmpeg) is **already in tree** (OUT-05 + SRT-01). Do not touch it.

## Background

Accepted same night (BW suite **900 + 23**):

| DSP | In tree |
| --- | --- |
| OUT-04 | One FBO/tick; tick 60; 2D default **on**; 2D claim always succeeds |
| OUT-05 | `presentedPts90k` = 33-bit PES; LUT reset on H.264 fallback |
| SRT-01 | Transcode `-copytb 1` + `-enc_time_base 1:90000` |

`src/output/ndiCaptureStagger.ts`: 2D returns true and does not set `lastFboChannel`. `src/output/streamMapNdiPump.ts` still: `ensureDrawn` → `drawImage` → **sync** `getImageData` → `slice` → IPC, from `onStudioTick`.

## In scope

1. **Defer 2D off the FBO tick stack.** `onStudioTick` may *schedule* a 2D capture; it must not run `getImageData` / map `redraw` / `drawImage` synchronously in the same turn as AR/3D `directRender`. Use `queueMicrotask` / `setTimeout(0)` at minimum so GL submits first.
2. **Async pixel grab** (worker + `OffscreenCanvas` / transferable `ArrayBuffer` preferred) so the 8 MB copy is not on the renderer animation thread. Fail closed to today’s sync path + one console note (same spirit as `NDI_SYNC_READBACK_NOTE`).
3. **No extra `slice` on the happy path** if the buffer is already transferable.
4. **Default on @ 30** (`streamMapNdiWanted = true`, `STREAM_MAP_NDI_DEFAULT_FPS = 30`). Toggle still 2D-only.
5. Keep OUT-04 stagger: AR/3D still one FBO per window. 2D must not start occupying the FBO slot.
6. Tests + `npm test` + `npm run build`. One-line Output README: 2D is CPU, deferred/async, still on.

## Out of scope

- PTS, LUT, Sync panel, `videoDecodePipeline`, ffmpeg argv, SRT helpers.
- Changing `STUDIO_TICK_FPS` or AR/3D PBO.
- OffscreenCanvas **WebGL** for AR/3D.
- Defaulting 2D off or silent 10 fps.
- grandi / new NDI process.

## Likely files

- `src/output/streamMapNdiPump.ts` + test
- New helper e.g. `src/output/ndi2dAsyncCapture.ts` + test
- `src/output/README.md`
- `docs/architecture/performance-budgets.md` (one sentence: 2D deferred off FBO stack)

## Acceptance criteria

- [ ] 2D NDI still defaults **on** at 30.
- [ ] Happy path: no sync `getImageData` (or map redraw) on the `studio:tick` callback that also runs NDI FBO pumps.
- [ ] Sync fallback exists and is logged once.
- [ ] Worker does not assert GPU fps. Does not edit PTS/ffmpeg.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Mechanism (defer + worker / OffscreenCanvas / other) and fail-closed behaviour
2. Files
3. Tests
4. Suggested OUT/PRF memo

## Worker paste block

```
You are WORKER(DSP-OUT-20260828-07-2d-off-fbo-stack).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260828-07-2d-off-fbo-stack.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-BW-OUT-20260828-07.md
4. src/output/streamMapNdiPump.ts
5. src/output/ndiCaptureStagger.ts
6. docs/architecture/performance-budgets.md

Context: OUT-04/05 and SRT-01 are already merged. Do not touch PTS, LUT, or ffmpeg.

Implement: 2D NDI stays default on @ 30. Do not run getImageData / map redraw
on the same studio:tick turn as AR/3D FBO renders. Defer off that stack; prefer
a worker + transferable buffer for the 1920×1080 grab. Fail closed to sync
getImageData. Do not occupy the FBO stagger slot. Do not default 2D off.
Report back per dispatch.
```
