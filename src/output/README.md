# output

Owned by **OUT**. Canvas clear modes, visual timecode, WebRTC WHEP underlay / later egress, Electron NDI frame pump.

## Clear modes

| Symbol | Role |
| --- | --- |
| `normalizeOutputMode(raw)` | `preview` \| `chroma` \| `transparent`; unknown → `preview` |
| `resolveClearAppearance(mode, options?)` | Mode → `{ color, alpha }` |
| `applyOutputMode(renderer, mode, options?)` | `renderer.setClearColor` |
| `startOutputModeControl(options)` | Runtime Ops toggle (sidebar; not persisted) |
| `arBackground` / `normalizeArBackground` | `'alpha'` (default, today's plate) \| `'video'` (in-WebGL fullscreen quad). Unknown → `'alpha'` |
| `startArBackgroundControl(options)` | Runtime Ops toggle in the Output section (not persisted) |
| `startVideoBackground(options)` | Wrap `renderer.render`: draw a texture **before** the scene (NDI-visible). `setTexture(null)` → no draw |

Mount: `opsSectionEl` in the unified ops sidebar (**Ops** section, above mode/POV —
`mountAt: 'start'`). No fixed canvas-corner chrome. WHEP status hint still appends to the
same `.output-mode-control` root (looked up after mount; video underlay stays on `app`).
NDI / air camera lock is unchanged — this control is DOM-only.

### In-WebGL AR background (Phase 17.1)

The AR NDI pump reads an offscreen FBO (WebGL2 PBO via `createNdiAsyncReadback`; Send checked ⇒ pack that RT. Skip is one busy tick — not skip-forever. Sync `readRenderTargetPixels` is debug/`forceSync` only). A DOM `<video>` (WHEP)
never appears in that frame. `startVideoBackground` draws a fullscreen ortho quad **inside**
the render wrap, before the scene, with `autoClear = false` around the scene call.

Install order (load-bearing):

1. `startVideoBackground` (innermost — draws **before** the scene)
2. `startVisualTimecode` (optional post-pass — **skipped** when `timecodeEnabled` is false)
3. NDI pumps bind `renderer.render` last (video-background wrap when the barcode is off; both wraps when it is on)

`shouldDrawVideoBackground` gates the quad: `arBackground === 'video'`, texture present,
not a 3D NDI opaque pass (`isOpaque3dPassActive`), and on the **screen** pass only when
local focus is AR **and** preview camera === air camera. AR NDI (FBO) still draws when
ops is on free cam. Fit uses the **drawing buffer** (`canvas.width` / `height`), `cover`
(default) or `contain`. Sampled textures get `THREE.SRGBColorSpace`.

OUT-06 drives frames with `handle.setTexture(tex | null)` — same call as the colour-bar
test pattern used until decode exists. `stop()` restores the original `renderer.render`
and does **not** dispose the caller's texture.

Mount: `opsSectionEl` in the unified ops sidebar (**Ops** section, above mode/POV —
`mountAt: 'start'`). No fixed canvas-corner chrome. WHEP status hint still appends to the
same `.output-mode-control` root (looked up after mount; video underlay stays on `app`).
NDI / air camera lock is unchanged — this control is DOM-only.

### Local channel switcher (Phase 13.5)

| Symbol | Role |
| --- | --- |
| `startLocalChannelSwitcher(options)` | Big **2D / 3D / AR** buttons — which channel fills the **local** window |
| `resolveLocalFocusPresentation(focus, arOutputMode)` | Pure screen plan (WebGL vs map, opaque vs AR clear) |
| `localFocusNdiInvariant` | Documents that focus changes never request `ndi.stop` |

**Compose with `outputMode`:** switcher = *which* channel you see; `outputMode` = *how* the
AR channel clears (`preview` / `chroma` / `transparent`). Changing local focus does **not**
start/stop AR, 3D, or 2D NDI pumps (the NDI tab’s 2D checkbox remains the only opt-out for
channel `'2d'`).

| Local focus | Screen | NDI |
| --- | --- | --- |
| **AR** | WebGL with `outputMode` clear (transparent air plate when `transparent`) | All three keep sending |
| **3D** | WebGL opaque + `setEnvironmentOpaqueClearSafe(true)` (matches 3D NDI look) | AR still alpha via forced air FBO + AR clear; 3D/2D unchanged |
| **2D** | Stream map large (not PiP-only); WebGL hidden | AR/3D/2D pumps keep running |

Mount: overlay strip (`.local-channel-switcher-strip`) above the canvas — DOM-only.

| Symbol | Role |
| --- | --- |
| `PREVIEW_CLEAR_COLOR` | `0x1a1a1a` (dark ops) |
| `DEFAULT_CHROMA_KEY` | `0x00ff00` — RGB `(0, 255, 0)` |
| `TRANSPARENT_CLEAR_COLOR` | `0x000000` with **alpha 0** (NDI plate) |

### Config

- `outputMode`: `"preview"` (committed default), `"chroma"`, or `"transparent"`.
- Optional `chromaKey`: `"#00ff00"` (or equivalent) when mode is chroma.
- `arBackground`: `"alpha"` (committed default — transparent plate) or `"video"`
  (in-WebGL underlay, visible in AR NDI). Unknown / missing → `"alpha"`.

| Mode | Clear | Studio use |
| --- | --- | --- |
| `preview` | Dark opaque | Ops; optional WHEP underlay |
| `chroma` | Green opaque | Fallback Chrome window capture + key |
| `transparent` | Alpha 0 | Electron → named alpha NDI |

## Visual timecode

Unity-compatible **8×8 LSB** black/white barcode burned into the **same WebGL canvas** (orthographic overlay after the main scene). Canvas-only capture and NDI readback include it; no sibling DOM canvas.

**Phase 19.1:** default **off**. The overlay is not installed unless `timecodeEnabled` is true. Code and tests remain so a pack or `config.json` can turn it back on.

| Symbol | Role |
| --- | --- |
| `encodeVisualTimecodeBits(ms)` | Pure 64-bit pattern, LSB at index 0 |
| `encodeVisualTimecodeRgba(ms)` / `writeVisualTimecodeRgba` | RGBA8888 for `DataTexture` |
| `startVisualTimecode(options)` | Overlay + `telemetryBus` drone `ts` source |

### Encode contract (Unity parity)

- Index `0` = bit 0 (LSB) = **bottom-left**; rows left→right, bottom→top
- Index `63` = bit 63 (MSB) = top-right
- White = 1, black = 0; **NearestFilter** (point sampling)
- Re-upload only when the resolved timestamp changes

### Timestamp source

- Prefer active POV drone packet `ts` (`getActivePovId` + `telemetryBus`)
- Fallback: latest drone `ts` across ids (Unity `useGlobalLatest` analogue)

### Config

- `timecodeEnabled`: default **`false`** (Phase 19.1 — barcode hidden on preview and NDI). Modules, tests, and the boot wrap stay. Restore with `"timecodeEnabled": true` in `public/config.json` **or** a race pack `output.timecodeEnabled: true` (pack `true` still installs the wrap and burns the barcode into NDI readback).
- `timecodeCorner`: `"bottom-right"` (default) \| `"bottom-left"`
- `timecodeSizePx`: on-screen size (default `96`, clamped 32–256)

## WHEP underlay

Browser **MediaMTX WHEP** video under the Three canvas in **preview** only. Soft-fails when URL empty or server unreachable. **Stopped** in `chroma` and `transparent`.

| Symbol | Role |
| --- | --- |
| `normalizeWhepUrl(raw)` | Trim; empty → idle |
| `shouldRunWhepUnderlay(url, mode)` | Non-empty URL **and** `preview` |
| `startWhepUnderlay(options)` | Connect / reconnect / status DOM; `getVideoElement()` for future CV |
| `formatWhepStatusLabel(status)` | `whep=off\|connecting\|live\|error` |

### Config

- `whepUrl`: full WHEP POST URL. Default `""` (idle). Non-empty enables underlay in preview only.

## Electron NDI frame pump (path A)

| Symbol | Role |
| --- | --- |
| `getStudioBridge()` | `window.broadcastStudio` when preload injected |
| `NDI_CHANNEL_IDS` / `DEFAULT_NDI_CHANNEL` | `'ar' \| '3d' \| '2d'`; default air = `'ar'` |
| `startDualFrameClock({ subscribeStudioTick })` | Dual clock: **preview** = rAF when visible, `studio:tick` when hidden; **NDI** subscribers always `studio:tick` (60 Hz). Preview is not 60 from `STUDIO_TICK_FPS`. |
| `startNdiFramePump({ renderer, scene, getAirCamera?, prepareCameraPass?, getAirPlateClear?, fps?, … })` | After **video background** then optional timecode: studio-tick air FBO → GPU Y-flip → PBO pack (Send checked ⇒ send; skip one busy tick if PBO cannot pack; not sync `readRenderTargetPixels`) → deferred IPC → main `grandi` **UYVA** send on channel (default `'ar'`); packed bytes top-down; default **30 fps**; does **not** patch `renderer.render` (preview rAF stays clean); start **before** 3D |
| `startNdi3dChannelPump({ renderer, scene, getAirCamera, setEnvironmentOpaqueClearSafe, fps?, … })` | Channel `'3d'` (`broadcast-web-3d`): opaque clear + `opaqueClearSafe(true)` → active-POV FBO → full-size RGBA PBO (Send checked ⇒ send; skip one busy tick if pack fails) → UYVY on the existing worker (CPU pool if missing); studio tick; default **30 fps**; independent of AR on the PBO path; start **after** AR pump |
| `createNdiCaptureFlip` / `ndiCaptureFlipBlitRect` | AR/3D only: WebGL2 `blitFramebuffer` with inverted dest Y into a second colour FBO (sRGB-pinned, RGBA, no depth). Apply on create **and** resize. Call after the scene pass, **before** `readback.begin`. Not used on 2D. |
| `createNdiAsyncReadback` / `probeNdiPboReadback` | **Send checked ⇒ that channel sends.** Live path is WebGL2 PBO. Spy `gl.bindFramebuffer` during `setRenderTarget` (and once on the same `gl`) and PBO-read the last non-null DRAW/`FRAMEBUFFER` handle Three bound — r178 does not publish `__webglFramebuffer` / `__webglTexture`, and ANGLE `getParameter(DRAW)` is null. If the spy sees only null, attach `rt.texture` to an OUT-owned READ FBO when that handle exists, else skip **this tick**. Do not skip-forever, do not `readRenderTargetPixels`. Never PBO a half-width dest; never pack the default canvas FB as UYVY. Skip is **one** busy tick (no slot / fence / spy+texture missing) — skip ≠ policy. Yellow **SYNC READBACK** banner = a **live enabled** channel actually used emergency sync (hidden when all Send boxes are off). Caps AR/3D/2D **30**; v1 still three outputs; this slice is not 30×3. Check `canBegin` before the 1080p render. |
| `createNdi2dAsyncCapture` / `probeNdi2dWorkerCapture` | 2D worker: native-size `createImageBitmap` + typed-array letterbox blit into a pooled **1920×1080** RGBA buffer (never `getImageData` of the destination). Fail closed to the same blit on-thread + `NDI_2D_SYNC_CAPTURE_NOTE`. Buffer is transferred (no extra `slice`). |
| `tryClaimNdiHeavyCapture` / `NDI_HEAVY_STAGGER_MS` | **Sync `readPixels` fallback only.** PBO path does not arbitrate. 2D is not an FBO. |
| `createNdiCaptureGate` | Phase-accumulate rate gate (~32 fps nominal, half-tick tolerance, no catch-up burst). |
| `snapshotClearPass` / `applyOpaque3dPassState` / `restoreClearPass` / `isOpaque3dPassActive` | Pure clear + SCN opaque-gate helpers around the 3D pass; `isOpaque3dPassActive` gates the AR video background off the 3D FBO |
| `startStreamMapNdiPump({ getSourceCanvas, ensureDrawn?, enabled?, fps?, delayMs? })` | Channel `'2d'` (`broadcast-web-2d`): letterbox map canvas → **1920×1080**; `studio:tick` **schedules** only; grab is deferred/async CPU. Default **on** @ **30 fps**. `recordNdiCapture('2d')` only after a successful grab; HUD `captureTicks 2d missed (no record)` means no grab while Status was live (usually AR/3D sync readback starving the thread). Empty source canvas while live → pump error (not silent live). Empty **course/boats** on the local 2D view is **SCN**. |
| `letterboxRect` / `STREAM_MAP_NDI_CHANNEL` | Pure fit math; channel id `'2d'` |
| `NdiDelayBuffer` / `clampNdiDelayMs` / `normalizeOutputDelayMs` | Per-channel RAM delay ring (0–30000 ms); **bypass + no allocation at 0** |
| `estimateNdiDelayBufferBytes` | `width×height×4×ceil(delayMs/1000×fps)` — 1920×1080 @ 30 fps × 30 s ≈ **~7.5 GB/channel** |
| `startLocalChannelSwitcher` / `resolveLocalFocusPresentation` | Local 2D/3D/AR window focus (Phase 13.5) — never stops NDI |
| `startNdiControllerPanel({ …, getDelayMs?, onDelayMsChange? })` | Ops sidebar **NDI** tab — per-channel status + delay inputs + live **Send** fps (1 s successful-send counter; **0 fps** when live but silent, not em-dash); hand toggles pause/resume AR/3D/2D independently (session-only; default all **on**) |
| `loadNdiChannelWanted` / `saveNdiChannelWanted` | Session-only AR/3D/2D wanted flags (`sessionStorage`); never race/`project.json` |
| `resolveNdiAirIndicator` | Pure `unavailable` \| `stopped` \| `starting` \| `live` \| `error` (AR / 3D pumps) |
| `resolveNdiChannelIndicator` | Per-channel indicator including `idle` (2d uses stream-map pump when provided) |
| `STREAM_MAP_NDI_BRIDGE_SUPPORTED` | `true` (Phase 13.4) — studio enables AR/3D/2D hand toggles (Phase 19.4; default all **on**) |
| `isAirCameraLocked` / `shouldForceFollowActivePov` | Studio bridge **or** `transparent` → air framing locked |
| `planNdiCapture` | Same camera → FB readback; preview ≠ air → dual-render FBO (helper; AR pump always FBO-captures on studio tick) |
| `STUDIO_OUTPUT_WIDTH/HEIGHT` | Electron lock **1920×1080** (AR/3D drawing buffer **and** 2D NDI letterbox target) |
| Visual timecode layout | Drawing-buffer space (size stable when window CSS scales) |
| Studio frame clock | Dual: ops preview **rAF** when the window is visible (~display refresh / 60); `studio:tick` **60 Hz** for NDI pumps (independent AR/3D clocks → Send ~30) and for preview when minimized / `document.hidden`. Main-process tick is not throttled when parked. |

No-ops in Chrome (no bridge). Shell + run notes: [`desktop/README.md`](../../desktop/README.md). vMix: [`docs/ops/vmix-ndi-alpha-runbook.md`](../../docs/ops/vmix-ndi-alpha-runbook.md). Contract: [`docs/architecture/ndi-alpha-electron.md`](../../docs/architecture/ndi-alpha-electron.md).

## SRT ingest bridge (Phase 17.1)

Electron main dials `srt://…` as **caller** and forwards **raw MPEG-TS** bytes
over IPC. Demux/decode is renderer-side (`createTsDemuxer` / `startVideoStreamManager`).
Plain browser: `getSrtBridge()` is `null`.

| Symbol | Role |
| --- | --- |
| `getSrtBridge()` | `window.broadcastStudio.srt` when preload injected; else `null` (must not throw) |
| `validateSrtUrl(raw)` | Caller `srt://host:port` only; listener / non-srt fail |
| `mergeSrtUrlOptions(href, opts)` | `streamid` / `latency` (µs) / `passphrase` on the URL query |
| `normalizeSrtStatus(raw)` | `idle \| connecting \| live \| error` |

Do not route this path through WHEP/WebRTC — that restamps clocks and drops
muxer PTS (`ar-video-underlay-ntp-sync.md` §3.1). Native dep + argv:
[`desktop/README.md`](../../desktop/README.md) § SRT ingest.

### Per-POV SRT config + sync debug (Phase 17.2)

| Symbol | Role |
| --- | --- |
| `buildSrtCallerUrl(template, srtId)` | Substitute **every** `{srtId}` (and `{id}` alias). Empty id → do not open. Listener rejected. Telemetry `povId` is **not** used. Path `/read:camN:…` (or `/publish:…`) is promoted to query `streamid` |
| `resolveSrtUrlForId(srtId)` | Hardcoded cam **1–27** catalog → caller at `49.13.20.49:9000` with `streamid=read:camN:pubN:<token>`. Empty template uses this; filled `{srtId}` template is the escape hatch. Unknown id → error |
| `redactSrtUrl` / `redactSrtTemplateForPack` | Never log the composed `streamid` token **or** a path-style `read:` / `publish:` token; pack save strips it |
| `resolveOpaqueClearSafeForVideo` | **L8:** `arBackground: video` + AR focus/plate → `opaqueClearSafe = false` (ocean/sky off). 3D NDI still forces env on during its FBO |
| `startSyncDebugPanel` | Ops **Output** section, **off by default**, DOM-only. Never on the AR plate / NDI |

**Fleet / Live:** per-drone **SRT id** beside the telemetry id; **Vid** checkbox independent of Live WS — while SRT is connected, uncheck closes that POV now (check opens it). **Connect SRT** looks the id up in the cam 1–27 catalog when the template is empty *or* is the dummy `srt://host:…` placeholder. **Disconnect SRT** (beside Connect) closes every caller, kills ffmpeg, and stays down: the decode-stall watchdog and HEVC→H.264 fallback must not reopen until the next Connect. Cap 4 callers. Per-POV status is idle / connecting / live with bitrate / retrying / closed. Live SRT state is shown in **Race ops** and under Connect SRT. Race pack: optional `output.srtUrlTemplate` + `output.srtByPovId` (soft; old packs unchanged). Relay token is **session-only**. Never log `streamid` or passphrase.

After an **explicit** Disconnect the AR underlay restores the colour-bar test pattern (the existing “not a live picture” placeholder). Repeating the last decoded frame is for mid-show dropouts only — a connection the operator killed must not look live. Renderer `beforeunload` calls `bridge.close('all')` so a reload cannot leak `ffmpeg.exe`.

LUT key defaults to the SRT id (camera number on the wire), not `povId`.

### MPEG-TS demux + WebCodecs decode (Phase 17.2)

Raw `srt:data` → in-repo video-only TS demuxer → `VideoDecoder` (Annex-B, **no**
`description`) → presentation queue → `videoBackground.setTexture`. PTS is never
rewritten: PES 33-bit → unwrap (TEL-01 `ptsDiff33`) → `EncodedVideoChunk.timestamp`
(µs) only; queued / `presentedPts90k` is `maskPts33` PES so LUT `toNtp` unwraps
once. HEVC→H.264 fallback resets that POV’s PtsNtpMap (ffmpeg argv is SRT-01).
On-wire codec is **HEVC** (L6); H.264 remains a working
fallback. Probe `isConfigSupported` with `prefer-hardware` before configure;
unsupported HEVC is the ops error
`HEVC not supported on this GPU/driver…`. Electron then (and on a live
`decoded=0` stall) ffmpeg-transcodes HEVC→H.264. Race ops shows `codec`,
`demux`, `decoded`. Electron must enable
`PlatformHEVCDecoderSupport` (`desktop/main.cjs`); H.264 does not need it.
(not a black frame).

| Symbol | Role |
| --- | --- |
| `createTsDemuxer()` | PAT/PMT, PES, exact PTS, mid-stream join, leftover across chunks |
| `createPtsUnwrapper()` | 33-bit wrap, same recurrence as `ptsNtpMap` |
| `createVideoDecodePipeline()` | Probe, wait-for-keyframe, queue, `VideoFrame.close()` accounting |
| `pickPresentationPts()` | Adaptive 100–400 ms (L4); telemetry stall pins at 400 ms + `degraded`. Empty LUT (`toNtp` all null) presents the newest decoded frame (`lut-miss-live`, degraded) — not stall-pin. |
| `startVideoStreamManager()` | `{ povId → pipeline + texture }`, warm cap **4**, LRU eviction. `dropPresented()` on explicit Disconnect; `resumeIngest()` on Connect |
| `WARM_STREAM_CAP` | 4 (L5). POV switch swaps the bound texture — no reconnect |
| `createSrtDisconnectHold` / `srtReopenAllowed` | Generation tag + stay-disconnected. Stall-fallback / H.264 `bridge.open` consult this; do not await ffmpeg teardown |

Presentation runs on `studio:tick` in Electron (NDI cadence unchanged). A video
stall **repeats the last frame**; pumps keep sending. An **explicit Disconnect
SRT** is different: `dropPresented()` unbinds every slot and the colour-bar
placeholder returns so the frozen picture is not mistaken for live. OUT-07 opens
SRT URLs; this module only consumes arriving bytes. `VideoFrame.close()` is
mandatory on every skipped frame — missing it exhausts the decoder pool.

**No in-browser NDI** without the Electron bridge. Preferred studio air = Electron alpha NDI; Chrome chroma = fallback ([`docs/ops/air-runbook.md`](../../docs/ops/air-runbook.md)). Path B deferred.

**Lifecycle:** `startVideoBackground` **then** `startVideoStreamManager` **then** optional `startVisualTimecode` (only when `timecodeEnabled`) **then** `startNdiFramePump` (AR) **then** `startNdi3dChannelPump` (3D) **then** `startStreamMapNdiPump` (2D) in Electron. With the barcode off, NDI binds the video-background wrap directly — underlay still draws before the scene. Stop on `beforeunload` (stream manager, then timecode if started, then video-background so wraps unstack). Phase **19.4**: independent hand toggles for **AR / 3D / 2D** in the NDI tab pause/resume each sender (session/`sessionStorage` only — never `project.json`). Default all **on**.

### Capture rate / UI FPS (Phase 13 perf / preview 60 / Studio 30 Send / `DSP-OUT-20260828-04`)

AR/3D GPU readback is **pipelined** (WebGL2 PBO + fence; one frame of capture latency). **Send checked ⇒ send.** If PBO cannot pack this tick (busy / no slot), **skip that one tick** — not skip-forever, not hitch rAF with sync `readPixels`. Sync `readPixels` is debug/`forceSync` only. On the PBO path AR and 3D may both `directRender` on the same tick; UYVY/UYVA pack runs on the existing worker after `poll()`. `sendFrame` is deferred off the tick. 2D is CPU: deferred off that FBO tick (`setTimeout(0)`), native-size read + typed-array blit into 1920×1080 (worker + transferable; sync blit fallback). Still **on** @ 30. v1 still needs **AR + 3D + 2D** on air; unchecking Send is an ops workaround, not the plan. Three channels at 30 is the next OUT/PRF problem — this slice is not 30×3. Defaults:

| Channel | Enable default | FPS default | Notes |
| --- | --- | --- | --- |
| **Ops preview** | on (visible window) | **rAF ~60** | Local WebGL present only. Ops HUD **preview** row shows a 1 s smoothed fps; **hitch** is `dt > 50 ms` in the same window. Hidden/minimized → studio tick (60 Hz) so NDI does not freeze. Preview is not 60 from `STUDIO_TICK_FPS`. |
| **AR** | on (session) | **30** | Air path on `studio:tick` at 60 Hz; independent of 3D on PBO |
| **3D** | on (session) | **30** | Always-on; same-tick FBO with AR on PBO; Send is not 60 |
| **2D** | **on** | **30** | Toggle in NDI tab stops **only** this sender. Deferred/async CPU grab; not an FBO slot. |

Live **Send** fps on the Output rail is a 1 s counter of successful `sendFrame` calls (`getSendFps()`). It is **not** the cap: defaults stay AR **30** / 3D **30** / 2D on@30. The capture gate targets ~32 fps nominal so the 1 s readout never shows 29. `STUDIO_TICK_FPS` is **60**.

Do not raise NDI **Send** to 60.

### NDI FourCC per channel (Phase 19.3)

| Channel | Packed bytes | FourCC on the wire | Notes |
| --- | --- | --- | --- |
| **AR** `broadcast-web` | `width×height×3` | **UYVA** | UYVY + alpha plane. Keys in the switcher. Worker/CPU pack. |
| **3D** `broadcast-web-3d` | `width×height×2` | **UYVY** | Packed UYVY from full-size scene RGBA unless READ-verified GPU dest. Live path: `readback.begin(fbo)` + `createNdiPackPool('uyvy')`. Do not skip CPU pack because `w*2===srcW`. |
| **2D** `broadcast-web-2d` | `1920×1080×2` | **UYVY** | Worker/CPU pack; letterbox. |

Green/purple vertical stripes = packed 4:2:2 shown as RGB (FourCC ≠ bytes). Do not “fix” that in OBS. Electron log line: `NDI[3d] FourCC UYVY 1920x1080 stride=3840 bytes=4147200`.

If hitch/s explodes with all three sending, escalate to OUT/PRF — do **not** silently drop a channel or fall back to 10 fps 3D. Low GPU % with hitch means JS blocked, not a weak card.

### NDI delay buffer (Phase 13.6)

Per-channel adjustable delay so studio can time-align NDI against a delayed camera feed.

| Lock | Value |
| --- | --- |
| Default | **0 ms** — immediate send; **no ring allocated** |
| Max | **30000 ms** (UI + API clamp) |
| Soft warn | UI shows **high memory** when delay **> 3000 ms** (still allowed up to max) |
| Channels | Independent knobs: `ar` / `3d` / `2d` |

**Memory formula:** `width × height × 4 × ceil(delayMs/1000 × fps)` bytes per channel. At studio lock 1920×1080 RGBA @ 30 fps, 30 s ≈ **~7.5 GB per channel** (~22 GB if all three sit at max). Shrinking delay (or setting 0) **drops buffered frames** immediately.

**Config (optional):** `outputDelayMs: { "ar": 0, "3d": 0, "2d": 0 }` in `config.json`. Live changes via NDI tab do not require restart and are not persisted.

**Sidebar invariant:** the NDI tab is DOM-only. AR/3D capture still uses WebGL FBO readback only (PBO; skip one busy tick — not skip-forever) — collapsing the ops sidebar must not change air pixels (`docs/architecture/unified-ops-sidebar.md` §2). 2D NDI samples the stream-map **canvas bitmap** (not sidebar chrome). Regression: `ndiControllerPanel.test.ts` + `ndiOpaquePass.test.ts` + `streamMapNdiPump.test.ts` + `ndiDelayBuffer.test.ts` + `sidebar/sidebar.test.ts`.

### Air camera lock (NDI = active POV)

**Contract:** AR **and** 3D NDI always frame the **active POV** camera — the operator-selected drone cam via POV switch / Fleet **Cam**. Ops free cam (SCN) may drive the **on-screen** preview only; it must not change NDI framing.

| Situation | Behavior |
| --- | --- |
| Screen camera = active POV (`view=follow`) | Preview rAF presents follow cam; AR NDI FBO-captures active POV on studio tick |
| Screen camera ≠ active POV (`view=free`) | Preview rAF presents free cam; **AR** FBO-captures active POV on studio tick. **3D** always FBO-captures active POV on studio tick |
| Studio Electron **or** `outputMode=transparent` | Air locked (`isAirCameraLocked`); free cam may still orbit — AR/3D NDI stay on active POV |

Wire AR: `startNdiFramePump({ scene, getAirCamera: () => scene.getActivePovCamera(), prepareCameraPass: (c) => scene.orientOpsBillboards(c) })` — studio tick, always air FBO + AR plate clear. Wire 3D: `startNdi3dChannelPump({ scene, getAirCamera, setEnvironmentOpaqueClearSafe, getEnvironmentOpaqueClearSafe, … })` — each tick sets opaque clear + `opaqueClearSafe(true)`, renders active POV to FBO, then restores so transparent AR never bakes sea/sky. Start AR **before** 3D (subscriber order unchanged; stagger is sync-fallback only). SCN: `getActivePovCamera()` / `getPreviewCamera()` / `orientOpsBillboards` / `setOpsViewMode` / `setEnvironmentOpaqueClearSafe`; free cam must not mutate `activePovId`.

## Stream 2D map (SCN) vs plate capture

SCN Phase **8.1** ships a CSS overlay stream map (`createStreamMap2d`). Phase **19.2** removed the PiP card and ops checkbox. It does not steal the air camera.

| Clear / path | Map in capture? |
| --- | --- |
| Preview | Local **2D** focus only (no PiP over 3D/AR) |
| Chroma (window capture) | Same — map is off-screen unless local 2D |
| Transparent + Electron **AR** NDI (`broadcast-web`) | **No** — AR pump uses WebGL `readPixels` only (no map burn-in) |
| Electron **2D** NDI (`broadcast-web-2d`) | **Yes** — separate sender; 16:9 source is **1920×1080** (`letterboxRect` identity); works while the local host is off-screen |

**Decision (Phase 11 / `DSP-OUT-20260811-01`, bridge Phase 13.1, pump Phase 13.4 / `DSP-OUT-20260812-03`, perf `DSP-OUT-20260812-06`, PiP removal `DSP-SCN-20260829-03`):** stream map stays off the primary air NDI plate. Channel `'2d'` is independently toggled (`STREAM_MAP_NDI_BRIDGE_SUPPORTED === true`; studio default **on**). Toggle affects **only** the 2D sender.

**Resolution choice:** 2D frames match the studio lock **1920×1080** (same as AR/3D). Native source is **16:9 1920×1080**; `letterboxRect` stays as a safety net for other sizes. Pump architecture unchanged.

## Out of scope (later)

- NTP / `stream_anchor` status TMP line
- Decoder / CV reader (use `getVideoElement()` when ready)
- App WebRTC/SRT **egress** (Phase 5.4 eval: defer; use vMix/OBS program out for remote) — [`docs/ops/egress-webrtc-srt-evaluation.md`](../../docs/ops/egress-webrtc-srt-evaluation.md)
- Native NDI helper (path B — only if A blocked)
- GPU zero-copy NDI
- Compressed / reduced-fps delay buffer (only if high-delay OOM forces it)
