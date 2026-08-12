# Handoff HO-BW-20260804-04 — Open Phase 10 (Cutover & console)

## To
**BW ops / human** + **OUT** (smoke) + **CON** (console deep-link)

## From
BW — 2026-08-04

## Context
- **V1-A** (Phase 8 visuals) met.
- **V1-B** (Phase 9 LAN) met — auth, venue pack, calib-on-project.
- Next product gate: can we run a show on broadcast-web vs Unity?

## Work items

| # | Owner | What |
| --- | --- | --- |
| 10.1 | **BW + human** | Parallel air vs Unity — dress/show criteria; explicit Unity retire OK (was 5.6). Checklist DSP optional: use air-runbook cutover section. |
| 10.2 | **CON** + console team | Deep-link ack — SPA already parses; console must emit contract URLs (was 3.6). DSP: `DSP-CON-20260804-01-console-deeplink-ack.md` |
| 10.3 | **OUT** + human | Studio NDI smoke — **Done / Pass** 2026-08-04 (`DSP-OUT-20260804-01` → `done/`; Studio Monitor + grandi; see `HO-OUT-BW-20260804-01`) |

## Behavior
1. OUT / CON: paste bootstrap + this handoff; issue workers from active DSPs below (or human runs checklists).
2. 10.1 is primarily **human + BW decision** — no large code slice required.
3. Report BW when V1-C exit criteria look met.

## Out of scope
Phase 11 polish, Phase 12 Hetzner, new visual assets.
