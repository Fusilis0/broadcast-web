# SRT_MEMO

**Last updated:** 2026-09-07  
**Status:** Phase **22** (after 20–21): **three** SRT callers AR/3D/2D; NDI parked. VPS TBD. Ingest locks unchanged.

## 2026-09-07 — SRT program out (operator)

Race day: SRT on **LAN**. Tests: network later (VPS TBD).

**Approach (Phase 22):** **three** callers AR/3D/2D. ffmpeg children, `h264_amf`, not NDI pack. NDI code kept, unused on air. Design: `docs/architecture/srt-egress.md`. No DSP until Phase 20–21 done.

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
