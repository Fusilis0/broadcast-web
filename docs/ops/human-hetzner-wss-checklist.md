# Human ops — Hetzner SPA + WSS + projects API

**Status:** **Deferred (Phase 12)** — not required for v1. BW lock 2026-08-04: local studio first; revisit in months if needed.  
**Related:** [`hetzner-static-deploy.md`](./hetzner-static-deploy.md), [`wss-live-telemetry.md`](./wss-live-telemetry.md), [`projects-api.md`](./projects-api.md) · roadmap: [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md)

## Goal

Put the static SPA on the real host, prove **HTTPS → WSS** live telemetry, and optionally run the **projects API** stub so far-PC can load shared race packs.

## Checklist

### A — Static deploy (5.1)

- [ ] `npm ci && npm run build` on a build machine
- [ ] Upload `dist/` to Hetzner (or static host) at domain **root**
- [ ] TLS OK (browser padlock)
- [ ] Smoke: SPA loads; `?race=demo-istanbul`; EGM96; optional chroma/transparent check
- [ ] Record public URL here: `https://________________`

### B — Live WSS (5.2)

- [ ] Choose Option A (native `wss://` on telemetry VPS) or Option B (SPA host reverse-proxy)
- [ ] Install cert + proxy per [`wss-live-telemetry.md`](./wss-live-telemetry.md)
- [ ] Point hosted `config.json` or deeplink at `wss://…` drone/boat URLs
- [ ] From **HTTPS** page: `mode=live` connects (no mixed-content block)
- [ ] Note any firewall / port issues

### C — Projects API stub (6.4) — optional same host

- [ ] `npm run server:install` + run Node stub on VPS (see [`projects-api.md`](./projects-api.md))
- [ ] nginx/Caddy proxy `/api/` → `127.0.0.1:8787`
- [ ] Hosted `config.json`: `"projectsApiBase": "/api"` (+ set `PROJECTS_API_TOKEN` for writes)
- [ ] Smoke: `GET https://<spa>/api/races` lists `demo-istanbul`; `?race=demo-istanbul` still works if API down (static fallback)

### D — Report back to BW

Paste:

| Field | Value |
| --- | --- |
| SPA URL | |
| WSS mode (A/B) | |
| Live smoke | pass / fail |
| Projects API | pass / skip / fail |
| Blockers | |

Studio Electron NDI air does **not** require Hetzner; this pack unblocks remote config + live + shared projects on hosted SPA.
