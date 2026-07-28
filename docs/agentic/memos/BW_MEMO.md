# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-07-28  
**Session role:** BW

## Current phase
**Phase 0–2 complete.**  
**Phase 3:** 3.1–3.4 + **3.3 WHEP** + 3.6 SPA done; **only 3.5** left (studio Results).  
**Phase 4:** **4.1** + **4.5** done; 4.2–4.4 not opened.  
Remote: https://github.com/Fusilis0/broadcast-web  
Last push: landing finish-pack with this commit.  
**Standing order:** land accepted slices with commit/push.

## What works today
- Race content + calib HUD + deeplink parser
- OUT: preview/chroma, timecode, **WHEP underlay** (empty URL idle; chroma stops underlay)
- TEL: mock/replay(loop)/live + reconnect polish
- CAL: CV spike plan docs (`docs/research/cv-calibration-spike.md`)

## Still human
1. **3.5** — fill Results in `docs/ops/vmix-chroma-runbook.md`  
2. Console-team ack of deeplink contract  
3. Optional: MediaMTX soak for WHEP on LAN

## Next software (when you want)
- **4.2** map ops UX (SCN)
- Live multi-URL TEL
- Phase 5 Hetzner / air runbook (after 3.5)
- Offline CV fixture spike (CAL, after you want code)

## Compaction recovery
`BOOTSTRAP_BW.md` → this memo → `docs/roadmap/phases-roadmap.md`
