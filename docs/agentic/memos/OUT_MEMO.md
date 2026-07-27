# OUT_MEMO

**Last updated:** 2026-07-27  
**Status:** Active — 3.5 runbook ready; **awaiting human studio Results**

## Focus
Phase **3.5** — human executes [`docs/ops/vmix-chroma-runbook.md`](../../ops/vmix-chroma-runbook.md), fills Results → OUT accepts

## Decisions
- Priority: chroma → WebRTC underlay → egress → NDI helper last (BW lock)
- No in-browser NDI; no NDI helper for 3.5
- **3.1 + 3.2 DONE**
- **3.5 worker docs DONE** — runbook + `src/output/README.md` link; acceptance blocked on human Results (not worker)
- Capture path: Chrome window/screen only; no WHEP, no NDI
- **3.3 WHEP** still deferred

## Issued dispatches
- **DSP-OUT-20260727-01-preview-chroma-clear** — **DONE**
- **DSP-OUT-20260727-02-visual-timecode** — **DONE**
- **DSP-OUT-20260727-03-vmix-chroma-experiment** — active  
  Worker runbook **accepted 2026-07-27**; human studio pending  
  Artifact: `docs/ops/vmix-chroma-runbook.md`

## Planned dispatches (not issued)
1. **DSP-OUT-…-whep-underlay-spike** (Phase 3.3) — **deferred** until BW opens underlay/CV

## Handoffs
- **HO-OUT-BW-20260727-02** — 3.5 opened; runbook ready for studio

## Blockers
- Human must run studio checklist and fill Results table in the runbook (or paste Results here)

## Next actions
1. Human: follow runbook on studio PC → fill Results (pass/fail + notes)
2. OUT: accept 3.5, archive DSP, tick roadmap when Results recorded
