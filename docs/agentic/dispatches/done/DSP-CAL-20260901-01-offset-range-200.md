# Dispatch DSP-CAL-20260901-01-offset-range-200

## Meta
- From orchestrator: CAL
- Worker role: WORKER(DSP-CAL-20260901-01-offset-range-200)
- Priority: P0
- Phase: Phase 19 — Senexus studio QoL (**19.5**)
- Related handoffs: none (BW Phase 19 Wave A)
- **Status: ACTIVE**

## Goal

Widen Calib rail **yaw / pitch / roll** slider (and matching number inputs) from **±45°** to **±200°** (step **0.1**). FOV, alt, and `syncTrimMs` ranges stay unchanged. Persistence behaviour unchanged (`offsetsStore` / `calibration.byPovId`).

## Background

- Design: `docs/architecture/phase19-senexus-qol.md` §4 / N7
- Brief: `docs/agentic/briefs/phase19/CAL_PHASE19.md`
- Today: `src/calibration/offsetSliders.ts` `OFFSET_SLIDER_SPECS` — yaw/pitch/roll `min: -45, max: 45, step: 0.1`
- Clamping goes through `clampOffsetField` / `writeOffsetField` — tests hard-code ±45 (`offsetSliders.test.ts`)
- Docs that cite ±45 as the **product** limit (e.g. `docs/research/cv-calibration-spike.md`) should be updated to ±200 for angles

## In scope

1. Set yaw / pitch / roll in `OFFSET_SLIDER_SPECS` to **min −200, max 200**, step **0.1**.
2. Update unit tests that assert ±45 clamps (expect ±200). Cover all three angle fields if tests only cover yaw today.
3. Confirm FOV, alt, `syncTrimMs` specs are **not** changed.
4. Update any in-repo docs that state ±45 as the current product angle limit for these sliders (research spike / README comments if they claim the live UX limit). Historical dispatch text under `dispatches/done/` may stay as-is.
5. `npm test` and build green.

## Out of scope

- FOV / alt / `syncTrimMs` range changes
- `applyCalibration` math, pose pipeline, SCN overlay, NDI, World Authoring
- Changing default FOV constant or store field set
- CV / vision work

## Likely files

- `src/calibration/offsetSliders.ts`
- `src/calibration/offsetSliders.test.ts`
- `src/calibration/README.md` (only if it cites ±45)
- `docs/research/cv-calibration-spike.md` (angle range wording)

## Inputs provided

- Phase 19 design §4; CAL brief 19.5
- Existing panel already wires range/number inputs from `OFFSET_SLIDER_SPECS`

## Acceptance criteria

- [ ] Yaw, pitch, roll can be set to **±200** via slider and number field (Calib rail)
- [ ] Values still flow through `setOffsets` / project calib the same way as today
- [ ] FOV, alt, `syncTrimMs` ranges unchanged
- [ ] Tests updated; `npm test` / build green in report-back

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for CAL

## Worker paste block

```
You are WORKER(DSP-CAL-20260901-01-offset-range-200).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-CAL-20260901-01-offset-range-200.md
2. docs/agentic/DISPATCH_PROTOCOL.md (worker rules)
3. src/calibration/offsetSliders.ts + offsetSliders.test.ts

Widen yaw/pitch/roll to ±200° (step 0.1). Do not change FOV/alt/syncTrimMs. Update tests and any docs that cite ±45 as the live product limit. Report back per dispatch.
```
