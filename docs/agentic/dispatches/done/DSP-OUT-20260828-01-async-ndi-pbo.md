# Dispatch DSP-OUT-20260828-01-async-ndi-pbo

## Meta
- From orchestrator: BW (Studio 30 wave 0) → OUT
- Worker role: WORKER(DSP-OUT-20260828-01-async-ndi-pbo)
- Priority: P0
- Phase: **Studio 30** wave 0 — non-blocking NDI readback
- Related: `HO-PRF-BW-20260828-03` (superseded: 60 cancelled) · `HO-BW-OUT-20260828-02` · `HO-PRF-OUT-20260826-01` · `done/DSP-OUT-20260812-06` stretch D
- Caps file: `docs/architecture/performance-budgets.md` — **do not change the fps numbers in this worker** (still 30/10/off). Wave 1 is `DSP-OUT-20260828-02`.
- **Status: DONE** — worker complete + BW accepted 2026-08-28 (merged tree `npm test` **887 + 23**, `npm run build` green). Caps were raised in `DSP-OUT-20260828-02` after this landed. Electron hitch/Send smoke still operator.

## Goal

Stop stalling the Electron UI on synchronous GPU readback while NDI is live. AR and 3D still send at **today’s caps** (AR ~30, 3D ~10, 2D off@10). After this lands, hitch/s on Race ops should stay ~0 with NDI sending. **Do not raise fps.** That is `DSP-OUT-20260828-02` (30/30/30). Forget 60.

## Background

Operator 2026-08-28: Electron HUD already matches locks (preview ~60, AR Send ~30, 3D Send ~10). Naive `fps: 60` or `STUDIO_TICK_FPS = 60` with today’s `renderer.readRenderTargetPixels` froze the sidebar (2026-08-12). Product lock **amended the same day:** forget 60; next raise is three senders at 30 (`DSP-OUT-20260828-02`), still blocked on this PBO.

Current path (`ndiFramePump.ts` ~L288, `ndi3dChannelPump.ts` ~L231): FBO render then **sync** `readRenderTargetPixels` on the renderer thread. 2D (`streamMapNdiPump.ts`) uses canvas `getImageData` — same stall class when enabled.

PRF: if both AR and 3D must later hit 30 on a 30 Hz tick, same-tick stagger that *skips* a channel cannot stay. Wave 0 may **keep stagger** at 30/10. Wave 1 (`DSP-OUT-20260828-02`) rewrites stagger after PBO is proven.

WebGL2 **PBO** (PIXEL_PACK_BUFFER + fence, map on a later tick) is the intended path. Three.js does not wrap this; use `renderer.getContext()` (WebGL2). If WebGL2/PBO is missing, fail **closed**: keep sync readback, surface an ops-safe note, do not pretend async.

## In scope

1. **Async readback helper** (testable): queue a read of an FBO/RT into a PBO; complete 1+ frames later into a `Uint8Array` without blocking the tick that rendered. Document the delay (one frame of capture latency is OK). Preserve bottom-up WebGL layout (existing `bottomUp: true` on AR/3D).
2. **Wire AR + 3D pumps** to the helper. `busy` / drop-if-previous-IPC-still-in-flight stays. Delay buffer unchanged.
3. **2D:** if cheap, avoid sync `getImageData` on the UI thread (e.g. complete on a later tick / `createImageBitmap`). If that is a rabbit hole, leave 2D sync and say so — 2D is default off.
4. **Stagger stays** (`tryClaimNdiHeavyCapture`). AR still ~30, 3D ~10, 2D off@10. `STUDIO_TICK_FPS` stays **30**.
5. Tests: helper can be faked (no GPU fps assert). Existing pump tests still pass. Assert source still contains caps 30/10 and `STUDIO_TICK_FPS` 30.
6. Docs: `src/output/README.md` + one line in `docs/ops/air-runbook.md` (readback is pipelined; Send fps unchanged).

## Out of scope

- Raising AR/3D/2D fps or `STUDIO_TICK_FPS` (wave 1 = `DSP-OUT-20260828-02`).
- Dropping alpha / changing NDI channel names.
- Pose clocks, `syncTrimMs`, SRT decode (TEL / SRT).
- SCN sea/terrain cost knobs (only if visible preview drops below 30 after NDI 30/30/30).
- Shipping a new Electron GPU pin (PLT).

## Likely files

- `src/output/ndiFramePump.ts`, `ndi3dChannelPump.ts`, `streamMapNdiPump.ts`
- New helper e.g. `src/output/ndiAsyncReadback.ts` + test
- `src/output/README.md`, `docs/ops/air-runbook.md`
- Tests alongside pumps

## Inputs provided

- Caps: AR 30, 3D 10, 2D off@10, `STUDIO_TICK_FPS = 30`
- Measurement already live: Race ops hitch/s, Output rail Send fps
- Studio lock 1920×1080 unchanged

## Acceptance criteria

- [ ] AR/3D capture no longer **must** block the tick on `readRenderTargetPixels` when WebGL2 PBO works.
- [ ] Defaults unchanged: AR ~30 Send, 3D ~10 Send, 2D default off, `STUDIO_TICK_FPS` 30, stagger still prevents two heavy captures same tick.
- [ ] Electron: sidebar still draggable while AR+3D NDI live; hitch/s stays in the same “~0” class as today or better. Send fps still ~30 / ~10 (not 60).
- [ ] Fallback if no WebGL2: sync path still sends NDI (no black).
- [ ] `npm test` + `npm run build` green.

## Report back

1. Summary (PBO vs fallback; 2D left sync or not; capture delay in frames)
2. Files touched
3. Tests / Electron hitch + Send fps
4. Follow-ups (ready for `DSP-OUT-20260828-02` 30/30/30 or not)
5. Suggested OUT memo bullets
