# SRT — Phase 22 brief (local program out)

**Role:** SRT — SRT Ingest **and** program egress  
**You do not implement `src/` in the orchestrator chat.** Plan, issue `DSP-SRT-*`, update `SRT_MEMO.md`.  
**Design:** [`../../../architecture/srt-egress.md`](../../../architecture/srt-egress.md)

## Owns

ffmpeg **publish** children (not the ingest reader). Three SRT **callers** AR/3D/2D. Local default `127.0.0.1:9201–9203`. Encoder `h264_amf` (NVENC / `libx264` fallback). Latency LAN 40–80 ms.

Ingest (catalog, HEVC decode) is **untouched**.

## Does not own

Plate look (SCN). NDI pack. VPS host (operator, after local Pass). Preview clock (`STUDIO_TICK_FPS`).

## Now

Issue / accept [`DSP-SRT-20260909-01-local-srt-out.md`](../../dispatches/active/DSP-SRT-20260909-01-local-srt-out.md). Worker implements. Human Pass = [`SRT_HUMAN_PASS.md`](./SRT_HUMAN_PASS.md) tests **A–D**.

## After local Pass

Return the operator to **BW**. Do **not** invent MediaMTX ports. 22.3 waits for VPS details.
