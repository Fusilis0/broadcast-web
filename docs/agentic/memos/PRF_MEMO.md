# PRF_MEMO

**Last updated:** 2026-09-15  
**Status:** NDI 30×3 closed. SRT **16×3 Fail gone** (worker measure: plate write 30×3). Human **A** still operator. **Never change `STUDIO_TICK_FPS`.**

## 2026-09-15 — DSP-PRF-20260915-01 accepted

Wall was stdin `highWaterMark` 16 KB vs 8.3 MB/frame + dual paint + 60 Hz plate `invalidate()`, not Cesium / tick. Instantaneous write **30/30/30**, `h264_amf`, GPU RX 6750 XT. ffmpeg `fps=` ~29 is session average. Human **A**: OBS canvas ~30 with AR+3D+2D on.

## 2026-09-15 — HO-BW-PRF-20260915-01

Wait `DSP-SCN-20260915-01` (AR without Cesium). Then `DSP-PRF-20260915-01-srt-30x3`. `STUDIO_TICK_FPS` is the 60 Hz studio clock, not OBS 30. Raising it is forbidden.

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
