# SRT_MEMO

**Last updated:** 2026-09-02  
**Status:** Idle — present() snap-to-next shipped; diag `6099188` reverted (`23c37e7`)

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
