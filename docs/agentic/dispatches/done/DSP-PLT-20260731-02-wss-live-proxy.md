# Dispatch DSP-PLT-20260731-02-wss-live-proxy

## Meta
- From orchestrator: PLT (BW: **5.1** accepted → open **5.2**; TEL FYI)
- Worker role: WORKER(DSP-PLT-20260731-02-wss-live-proxy)
- Priority: P1
- Phase: Phase 5.2 — WSS or proxy for live TEL on HTTPS SPA
- Related: `docs/ops/hetzner-static-deploy.md`; TEL `wsUrl` / `wsBoatUrl`
- BW ask: document + verify path so hosted HTTPS page can use **live** mode; prefer reverse-proxy or direct `wss://`; no NDI/DB; no mandatory live VPS soak
- **Status: DONE** (worker 2026-07-31) — human still owns VPS cert / proxy install + live smoke

## Worker report (summary)

- Added `docs/ops/wss-live-telemetry.md` (mixed content, Option A native WSS, Option B SPA proxy, nginx/Caddy, config + deeplink notes)
- Linked from Hetzner deploy runbook, root README, TEL README; `.env.example` placeholder shapes
- Client verify: `wss://` passed through unchanged; empty URL stays idle (tests in `live.test.ts`)
- `npm test` 214 + `npm run build` green; no secrets / no VPS login

## Goal

Unblock **live** telemetry when the SPA is served over **HTTPS**: browsers block mixed content (`https` page → `ws://`). Deliver an ops runbook for **WSS** (direct or nginx/Caddy reverse proxy to existing VPS WS), confirm the client accepts `wss://` URLs, and document `config.json` / deeplink examples. Implementation on the real VPS/proxy is human; worker does docs + any small client/config hardening.

## Background

- Static host (5.1) serves SPA; live sockets still point at race VPS
- TEL already takes `wsUrl` / `wsBoatUrl` strings — likely works with `wss://` if TLS terminates correctly
- Architecture: WSS required for HTTPS Hetzner pages

## In scope

1. **`docs/ops/wss-live-telemetry.md`** covering:
   - Why mixed content fails
   - Option A: VPS offers native `wss://` (cert on telemetry host)
   - Option B: SPA host reverse-proxies `/ws/drone` `/ws/boat` (or similar) → backend `ws://` with TLS on the edge
   - nginx and/or Caddy example snippets (placeholders for upstream host/ports)
   - `config.json` examples: absolute `wss://…` vs same-origin `wss://<spa-host>/ws/…`
2. Link from Hetzner deploy runbook + TEL README + root README
3. **Client verify:** unit/doc that `wss://` URLs are passed through (add test if gap); no fake open on empty URL
4. `.env.example` — example `wss` shapes (no real hosts/secrets)
5. Optional: config comment in `public/config.json` is unnecessary if docs clear

## Out of scope

- Logging into customer VPS / installing certs (human)
- Changing subscribe protocol / multi-URL maps
- NDI, RaceProject DB, GeoJSON
- Requiring live soak in CI

## Acceptance criteria

- [x] WSS runbook exists with proxy + direct options
- [x] Linked from deploy runbook + TEL README
- [x] Client accepts / documents `wss://` (test if needed)
- [x] No secrets committed
- [x] `npm test` + `npm run build` green

## Report back

Standard five sections; suggested PLT + TEL memo bullets.

## Worker paste block

```
You are WORKER(DSP-PLT-20260731-02-wss-live-proxy).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260731-02-wss-live-proxy.md
2. docs/ops/hetzner-static-deploy.md
3. src/telemetry/liveSource.ts + ingest URL resolve + README
4. public/config.json / .env.example

WSS/proxy runbook + client verify. No live VPS login, no NDI/DB.
Report back per dispatch.
```
