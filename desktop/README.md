# broadcast-web desktop (studio shell)

Minimal **Electron** shell that loads the existing SPA. Path **A** scaffold for Phase **7.3** — **no NDI SDK** and no frame sender in this slice.

Product contract: [`../docs/architecture/ndi-alpha-electron.md`](../docs/architecture/ndi-alpha-electron.md).

## Shell vs Chrome chroma air

| Path | When | How |
| --- | --- | --- |
| **Chrome + chroma** (interim air) | Shows today | [`../docs/ops/air-runbook.md`](../docs/ops/air-runbook.md) — `npm run dev` in Chrome, `outputMode=chroma`, OBS/vMix window capture + green key |
| **Electron studio shell** (this folder) | Studio path A scaffold | Load SPA in Electron; later slices attach named **alpha** NDI |

Default product remains the browser SPA. Do not treat Electron as required for current air.

## Setup

From repo root (once):

```bash
npm install
npm install --prefix desktop
```

## Run — SPA in Electron (dev)

Terminal 1 — Vite:

```bash
npm run dev
```

Terminal 2 — shell (loads `http://127.0.0.1:5173`):

```bash
npm run desktop:dev
```

Or from this folder: `npm run start:dev`.

Optional race / chroma query (still useful for interim testing inside the shell):

```text
http://127.0.0.1:5173/?race=demo-istanbul&outputMode=chroma
```

Override URL:

```bash
# Windows PowerShell
$env:BROADCAST_WEB_URL="http://127.0.0.1:5173/?race=demo-istanbul"; npm run desktop:dev
```

## Run — production build in Electron

```bash
npm run build
npm run desktop:file
```

Loads `dist/index.html` via `file://`. Static assets under `/races/` etc. work when opened from `dist/` as Vite `base: '/'` expects a proper origin in hosted deploys; for local file mode prefer `npm run preview` + `--preview` if asset paths misbehave.

## Modes

| Command / flag | Loads |
| --- | --- |
| `npm run desktop:dev` / `--dev` (default) | `http://127.0.0.1:5173` |
| `electron . --preview` | `http://127.0.0.1:4173` (after `npm run preview`) |
| `npm run desktop:file` / `--file` | `../dist/index.html` |
| `BROADCAST_WEB_URL` | Any URL (wins over flags) |
| `--devtools` | Open detached DevTools |

## Non-goals (this slice)

- NDI SDK, native addon, sending frames
- electron-builder release pipeline
- Changing Chrome chroma as default air

Next: follow-up DSP for NDI SDK + alpha frame send (7.3b / toward 7.5).
