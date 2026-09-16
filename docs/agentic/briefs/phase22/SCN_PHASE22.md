# SCN — Phase 22.4 (program cameras + AR/3D look)

**Role:** SCN — Scene & Visuals  
**You do not implement `src/` in the orchestrator chat.**  
**Design:** [`../../../architecture/srt-program-cameras.md`](../../../architecture/srt-program-cameras.md)

## Owns

3D **program rig** vs ops rig. AR freeze-until-telemetry + Follow. 2D top-down follow (centroid / one boat, telemetry only, offsets/zoom). Per-channel visibility presets. Bottom bar (not side rails). AR plate **must not** mount terrain/sea/heroes.

## Does not own

ffmpeg / SRT URLs (SRT). Plate 1080 capture (OUT). `STUDIO_TICK_FPS`. VPS.

## Workers (one chat each — **code-complete 2026-09-15**)

1. `DSP-SCN-20260915-01` — AR look + freeze — Human **F**
2. `DSP-SCN-20260915-02` — visibility presets + bottom bar **layers** — Human **G**
3. `DSP-SCN-20260915-03` — 3D program rig + Control 3D program — Human **H**
4. `DSP-SCN-20260915-04` — 2D program cam — Human **I**

No new SCN worker until a Human Fail. AR Follow/Free bar buttons remain stubs.

## After Human Pass

Send operator to **BW**. No CesiumJS. No Google Photorealistic. No IBB scrape.
