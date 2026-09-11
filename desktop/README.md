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
| Pixel path | WebGL `readPixels` RGBA → native NDI **RGBA** (`grandi.FourCC.RGBA`, straight alpha). CPU BGRA fallback if RGBA is missing at runtime. |
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

### HEVC (H.265) WebCodecs

DJI SRT is HEVC on the wire. **H.264 always works** in Chromium. Electron is not
Chrome-branded, so `PlatformHEVCDecoderSupport` is off unless we enable it
(`desktop/main.cjs`). Even then, Windows **HEVC Video Extensions** are only for
WebCodecs / Media Foundation — **you do not need them**.

OBS can play the same stream because it uses **ffmpeg’s** HEVC decoder. Studio
does the same fallback: if WebCodecs rejects HEVC **or** SRT is live with
bitrate but `decoded=0` for ~2.5 s, Electron ffmpeg decodes HEVC and remuxes
**H.264** (`libx264` ultrafast, `-copyts`, `repeat-headers=1`) into the existing
WebCodecs path. Transcode must not start a new PTS origin: `-copytb 1` and
`-enc_time_base 1:90000` keep the same 90 kHz PTS as the input access units.
Race ops will say `ffmpeg decoding HEVC→H.264` and show
`codec` / `demux` / `decoded`. Colour bars with `decoded=0` are the compositor
placeholder, not the drone.

If that still fails after ~8 s, Race ops names a missing `libx264` (gyan
`full_build`). Same as OUT-03: ffmpeg on PATH must be a **full** build.

Dual-GPU: pin `electron.exe` to the discrete GPU if WebGL/NDI is on the iGPU.

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
| `main.cjs` | BrowserWindow + NDI IPC (per-channel) + `races:*` + `config:setCesiumIonToken` + `srt:*` ingest + `srtOut:*` publish + cinematic MP4 save IPC |
| `preload.cjs` | `window.broadcastStudio` bridge (`ndi` + `races` + `config` + `srt` + `srtOut` + `cinematicRecord`) |
| `ndiSender.cjs` | Multi-sender `grandi` Map (`ar`/`3d`/`2d` → BGRA) |
| `srtPublisher.cjs` | Per-channel SRT **publish** ffmpeg (`gdigrab` title → `h264_amf` → SRT caller). Not ingest. |
| `srtReader.cjs` | Per-POV SRT **ingest** caller → raw MPEG-TS over IPC (ffmpeg `-c copy` child) |
| `srtHelpers.cjs` | URL validation, ffmpeg argv (PTS-safe), status normalisation |
| `racesFs.cjs` | Local RaceProject folder write/list/read |
| `configFs.cjs` | Patch `cesiumIonToken` in `public/config.json` (dev) or userData (`--file`) |
| `cinematicTileCache.cjs` | Cinematic ion tile cache dir (`userData/cinematic-tiles`; Vite uses `.cache/cinematic-tiles`) |
| `cinematicRecord.cjs` | Save-as dialog + write silent cinematic MP4 (ffmpeg remux if MediaRecorder emitted WebM) |

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

## Cinematic ion tile cache (Phase 21.3a)

Tile **bytes** stay on the studio machine, not in git. SPA helper:
`getCinematicTileCacheDir()` in `src/platform/cinematicTileCache.ts`.

| Runtime | Directory |
| --- | --- |
| This shell (Electron `userData`) | `app.getPath('userData')/cinematic-tiles/` |
| `npm run dev` / Vite preview | repo `.cache/cinematic-tiles/` (gitignored) |

`desktop:dev` loads the Vite URL, so the renderer `GET`/`POST /cinematic-tiles/<file>`
is served from `.cache` by the Vite plugin. Packaged `--file` uses `userData` via
IPC `cinematicTiles.read` / `write` (SHA-256 filename, token query stripped).
Do not commit `.terrain`.

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

## SRT ingest (Phase 17.1)

Electron main is a **dumb MPEG-TS byte pipe**. It does not demux, decode, or
transcode. Demux/decode is renderer-side (OUT-06). Design:
[`../docs/architecture/ar-video-underlay-ntp-sync.md`](../docs/architecture/ar-video-underlay-ntp-sync.md) §3.2.

We are the **caller** (L3): we dial `srt://host:port`. No listener mode.

### Native dependency (decided)

**ffmpeg child process**, not a Node SRT binding.

| Candidate | Verdict |
| --- | --- |
| **ffmpeg** `spawn` + `-c copy -f mpegts pipe:1` | **Chosen.** No Electron native-addon ABI. This machine’s gyan `full_build` is on PATH with `--enable-libsrt` (`ffmpeg -protocols` lists `srt`). PTS is preserved by the argv below. |
| `@eyevinn/srt` (or similar) | **Rejected.** Compiles libsrt at install (CMake + VS). No Windows prebuilds. Would need `@electron/rebuild` against Electron `^37.2.6`. That is the historical failure mode in §3.2. CMake is not even on PATH here. |

Resolution order for the binary:

