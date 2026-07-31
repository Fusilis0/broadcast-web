# Human ops — Hetzner SPA + WSS (parallel pack)

**Status:** Human-owned (docs already landed in 5.1 / 5.2)  
**When:** In parallel with worker **5.4** + **6.4** design  
**Related:** [`hetzner-static-deploy.md`](./hetzner-static-deploy.md), [`wss-live-telemetry.md`](./wss-live-telemetry.md)

## Goal

Put the static SPA on the real host and prove **HTTPS → WSS** live telemetry so far-PC / hosted air is unblocked.

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

### C — Report back to BW

Paste:

| Field | Value |
| --- | --- |
| SPA URL | |
| WSS mode (A/B) | |
| Live smoke | pass / fail |
| Blockers | |

Studio Electron NDI air does **not** require Hetzner; this pack unblocks remote config + live on hosted SPA.
