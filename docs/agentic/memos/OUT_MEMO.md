# OUT_MEMO

**Last updated:** 2026-08-28  
**Status:** Idle — TEL-04 landed; wait video-mode smoke (Sync `PTS → NTP`)

## LUT-miss plate accepted 2026-08-28 (BW)
- `done/DSP-OUT-20260828-08` — empty LUT (`toNtp` all null) → newest decoded frame, `reason: lut-miss-live`, `degraded`. OUT-03 stall-pin on empty LUT is **void**.
- Stall-pin 400 ms remains for telemetry stall **with a working LUT**, and for pose-not-yet-covered mapped frames.
- Healthy LUT + pose: adaptive 100–400 unchanged. LUT extra still 2 s.
- Suite **910 + 23**. Overlay free-run is TEL-03.

## Accepted 2026-08-28 night (BW) — OUT-07
- `done/DSP-OUT-20260828-07` — 2D deferred off the FBO tick; worker + transferable; fail closed + `NDI_2D_SYNC_CAPTURE_NOTE`. Still on@30. Suite **909 + 23**.
- `done/DSP-OUT-20260828-04` — one FBO/tick; `STUDIO_TICK_FPS=60`; 2D on @ 30
- `done/DSP-OUT-20260828-05` — PES `presentedPts90k`; LUT reset on H.264 fallback; Sync last pacing
- `done/DSP-OUT-20260828-06` — superseded by **OUT-07** (never started)

## GPU idle leftover (BW)
**Closed in code** by OUT-07. Human: Send ~30/30/30, hitch ~0, 2D on. Watch console for the sync-capture note.



## Phase 17.6 accepted 2026-08-28 (BW)
- `done/DSP-OUT-20260828-03` — `lookupPts90k`: exact or nearest ±32 µs, then consume; miss → `pts90k` null (never WebCodecs µs as 90 kHz).
- `pickPresentationPts` all `toNtp` null → stall-pin **400 ms** (same as pose stall), not newest. Single-frame queue still shows that frame.
- Adaptive 100–400 unchanged when LUT works. HEVC→H.264 `-copyts` untouched.
- Suite **896 + 23** / build green. Handoff: `HO-BW-OUT-20260828-03`.
- **Human:** Sync PTS must be 90 kHz-shaped (not ~1e6); Latency PINNED ceiling when no anchors.

## Studio 30 accepted 2026-08-28 (BW)
- `done/DSP-OUT-20260828-01` — WebGL2 `PIXEL_PACK_BUFFER` + fence; AR/3D `createNdiAsyncReadback`; 1 studio tick latency; fail closed to sync + `NDI_SYNC_READBACK_NOTE`. 2D left sync `getImageData`.
- `done/DSP-OUT-20260828-02` — AR/3D/2D default **30**, 2D boot **on** (toggle still 2D-only). Stagger: async claims share a tick; two **blocking** sync readbacks still refused. `STUDIO_TICK_FPS` 30. Never 60.
- Suite **887 + 23** / build green. **Human:** Output rail Send ~30/30/30 + hitch/s ~0. Do not silent-fallback 3D to 10.
- Handoffs: `HO-BW-OUT-20260828-01`, `HO-BW-OUT-20260828-02`, `HO-BW-PRF-20260828-06`.

## Phase 17 follow-up accepted 2026-08-26 (BW)

- Electron HEVC: WebCodecs often cannot decode HEVC (unbranded Chromium). **No Store pack required.** Fallback is ffmpeg HEVC→H.264 (`transcodeToH264`, `-copyts`, `repeat-headers=1`) on explicit `HEVC not supported` **or** live SRT with bitrate and `decoded=0` for ~2.5 s. Race ops shows `codec` / `demux` / `decoded`; silent colour bars were a HUD hole (`SRT lastError` stayed null). `streamid` is serialized without `%3A`.
- Dummy `srt://host:…` template is treated as empty (catalog). Live SRT situation is on **Race ops** + Fleet (state / kbps / decoded / redacted URL). Colour bars = no decoded frame, not the drone.
- **PRF** (2026-08-26) owns frame budgets / dual clock. **SRT** (2026-08-26) owns caller/catalog/decode. OUT owns NDI pumps, chroma, plate mode. Do not raise `STUDIO_TICK_FPS`.
- Catalog streamid lock **amended 2026-08-26 pm:** `read:camN:pubN:<token>` (was `publish:`). Same host/tokens. Path `/read:…` (and legacy `/publish:…`) still promoted to query.
- `done/DSP-OUT-20260826-09` — empty template → catalog cams 1–27 @ `49.13.20.49:9000`, query `streamid=read:camN:pubN:<token>`, `mode=caller`. Filled `{srtId}` template still wins. Unknown id → error. Leftover: Electron `desktop/srtHelpers.cjs` `redactSrtUrl` still passphrase-only.

## Phase 17.2 accepted 2026-08-26 (BW)

- `done/DSP-OUT-20260826-06` — in-repo TS demux + WebCodecs pipeline + 4-warm manager; PTS unwrap = TEL-01; HEVC probe-gated. Sink is `videoBackground.setTexture`. Live SRT picture-in-NDI **not smoked** (no relay token). HEVC HW **supported** on RX 6750 XT in Chromium. Counters on `getCounters(povId)`.
- `done/DSP-OUT-20260826-07` — shared `{srtId}` template + per-row SRT id (≠ telem id); Vid independent of Live WS; Connect SRT cap 4. Token session-only; Save redacts `streamid` last segment; never log composed URL. L8: video → env off on AR; 3D NDI still env-on. Sync debug: Output rail, off by default, DOM-only, never NDI.

