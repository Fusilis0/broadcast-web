# Phase 22 orchestrator briefs

**BW locked:** 2026-09-09  
**Design:** [`../../../architecture/srt-egress.md`](../../../architecture/srt-egress.md)  
**Roadmap:** Phase 22 — **local first**.

| File | When |
| --- | --- |
| [`SRT_PHASE22.md`](./SRT_PHASE22.md) | **Now** — ffmpeg SRT callers + destination URL |
| [`SRT_HUMAN_PASS.md`](./SRT_HUMAN_PASS.md) | **Now** — operator tests A–D |
| [`OUT_PHASE22.md`](./OUT_PHASE22.md) | **Now** — plates, SRT toggles, hide NDI |
| [`PLT_PHASE22.md`](./PLT_PHASE22.md) | FYI — same ffmpeg binary / AMF |

**First worker:** [`../../dispatches/active/DSP-SRT-20260909-01-local-srt-out.md`](../../dispatches/active/DSP-SRT-20260909-01-local-srt-out.md)

**Pass:** operator [`SRT_HUMAN_PASS.md`](./SRT_HUMAN_PASS.md) — **A** 30×3, **B** OBS 3D sea+terrain, **C** LAN, **D** URL field. VPS (22.3) after A. Do **not** pick a relay host in this slice.
