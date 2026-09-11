# Dispatch DSP-SRT-20260909-01-local-srt-out

## Meta
- From orchestrator: BW (Phase 22 open 2026-09-09). Domain lead: **SRT** (+ OUT files listed).
- Worker role: WORKER(DSP-SRT-20260909-01-local-srt-out)
- Priority: **P0**
- Phase: **22** — local SRT program out
- Related: `HO-BW-SRT-20260909-01`, `HO-BW-OUT-20260909-01`, `HO-BW-PLT-20260909-01`
- Worker result: **code-complete 2026-09-09**. gdigrab titled 1080 plates; AMF first; NDI Send folded. **Human Pass:** OBS 30/30/30 on this PC (not measured in the worker chat).

## Goal

Hide NDI Send. Publish **three** opaque 1080p30 SRT callers (AR, 3D, 2D) to **OBS on this PC**. Pass = OBS shows all three at **~30 fps** with the right picture. VPS is **out of scope**.

## Background

NDI 30×3 is closed (~20 fps AR/3D; stall is UYVY pack/IPC). SRT only helps if **ffmpeg children** encode. Do **not** feed grandi / `ndiDeferredSend` / `getImageData` into SRT.

Ingest (`srtReader.cjs`, catalog, HEVC decode) stays as-is. New code is **publish**, not another reader.

## In scope

1. **NDI UI hidden** (legacy fold or remove from ops). Pumps and `ndiSender.cjs` stay. Defaults stay off. Enabling SRT must not start NDI.
2. Three chrome-free **1920×1080** titled program surfaces ffmpeg can grab:
   - `broadcast-web-srt-ar`
   - `broadcast-web-srt-3d`
   - `broadcast-web-srt-2d`
   AR = composited air plate. 3D = world view (no HUD). 2D = stream map. No ops chrome in the grab.
3. Electron main: one ffmpeg child per enabled channel. Input = `gdigrab` (or DXGI equivalent) **by window title**. Output = SRT **caller**.
4. Encoder: `h264_amf` first (this studio is RX 6750 XT). NVENC if AMF missing. `libx264` ultrafast+zerolatency **only** as last resort and **say so** in ops status. `-an`, `yuv420p`, 1080p, `-r 30`, ~8–15 Mbps.
5. Default URLs (ffmpeg `latency` is **microseconds**):
   - AR `srt://127.0.0.1:9201?mode=caller&latency=60000`
   - 3D `srt://127.0.0.1:9202?mode=caller&latency=60000`
   - 2D `srt://127.0.0.1:9203?mode=caller&latency=60000`
   Ops may edit host/port later; local defaults must work with no VPS.
6. Ops: **SRT AR / SRT 3D / SRT 2D** toggles (independent start/stop). Status: idle / connecting / live / error. Show encoder name. Optional encoder fps from ffmpeg stderr.
7. Runbook: `docs/ops/srt-local-obs.md` — start OBS **listeners first**, then studio SRT. How to read fps in OBS.
8. Tests: argv builder (titles, caller URLs, no NDI FourCC, no ingest `-c copy` pipe); toggle off kills that child; three channels independent; NDI panel not shown by default.

## Out of scope

- VPS / MediaMTX / WAN latency presets
- Deleting NDI pumps
- Ingest catalog / drone SRT / HEVC
- Cinematic Record
- `STUDIO_TICK_FPS`
- In-browser SRT
- vMix (human can use OBS only for this Pass)

## Likely files

- `desktop/srtPublisher.cjs` (or similar) + argv tests
- `desktop/main.cjs`, `desktop/preload.cjs`
- `src/output/srtPublisher.ts` (renderer IPC) + test
- `src/output/ndiControllerPanel.ts` (hide NDI; add SRT rows) **or** a sibling SRT panel
- `src/main.ts` wire
- `src/output/README.md`, `desktop/README.md`
- `docs/ops/srt-local-obs.md`

Reuse ingest `resolveFfmpegPath()`. Do **not** spawn ingest readers for publish. Do **not** import `ndiUyvy` / grandi into the new module.

## Inputs provided

- Local ports 9201–9203
- Latency 60 ms
- Silent 1080p30
- OBS on the same machine
- Human starts listeners, then checks SRT boxes

## Acceptance criteria

- [x] NDI Send UI not in the way (hidden/legacy). NDI does not start with SRT.
- [x] Electron: three independent SRT toggles. Off = that ffmpeg dead.
- [ ] OBS (three Media Sources, listener on 9201–9203) shows AR / 3D / 2D picture. **Human Pass**
- [ ] With all three on, OBS fps is ~**30 / 30 / 30**. Preview still usable. **Human Pass**
- [x] No UYVY/grandi on the SRT path.
- [ ] `npm test` + `npm run build` green. *(pre-existing red: `library.test.ts`, `tsc` in `videoDecodePipeline.ts` / `createScene.ts` / `isolateTilesCaches.ts`. New SRT tests 11/11.)*
- [x] `docs/ops/srt-local-obs.md` exists.

**Fail / stop and report (do not fake Pass):** encoder is `libx264` and fps dies; grab is black; one channel blocks the others; ingest SRT broken.

## Report back

1. Summary (gdigrab vs other, encoder actually used)
2. Files
3. How to smoke (OBS clicks + studio toggles)
4. FPS observed (or why not 30×3)
5. Memo bullets for SRT + OUT

## Worker paste block

```
You are WORKER(DSP-SRT-20260909-01-local-srt-out).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SRT-20260909-01-local-srt-out.md
2. docs/architecture/srt-egress.md
3. desktop/README.md (ffmpeg path)
4. src/output/README.md (do not break ingest)

Implement that dispatch only. Hide NDI Send. Three local SRT callers to OBS.
Do not use NDI pack/IPC. Do not touch VPS. Do not change STUDIO_TICK_FPS.
Report back per dispatch.
```
