# OUT — Phase 22 brief (plates + NDI hide)

**Role:** OUT — Output & Compositing Orchestrator  
**You do not implement `src/` in the orchestrator chat.**  
**Design:** [`../../../architecture/srt-egress.md`](../../../architecture/srt-egress.md)

## Owns

Chrome-free **1920×1080** program surfaces for AR / 3D / 2D (titled HWNDs ffmpeg can grab). Ops toggles **SRT AR / SRT 3D / SRT 2D**. **Hide** NDI Send UI. Keep NDI pumps in-repo, default off, do not start them while SRT is on.

## Does not own

ffmpeg argv / SRT URL compose (SRT). Scene content (SCN). VPS.

## Now

The first worker is **SRT-owned** (`DSP-SRT-20260909-01`) and **lists OUT files**. Do not start a second NDI-hide worker in parallel — it is in that DSP.

## After local Pass

NDI stays hidden. No NDI 30×3 climb.
