# output

Owned by **OUT**. Canvas clear modes, visual timecode, WebRTC WHEP underlay / later egress, Electron NDI frame pump.

## Clear modes

| Symbol | Role |
| --- | --- |
| `normalizeOutputMode(raw)` | `preview` \| `chroma` \| `transparent`; unknown → `preview` |
| `resolveClearAppearance(mode, options?)` | Mode → `{ color, alpha }` |
| `applyOutputMode(renderer, mode, options?)` | `renderer.setClearColor` |
| `startOutputModeControl(options)` | Runtime HUD toggle (not persisted) |
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
- `timecodeCorner`: `"bottom-right"` (default, clear of OUT mode control) \| `"bottom-left"`
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
| `startNdiFramePump({ renderer })` | After timecode: `readPixels` → IPC → main `grandi` BGRA send |
| `STUDIO_OUTPUT_WIDTH/HEIGHT` | Electron lock **1920×1080** |
| Visual timecode layout | Drawing-buffer space (size stable when window CSS scales) |
| Studio frame clock | Main-process `studio:tick` (~30 fps; not throttled when minimized) |

No-ops in Chrome (no bridge). Shell + run notes: [`desktop/README.md`](../../desktop/README.md). vMix: [`docs/ops/vmix-ndi-alpha-runbook.md`](../../docs/ops/vmix-ndi-alpha-runbook.md). Contract: [`docs/architecture/ndi-alpha-electron.md`](../../docs/architecture/ndi-alpha-electron.md).

**No in-browser NDI** without the Electron bridge. Preferred studio air = Electron alpha NDI; Chrome chroma = fallback ([`docs/ops/air-runbook.md`](../../docs/ops/air-runbook.md)). Path B deferred.

## Out of scope (later)

- NTP / `stream_anchor` status TMP line
- Decoder / CV reader (use `getVideoElement()` when ready)
- App WebRTC/SRT **egress** (Phase 5.4 eval: defer; use vMix/OBS program out for remote) — [`docs/ops/egress-webrtc-srt-evaluation.md`](../../docs/ops/egress-webrtc-srt-evaluation.md)
- Native NDI helper (path B — only if A blocked)
- GPU zero-copy NDI
