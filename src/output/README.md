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
| `startNdiFramePump({ renderer, getAirCamera?, prepareCameraPass? })` | After timecode: `readPixels` → IPC → main `grandi` BGRA send; dual-render re-orients SCN billboards per pass |
| `startNdiControllerPanel({ container, getPump, getActivePovId })` | Ops sidebar **NDI** tab — read-only air status (source / SDK / error / active POV); Chrome shows unavailable |
| `resolveNdiAirIndicator` | Pure `unavailable` \| `stopped` \| `starting` \| `live` \| `error` |
| `STREAM_MAP_NDI_BRIDGE_SUPPORTED` | `false` until desktop multi-sender; UI toggle stays disabled |
| `isAirCameraLocked` / `shouldForceFollowActivePov` | Studio bridge **or** `transparent` → air framing locked |
| `planNdiCapture` | Same camera → FB readback; preview ≠ air → dual-render FBO |
| `STUDIO_OUTPUT_WIDTH/HEIGHT` | Electron lock **1920×1080** |
| Visual timecode layout | Drawing-buffer space (size stable when window CSS scales) |
| Studio frame clock | Main-process `studio:tick` (~30 fps; not throttled when minimized) |

No-ops in Chrome (no bridge). Shell + run notes: [`desktop/README.md`](../../desktop/README.md). vMix: [`docs/ops/vmix-ndi-alpha-runbook.md`](../../docs/ops/vmix-ndi-alpha-runbook.md). Contract: [`docs/architecture/ndi-alpha-electron.md`](../../docs/architecture/ndi-alpha-electron.md).

**No in-browser NDI** without the Electron bridge. Preferred studio air = Electron alpha NDI; Chrome chroma = fallback ([`docs/ops/air-runbook.md`](../../docs/ops/air-runbook.md)). Path B deferred.

**Lifecycle:** `startNdiFramePump` runs once after scene + visual timecode boot in Electron and stops on `beforeunload`. The controller tab is **read-only** — no start/stop buttons in v1 (NDI is tied to the studio session).

**Sidebar invariant:** the NDI tab is DOM-only. Capture still uses WebGL `readPixels` / air FBO only — collapsing the ops sidebar must not change air pixels (`docs/architecture/unified-ops-sidebar.md` §2). Regression: `ndiControllerPanel.test.ts` + `sidebar/sidebar.test.ts`.

### Air camera lock (NDI = active POV)

**Contract:** NDI (and the transparent studio plate) always frames the **active POV** camera — the operator-selected drone cam via POV switch / Fleet **Cam**. Ops free cam (SCN) may drive the **on-screen** preview only; it must not change NDI framing.

| Situation | Behavior |
| --- | --- |
| Screen camera = active POV (`view=follow`) | Single render; NDI readback = framebuffer |
| Screen camera ≠ active POV (`view=free`) | **Dual-render:** air FBO from `getAirCamera()` → NDI (same bottom-up readback as FB); then preview camera to screen |
| Studio Electron **or** `outputMode=transparent` | Air locked (`isAirCameraLocked`); free cam may still orbit — NDI stays on active POV |

Wire: `startNdiFramePump({ getAirCamera: () => scene.getActivePovCamera(), prepareCameraPass: (c) => scene.orientOpsBillboards(c) })`. SCN: `getActivePovCamera()` / `getPreviewCamera()` / `orientOpsBillboards` / `setOpsViewMode`; free cam must not mutate `activePovId`. When preview ≠ air, `prepareCameraPass` runs for the air camera before the FBO pass and again for the preview camera before the screen present so tag distance-scale matches each pass.

## Stream 2D map (SCN) vs plate capture

SCN Phase **8.1** ships a toggleable **CSS overlay** stream/PiP map (`createStreamMap2d`). It does not steal the air camera.

| Clear / path | Map in capture? |
| --- | --- |
| Preview | Yes when HUD **stream map** on |
| Chroma (window capture) | Yes when on — opaque DOM over green; ops may crop/key carefully |
| Transparent + Electron NDI | **No** — pump uses WebGL `readPixels` only |

**Decision (Phase 11 / `DSP-OUT-20260811-01`):** stream map stays DOM-only on the primary air NDI source. A second, independently named NDI sender for the map is the opt-in path when wanted — **stubbed disabled** today because `desktop/ndiSender.cjs` is a **single** `grandi` sender (`STREAM_MAP_NDI_BRIDGE_SUPPORTED === false`). The ops **NDI** tab shows the toggle greyed with “not supported by current NDI bridge”. Follow-up: multi-sender desktop bridge, then wire a map-canvas pump.

## Out of scope (later)

- NTP / `stream_anchor` status TMP line
- Decoder / CV reader (use `getVideoElement()` when ready)
- App WebRTC/SRT **egress** (Phase 5.4 eval: defer; use vMix/OBS program out for remote) — [`docs/ops/egress-webrtc-srt-evaluation.md`](../../docs/ops/egress-webrtc-srt-evaluation.md)
- Native NDI helper (path B — only if A blocked)
- GPU zero-copy NDI
- Multi-sender NDI bridge + stream-map second source (see above)
