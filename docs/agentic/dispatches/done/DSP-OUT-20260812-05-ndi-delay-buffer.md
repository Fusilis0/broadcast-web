# Dispatch DSP-OUT-20260812-05-ndi-delay-buffer

## Meta
- From orchestrator: BW → OUT (Phase 13.6)
- Worker role: WORKER(DSP-OUT-20260812-05-ndi-delay-buffer)
- Priority: P0
- Phase: Phase 13 — Multi-channel output
- Prerequisites: `done/DSP-OUT-20260812-01` (+ pumps from 13.3/13.4 already on main)
- Parallel-safe with: `DSP-OUT-20260812-04` (switcher) — **you own delay ring buffer + NDI-tab delay
  controls**; do **not** build the 2D/3D/AR local switcher. Rebase `main.ts` if needed.
- Design: `docs/architecture/multi-output-streaming.md` §4
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 461+23)

## Goal

Add an adjustable **per-channel NDI delay** (0–30000 ms) so frames are held in RAM and sent late,
for studio time-alignment. Default must stay cheap (zero delay = today’s behavior).

## Background

- Full 30 s × 1080p RGBA @ 30 fps ≈ **~7.5 GB per channel** — unacceptable as default.
- Pumps already exist: AR (`ndiFramePump`), 3D (`ndi3dChannelPump`), 2D (`streamMapNdiPump`).

### BW memory locks (do not reopen)

1. **Default delay = `0`** for all channels (immediate send; **no ring buffer allocated**).
2. **Max = `30000` ms** (clamp UI + API).
3. **Allocate / push the ring only when `delayMs > 0`** — option (3) from the design doc.
4. **Warn in UI** when delay &gt; **3000 ms** (label e.g. “high memory”) — option (1) soft guidance;
   do **not** silently refuse values up to 30000.
5. No compressed-frame or 15 fps buffer in v1 unless you hit an unavoidable OOM in smoke — report
   instead of inventing a second scheme.
6. **Per-channel** knobs: `ar` / `3d` / `2d` independently (config draft
   `outputDelayMs.{ar,3d,2d}` optional in `config.json`; live UI required).

## In scope

1. Shared delay helper (e.g. `ndiDelayBuffer.ts`): timestamped frame ring; `push` + `popReady(now)`;
   bypass when delay is 0; clamp 0..30000; estimate/document memory cost in README.
2. Wire into **all three** pumps so `sendFrame` happens only after delay (or immediately at 0).
3. NDI controller tab: per-channel delay control (number input or slider + ms readout). Changing
   delay live must not require app restart; shrinking delay may drop buffered frames (document).
4. Optional: read initial delays from config if a clean hook exists; otherwise UI-only defaults 0.
5. Docs: `src/output/README.md`, `docs/ops/air-runbook.md` (when to use delay; memory warning).
6. Unit tests: bypass at 0; clamp; pop order; no huge default allocation.

## Out of scope

- Local 2D/3D/AR screen switcher (`DSP-OUT-20260812-04`).
- Changing studio resolution / portrait mode.
- Desktop `grandi` bridge redesign.
- Persisting delay into RaceProject (unless trivial and already patterned — prefer config/UI only).

## Likely files

- New: `src/output/ndiDelayBuffer.ts` (+ test)
- Edit: `ndiFramePump.ts`, `ndi3dChannelPump.ts`, `streamMapNdiPump.ts`, `ndiControllerPanel.ts`
  (+ tests), maybe `loadConfig` / types if config keys added
- Docs: `src/output/README.md`, `docs/ops/air-runbook.md`, design doc status line OK
- Avoid owning `localChannelSwitcher` / Ops three-button UI (sibling DSP)

## Acceptance criteria

- [ ] Default 0 delay: behavior and memory footprint match pre-DSP (no standing multi-GB buffers)
- [ ] Each channel can set 0..30000 ms independently; values clamp
- [ ] UI warns when delay &gt; 3000 ms; NDI still functions
- [ ] `npm test` + `npm run build` green
- [ ] README states memory formula + BW locks above

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (peak RAM observed if you smoked a high delay)
5. Suggested memo bullets for OUT
