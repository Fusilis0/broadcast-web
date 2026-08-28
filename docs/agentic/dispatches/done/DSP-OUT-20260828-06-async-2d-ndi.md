# Dispatch DSP-OUT-20260828-06-async-2d-ndi

## Meta
- From orchestrator: OUT (adopted BW draft via `HO-BW-OUT-20260828-06`)
- Worker role: WORKER(DSP-OUT-20260828-06-async-2d-ndi)
- Priority: P0
- Phase: Studio 30 — **all three senders on**; GPU is idle, 2D is CPU
- Related: `HO-BW-OUT-20260828-06` · `DSP-OUT-20260828-04` (amendment: 2D stays **on**) · `done/DSP-OUT-20260828-01` · `done/DSP-OUT-20260828-02`
- Status: **superseded 2026-08-28 (BW)** — never started. Remaining work is `DSP-OUT-20260828-07-2d-off-fbo-stack`.
- Parallel: OUT-04 and OUT-05 **accepted**; do not implement this file.

## Goal

Keep **2D NDI at 30 fps, default on**, without freezing the WebGL / UI thread.

Operator: Electron GPU ~**10%** on RX 6750 XT while preview hitch and Send stall. That is **not** a weak GPU. 2D capture is `canvas.getImageData` (1920×1080 RGBA ≈ 8 MB) plus a second `ArrayBuffer.slice` on the **same** JavaScript thread that submits WebGL. Task Manager GPU stays low because the card finishes a frame then **waits** for that copy. Turning 2D off is refused.

## Background

`src/output/streamMapNdiPump.ts` `captureAndSend`: `drawImage` → sync `getImageData` → `buf.buffer.slice` → IPC `sendFrame` → main `rgbaToBgra`. None of that uses the 6750 XT. Live A/B: 2D on dropped preview 16→6; GPU did not saturate.

WebGL2 PBO does not apply to Canvas 2D. Use an async CPU path (worker `OffscreenCanvas` / `createImageBitmap` + transferred buffer, or equivalent). After it is non-blocking, claim `tryClaimNdiHeavyCapture('2d', now, { blocking: false })` so 2D may share a tick with an AR or 3D FBO.

vMix must see AR + 3D + 2D **all live at ~30**. Staggering GPU work internally is allowed; dropping a sender is not.

## In scope

1. **Async 2D pixel grab** so `getImageData` (or equivalent) does not run synchronously on the renderer animation / `studio:tick` stack. Prefer a worker + transferred `ArrayBuffer`. Fail closed to today's sync path + one console note (same spirit as `NDI_SYNC_READBACK_NOTE`).
2. **No extra copy on the happy path** if a transferable buffer already exists (today's `slice` is a forced copy).
3. Claim **`blocking: false`** when the async path is live; keep `blocking: true` on the sync fallback.
4. **Default on @ 30** (`streamMapNdiWanted = true`, `STREAM_MAP_NDI_DEFAULT_FPS = 30`). Do not default 2D off.
5. Tests: async path does not throw; sync fallback still sends; default-on grep stays true. `npm test` + `npm run build`.
6. One-line Output README + `performance-budgets.md`: 2D is CPU; async grab; GPU % idle is expected until JS stops blocking.

## Out of scope

- AR/3D PBO / FBO stagger (OUT-04).
- PTS / LUT (OUT-05).
- ffmpeg / SRT (SRT-01).
- OffscreenCanvas **WebGL** for AR/3D (later, only if 04+06 still hitch with GPU still idle).
- Silent 10 fps or default-off 2D.
- NDI encode in a new process (grandi stays in Electron main).

## Likely files

- `src/output/streamMapNdiPump.ts` + test
- New helper e.g. `src/output/ndi2dAsyncCapture.ts` + test (optional but preferred)
- `src/output/ndiCaptureStagger.ts` (2D blocking flag only if pumps change)
- `src/output/README.md`
- `docs/architecture/performance-budgets.md` (one paragraph, BW-authorized)

## Acceptance criteria

- [ ] 2D NDI still defaults **on** at 30.
- [ ] Happy path does not call sync `getImageData` on the `studio:tick` / rAF stack (worker or otherwise async). Sync fallback exists.
- [ ] Worker does not assert GPU fps or Task Manager %.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Mechanism (worker / OffscreenCanvas / other) and fail-closed behaviour
2. Files
3. Tests
4. Suggested OUT/PRF memo

## Worker paste block

```
You are WORKER(DSP-OUT-20260828-06-async-2d-ndi).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260828-06-async-2d-ndi.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-BW-OUT-20260828-06.md
4. src/output/streamMapNdiPump.ts
5. src/output/ndiCaptureStagger.ts
6. docs/architecture/performance-budgets.md

Implement: 2D NDI stays default on @ 30. Move the 1920×1080 pixel grab off the
renderer tick (worker / OffscreenCanvas / transferable buffer). Fail closed to
sync getImageData. Do not default 2D off. Do not touch AR/3D FBO or PTS.
Report back per dispatch.
```
