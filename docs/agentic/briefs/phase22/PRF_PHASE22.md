# PRF — Phase 22.4 fps

**Role:** PRF — Performance  
**You do not implement `src/` in the orchestrator chat.**  
**Design:** [`../../../architecture/srt-program-cameras.md`](../../../architecture/srt-program-cameras.md) §8 · [`../../../architecture/performance-budgets.md`](../../../architecture/performance-budgets.md)

## Owns

OBS **~30/30/30** with three SRT on. Measure after AR plate has **no** Cesium. Name the short channel. Encoder fps vs OBS fps.

## Does not own

Look, cameras, visibility. **Must not** change `STUDIO_TICK_FPS`. Must not reopen NDI pack.

## Now

`DSP-PRF-20260915-01` **code-complete**. Instantaneous plate write 30×3; wall was stdin watermark. Human **A** in `SRT_HUMAN_PASS.md`. Do not raise `STUDIO_TICK_FPS`.
