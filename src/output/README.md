# output

Owned by **OUT**. Canvas clear modes, visual timecode, WebRTC WHEP underlay / later egress, Electron NDI frame pump.

## Clear modes

| Symbol | Role |
| --- | --- |
| `normalizeOutputMode(raw)` | `preview` \| `chroma` \| `transparent`; unknown → `preview` |
| `resolveClearAppearance(mode, options?)` | Mode → `{ color, alpha }` |
| `applyOutputMode(renderer, mode, options?)` | `renderer.setClearColor` |
| `startOutputModeControl(options)` | Runtime Ops toggle (sidebar; not persisted) |

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

| Mode | Clear | Studio use |
| --- | --- | --- |
| `preview` | Dark opaque | Ops; optional WHEP underlay |
| `chroma` | Green opaque | Fallback Chrome window capture + key |
| `transparent` | Alpha 0 | Electron → named alpha NDI |

## Visual timecode

Unity-compatible **8×8 LSB** black/white barcode burned into the **same WebGL canvas** (orthographic overlay after the main scene). Canvas-only capture and NDI readback include it; no sibling DOM canvas.

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

- `timecodeEnabled`: default **`true`** (ops on). Set `false` to disable.
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
| `startNdiFramePump({ renderer, getAirCamera?, prepareCameraPass?, forceAirTargetCapture?, getAirPlateClear?, fps?, … })` | After timecode: `readPixels` → IPC → main `grandi` BGRA send on channel (default `'ar'`); default **30 fps**; dual-render re-orients SCN billboards per pass; optional force air-target when local 3D opaque screen would pollute AR alpha |
| `startNdi3dChannelPump({ renderer, scene, getAirCamera, setEnvironmentOpaqueClearSafe, fps?, … })` | Channel `'3d'` (`broadcast-web-3d`): opaque clear + `opaqueClearSafe(true)` → active-POV FBO → restore; studio tick; default **10 fps**; start **before** AR pump |
| `tryClaimNdiHeavyCapture` / `NDI_HEAVY_STAGGER_MS` | Shared gate so AR + 3D never both sync-readback on the same tick (deferred 3D → AR yields next tick) |
| `snapshotClearPass` / `applyOpaque3dPassState` / `restoreClearPass` | Pure clear + SCN opaque-gate helpers around the 3D pass |
| `startStreamMapNdiPump({ getSourceCanvas, ensureDrawn?, enabled?, fps?, delayMs? })` | Channel `'2d'` (`broadcast-web-2d`): letterbox map canvas → **1920×1080**; studio tick; default **off** @ **10 fps** when enabled; independent of PiP visibility |
| `letterboxRect` / `STREAM_MAP_NDI_CHANNEL` | Pure fit math; channel id `'2d'` |
| `NdiDelayBuffer` / `clampNdiDelayMs` / `normalizeOutputDelayMs` | Per-channel RAM delay ring (0–30000 ms); **bypass + no allocation at 0** |
| `estimateNdiDelayBufferBytes` | `width×height×4×ceil(delayMs/1000×fps)` — 1920×1080 @ 30 fps × 30 s ≈ **~7.5 GB/channel** |
| `startLocalChannelSwitcher` / `resolveLocalFocusPresentation` | Local 2D/3D/AR window focus (Phase 13.5) — never stops NDI |
| `startNdiControllerPanel({ …, getDelayMs?, onDelayMsChange? })` | Ops sidebar **NDI** tab — per-channel status + delay inputs; 2D toggle starts/stops only `'2d'` (default **off**) |
| `resolveNdiAirIndicator` | Pure `unavailable` \| `stopped` \| `starting` \| `live` \| `error` (AR / 3D pumps) |
| `resolveNdiChannelIndicator` | Per-channel indicator including `idle` (2d uses stream-map pump when provided) |
| `STREAM_MAP_NDI_BRIDGE_SUPPORTED` | `true` (Phase 13.4) — studio enables 2D toggle (default **off** for UI FPS) |
| `isAirCameraLocked` / `shouldForceFollowActivePov` | Studio bridge **or** `transparent` → air framing locked |
| `planNdiCapture` | Same camera → FB readback; preview ≠ air → dual-render FBO |
| `STUDIO_OUTPUT_WIDTH/HEIGHT` | Electron lock **1920×1080** (AR/3D drawing buffer **and** 2D NDI letterbox target) |
| Visual timecode layout | Drawing-buffer space (size stable when window CSS scales) |
| Studio frame clock | Main-process `studio:tick` (~30 fps; not throttled when minimized) |

No-ops in Chrome (no bridge). Shell + run notes: [`desktop/README.md`](../../desktop/README.md). vMix: [`docs/ops/vmix-ndi-alpha-runbook.md`](../../docs/ops/vmix-ndi-alpha-runbook.md). Contract: [`docs/architecture/ndi-alpha-electron.md`](../../docs/architecture/ndi-alpha-electron.md).

**No in-browser NDI** without the Electron bridge. Preferred studio air = Electron alpha NDI; Chrome chroma = fallback ([`docs/ops/air-runbook.md`](../../docs/ops/air-runbook.md)). Path B deferred.

