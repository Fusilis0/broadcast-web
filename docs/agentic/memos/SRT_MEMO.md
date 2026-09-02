# SRT_MEMO

**Last updated:** 2026-09-02  
**Status:** Idle — no-click repro via `?arBackground=video&autoConnectLive=1&livePov=&autoConnectSrt=1&srtPov=` (diag; revert). present() skip already verified.

## no-click repro 2026-09-02
No existing query/config auto-connect. Checkboxes = sessionStorage tab cache (not restored as Connect). Connect SRT is an explicit `operatorConnected` hold. `arBackground` is `config.json` (`alpha`); URL had `outputMode` only. Order: Vid/Live checkboxes → Connect live and Connect SRT (independent) → AR video can be anytime (no SRT/autoplay gate; ffmpeg is main-process). `desktop/configFs.cjs` does not persist these. Diag query params; POV ids must be in the URL (no default POV in source).

## live verify log 2026-09-02 (4404a68, post tray-quit)
New session starts at log line 2751 (`sameFrameUpload` field). Steady HEVC copy, `decodedFps>20`, `kfRise=0`, **n=148 s**.

| Metric | Steady mean |
| --- | --- |
| ffmpeg | 29.69 fps / 0.982x / 0.007 CPU cores |
| ipcDropPerSec | 0.06 (10 drops whole session) |
| auFps / decodedFps / uniquePresentFps | **29.87 / 29.71 / 29.73** (unique/decoded = **1.001**) |
| presentHz | **58.80** (min 54.65, never <50) |
| reasonCounts | min-clamp **4468 (50.57%)**, repeat **4368 (49.43%)**. max-clamp/stall-pin/lut-miss-live/**other = 0** |
| AU per present | 0: 77.4%, 1: 2.0%, 2: 13.1%, 3: 7.6%, 4+: 0 |
| latency / queue | 113 ms / depth 5.4 |

First 20s rollup uniquePresent **13.93** is idle+connect dilution (~10 empty seconds). Seven later 20s windows unique **28.1–29.8**. Verdict **(c)**: present() unique tracks decode; studio:tick still feeds present() at ~59 Hz. Pre-restart HUD AR Send 10–19 / `arEnqueueIpc n≈11–13` is downstream NDI capture, not this skip bug. `droppedFps≈decoded` is prevPresented recycle (one drop per unique advance), not hole-skip.

## live verify after present() fix 2026-09-02
Running instance (no restart this pass): Electron `--dev` pid 29452 started 11:22:32; Vite pid 34280 since 08:54; HEAD `bdb4c73` 09:38:51, clean tree. Vite is serving `allowsCatchUpSkip` from `videoDecodePipeline.ts`. Packaged app is not in use.

Existing HUD (this process, SRT already connected): `pov 1 srt=1 live ~4.6–5.1 Mbps codec=hevc picture=yes err=Decoding error.` Cumulative demux/decoded ~25–28 fps session average (e.g. demux 10123 / decoded 9506 at ~6.5 min). **No `reason`, uniquePresent, dropped, or queueDepth** on the Race SRT HUD. Sync debug is off and below the NDI fold. NDI AR Send oscillating **10–19 fps**; `arEnqueueIpc n≈11–13`; `3dFboRender n≈21–25`; `2dGrab ~80ms n=6`; studio tick mean ~17ms but `>20ms` ~38%. `dropBusy=0`.

Cannot tell skip-vs-catch-up-vs-NDI from this HUD. Diag `diag:` commit restores ingest+decode logs plus per-reason counts / AU-per-present hist / uniquePresentFps. **Needs tray-quit (not park) + Connect SRT ~20s.** Do not patch `present()` until that log is read.

## present() 2:1 skip 2026-09-02
Live: copy HEVC ~30 decoded, `presentHz` ~60, `uniquePresentFps` ~14. Cause: `dropQueued` of every `pts < pick` when `frameAtLatency(100ms)` jumped two PTS steps on a decode burst. Fix: snap pick to the next queued PTS for `min-clamp` / `adaptive` / `fixed`; skip-jump only for `max-clamp` / `stall-pin` / `lut-miss-live`. Tests: paired 87/90 after (44/90 before), asymmetric 87/90 after (29/90 before), smooth already 87/90. Diag instrumentation reverted.

## FPS collapse bisect 2026-09-02 (measured)
`diag-srt-fps.log` after Electron restart + Connect SRT. First live run ~116s; `transcodeToH264=false` (bitstream copy), `codec=hevc`.

Steady seconds (`kfRise=0`, `decodedFps>20`, n=110): ffmpeg **29.60 fps** / **0.98x** / **~0.009 CPU cores**; `ipcDropPerSec` **0** (7 drops in the whole run); `auFps` **29.06**; `decodedFps` **29.06**; `droppedFps` **29.01**; `uniquePresentFps` **14.31**; `presentHz` **59.19**; `kfRise` **0**. Latency pinned ~100 ms; reason `min-clamp` / `repeat`.

Collapse is **presentation skip** (suspect 4), not ingest/IPC/tick/transcode. Brief HEVC `"Decoding error."` seconds dip decode further (secondary). Diag `6099188` reverted in `23c37e7`.

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
