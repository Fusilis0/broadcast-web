# Dispatch DSP-OUT-20260902-01-restore-ndi-pbo

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260902-01-restore-ndi-pbo)
- Priority: P0
- Phase: After 19.3 picture — restore **PBO** so the overlay is not ~8 fps
- Related: `HO-BW-OUT-20260902-02` · OUT-05/06 · **19.4 landed** (`done/DSP-OUT-20260901-02`)
- Status: **DONE (code)** 2026-09-02 — suite **1058 + 23** / build green. **Human Electron gate open** (banner / idle preview / Send).

## Goal

Live Electron: **no** yellow **SYNC READBACK** banner; preview HUD not stuck at ~8 idle; NDI **Send** shows a moving number while Status is live. Keep OBS picture (AR keys, 3D no stripes, 2D letterbox). **Do not** raise `STUDIO_TICK_FPS`. **Do not** fake mouse input.

## Background

BW (`HO-BW-OUT-20260902-02`): whole app ~8 fps because AR/3D **sync `readPixels`** + CPU UYVY on the **same JS thread as rAF**. `tickIntervalMs` ~111–124 ms. Caps still say preview ~60 / NDI ~30. Sync is the **escape**, not the live path.

Picture locks we must keep:
- **Never** PBO-read a **half-width** dest and skip CPU pack (`w*2===srcW`) — that was RGB-as-UYVY stripes.
- **Never** pack the **default canvas** FB as UYVY.
- 3D send stays **full-size RGBA → UYVY pack** (OUT-06). AR stays **UYVA**. GPU `ndiGpuUyvy` stays **off** the send path unless READ is proven on that dest (not required this DSP).

Why live is still sync: OUT-05 falls to `readRenderTargetPixels` when public FBO / `FRAMEBUFFER_BINDING` is null. Worker said Three r178 **does** set `_this.properties` in `initGLContext` — use it at **runtime** if present (not as a TS-required API). Prefer: after `setRenderTarget(full FBO)`, bind READ to that RT’s `__webglFramebuffer` from `properties.get`, **then** PBO. Only sync if WebGL2/PBO/fence is actually missing.

## In scope

1. **PBO on for WebGL2 studio** for AR and 3D full-size FBO reads. `markNdiSyncReadback` must **not** fire on the happy path.
2. CPU UYVY/UYVA pack **after** `poll()` (existing pools/workers OK) — not a blocking `readRenderTargetPixels` on the tick when PBO works.
3. **2D `captureTicks` missed / Send —:** find why 2D grab does not `record()` while sender Status is live. Fix pump/HUD so Send is a number if frames go out; if the sender is live but never sends, HUD must not look healthy. Empty **course/boats on local 2D** is **SCN** — note it, do not invent map art.
4. Tests: PBO begin true when `properties.get(rt).__webglFramebuffer` exists even if DRAW query is null; half-width skip still off; 2D record/miss documented.
5. README + air-runbook one-liner: live path is PBO; sync banner = broken studio.
6. `npm test` + `npm run build` green.

## Out of scope

- 19.4 toggle UX (other worker; merge after they report)
- Raising `STUDIO_TICK_FPS`
- Mouse / compositor hacks
- GPU UYVY half-width send
- SCN 2D feature content
- Committing unless asked

## Likely files

- `src/output/ndiAsyncReadback.ts` (+ tests)
- `src/output/ndiFramePump.ts`, `ndi3dChannelPump.ts`
- `src/output/streamMapNdiPump.ts` / 2D capture (missed ticks)
- `src/output/ndiControllerPanel.ts` (Send HUD if needed)
- `src/output/ndiStageTiming.ts` if captureTicks wiring is wrong
- `src/output/README.md`

## Acceptance criteria

- [x] WebGL2 happy path does not call sync `readRenderTargetPixels` for AR/3D
- [x] `markNdiSyncReadback` / yellow banner stays off when PBO works
- [x] No half-width RGB-as-UYVY skip
- [x] 2D Send / captureTicks explained or fixed if pumps send
- [x] `npm test` + `npm run build` green — **1058 + 23**

## Worker report

1. **PBO without Three-private-only FBO.** Three r178 assigns `this.properties` in `initGLContext`. After `setRenderTarget(full-size RT)`, bind READ to `properties.get(rt).__webglFramebuffer` (duck-typed at runtime, `get` called on the properties object). DRAW/`FRAMEBUFFER_BINDING` may still be null on ANGLE. Do **not** fail closed on `checkFramebufferStatus` (that was the OUT-05 8 fps lock). Permanent `fallToSync` + `markNdiSyncReadback` only if WebGL2/PBO/fence is actually missing. A missing FBO this tick sync-reads the **same** RT (never default FB) and **keeps PBO mode**. Never PBO half-width dest; 3D still full-size RGBA → CPU UYVY (`shouldSkipCpuUyvyPack` stays off unless verified GPU READ).

2. **2D missed + Send HUD.** `captureTicks 2d missed (no record)` means `recordNdiCapture('2d')` never ran — the deferred grab was starved while AR/3D blocked the JS thread on sync `readPixels`. Empty **course/boats on local 2D** is **SCN** (chrome-only map). HUD: `formatNdiSendFps` shows **0 fps** (not em-dash) when the sender is available but silent; Status **live · no send** when live with 0 Send. Empty source canvas while the 2D sender is live → pump error `2D source canvas unavailable`.

3. **Files / tests.** `ndiAsyncReadback.ts` (+ tests: properties + DRAW null + incomplete READ still PBO; no-FBO tick does not leave PBO / does not light the banner). `ndiControllerPanel.ts` (`formatNdiLiveStatus`). `perfCounters.ts`, `ndiStageTiming.ts`, `streamMapNdiPump.ts` (+ empty-canvas error). `ndi3dChannelPump.ts` comment only. README + air-runbook. Half-width skip tests unchanged.

4. **Human retest.** Electron studio, all three senders on. Yellow **SYNC READBACK** gone; idle preview not ~8; Send numbers move. Then check 2D content — if still chrome-only grid, that is SCN. Do not raise `STUDIO_TICK_FPS`. Do not fake mouse.

5. **OUT memo bullets.** See report-back in worker chat.

## Report back

1. How PBO stays on without Three-private-only FBO
2. 2D missed + Send HUD
3. Files / tests
4. Human retest: banner gone, idle preview not ~8, Send numbers move, then check 2D content (SCN if still empty grid)
5. OUT memo bullets

## Worker paste block

```
You are WORKER(DSP-OUT-20260902-01-restore-ndi-pbo).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260902-01-restore-ndi-pbo.md
2. docs/agentic/handoffs/HO-BW-OUT-20260902-02.md
3. docs/architecture/performance-budgets.md
4. src/output/ndiAsyncReadback.ts (sync fallback / READ bind)
5. src/output/ndi3dChannelPump.ts, ndiFramePump.ts, streamMapNdiPump.ts
6. src/output/ndiControllerPanel.ts (SYNC READBACK banner, formatNdiSendFps)

P0: keep WebGL2 PBO on for full-size AR/3D FBO reads so rAF is not ~8 fps.
Do not PBO half-width GPU dest. Do not pack default FB as UYVY.
Do not raise STUDIO_TICK_FPS. Explain/fix 2D captureTicks missed + Send — while live.
No 19.4 UX unless that worker already landed. Report back per dispatch.
```
