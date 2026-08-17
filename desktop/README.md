# broadcast-web desktop (studio shell)

**Electron** shell that loads the existing SPA and publishes a **named alpha NDI** source (path **A**, Phase **7.3b**).

Product contract: [`../docs/architecture/ndi-alpha-electron.md`](../docs/architecture/ndi-alpha-electron.md).  
vMix ingest: [`../docs/ops/vmix-ndi-alpha-runbook.md`](../docs/ops/vmix-ndi-alpha-runbook.md).

## Shell vs Chrome chroma air

| Path | When | How |
| --- | --- | --- |
| **Electron + alpha NDI** (this folder) | **Preferred** studio air (path A) | SPA in Electron; WebGL readback → BGRA → NDI (`grandi`); [`../docs/ops/air-runbook.md`](../docs/ops/air-runbook.md) |
| **Chrome + chroma** | **Fallback** | Same air-runbook § Fallback — Chrome, `outputMode=chroma`, OBS/vMix window capture + green key |

Default product remains the browser SPA (Hetzner / preview). Electron is the **preferred studio** path.

## NDI

| Item | Value |
| --- | --- |
| Binding | [`grandi`](https://www.npmjs.com/package/grandi) ^2 (NDI SDK 6, Node-API) |
| Multi-sender | `ndiSender.cjs` Map of channel → sender (`ar` \| `3d` \| `2d`) |
| Default AR name | `broadcast-web` → `HOSTNAME (broadcast-web)` (unchanged; not renamed to `-ar`) |
| Default 3D / 2D names | `broadcast-web-3d` / `broadcast-web-2d` (idle until Phase 13.3 / 13.4 pumps) |
| Pixel path | WebGL `readPixels` RGBA → main converts to top-down **BGRA** (straight alpha) |
| Output size | **1920×1080** locked in the SPA (window may resize; NDI stays 1080p) |
| Timecode size | Fixed — canvas displayed at native **1920×1080** CSS px (window scroll/letterbox, no scale) |
| Minimize / close | **Parks off-screen** (OS minimize freezes WebGL). NDI stays ~30 fps. **Tray → Show studio** to restore; **Tray → Quit** to exit |
| Clear mode | Prefer `outputMode=transparent` (alpha 0 plate; opaque AR + timecode) |
| Air camera | **Active POV** only — NDI does not follow ops free cam (see OUT air lock) |

### Preload API (`window.broadcastStudio.ndi`)

| Method | Notes |
| --- | --- |
| `start({ channel?, name? })` | Omit `channel` → `'ar'`. Returns `{ ok, channel, sourceName, sdkVersion, error? }` |
| `stop(channelOrOpts?)` | Omit → stop `'ar'`; `'all'` / `{ channel: 'all' }` → every sender |
| `sendFrame({ channel?, width, height, data, bottomUp? })` | Omit `channel` → `'ar'` |
| `getStatus(channel?)` | Omit → `'ar'` status; `'all'` → status map |
| `getStatusAll()` | `{ ar, 3d, 2d }` status objects |

Back-compat: existing SPA calls that omit `channel` keep driving the AR air plate.

### Overrides

```bash
# Windows PowerShell
$env:BROADCAST_NDI_NAME="Broadcast AR"; npm run desktop:dev
```

```bash
npm run desktop:dev -- --ndi-name=BroadcastAR
npm run desktop:dev -- --no-ndi
```

## GPU (prefer discrete / external)

Studio WebGL + NDI readback is heavy. On dual-GPU Windows laptops (Intel + NVIDIA/AMD),
Electron/Chromium often lands on the **iGPU** unless told otherwise.

**What we do in `main.cjs` (default):**

- `force_high_performance_gpu` — Chromium preference for the high-performance adapter
- `ignore-gpu-blocklist` — avoid blocklist steering WebGL onto a weak adapter

**Opt out (force integrated):**

```bash
npm run desktop:dev -- --integrated-gpu
# or
$env:BROADCAST_USE_INTEGRATED_GPU="1"; npm run desktop:dev
```

On boot the shell logs `GPU preference:` and `GPU info (basic):` — check which adapter Chromium
reports. You can also open DevTools and go to `chrome://gpu`.

**If Task Manager still shows the iGPU** (common with Optimus): Chromium’s preference is not
enough — pin the process in Windows / NVIDIA:

1. **Windows Settings → System → Display → Graphics** (or *Graphics settings*)  
   - Browse to `desktop\node_modules\electron\dist\electron.exe`  
   - Options → **High performance** (your NVIDIA/AMD GPU) → Save  
   - Restart `npm run desktop:dev`
2. **NVIDIA Control Panel → Manage 3D settings → Program Settings**  
   - Add the same `electron.exe`  
   - Prefer **High-performance NVIDIA processor**

Laptop “external GPU” (eGPU enclosure): ensure the eGPU is the Windows high-performance GPU for
that `electron.exe`, then restart the studio shell.

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
| `main.cjs` | BrowserWindow + NDI IPC (per-channel) + `races:*` + `config:setCesiumIonToken` IPC |
| `preload.cjs` | `window.broadcastStudio` bridge (`ndi` + `races` + `config`) |
| `ndiSender.cjs` | Multi-sender `grandi` Map (`ar`/`3d`/`2d` → BGRA) |
| `racesFs.cjs` | Local RaceProject folder write/list/read |
| `configFs.cjs` | Patch `cesiumIonToken` in `public/config.json` (dev) or userData (`--file`) |

## Local RaceProject saves (Phase 13.8)

Electron **Save / Save as** write RaceProject JSON into the races folder as the **primary**
persist path. **Export…** downloads `project.json` only. Chrome without the bridge stays
download-only.

| Mode | Write root | Why |
| --- | --- | --- |
| `desktop:dev` / Vite URL / preview | repo **`public/races/`** | Vite serves updates immediately |
| `--file` / packaged | Electron **`app.getPath('userData')/races/`** | `dist/` is not writable; do not write into baked `dist/races/` |

Layout (same as static packs):

```text
<racesDir>/<id>/project.json
<racesDir>/index.json   → { "ids": ["demo-istanbul", "<id>", …] }
```

IPC (preload → `window.broadcastStudio.races`):

| Method | Role |
| --- | --- |
| `save(project)` | mkdir + write `project.json` + upsert id into `index.json` (never drops other ids) |
| `list()` | read `index.json` ids (+ `kind`: `public` \| `userData`) |
| `read(id)` | read `project.json` (for Load when static `/races` is not the write target) |
| `getRoot()` | `{ kind, path }` |

**Git hygiene:** saving in `desktop:dev` dirties tracked files under `public/races/` — expected for
studio; commit demo packs intentionally. No new ignore scheme in this slice.

**API coexistence:** when `projectsApiBase` is set, HTTP POST/PUT still runs; Electron Save
writes the local folder when the `races` bridge is present (folder + API; Export… = download).

## Cesium ion token (git-share)

Ops **ion token + Apply** calls `config:setCesiumIonToken`. That patches
`cesiumIonToken` in `config.json` without dropping other keys.

| Mode | Write path | Git |
| --- | --- | --- |
| `desktop:dev` / Vite URL | repo **`public/config.json`** | **Yes** — commit after Apply |
| `--file` / packaged | `userData/config.json` | No (`dist/` is not writable) |

Chrome without the studio bridge keeps the token in **sessionStorage** only until
you paste the same value into `public/config.json` and commit.

Do not log the token. Do not upload a filled token to a public Hetzner SPA.

## Non-goals (this slice)

- electron-builder release pipeline / asar unpack polish
- Path B helper
- Killing Chrome chroma as fallback air
- GPU zero-copy (CPU readback is intentional for the spike)
