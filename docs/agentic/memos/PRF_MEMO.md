# PRF_MEMO

**Last updated:** 2026-09-09  
**Status:** NDI 30×3 closed. Phase 22 local SRT Pass = **30/30/30 in OBS**. No PRF DSP until the SRT worker reports encoder fps. Never `STUDIO_TICK_FPS = 60` as a fix.

## 2026-09-09 — Phase 22 local SRT (FYI)

Air path is ffmpeg children, not NDI pack. Measure after `DSP-SRT-20260909-01` smokes. Preview must stay usable with three SRT on.

## Role
Performance Orchestrator (`PRF`). Budgets + measurement. Does not own look (SCN) or egress (OUT). Caps: `docs/architecture/performance-budgets.md` (ignore stale BOOTSTRAP_PRF 3D~10 / tick 30).

## Locked caps (BW Studio 30 + 60 Hz tick)
- Ops **preview** ~60 rAF when visible. Floor ≥30.
- NDI AR/3D/2D **parked** (30×3 closed).
- SRT AR/3D/2D **30/30/30** local OBS Pass (Phase 22).
- `STUDIO_TICK_FPS = 60` already (NDI capture clock). Do not change it as a fix.
- No fake mouse / rAF keep-alive.

## Received 2026-09-02 — `HO-BW-PRF-20260902-01`
Operator: idle ~8 crunchy; mousedown+hover feels >40. Not a shipped boost. `backgroundThrottling` already false. OUT-06 put **3D send on full-size CPU UYVY** (GPU pack off the wire — stripes).

Playbook: 10 s idle dump vs 10 s mousedown+hover. Verdict A/B/C in `performance-budgets.md`. **DSP-PRF-20260902-01** stamps dump with session + preview/hitch/Send + `3dCpuPack` stage. Operator can still run the playbook **today** on existing HUD + Copy 10 s dump.

Do **not** hand OUT until dumps name a hog. If **B/C** and `3dCpuPack` / `3dReadbackDrain` dominates idle → then `HO-PRF-OUT` (GPU UYVY only with READ-proven dest, no size heuristic).

## DSP-PRF-01 (2026-08-27)
GPU HUD, hitch/s, live Send. Still the operator numbers for preview vs Send.

## Open
- Worker: `active/DSP-PRF-20260902-01-idle-vs-mouse-dump.md`
- Operator: two dumps (steps in PRF chat). No OUT pixel work until verdict.

## Handoffs / dispatches
- `HO-BW-PRF-20260902-01` (received)
- `active/DSP-PRF-20260902-01-idle-vs-mouse-dump.md`
- `done/DSP-PRF-20260826-01-measure-gpu-hitch.md`
- `done/DSP-PRF-20260829-01-ndi-stage-timing.md`
