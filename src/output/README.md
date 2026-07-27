# output

Owned by **OUT**. Canvas clear modes, later WebRTC underlay / timecode / egress.

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

### Studio note

Capture the WebGL canvas window in **vMix** with a chroma key on the clear color (default green). No in-browser NDI.

### Out of scope (later)

- `transparent` alpha capture
- WebRTC WHEP underlay (3.3)
- Timecode burn-in (3.2)
- Egress / native NDI helper
