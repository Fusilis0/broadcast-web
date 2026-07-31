# Dispatch DSP-OUT-20260731-01-air-runbook

## Meta
- From orchestrator: OUT (BW: **5.2** accepted → open **5.3**)
- Worker role: WORKER(DSP-OUT-20260731-01-air-runbook)
- Priority: P1
- Phase: Phase 5.3 — Air runbook (Chrome + chroma; hosted or local)
- Related: `docs/ops/vmix-chroma-runbook.md` (3.5 Pass), hetzner + wss ops docs
- BW ask: one ops air runbook that folds chroma (OBS/vMix), optional hosted URL, mock/replay default, live/WSS pointers; no NDI impl
- **Status: DONE** (worker report accepted by BW 2026-07-31)
- **Status: DONE** (worker 2026-07-31) — docs only; no deploy / no NDI code

## Worker report (summary)

- Added `docs/ops/air-runbook.md` (local vs hosted, chroma OBS/vMix, timecode, `?race=`, WSS pointer, NDI = Phase 7, Milestone C note + Results)
- Linked from root README, `src/output/README.md`, Hetzner deploy; 3.5 runbook marked superseded for day-to-day ops
- Docs-only — `npm test` / `npm run build` not required

## Goal

Write **`docs/ops/air-runbook.md`**: end-to-end checklist for putting broadcast-web on air today (Chrome → chroma → OBS/vMix), including local vs Hetzner URL, `outputMode=chroma`, timecode check, race pack `?race=`, and pointers to WSS for live. Absorb/supersede the 3.5 chroma checklist as the canonical air path; keep NDI as “future / Phase 7”.

## In scope

1. `docs/ops/air-runbook.md` — prerequisites, local vs hosted, chroma steps (OBS + vMix notes), pass/fail, Results table
2. Links to `vmix-chroma-runbook.md`, `hetzner-static-deploy.md`, `wss-live-telemetry.md`
3. Link from `src/output/README.md` + root README
4. Note: Milestone C already passed; this is the durable ops doc
5. No product code required unless a tiny README fix

## Out of scope

- NDI Electron/helper implementation
- Actually deploying to Hetzner
- Changing chroma/timecode code

## Acceptance criteria

- [x] Air runbook exists and is linked
- [x] Covers local + hosted + chroma + timecode + optional live/WSS pointer
- [x] Explicit: NDI not required for current air path
- [x] `npm test` + `npm run build` still green if any code touched (docs-only OK)

## Report back

Standard five sections.

## Worker paste block

```
You are WORKER(DSP-OUT-20260731-01-air-runbook).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260731-01-air-runbook.md
2. docs/ops/vmix-chroma-runbook.md
3. docs/ops/hetzner-static-deploy.md
4. docs/ops/wss-live-telemetry.md
5. src/output/README.md

Write the air runbook + links. No NDI code, no deploy.
Report back per dispatch.
```
