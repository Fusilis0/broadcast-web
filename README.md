# broadcast-web

Browser-based Three.js AR overlay for maritime race broadcast. Runs **beside** the Unity `broadcast` project until cutover. Opened from the existing web console via redirect.

| | |
| --- | --- |
| **Runtime** | Web browser only (no Electron) |
| **Stack** | Vite · TypeScript · Three.js |
| **Air path (planned)** | Chroma → vMix first; WebRTC/SRT later; native NDI helper only if required |
| **Host (later)** | Hetzner static/SPA — render runs in studio Chrome |
| **Unity sibling** | `../broadcast` (telemetry contracts, assets, analysis) |

## Start here (humans & agents)

| Doc | Purpose |
| --- | --- |
| [`docs/agentic/README.md`](./docs/agentic/README.md) | Agentic operating system overview |
| [`docs/architecture/system-architecture.md`](./docs/architecture/system-architecture.md) | Full system architecture |
| [`docs/roadmap/phases-roadmap.md`](./docs/roadmap/phases-roadmap.md) | Phased roadmap |
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

Also available:

- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve the production build locally

Runtime placeholders live in `public/config.json`. Optional env keys are listed in `.env.example` (copy to `.env` locally; `.env` is gitignored).

## Status

Local folder only. GitHub remote (`fusilis/broadcast-web`, private) not created yet. Vite + TypeScript + Three.js scaffold is runnable (`npm run dev`); domain modules under `src/` are empty stubs pending orchestrator dispatches.
