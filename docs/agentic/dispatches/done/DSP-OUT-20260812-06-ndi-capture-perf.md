# Dispatch DSP-OUT-20260812-06-ndi-capture-perf

## Meta
- From orchestrator: BW → OUT (Phase 13 perf follow-up)
- Worker role: WORKER(DSP-OUT-20260812-06-ndi-capture-perf)
- Priority: P0
- Phase: Phase 13 — Multi-channel output (perf)
- Prerequisites: pumps from 13.3–13.6 landed
- Related: user report 2026-08-12 — studio UI ~unusable FPS; Task Manager looks fine
  (classic **sync GPU `readPixels` / main-thread `getImageData` stall**, not CPU peg)
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 476+23; human Electron UI smoke recommended)

## Goal

Restore usable Electron UI FPS while keeping three NDI channels available. Today every studio
tick can do **two** full 1920×1080 WebGL `readRenderTargetPixels` (AR + 3D) **plus** a 1920×1080
canvas `getImageData` (2D) on the renderer main thread — that stalls presentation and makes the
sidebar feel frozen even when Task Manager CPU looks calm.

## Background

- `startNdiFramePump` + `startNdi3dChannelPump` + `startStreamMapNdiPump` all subscribe to
  `onStudioTick` (~30 Hz) and capture at up to 30 fps each.
- Sync `readPixels` / `getImageData` block the main thread until the GPU finishes — UI (menu drag)
  shares that thread.
- Product ask was always-on NDI; that does **not** require all three to capture at full 30 fps
  with sync readback forever.

## In scope (ship A+B+C; D only if still janky)

**A. Cap channel FPS (required — 2D-off alone is not enough)**  
User confirmed UI still dead with 2D NDI off → **AR + 3D sync `readPixels`** are enough to stall.
- Defaults: **AR = 30**, **3D = 10**, **2D = 10** (when enabled).  
- Optional NDI-tab or config override later; not required if defaults fix UI.

**B. Default 2D NDI off (required)**  
`startStreamMapNdiPump({ enabled: false })` in studio; ops turns on in NDI tab when needed.

**C. Stagger + optional pause heavy channels (required)**  
- Stagger: don’t capture AR+3D on the exact same tick when both are due.  
- **Also:** when local focus is **not** `3d`, default **3D NDI capture to ≤10 fps** (already) **or**
  offer NDI-tab toggle default **on** but document pausing 3D for ops machines. Prefer keeping 3D
  sending at 10 fps always-on unless still unusable — then default **3D NDI off** with one-click
  enable (same pattern as 2D). **BW lock if A+C at 10 fps still janks UI:** default **3D NDI off**
  too; AR remains the always-on air path.

**D. Optional stretch:** async PBO readback — only if A–C still insufficient.

**E. Docs:** `src/output/README.md` + `docs/ops/air-runbook.md`.

## Out of scope

- Dropping multi-sender bridge or removing 3D/2D channels.
- Changing studio lock resolution.
- SCN water-tick polish (separate soft follow-up).
- Delay-buffer redesign.
- Fleet map / project Save UX (other DSPs).

## Likely files

- `ndiFramePump.ts`, `ndi3dChannelPump.ts`, `streamMapNdiPump.ts`, `main.ts`
- `ndiControllerPanel.ts` (enable defaults / fps if exposed)
- Tests + README / air-runbook

## Acceptance criteria

- [ ] With **defaults**, Electron sidebar/menu is usable while AR NDI is live (can drag/scroll rail)
- [ ] AR NDI still sends by default (~30 fps)
- [ ] 3D and 2D remain available (reduced fps and/or default off + one-click enable)
- [ ] Turning 2D off is no longer the only dial — 3D rate/default also addressed
- [ ] `npm test` + `npm run build` green
- [ ] Air-runbook notes the perf dials

## Report back
When done, reply with:
1. Summary (which of A–D shipped + **final defaults** for AR/3D/2D enable + fps)
2. Files touched
3. Tests / how verified (Electron UI feel + which NDI sources still present)
4. Follow-ups / blockers
5. Suggested OUT memo bullets
