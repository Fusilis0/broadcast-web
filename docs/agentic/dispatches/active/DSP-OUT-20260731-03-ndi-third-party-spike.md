# Dispatch DSP-OUT-20260731-03-ndi-third-party-spike

## Meta
- From orchestrator: OUT (BW: open Phase **7.1** — trial **C**)
- Worker role: WORKER(DSP-OUT-20260731-03-ndi-third-party-spike)
- Priority: P0
- Phase: Phase 7.1 — Third-party NDI from capture/window
- Related: `docs/ops/ndi-path-evaluation.md` (BW ack C→B→A); air-runbook
- BW ask: dedicated C-spike runbook + Results table; human runs studio trial; **no** Electron/helper/SDK code

## Goal

1. Extract a clear **7.1 runbook** from the eval checklist into `docs/ops/ndi-c-spike-runbook.md` (setup, pass/fail, Results).  
2. Link it from air-runbook + ndi-path-evaluation.  
3. **Human** (same or follow-up session) executes the spike and fills Results → OUT/BW accept 7.1.

Worker may stop after docs if human is not in the same chat; report “awaiting human Results” like 3.5.

## In scope

1. `docs/ops/ndi-c-spike-runbook.md` — copy/refine checklist from eval § Spike checklist; OBS and vMix variants; same-PC rule; chroma vs preview note; Results table
2. Links from `ndi-path-evaluation.md`, `air-runbook.md`, OUT README
3. Explicit: chroma remains production; this spike does not change default air path
4. No NDI SDK / Electron / helper implementation

## Out of scope

- 7.2 / 7.3 owned NDI code
- 5.4 egress, 6.4 DB
- Declaring production NDI cutover

## Acceptance criteria (docs half)

- [ ] C-spike runbook exists and is linked
- [ ] Results table ready for human
- [ ] No product NDI code

## Acceptance criteria (7.1 phase close — human)

- [ ] Results table filled (pass/fail + tool chain)
- [ ] BW/OUT decide: defer A/B, or open 7.2/7.3

## Report back

Standard five sections; if docs-only, say human Results pending.

## Worker paste block

```
You are WORKER(DSP-OUT-20260731-03-ndi-third-party-spike).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260731-03-ndi-third-party-spike.md
2. docs/ops/ndi-path-evaluation.md (spike checklist + BW ack C→B→A)
3. docs/ops/air-runbook.md

Write docs/ops/ndi-c-spike-runbook.md + links. No Electron/NDI SDK code.
If you are not the studio operator, stop after docs and note human Results pending.
Report back per dispatch.
```
