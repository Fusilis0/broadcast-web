# OUT — Phase 22 brief (plates + NDI hide)

**Role:** OUT — Output & Compositing Orchestrator  
**You do not implement `src/` in the orchestrator chat.**  
**Design:** [`../../../architecture/srt-egress.md`](../../../architecture/srt-egress.md)

## Owns

Chrome-free **1920×1080** program surfaces for AR / 3D / 2D (titled HWNDs ffmpeg can grab). Ops toggles **SRT AR / SRT 3D / SRT 2D**. **Hide** NDI Send UI. Keep NDI pumps in-repo, default off, do not start them while SRT is on.

## Does not own

ffmpeg argv / SRT URL compose (SRT). Scene content (SCN). VPS.

## Now

`DSP-OUT-20260915-01` **code-complete** (scale, not crop). Human **E**. Do not start a second 1080 DSP unless E Fails.

## After

NDI stays hidden. No NDI 30×3 climb.
