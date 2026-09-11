# SRT_MEMO

**Last updated:** 2026-09-09  
**Status:** Phase **22 open**. Local OBS 30×3 first (`DSP-SRT-20260909-01` worker shipped). Human Pass still open. VPS later. Ingest locks unchanged.

## 2026-09-10 — 3D SRT missing sea/terrain (heroes only)

Human: studio 3D has sea + aerial terrain; OBS 3D showed hero glTF only.

Cause: SRT plates are a **new SPA**. Terrain default is **off**, environment default is **simple**. Heroes default **on**. Plate never saw the ops HUD toggles.

Fix: 3D/AR plates default to **realistic + terrain on**, then mirror the studio look over IPC (`srtOut:worldLook`).

## 2026-09-09 — HiDPI crop / 7 fps / 3D missing sea

Human: AR in OBS looked 2K/cropped; 3D had buildings but no terrain/sea; all three ~7 fps; studio preview 0 fps.

- HiDPI `toBitmap()` was **cropped** to 1080p (wrong stride) → 2K zoom look. Now infer size from bytes and **scale**.
- Plates are **offscreen compositor** (`paint` / frame subscription) so Cesium keeps drawing without covering the studio. `capturePage` at 2K×3 was the 7 fps stall.
- SRT plates force **opaque** world (ops `output: transparent` is NDI/keying). 3D = free cam + terrain/sea; AR = follow + opaque composite.

## 2026-09-09 — DXGI was screen copy (ops HUD in OBS)

Human: SRT 3D showed the studio UI (sidebar, LOCAL VIEW). Cause: `ddagrab` is a **screen-region** copy of where the plate HWND sits. Plates are not on top, so OBS got the studio composite.

Fix: **`capturePage` of the plate BrowserWindow** (Chromium compositor / camera view) → BGRA pipe → ffmpeg. Plates parked off-screen. Do not use DXGI. Still not NDI/grandi pack.

## 2026-09-09 — plate display / fps / 3D free cam

Human: SRT 3D was `live · 0 fps`, OBS picture split/wrong, plate spilled onto a portrait second monitor, 3D showed drone POV.

- Plates stay on the **studio landscape** display; 16:9 fitted inside the work area (never pick portrait when a landscape exists).
- Encoder fps from ffmpeg **`-progress pipe:1`** (stderr stats were hidden by `-loglevel warning`).
- **SRT 3D** mirrors ops **free cam** (IPC pose). AR stays follow. 2D stays map.

## 2026-09-09 — connecting hang / OBS black (3D)

Human: SRT 3D stayed `connecting`, OBS black. Cause: plate waited on full SPA `did-finish-load` before ffmpeg (never left connecting), and GDI `gdigrab` of Chromium WebGL is often black.

Fix: show the plate immediately; start ffmpeg after ~0.7 s; capture with **ddagrab** (DXGI) of the window region. OBS listener still needs Input Format `mpegts` and `latency=60000`.

## 2026-09-09 — OBS listen (Human Pass stuck connecting)

Operator: all three `connecting · 0 fps`. Cause: OBS was not a working **listener**. Media Source needs **Input Format `mpegts`** and `latency=60000` (µs, not `60`). Bind `0.0.0.0`. Two callers never handshake. Runbook updated.

## 2026-09-09 — DSP-SRT-20260909-01 worker (local publish)

Worker implemented local SRT program out. Do not invent VPS ports.

- ffmpeg **gdigrab** of titled 1080 windows `broadcast-web-srt-ar` / `-3d` / `-2d`
- Encoder preference **h264_amf** → NVENC → libx264 (CPU fallback labelled in ops)
- Callers `127.0.0.1:9201–9203` `latency=60000` µs. Ingest catalog / `srt:open` untouched
- Ops: **SRT AR / SRT 3D / SRT 2D**. NDI Send folded **Legacy NDI (hidden)**
- Runbook: `docs/ops/srt-local-obs.md`. Human Pass = OBS 30/30/30

## 2026-09-09 — Phase 22 local publish (HO-BW-SRT-20260909-01)

Operator: hide NDI; three SRT outs; listen on this PC in OBS; Pass = **30/30/30**. Then VPS.

**Worker (new chat):** `DSP-SRT-20260909-01-local-srt-out`. ffmpeg children, `h264_amf`, `gdigrab` titled 1080 windows, caller `127.0.0.1:9201–9203`. Do not implement in the SRT orchestrator chat. Do not reuse NDI pack. Do not touch ingest catalog.

## 2026-09-07 — SRT program out (operator)

Race day: SRT on **LAN**. Tests: network later (VPS TBD). Local OBS Pass is **now** (2026-09-09).

## HEVC SPS RBSP unescape 2026-08-29 (pulled main)

## HEVC SPS RBSP unescape 2026-08-29 (pulled main)
Far-device `fix(srt): unescape HEVC SPS so WebCodecs can copy-decode DJI`.

- Annex-B EPB `0x000003` was parsed into `hev1.*` → WebCodecs rejected → transcode.
- `unescapeRbsp` before HEVC SPS/VPS PTL. Feed AUs stay Annex-B (no `description`).
- Intended live path: ffmpeg **`-c copy`** + WebCodecs **HEVC** (D3D11VA / VCN). `transcodeToH264` only on true unsupported or ~2.5 s `decoded=0`.
- No Store pack. No raw-frame IPC. No shared GPU. Electron stays the shell.

## Keep-PTS accepted 2026-08-28 (BW)
`done/DSP-SRT-20260828-01`. Transcode: `-copytb 1` + `-enc_time_base 1:90000`. Copy path untouched. File round-trip kept muxer PTS. Live ~34 s extra is operator + OUT-05 PES identity. No `setpts` / `setts` next.

## Role
SRT Ingest Orchestrator (`SRT`). Caller, catalog, ffmpeg TS, demux/decode, HEVC fallback, Race ops SRT HUD. New workers: `DSP-SRT-*`. Historical SRT code shipped as `DSP-OUT-03`…`09`.

## Locks
- Caller, DJI only, catalog 1–27 @ `49.13.20.49:9000`, `read:camN:pubN:<token>`
- Empty / dummy `host` template → catalog
- No `%3A` in `streamid`; never log tokens
- HEVC on wire; WebCodecs HEVC after RBSP-unescaped `hev1` (2026-08-29). ffmpeg→H.264 on WebCodecs fail or live `decoded=0` stall (~2.5 s)
- Transcode must keep **muxer 90 kHz PTS** (not a new origin). Colour bars ≠ drone. Cap 4. Present 100–400 ms
- No Store HEVC pack. No WHEP. No `STUDIO_TICK_FPS = 60`

## Leftovers (not this dispatch)
- Electron `desktop/srtHelpers.cjs` `redactSrtUrl` may still be passphrase-only on some log paths
- PLT: vendor gyan **full** `ffmpeg.exe` (libx264) in extraResources — still needed for fallback
- Confirm Race ops: `codec=hevc`, no `ffmpeg→h264`, PTS still maps (TEL-04)

## Handoffs / dispatches
- `HO-BW-SRT-20260828-01` / `DSP-SRT-20260828-01` **accepted**
- 2026-08-29 HEVC unescape: no DSP (direct `main` commit `1a4e0ae`)
