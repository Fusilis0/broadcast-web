# OUT — Phase 21 brief (silent MP4)

**Role:** OUT — Output & Compositing Orchestrator  
**You do not implement `src/`.** Plan, issue `DSP-OUT-*`, update `OUT_MEMO.md`.  
**Design:** [`../../../architecture/commercial-video.md`](../../../architecture/commercial-video.md)

## Owns

Silent **1920×1080 30 fps MP4** from the opaque 3D canvas while SCN cinematic play runs. Chrome-free (SCN already hides HUD). **Not** NDI. **Not** SRT. No audio track.

Issued: [`DSP-OUT-20260908-01-cinematic-mp4`](../../dispatches/active/DSP-OUT-20260908-01-cinematic-mp4.md) — **code-complete 2026-09-09**. Human Pass = Electron Record.

## Does not own

Spline, globe math, ocean, heroes, vMix playlist (human).

## After Human Pass

Return the operator to **BW**. Phase 22 SRT is still later.
