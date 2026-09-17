# broadcast-web

Browser-based Three.js AR overlay for maritime race broadcast. Runs **beside** the Unity `broadcast` project until cutover. Opened from the existing web console via redirect.

| | |
| --- | --- |
| **Runtime** | Browser SPA + **Electron** studio (alpha NDI) |
| **Stack** | Vite · TypeScript · Three.js |
| **Air path (v1)** | **Electron alpha NDI** preferred; chroma = fallback; WHEP underlay as needed |
| **Projects** | Static packs under `public/races/` + local API stub (`server/`) — Save as / `?race=` |
| **Host (v1)** | **Local studio** (no cloud required). Public host/Hetzner = Phase 12 deferred |
| **Unity sibling** | `../broadcast` (telemetry contracts, assets) — cutover = Phase 10 |
| **Roadmap** | [`docs/roadmap/phases-roadmap.md`](./docs/roadmap/phases-roadmap.md) — next: **Phase 8 visuals** |

## Start here (humans & agents)

| Doc | Purpose |
| --- | --- |
| [`docs/ops/studio/README.md`](./docs/ops/studio/README.md) | **Panel guides** — one short doc per studio section |
| [`docs/ops/studio-operator-manual.md`](./docs/ops/studio-operator-manual.md) | **Operator catalog** — every studio control, asset hide, Cesium ion, SRT |
| [`docs/agentic/README.md`](./docs/agentic/README.md) | Agentic operating system overview |
| [`docs/architecture/system-architecture.md`](./docs/architecture/system-architecture.md) | Full system architecture |
| [`docs/architecture/race-projects-and-world-authoring.md`](./docs/architecture/race-projects-and-world-authoring.md) | Race projects, map editor, shared 3D/2D, NDI options |
| [`docs/roadmap/phases-roadmap.md`](./docs/roadmap/phases-roadmap.md) | Living roadmap (v1 = local studio → Phase 8 visuals) |
| [`docs/agentic/ORCHESTRATORS.md`](./docs/agentic/ORCHESTRATORS.md) | Orchestrator registry (full names) |
| [`docs/agentic/dispatches/`](./docs/agentic/dispatches/) | Paste-ready session bootstrap dispatches |

## Agentic roles (short)

- **BW (Broadcast-Web Master Orchestrator)** — plans, routes, never implements product code.
- **Domain orchestrators** (`TEL`, `GEO`, `SCN`, `OUT`, `CON`, `CAL`, `PLT`) — plan + dispatch workers + memos; never implement in their own chat.
- **Workers** — new Cursor chats that execute one dispatch.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`). You should see a dark WebGL canvas with a rotating wireframe cube.

Optional console deep-link query overrides (after `config.json`; see [`docs/contracts/console-deeplink.md`](./docs/contracts/console-deeplink.md)):

```
http://127.0.0.1:5173/?mode=replay&originLat=41.0082&originLon=28.9784
```

Also available:

- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve the production build locally

Runtime placeholders live in `public/config.json`. Optional env keys are listed in `.env.example` (copy to `.env` locally; `.env` is gitignored).

Wind (Phase 14.3b): Open-Meteo forecast at `config.origin` polls onto `windBus` (~10 min). Operator **hold** in Ops beats the API. Open-Meteo data is [CC BY 4.0](https://open-meteo.com/) (non-commercial free tier; fine for studio/dev).

## Deploy

Production is a **static SPA**: `npm run build` → upload `dist/` to a web root with SPA fallback (`try_files` → `index.html`).

- Static host (Hetzner / nginx / Caddy, TLS, smoke): [`docs/ops/hetzner-static-deploy.md`](./docs/ops/hetzner-static-deploy.md)
- Live telemetry WSS / reverse proxy (HTTPS → `wss://`): [`docs/ops/wss-live-telemetry.md`](./docs/ops/wss-live-telemetry.md)
- Optional rsync helper (placeholders only): [`scripts/deploy-static.example.sh`](./scripts/deploy-static.example.sh)

Mock/replay work on the static host without WebSockets. Live on HTTPS requires `wss://` (direct or same-origin proxy).

## On air

**Preferred studio:** Electron + **SRT program out** (AR/3D/2D callers → OBS). NDI Send stays hidden.  
**Fallback:** chroma / window capture.

- **Every button and field:** [`docs/ops/studio-operator-manual.md`](./docs/ops/studio-operator-manual.md)
- Local OBS SRT: [`docs/ops/srt-local-obs.md`](./docs/ops/srt-local-obs.md)
- Air runbook (legacy NDI + cutover notes): [`docs/ops/air-runbook.md`](./docs/ops/air-runbook.md)
- Desktop shell: [`desktop/README.md`](./desktop/README.md)
- vMix alpha ingest: [`docs/ops/vmix-ndi-alpha-runbook.md`](./docs/ops/vmix-ndi-alpha-runbook.md)
- NDI path evaluation (A/B/C): [`docs/ops/ndi-path-evaluation.md`](./docs/ops/ndi-path-evaluation.md)
- Phase 3.5 chroma experiment record: [`docs/ops/vmix-chroma-runbook.md`](./docs/ops/vmix-chroma-runbook.md)

## Status

Private GitHub repo; Vite + TypeScript + Three.js app with domain modules under `src/`. Phase 5.1–5.3 deploy/WSS/air docs are in place; human upload and VPS/proxy TLS remain outside the repo.