1. `BROADCAST_FFMPEG` (full path to `ffmpeg.exe`)
2. Packaged `extraResources/ffmpeg/ffmpeg.exe` (PLT — not shipped in this slice)
3. `ffmpeg.exe` / `ffmpeg` on `PATH`

`npm run desktop:dev` does **not** require ffmpeg until `srt:open`. A missing or
non-libsrt binary surfaces as `state: 'error'` with `lastError`, then retries
with backoff. Do not add `ffmpeg-static` to `desktop/package.json` in this slice
(GPL wrapper + ~80 MB download on every `npm install --prefix desktop`); PLT
owns shipping a gyan **full** (not essentials) build next to the app.

### PTS-safe argv

Exact argv from `srtHelpers.cjs` `buildFfmpegArgv`:

```text
ffmpeg -hide_banner -loglevel error -nostdin -copyts
  -fflags +nobuffer -analyzeduration 0 -probesize 65536
  -f mpegts -i srt://host:port?latency=<µs>
  -map 0 -c copy -f mpegts
  -mpegts_copyts 1 -muxdelay 0 -muxpreload 0
  -avoid_negative_ts disabled
  pipe:1
```

`-c copy` is load-bearing (no transcode). Input `-f mpegts` tells ffmpeg the SRT
payload is already MPEG-TS so it does not hang on a live probe — it is not a
remux/transcode. `-mpegts_copyts 1` plus mux delay 0 stops the mpegts muxer
shifting PCR/PTS (default mux delay is 0.7 s, which would desync `stream_anchor`).
`-avoid_negative_ts disabled` prevents a restamp to hide negative timestamps.
There is no `-fflags +genpts`.

`streamid` / `passphrase` / `latency` are **URL query** SRT socket options, never
ffmpeg `-streamid` (that flag is an MPEG-TS PID map and would be the wrong layer).

### Preload API (`window.broadcastStudio.srt`)

| Method | Notes |
| --- | --- |
| `open({ povId, url, streamId?, latencyMs?, passphrase? })` | Caller `srt://host:port`. Cap **4** concurrent sessions (L5). Re-open same `povId` replaces. |
| `close(povIdOrOpts?)` | `{ povId }` → that session; `'all'` / `{ povId: 'all' }` → every session |
| `getStatus()` | `Record<povId, { state, bitrateKbps, lastError }>` |
| `onSrtData(cb)` | `{ povId, chunk: Uint8Array }` raw MPEG-TS. Returns unsubscribe. |
| `onSrtStatus(cb)` | `{ povId, state, bitrateKbps, lastError }`. Returns unsubscribe. |

`state`: `'idle' \| 'connecting' \| 'live' \| 'error'`. Unreachable URL → `error`
+ `lastError`, then backoff retry (1s … 30s). Renderer backpressure: one queued
chunk; further stdout is dropped and counted, never buffered unboundedly.

Teardown: window `closed` (sessions owned by that renderer) and `before-quit`
kill the ffmpeg **process tree** (`taskkill /T /F` on Windows) so a child cannot
outlive the app. Park/minimize does **not** stop SRT (studio stays up, same as NDI).

URL scheme assumed: `srt://<host>:<port>` with optional `?streamid=&latency=&passphrase=`.
`latencyMs` on `open` is converted to SRT `latency` microseconds.

### Overrides

```bash
$env:BROADCAST_FFMPEG="C:\ffmpeg\bin\ffmpeg.exe"; npm run desktop:dev
```

## SRT program out (Phase 22)

Local **publish** (not ingest). Three chrome-free 1920×1080 windows titled
`broadcast-web-srt-ar` / `-3d` / `-2d`. One ffmpeg child per enabled channel:
`gdigrab` by title → `h264_amf` (then NVENC, then `libx264` last resort) → SRT
**caller** on `127.0.0.1:9201–9203`. Audio off. Enabling SRT does **not** start NDI.

Reuse `resolveFfmpegPath()` (same gyan full build as ingest). Do not spawn
`srtReader` sessions for publish.

Ops runbook: [`../docs/ops/srt-local-obs.md`](../docs/ops/srt-local-obs.md).
Start **OBS listeners first**, then check **SRT AR / SRT 3D / SRT 2D**.

### Preload API (`window.broadcastStudio.srtOut`)

| Method | Notes |
| --- | --- |
| `start({ channel, url? })` | `ar` \| `3d` \| `2d`. Default local caller URLs. |
| `stop(channelOrOpts?)` | One channel or `'all'` |
| `getStatus()` | `{ ar, 3d, 2d }` → `idle` \| `connecting` \| `live` \| `error` + encoder name |
| `onStatus(cb)` | Push on state / encoder fps. Returns unsubscribe. |

Independent of ingest `window.broadcastStudio.srt`. Same `BROADCAST_FFMPEG` override as ingest.

## Non-goals (this slice)

- electron-builder release pipeline / asar unpack polish
- Path B helper
- Killing Chrome chroma as fallback air
- GPU zero-copy (CPU readback is intentional for the spike)
