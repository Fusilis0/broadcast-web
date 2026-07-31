# Dispatch DSP-OUT-20260731-02-ndi-path-evaluation

## Meta
- From orchestrator: OUT (BW: **5.3** done → open **5.5** NDI evaluation)
- Worker role: WORKER(DSP-OUT-20260731-02-ndi-path-evaluation)
- Priority: P1
- Phase: Phase 5.5 — NDI path evaluation (docs / decision matrix)
- Related: `docs/architecture/race-projects-and-world-authoring.md` §7; roadmap Phase 7
- **Status: DONE** (worker 2026-07-31) — **BW acked** recommendation **C → B → A** (2026-07-31)
- **Status: DONE** (worker 2026-07-31) — docs only; no Electron/NDI code; **BW ack pending**

## Worker report (summary)

- Added `docs/ops/ndi-path-evaluation.md` (requirements, A/B/C scores, recommend trial **C** then owned **B** / alternate **A**, C spike checklist, Phase 7 entry criteria)
- Linked from air-runbook, race-projects §7, roadmap 5.5/7, root README On air
- Explicit: NDI not required for current chroma air path

## Goal

Produce **`docs/ops/ndi-path-evaluation.md`**: compare options for sending the AR camera view as NDI into vMix (optimum air), with pros/cons, effort, risks, and a clear BW recommendation. Chroma remains fallback. No Electron app, no NDI SDK integration in this slice.

## Options to score (locked)

| ID | Option |
| --- | --- |
| **C** | Third-party: OBS/vMix NDI plugin or window→NDI tool from Chrome capture |
| **B** | Native NDI helper sidecar (SPA stays browser) |
| **A** | Electron shell + our NDI sender (WebGL/frame → NDI SDK) |

## In scope

1. Evaluation doc: requirements (latency, resolution, named source, studio ops), score A/B/C, recommend order (design already prefers prove chroma → trial C → invest A/B)
2. Spike checklist for human trial of **C** (optional section)
3. Phase 7 entry criteria: when to start A or B
4. Link from air-runbook + architecture race-projects §7 + roadmap note
5. Update OUT_MEMO suggested bullets in report-back

## Out of scope

- Implementing Electron, NDI SDK, or helper code
- Buying/licensing decisions beyond noting NDI SDK requirements at high level
- Changing chroma path

## Acceptance criteria

- [x] `docs/ops/ndi-path-evaluation.md` exists with scored A/B/C + recommendation
- [x] Linked from air runbook
- [x] Explicit: no NDI required for current air (chroma)
- [x] Docs-only (or trivial link edits)

## Report back

Standard five sections; recommended option for BW ack.

## Worker paste block

```
You are WORKER(DSP-OUT-20260731-02-ndi-path-evaluation).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260731-02-ndi-path-evaluation.md
2. docs/architecture/race-projects-and-world-authoring.md §7
3. docs/ops/air-runbook.md
4. docs/roadmap Phase 5.5 / 7

Docs-only NDI path evaluation. No Electron/NDI code.
Report back per dispatch.
```
