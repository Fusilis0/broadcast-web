# Dispatch DSP-PRF-20260826-01-measure-gpu-hitch

## Meta
- From orchestrator: PRF
- Worker role: WORKER(DSP-PRF-20260826-01-measure-gpu-hitch)
- Priority: P0
- Phase: PRF measurement (no cap change)
- Related handoffs: `HO-PRF-BW-20260826-01`, `HO-PRF-OUT-20260826-01`, `HO-PRF-SCN-20260826-01`, `HO-PRF-PLT-20260826-01`
- FYI: OUT (NDI send-fps row), SCN (ops HUD rows + `powerPreference`)
- **Status: DONE** — worker complete 2026-08-27. `npm test` 869+23, `npm run build` green. Caps unchanged. Electron smoke **not run**.

## Goal

Make **which GPU** and **hitch vs average** visible on ops, and show **actual NDI send fps** per channel. Do **not** raise clocks. Operator report 2026-08-26: machine “doesn’t use a lot of GPU”, everything feels glitchy, wants 60 on preview/AR/3D/2D. First need is numbers — Electron 60 was never smoked (`DSP-OUT-20260818-01`).

## Background

Read, in order:

1. `docs/architecture/performance-budgets.md`
2. `src/output/previewFrameClock.ts` (preview fps, 1 s window)
3. `desktop/main.cjs` — `force_high_performance_gpu` already set; Chromium may still land on iGPU
4. `src/scene/createScene.ts` — `new THREE.WebGLRenderer({ antialias: true, alpha: true })` has **no** `powerPreference`
5. NDI pumps: `readRenderTargetPixels` / 2D `getImageData` are **sync** stalls (`DSP-OUT-20260812-06`)
6. Output rail documents “AR ~30 / 3D ~10” as **copy**, not a live counter — pumps have no `getSendFps()`

Locked caps (do not change): preview ~60 rAF, AR NDI ~30, 3D NDI ~10, 2D off@10, `STUDIO_TICK_FPS = 30`.

## In scope

1. **GPU adapter on ops HUD**
   - After renderer create, read `WEBGL_debug_renderer_info` (`UNMASKED_RENDERER_WEBGL` + vendor). Short string on Race ops next to preview fps (e.g. `GPU · NVIDIA …` / `GPU · Intel …`).
   - Never log the Cesium ion token. GPU string is fine to log once at boot (`[perf] WebGL renderer: …`).
   - If the extension is missing, show `GPU · unknown`.

2. **WebGL `powerPreference: 'high-performance'`**
   - Pass it on `THREE.WebGLRenderer` context attributes in `createScene.ts`. Cost-only; no look change. Confirm the HUD GPU string still updates after.

3. **Hitch counter (preview)**
   - 1 s window on the preview clock: count frames whose `dt` is **> 33 ms** and **> 50 ms**.
   - Ops HUD: `hitch` row, e.g. `2 / 1s (>50ms)` or `0`. Average fps already exists — do not replace it.
   - Unit-test the window math with a fake clock. Do **not** assert GPU fps in tests.

4. **NDI send fps (live)**
   - Each pump (`ndiFramePump`, `ndi3dChannelPump`, `streamMapNdiPump`): `getSendFps()` over a 1 s window of successful sends (not claims that were staggered away).
   - Output rail: one **Send** row per channel (`12 fps`, `—` when off / unavailable).
   - Do **not** change default fps, stagger, or `STUDIO_TICK_FPS`.

5. **Electron smoke table** (report-back, not a unit-test gate)
   - Visible studio, realistic env **on**, terrain **off**, then terrain **on** (lock-tiles off).
   - Record: GPU string, preview fps, hitch/s, AR send fps, 3D send fps, 2D send fps (2D off unless you enable it for one row).
   - One line: hitch-then-recover (tile compile) vs sustained low fps.

## Out of scope

- Raising `STUDIO_TICK_FPS`, AR/3D/2D fps, or removing stagger.
- Async PBO `readPixels` (OUT follow-up after this lands).
- Ocean/terrain look, seaQuality defaults, lock-tiles default-on (SCN follow-up).
- Windows Graphics Settings pin (PLT / operator).
- SRT colour bars / HEVC (OUT / SRT).
- Pose matching “overlay tracks the pilot” (TEL-10).

## Likely files

- `src/output/previewFrameClock.ts` (+ test)
- `src/output/perfCounters.ts` (new helper OK) (+ test)
- `src/scene/createScene.ts` (`powerPreference` only)
- `src/scene/stubHud.ts` (GPU + hitch rows; reuse chrome, no new tab)
- `src/main.ts` (wire GPU string + hitch into HUD)
- `src/output/ndiFramePump.ts`, `ndi3dChannelPump.ts`, `streamMapNdiPump.ts` (+ existing tests)
- `src/output/ndiControllerPanel.ts` (+ test)
- `src/output/README.md` — one paragraph: live send fps is a counter, caps unchanged

## Inputs provided

- Preview fps HUD + `getPreviewFps()` already exist.
- NDI pumps already throttle with `minIntervalMs` and `lastCaptureMs`.
- `desktop/main.cjs` already requests high-performance GPU.

## Acceptance criteria

- [x] Ops shows GPU renderer string and hitch/s; preview fps unchanged in meaning.
- [x] `WebGLRenderer` is created with `powerPreference: 'high-performance'`.
- [x] Output rail shows live send fps for AR / 3D / 2D; defaults still 30 / 10 / off@10.
- [x] Unit tests for hitch window + send-fps counter; existing clock/stagger tests still green.
- [x] `STUDIO_TICK_FPS` still 30 (keep the existing source assertion).
- [x] `npm test` + `npm run build` green.
- [x] Report-back includes the Electron smoke table **or** states that Electron was not run (then GPU string + counters still ship).

## Report back

When done, reply with:
1. Summary (HUD fields, `powerPreference`, send-fps)
2. Files touched
3. Tests run / Electron smoke table (or “not smoked”)
4. Follow-ups / blockers (Intel vs NVIDIA/AMD string, hitch vs average)
5. Suggested PRF memo bullets
