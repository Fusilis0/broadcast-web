# broadcast-web

Browser-based Three.js AR overlay for maritime race broadcast. Runs **beside** the Unity `broadcast` project until cutover. Opened from the existing web console via redirect.

| | |
| --- | --- |
| **Runtime** | Browser SPA today; optional **Electron** later for owned NDI |
| **Stack** | Vite · TypeScript · Three.js |
| **Air path** | Chroma → vMix first; **NDI camera view = optimum** (Electron / native helper / third-party); WHEP underlay + SRT/WebRTC as needed |
| **Projects (planned)** | Race packs (JSON → DB): boats, course, billboards, S/F, arrows — load on any PC via `?race=` |
| **Host (later)** | Hetzner static/SPA + project API; render on studio GPU |
| **Unity sibling** | `../broadcast` (telemetry contracts, assets, analysis) |

## Start here (humans & agents)

| Doc | Purpose |
| --- | --- |
| [`docs/agentic/README.md`](./docs/agentic/README.md) | Agentic operating system overview |
| [`docs/architecture/system-architecture.md`](./docs/architecture/system-architecture.md) | Full system architecture |
| [`docs/architecture/race-projects-and-world-authoring.md`](./docs/architecture/race-projects-and-world-authoring.md) | Race projects, map editor, shared 3D/2D, NDI options |
| [`docs/roadmap/phases-roadmap.md`](./docs/roadmap/phases-roadmap.md) | Phased roadmap (incl. Phase 6 projects, Phase 7 NDI) |
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

## Status

Local folder only. GitHub remote (`fusilis/broadcast-web`, private) not created yet. Vite + TypeScript + Three.js scaffold is runnable (`npm run dev`); domain modules under `src/` are empty stubs pending orchestrator dispatches.
