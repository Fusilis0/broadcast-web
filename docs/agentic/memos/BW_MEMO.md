# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-08-03  
**Session role:** BW

## Current phase
**Ops polish batch accepted** (2026-08-03) — five DSPs archived to `done/`.  
Suite green: **255** SPA + **8** server.

| DSP | Result |
| --- | --- |
| TEL live-socket-hygiene | Enabled-id sockets + last-packet / nopkt HUD |
| SCN free-cam-ops-view | Orbit free cam; does not mutate active POV |
| OUT ndi-active-cam-lock | Dual-render NDI = active POV |
| SCN world-anchor-ui | Origin lat/lon/altMsl Apply → GEO + remount |
| PLT project-save-as-load | Save / Save as / Load + optional API write |

**Still blocked on human:** Hetzner SPA + WSS + optional `/api` (`human-hetzner-wss-checklist.md`).  
**6.5** only when write auth required.  
Preferred air: Electron alpha NDI. Egress deferred (E0).  
Remote: https://github.com/Fusilis0/broadcast-web  
**Standing order:** land accepted slices with commit/push.

## Next (human / ops)
1. Fleet: enable Live only on ids you send → Connect; look for `open/<age>` not `nopkt`.
2. HUD origin Apply → Bosphorus (or race anchor) → Save / Save as.
3. Studio: Free cam on screen + POV switch; confirm NDI stays active POV (air-runbook checklist).
4. Optional polish: boat tags billboard toward preview cam during free look (SCN).

## Compaction recovery
`BOOTSTRAP_BW.md` → this memo → `docs/ops/air-runbook.md` → Fleet/Live + origin HUD