**Lifecycle:** `startNdi3dChannelPump` (3D) **then** `startNdiFramePump` (AR) **then** `startStreamMapNdiPump` (2D) run after scene + visual timecode boot in Electron and stop on `beforeunload`. AR/3D have no manual start/stop in v1 (session-tied). The **2D** toggle in the NDI tab enables/disables only channel `'2d'` (default **off** in studio — enable when needed).

### Capture rate / UI FPS (Phase 13 perf / `DSP-OUT-20260812-06`)

Sync WebGL `readPixels` / canvas `getImageData` stall the renderer main thread (sidebar feels frozen while Task Manager CPU looks calm). Defaults:

| Channel | Enable default | FPS default | Notes |
| --- | --- | --- | --- |
| **AR** | on (session) | **30** | Air path; may drop one frame when yielding to deferred 3D |
| **3D** | on (session) | **10** | Always-on at reduced rate; staggered vs AR |
| **2D** | **off** | **10** (when on) | One-click enable in NDI tab |

If UI is still unusable with these dials, escalate to BW — next lock is default **3D NDI off** (same pattern as 2D). Async PBO readback is stretch only.
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

**Sidebar invariant:** the NDI tab is DOM-only. AR/3D capture still uses WebGL `readPixels` / air FBO only — collapsing the ops sidebar must not change air pixels (`docs/architecture/unified-ops-sidebar.md` §2). 2D NDI samples the stream-map **canvas bitmap** (not sidebar chrome). Regression: `ndiControllerPanel.test.ts` + `ndiOpaquePass.test.ts` + `streamMapNdiPump.test.ts` + `ndiDelayBuffer.test.ts` + `sidebar/sidebar.test.ts`.

### Air camera lock (NDI = active POV)

**Contract:** AR **and** 3D NDI always frame the **active POV** camera — the operator-selected drone cam via POV switch / Fleet **Cam**. Ops free cam (SCN) may drive the **on-screen** preview only; it must not change NDI framing.

| Situation | Behavior |
| --- | --- |
| Screen camera = active POV (`view=follow`) | Single render; AR NDI readback = framebuffer |
| Screen camera ≠ active POV (`view=free`) | **Dual-render (AR):** air FBO from `getAirCamera()` → NDI; then preview camera to screen. **3D** always FBO-captures active POV on studio tick |
| Studio Electron **or** `outputMode=transparent` | Air locked (`isAirCameraLocked`); free cam may still orbit — AR/3D NDI stay on active POV |

Wire AR: `startNdiFramePump({ getAirCamera: () => scene.getActivePovCamera(), prepareCameraPass: (c) => scene.orientOpsBillboards(c) })`. Wire 3D: `startNdi3dChannelPump({ scene, getAirCamera, setEnvironmentOpaqueClearSafe, getEnvironmentOpaqueClearSafe, … })` — each tick sets opaque clear + `opaqueClearSafe(true)`, renders active POV to FBO, then restores so transparent AR never bakes sea/sky. Start 3D **before** AR so the 3D pump binds `renderer.render` before the AR monkey-patch. SCN: `getActivePovCamera()` / `getPreviewCamera()` / `orientOpsBillboards` / `setOpsViewMode` / `setEnvironmentOpaqueClearSafe`; free cam must not mutate `activePovId`.

## Stream 2D map (SCN) vs plate capture

SCN Phase **8.1** ships a toggleable **CSS overlay** stream/PiP map (`createStreamMap2d`). It does not steal the air camera.

| Clear / path | Map in capture? |
| --- | --- |
| Preview | Yes when HUD **stream map** on |
| Chroma (window capture) | Yes when on — opaque DOM over green; ops may crop/key carefully |
| Transparent + Electron **AR** NDI (`broadcast-web`) | **No** — AR pump uses WebGL `readPixels` only (no map burn-in) |
| Electron **2D** NDI (`broadcast-web-2d`) | **Yes** — separate sender; letterboxes map canvas into 1920×1080; works while PiP hidden |

**Decision (Phase 11 / `DSP-OUT-20260811-01`, bridge Phase 13.1, pump Phase 13.4 / `DSP-OUT-20260812-03`, perf `DSP-OUT-20260812-06`):** stream map stays off the primary air NDI plate. Channel `'2d'` is opt-in (`STREAM_MAP_NDI_BRIDGE_SUPPORTED === true`; studio default **off** for UI FPS). Toggle affects **only** the 2D sender.

**Resolution choice:** 2D frames are **letterboxed into 1920×1080** (studio lock). Native PiP stays ~520²; AR/3D buffer size unchanged.

## Out of scope (later)

- NTP / `stream_anchor` status TMP line
- Decoder / CV reader (use `getVideoElement()` when ready)
- App WebRTC/SRT **egress** (Phase 5.4 eval: defer; use vMix/OBS program out for remote) — [`docs/ops/egress-webrtc-srt-evaluation.md`](../../docs/ops/egress-webrtc-srt-evaluation.md)
- Native NDI helper (path B — only if A blocked)
- GPU zero-copy NDI
- Compressed / reduced-fps delay buffer (only if high-delay OOM forces it)
