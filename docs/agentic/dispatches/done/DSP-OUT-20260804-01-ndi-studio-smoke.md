# Dispatch DSP-OUT-20260804-01-ndi-studio-smoke

## Meta
- From orchestrator: OUT (Phase 10.3; from `HO-BW-20260804-04`)
- Worker role: WORKER(DSP-OUT-20260804-01-ndi-studio-smoke)
- Priority: P0
- Phase: Phase 10 — Cutover & console
- Related handoffs: HO-BW-20260804-04, HO-BW-OUT-20260804-01
- Related: air-runbook, NDI dual-render lock (`DSP-OUT-20260803-01` done)
- **Status: DONE** — worker Pass accepted by OUT 2026-08-04

## Goal

Formalize and execute a **studio NDI smoke checklist**: free cam on screen does not change NDI; POV switch changes NDI; alpha plate clean; stream map left off.

## In scope
1. Expand/confirm checklist in `docs/ops/air-runbook.md` (and vmix runbook if needed).
2. Run smoke on Electron + vMix/Studio Monitor (or document blockers if machine unavailable).
3. Record Pass/Fail + notes in OUT_MEMO / dispatch report.
4. No new NDI features unless a P0 bug blocks smoke.

## Out of scope
- Stream map burn-in (BW locked DOM-only)
- Unity cutover decision (10.1 human/BW)
- Console deep-link (CON)

## Acceptance criteria
- [x] Checklist exists and is runnable — `air-runbook.md` § Studio NDI smoke (Phase 10.3)
- [x] Smoke attempted; Pass or explicit blocker listed — **Pass**
- [x] OUT_MEMO updated

## Worker report

### Environment
| Item | Value |
| --- | --- |
| Host | `DESKTOP-264DNL1` |
| Shell | Vite + `desktop:dev` |
| URL | `http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent` |
| NDI name | `DESKTOP-264DNL1 (broadcast-web)` |
| Ingest | NDI 6 Studio Monitor present; vMix **not** installed — verified with Studio Monitor + `grandi` receive |
| Stream map | Left off (DOM-only per `HO-BW-OUT-20260804-01`) |

### Checklist
| # | Check | Result |
| --- | --- | --- |
| 1 | Boot transparent studio | Pass |
| 2 | Source live 1920×1080 | Pass |
| 3 | Alpha plate + sharp 8×8 timecode | Pass |
| 4 | POV switch changes NDI | Pass |
| 5 | Free cam ≠ NDI (upright active POV) | Pass (after P0 fix) |
| 6 | Follow sync | Pass |
| 7 | Stream map off | Pass |

### P0 fix (blocked smoke)
**Bug:** Dual-render air-target path in `src/output/ndiFramePump.ts` called `sendRgba(..., false)` after `readRenderTargetPixels`. WebGL/Three readback is bottom-up (same as `gl.readPixels`), so free-cam sessions published a **vertically flipped** NDI plate (timecode jumped to top-right). Visual smoke read that as free cam hijacking air.

**Fix:** Use `bottomUp: true` for air-target capture (match framebuffer path).

### Verdict
**Pass** — Phase 10.3 studio NDI smoke complete on this machine.

## Worker paste block

```
You are WORKER(DSP-OUT-20260804-01-ndi-studio-smoke).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260804-01-ndi-studio-smoke.md
2. docs/ops/air-runbook.md
3. docs/ops/vmix-ndi-alpha-runbook.md
4. HO-BW-OUT stream map DOM-only decision

Run/document studio NDI smoke. Fix only P0 bugs that block the checklist. Report Pass/Fail.
```
