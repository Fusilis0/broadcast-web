# Dispatch DSP-PLT-20260731-01-hetzner-static-deploy

## Meta
- From orchestrator: PLT (BW: authoring stack ready → open Phase **5.1**)
- Worker role: WORKER(DSP-PLT-20260731-01-hetzner-static-deploy)
- Priority: P1
- Phase: Phase 5.1 — Hetzner static deploy
- Related: roadmap 5.1–5.2; race packs under `public/races/`
- BW ask: production static build + deploy docs/scripts for Hetzner (or generic static host); note WSS for live TEL; no NDI, no DB API yet

## Goal

Make `broadcast-web` deployable as a **static SPA** on Hetzner (or any static host): reproducible `npm run build` → `dist/`, SPA fallback for `/` and future `/overlay`, document how to serve `public/races/` and EGM96, and call out that **live WebSocket needs WSS** when the page is HTTPS. Do not require real Hetzner credentials in-repo — provide runbook + optional CI/rsync example with placeholders.

## Background

- App is Vite SPA; assets in `public/` including `egm96`, fixtures, `races/`
- Far-PC load: HTTPS host + `?race=` already works against static packs once hosted
- Live TEL from HTTPS page cannot use `ws://` — Phase 5.2 proxy; document as follow-up
- Chroma air still runs in studio Chrome against the hosted or local URL

## In scope

1. Verify/fix `vite.config` for production base (`/` default); `npm run build` → `dist/`
2. SPA rewrite notes for nginx/Caddy (try_files → `index.html`) so deep links work
3. `docs/ops/hetzner-static-deploy.md` — prerequisites, build, upload `dist/`, TLS, smoke checklist (`/`, `/?race=demo-istanbul`, chroma toggle)
4. `.env.example` notes for public URLs if any
5. Optional: `scripts/deploy-static.example.sh` with `HOST=` / `REMOTE_DIR=` placeholders (no secrets)
6. README “Deploy” section linking the runbook
7. Mention 5.2: WSS or same-origin proxy required for live mode on HTTPS

## Out of scope

- Actually SSHing to the user’s Hetzner (human does upload)
- Implementing WSS proxy (5.2 DSP)
- Project DB API (6.4), NDI, changing app features

## Acceptance criteria

- [ ] `npm run build` green; `dist/` contains index + races/egm96 assets
- [ ] Deploy runbook exists with nginx/Caddy snippet + smoke tests
- [ ] No secrets committed
- [ ] WSS follow-up clearly noted

## Report back

Standard five sections; suggested PLT memo bullets.

## Worker paste block

```
You are WORKER(DSP-PLT-20260731-01-hetzner-static-deploy).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260731-01-hetzner-static-deploy.md
2. vite.config.ts + package.json scripts
3. public/ layout (races, egm96, fixtures)
4. docs/roadmap Phase 5

Static deploy runbook + build verify. No live Hetzner login, no WSS impl, no NDI/DB.
Report back per dispatch.
```
