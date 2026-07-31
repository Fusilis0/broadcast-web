# output

Owned by **OUT**. Canvas clear modes, visual timecode, WebRTC WHEP underlay / later egress.

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

Barcode is sync burn-in for telemetry ↔ video timing. Capture the WebGL canvas / window in **OBS or vMix**; key chroma as before (3.1). **No in-browser NDI.** Interim air: [`docs/ops/air-runbook.md`](../../docs/ops/air-runbook.md). Full-product lock: Electron **A** + **NDI with alpha** (Phase 7.3+) — contract [`docs/architecture/ndi-alpha-electron.md`](../../docs/architecture/ndi-alpha-electron.md), shell [`desktop/`](../../desktop/), eval [`docs/ops/ndi-path-evaluation.md`](../../docs/ops/ndi-path-evaluation.md). C trial (closed): [`docs/ops/ndi-c-spike-runbook.md`](../../docs/ops/ndi-c-spike-runbook.md). Historical 3.5: [`docs/ops/vmix-chroma-runbook.md`](../../docs/ops/vmix-chroma-runbook.md).

## Phase 3.3 — WHEP underlay

Browser **MediaMTX WHEP** video under the Three canvas in **preview** (DOM `<video>` + native `RTCPeerConnection`, no extra deps). Soft-fails when URL empty or server unreachable.

| Symbol | Role |
| --- | --- |
| `normalizeWhepUrl(raw)` | Trim; empty → idle |
| `shouldRunWhepUnderlay(url, mode)` | Non-empty URL **and** `preview` |
| `startWhepUnderlay(options)` | Connect / reconnect / status DOM; `getVideoElement()` for future CV |
| `formatWhepStatusLabel(status)` | `whep=off\|connecting\|live\|error` |

### Config

- `whepUrl`: full WHEP POST URL. Default `""` (idle, no errors). Non-empty enables underlay in preview.
- Example shapes (placeholders — use your MediaMTX host/path):
  - `http://127.0.0.1:8889/cam1/whep`
  - `http://mediamtx:8889/read:cam1:pub1:token/whep` (Unity-style path)
  - Some MediaMTX setups also use `/whep/<path>` — set the **exact** endpoint your server exposes.

Leave empty in git. Override locally in `public/config.json` (or a local copy). No secrets required for typical LAN WHEP; see `.env.example` note.

### Compositing / chroma

| Mode | Underlay |
| --- | --- |
| `preview` | Connect when `whepUrl` set; video behind canvas; clear alpha → `0` while connecting/live so video shows through |
| `chroma` | **Stopped and hidden** by default — green key must stay clean (no video bleed) |

Timecode + AR canvas stay on top. Status chip lives on the OUT mode control: `whep=off|connecting|live|error`.

### Manual check (no MediaMTX in CI)

1. Empty `whepUrl` → boot with `whep=off`; `npm test` / `npm run build` green.
2. Point `whepUrl` at a live MediaMTX WHEP endpoint → preview shows video under AR; status `live`.
3. Toggle to chroma → underlay stops; solid green clear.

**No in-browser NDI.** Production NDI = Electron + alpha (7.3+) — [`docs/architecture/ndi-alpha-electron.md`](../../docs/architecture/ndi-alpha-electron.md). Helper path B deferred. C trial record: [`docs/ops/ndi-c-spike-runbook.md`](../../docs/ops/ndi-c-spike-runbook.md).

## Out of scope (later)

- `transparent` alpha capture (dedicated mode) — required for NDI path A; see alpha contract
- NTP / `stream_anchor` status TMP line
- Decoder / CV reader (use `getVideoElement()` when ready)
- Egress / NDI SDK sender in Electron (after shell scaffold)
- Native NDI helper (path B — only if A blocked)
