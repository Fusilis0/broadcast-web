# output

Owned by **OUT**. Canvas clear modes, visual timecode, later WebRTC underlay / egress.

## Phase 3.1 — preview / chroma clear

| Symbol | Role |
| --- | --- |
| `normalizeOutputMode(raw)` | `preview` \| `chroma`; unknown → `preview` |
| `resolveClearAppearance(mode, options?)` | Mode → `{ color, alpha }` |
| `applyOutputMode(renderer, mode, options?)` | `renderer.setClearColor` |
| `parseChromaKey(raw)` | `#00ff00` / `00ff00` / number → hex |
| `startOutputModeControl(options)` | Runtime HUD toggle (not persisted) |
| `PREVIEW_CLEAR_COLOR` | `0x1a1a1a` (dark ops) |
| `DEFAULT_CHROMA_KEY` | `0x00ff00` — RGB `(0, 255, 0)` |

### Config

- `outputMode`: `"preview"` (committed default) or `"chroma"`.
- Optional `chromaKey`: `"#00ff00"` (or equivalent) when mode is chroma.

## Phase 3.2 — visual timecode

Unity-compatible **8×8 LSB** black/white barcode burned into the **same WebGL canvas** (orthographic overlay after the main scene). Canvas-only capture includes it; no sibling DOM canvas.

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

### Studio note

Barcode is sync burn-in for telemetry ↔ video timing. Capture the WebGL canvas / window in **vMix**; key chroma as before (3.1). **No in-browser NDI.** Studio steps + pass/fail: [docs/ops/vmix-chroma-runbook.md](../../docs/ops/vmix-chroma-runbook.md) (Phase 3.5).

## Out of scope (later)

- `transparent` alpha capture
- WebRTC WHEP underlay (3.3 — deferred)
- NTP / `stream_anchor` status TMP line
- Decoder / CV reader
- Egress / native NDI helper
