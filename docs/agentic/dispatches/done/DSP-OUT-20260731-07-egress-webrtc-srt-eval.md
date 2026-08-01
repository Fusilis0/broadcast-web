# Dispatch DSP-OUT-20260731-07-egress-webrtc-srt-eval

**Status:** Done / archived (2026-08-01) — **BW ack E0** defer app egress

## Meta
- From orchestrator: OUT (BW: Phase **5.4** — egress evaluation)
- Worker role: WORKER(DSP-OUT-20260731-07-egress-webrtc-srt-eval)
- Priority: P1
- Phase: Phase 5.4 — Evaluate WebRTC/SRT egress
- Related: air-runbook (preferred = Electron alpha NDI); WHEP underlay already exists
- BW ask: **docs-only** score + recommendation; no production egress code unless a tiny spike is needed to answer a question

## Goal

Evaluate options for sending broadcast-web video **out** of the studio (remote / cleaner ingest) via **WebRTC and/or SRT**, relative to current air paths (Electron alpha NDI local, Chrome chroma fallback, WHEP underlay in). Recommend order of investment for BW.

## Background

- Preferred studio air today: Electron + named **alpha NDI** into vMix (local LAN).
- WHEP underlay is **ingest** (camera under AR), not egress.
- Architecture ladder includes SRT/WebRTC egress when remote matters.
- Do not block shows on egress; NDI/chroma remain primary for on-site.

## In scope

1. New doc `docs/ops/egress-webrtc-srt-evaluation.md`:
   - Options (at least): browser WebRTC egress; SRT from helper/Electron; compositor-side egress (vMix/OBS already has program out); “defer / not needed”
   - Criteria: latency, reliability, ops complexity, alpha preservation, overlap with NDI, effort
   - Scoring matrix + recommendation for BW
   - Explicit: when to keep using vMix/OBS program out instead of app egress
2. Links from air-runbook (related), OUT README, roadmap 5.4
3. Non-goals called out: no NDI rewrite, no 6.4 DB

## Out of scope

- Implementing production WebRTC/SRT sender
- Changing preferred NDI air path
- 6.4 project API
- Hetzner/WSS human install

## Acceptance criteria

- [x] Evaluation doc exists with scored options + BW-facing recommendation
- [x] Linked from air-runbook / OUT README / roadmap note
- [x] No product egress code (docs-only unless a one-line clarify)

## Report back

Standard five sections. Suggest whether to open an implementation DSP or defer egress.

## Worker paste block

```
You are WORKER(DSP-OUT-20260731-07-egress-webrtc-srt-eval).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260731-07-egress-webrtc-srt-eval.md
2. docs/ops/air-runbook.md
3. docs/architecture/race-projects-and-world-authoring.md (§ output ladder)
4. src/output/README.md

Deliver docs/ops/egress-webrtc-srt-evaluation.md + links. Docs-only. Report back per dispatch.
```
