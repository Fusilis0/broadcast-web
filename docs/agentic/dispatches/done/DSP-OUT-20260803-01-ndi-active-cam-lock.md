# Dispatch DSP-OUT-20260803-01-ndi-active-cam-lock

## Meta
- From orchestrator: OUT (adopted BW draft 2026-08-03)
- Worker role: WORKER(DSP-OUT-20260803-01-ndi-active-cam-lock)
- Priority: P0
- Phase: 7.x polish — air vs ops view
- Related: `ndiFramePump.ts`, Electron shell, SCN free-cam DSP (`DSP-SCN-20260803-01`), `air-runbook.md`
- Status: **worker complete 2026-08-03** — awaiting OUT accept
- BW ask: NDI always from **active cam** (selected drone POV). Ops free cam / other preview must not hijack NDI.
- **Status: DONE** (BW accepted 2026-08-03)

## Goal

Contract: **NDI (and transparent studio plate) = active POV camera only.** Preview may show free cam or another view; air stream stays on the operator-selected active cam.

## Background

- Today NDI readbacks the same framebuffer as on-screen render → whatever camera renders last goes to NDI.
- Free cam (SCN) will break air if it shares that path without a split.

## In scope

1. Explicit product contract in OUT README + air-runbook.
2. Implementation options (pick simplest that works):
   - **A (preferred):** Dual render — air FBO from active POV → NDI; screen may use free cam camera; **or**
   - **B:** While NDI/studio/`outputMode=transparent`, force screen to active POV (document); free cam only when NDI off.
3. Active cam still set via existing POV switch / Fleet “Cam”.
4. Manual checklist: switch active POV → NDI framing changes; free cam (if present) does not.
5. Coordinate with SCN free-cam DSP for any scene API (`renderAirCamera` / `getActivePovCamera`).

## Out of scope

- Building free cam itself (SCN)
- WHEP / chroma changes
- Multi-NDI sources (one source only)

## Acceptance criteria

- [x] Documented: NDI = active POV always
- [x] With free cam on screen (if shipped), NDI still active POV — **or** free cam disabled in studio NDI mode with clear UI
- [x] POV switch updates NDI perspective
- [x] Runbook note; build green

## Worker paste block

```
You are WORKER(DSP-OUT-20260803-01-ndi-active-cam-lock).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260803-01-ndi-active-cam-lock.md
2. docs/agentic/dispatches/active/DSP-SCN-20260803-01-free-cam-ops-view.md
3. src/output/ndiFramePump.ts, desktop/main.cjs
4. docs/ops/air-runbook.md

Implement NDI=active-POV lock vs ops free cam. Prefer dual-render if free cam already exists; else document studio force-follow.
Report back per dispatch.
```