## Phase 17.1 accepted 2026-08-26 (BW)

- `done/DSP-OUT-20260826-03` — ffmpeg `-c copy` byte pipe; native SRT addon rejected (Windows/Electron rebuild). `broadcastStudio.srt` + `getSrtBridge()`; cap 4; backoff; process-tree kill. PTS: `-c copy` + `-mpegts_copyts 1` + muxdelay 0. PLT later: vendor gyan **full** `ffmpeg.exe` in extraResources; SPA no-ops without Electron.
- `done/DSP-OUT-20260826-04` — in-WebGL pre-pass quad; `arBackground: alpha|video` (default alpha); Output toggle; 3D FBO suppressed via `isOpaque3dPassActive`. OUT-06 sink is `videoBackground.setTexture`. **Follow-up:** `preview` + `video` still mounts realistic env (opaque-safe); underlay is only clearly visible with transparent AR / env off — BW asking user before Wave 2.

## Phase 15.1 accepted 2026-08-18 (BW)

- `done/DSP-OUT-20260818-01-preview-60` — dual clock: **rAF preview when visible**, `studio:tick` ~30 for NDI + hidden. Do **not** set `STUDIO_TICK_FPS = 60`. AR pump is studio-tick air FBO (no `renderer.render` patch). Start **AR then 3D** for stagger. Caps unchanged: AR ~30, 3D ~10, 2D off@10. Ops HUD **preview** fps (1 s window). Terrain-tick skip not added. Electron 60 fps not smoked in worker; BW suite 600+23 / build green.

## Phase 13 follow-up — OUT-06 accepted 2026-08-12
- `done/DSP-OUT-20260812-06-ndi-capture-perf` — AR **30** / 3D **10** / 2D **off@10**;
  `tryClaimNdiHeavyCapture` stagger (AR wins shared tick, yields next). Suite 476+23.
  Soft escalate: default **3D NDI off** only if UI still unusable after smoke.

## Phase 13 — wave 3 accepted 2026-08-12
- `done/DSP-OUT-20260812-04` — local 2D/3D/AR switcher; never stops NDI; 3D local opaque + AR air-FBO
- `done/DSP-OUT-20260812-05` — per-channel delay; default 0 / max 30000 / warn &gt;3s; AR+3D+2D pumps
- Suite **461 + 23** green at wave-3 accept. Phase 13 OUT scope closed (perf follow-up above).

## Phase 13 — wave 3 issued 2026-08-12 (parallel) — accepted; see above
- Was: `DSP-OUT-20260812-04` + `-05`

## Phase 13 — wave 2 accepted 2026-08-12
- `done/DSP-OUT-20260812-02` — continuous `3d` / `broadcast-web-3d`; `ndiOpaquePass` restore for AR;
  start order 3D→AR; soft follow-up: water may look static on 3D when AR is transparent (env only
  mounted during 3D FBO). Human vMix smoke recommended.
- `done/DSP-OUT-20260812-03` — `startStreamMapNdiPump` → `2d` / `broadcast-web-2d`;
  `STREAM_MAP_NDI_BRIDGE_SUPPORTED === true`; default on; **1920×1080 letterbox**; PiP-independent.
- Suite **439 + 23** green. Next held: **13.5** switcher · **13.6** delay.

## Phase 13 — wave 1 accepted / wave 2 issued 2026-08-12 — wave 2 done; see above
- **Accepted:** `done/DSP-OUT-20260812-01-multi-sender-ndi-bridge` — Map of `ar`/`3d`/`2d`; omit→`ar`;
  AR name still `broadcast-web`; preload API locked for pumps.

## Phase 13 — wave 1 issued 2026-08-12 — superseded
BW wrote [`docs/architecture/multi-output-streaming.md`](../../architecture/multi-output-streaming.md)
covering OUT's future scope: multi-sender NDI bridge (today's `desktop/ndiSender.cjs` is a single
`grandi` sender — this is the blocking prereq, 13.1), a bigger local 2D/3D/AR switcher that only
changes on-screen focus (never gates NDI — all channels always send), a per-channel NDI delay
buffer up to 30000 ms (memory cost flagged: ~7.5 GB/channel for a full 30 s buffer at 1080p —
needs a mitigation decision before dispatch, see doc §4), and the resolution ask (`1080×1920` —
literally portrait, opposite of today's `1920×1080` lock — flagged for confirmation). Note: the
"3D channel" (13.2/13.3) is **not** a new render pipeline — SCN adds a sea/sky model to the
existing scene, OUT just wires that same render (opaque clear variant) to its own NDI sender;
13.3 is OUT-only, no joint SCN dependency beyond 13.2 landing first.

## Phase 11 (accepted)
- **11.5** `done/DSP-OUT-20260811-01` — NDI controller tab (2nd map source stubbed)
- **Follow-up** `done/DSP-OUT-20260811-02` — output mode in Ops sidebar (`mountAt: 'start'`); fixed canvas chrome removed; WHEP status co-located; NDI air lock unchanged

## Standing decisions
- NDI / transparent plate = **active POV** only (dual-render)
- Air-target readback: `bottomUp: true`
- Preferred air: Electron + alpha NDI
- Stream map not burned into primary AR NDI; own channel `'2d'` instead
- Three studio sources: `broadcast-web` (AR) · `broadcast-web-3d` · `broadcast-web-2d`

## Soft follow-up (optional)
Realistic water `tick` while AR is transparent (env only mounted during 3D FBO today → static water
on `broadcast-web-3d`) — SCN visibility/mask follow-up if needed.

## Phase 10
10.3 NDI studio smoke — **Pass**. V1-C still needs BW **10.1** human cutover.
