# PLT — Phase 22 brief (ffmpeg packaging)

**Role:** PLT — Platform & DevEx  
**No worker this slice unless SRT is blocked on the binary.**

## Owns

Same gyan **full** `ffmpeg.exe` already used for ingest (libsrt + `libx264`). AMF (`h264_amf`) must exist on this studio box (RX 6750 XT). Do not add a second ffmpeg tree.

## Does not own

Publish argv (SRT). Program windows (OUT).

## Now

FYI `HO-BW-PLT-20260909-01`. If the worker cannot find `h264_amf`, report — do not silently stay on `libx264` without saying so (CPU encode will miss 30×3).
