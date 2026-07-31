# broadcast-web desktop (studio shell)

**Electron** shell that loads the existing SPA and publishes a **named alpha NDI** source (path **A**, Phase **7.3b**).

Product contract: [`../docs/architecture/ndi-alpha-electron.md`](../docs/architecture/ndi-alpha-electron.md).  
vMix ingest: [`../docs/ops/vmix-ndi-alpha-runbook.md`](../docs/ops/vmix-ndi-alpha-runbook.md).

## Shell vs Chrome chroma air

| Path | When | How |
| --- | --- | --- |
| **Chrome + chroma** (interim air) | Shows today | [`../docs/ops/air-runbook.md`](../docs/ops/air-runbook.md) — `npm run dev` in Chrome, `outputMode=chroma`, OBS/vMix window capture + green key |
| **Electron + alpha NDI** (this folder) | Studio path A | SPA in Electron; WebGL readback → BGRA → NDI (`grandi`) |

Default product remains the browser SPA. Electron is the **studio** path.

## NDI

| Item | Value |
| --- | --- |
| Binding | [`grandi`](https://www.npmjs.com/package/grandi) ^2 (NDI SDK 6, Node-API) |
| Default source name | `broadcast-web` → appears as `HOSTNAME (broadcast-web)` |
| Pixel path | WebGL `readPixels` RGBA → main converts to top-down **BGRA** (straight alpha) |
| Output size | **1920×1080** locked in the SPA (window may resize; NDI stays 1080p) |
| Timecode size | Fixed — canvas displayed at native **1920×1080** CSS px (window scroll/letterbox, no scale) |
| Minimize / close | **Parks off-screen** (OS minimize freezes WebGL). NDI stays ~30 fps. **Tray → Show studio** to restore; **Tray → Quit** to exit |
| Clear mode | Prefer `outputMode=transparent` (alpha 0 plate; opaque AR + timecode) |

### Overrides

```bash
# Windows PowerShell
$env:BROADCAST_NDI_NAME="Broadcast AR"; npm run desktop:dev
```

```bash
npm run desktop:dev -- --ndi-name=BroadcastAR
npm run desktop:dev -- --no-ndi
```

## Setup

From repo root (once):

```bash
npm install
npm install --prefix desktop
```

`grandi` downloads/bundles the NDI runtime for the host platform (do not use `--omit=optional`).

## Run — SPA in Electron (dev)

Terminal 1 — Vite:

```bash
npm run dev
```

Terminal 2 — shell (loads `http://127.0.0.1:5173`, starts NDI):

```bash
npm run desktop:dev
```

Studio alpha plate URL:

```text
http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent
```

Or set:

```bash
$env:BROADCAST_WEB_URL="http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent"; npm run desktop:dev
```

Confirm the source in NDI Studio Monitor / vMix NDI input (see vMix runbook). Timecode corner should stay sharp (nearest; avoid soft scale on the input).

### Minimize / background

Windows **OS minimize freezes WebGL** (~0.2 fps) even with JS ticking. This shell **parks** the window off-screen instead:

1. Click minimize (or the window ✕) → window disappears; NDI keeps running  
2. System tray icon → **Show studio** (or double-click) to bring it back  
3. Tray → **Quit** to fully exit (✕ alone does not quit while NDI is on)

## Run — production build in Electron

```bash
npm run build
npm run desktop:file
```

## Modes

| Command / flag | Loads |
| --- | --- |
| `npm run desktop:dev` / `--dev` (default) | `http://127.0.0.1:5173` |
| `electron . --preview` | `http://127.0.0.1:4173` (after `npm run preview`) |
| `npm run desktop:file` / `--file` | `../dist/index.html` |
| `BROADCAST_WEB_URL` | Any URL (wins over flags) |
| `--devtools` | Open detached DevTools |
| `--no-ndi` | Shell only (no sender) |
| `BROADCAST_NDI_NAME` / `--ndi-name=` | NDI source name |

## Layout

| File | Role |
| --- | --- |
| `main.cjs` | BrowserWindow + NDI IPC |
| `preload.cjs` | `window.broadcastStudio` bridge |
| `ndiSender.cjs` | `grandi` send (BGRA) |

## Non-goals (this slice)

- electron-builder release pipeline / asar unpack polish
- Path B helper
- Killing Chrome chroma as interim air
- GPU zero-copy (CPU readback is intentional for the spike)
