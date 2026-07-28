# Dispatch DSP-CAL-20260728-01-cv-spike-plan

## Meta
- **Status: DONE** (accepted by BW 2026-07-28)
- From orchestrator: CAL (BW: finish no-studio software — Phase **4.5**)
- Worker role: WORKER(DSP-CAL-20260728-01-cv-spike-plan)
- Priority: P2
- Phase: Phase 4.5 — CV research spike plan
- Related handoffs: FYI OUT (WHEP underlay will feed CV later)
- BW ask: **docs only** — how future image processing writes the same CAL offsets; no CV code

## Goal

Write a short research/spike plan for runtime CV that matches video to drone sight and updates **existing** `CalibrationOffsets` (yaw/pitch/roll/FOV/alt) — no second pose pipeline.

## Background

- Architecture §5.3: CV only writes CAL knobs
- WHEP underlay (3.3) will provide video; chroma path is for air, not necessarily CV input
- Human sliders already prove the apply path

## In scope

1. New doc: `docs/research/cv-calibration-spike.md` (or `docs/calibration/cv-spike-plan.md`) covering:
   - Goal / non-goals
   - Inputs: WHEP frame + pose/timecode sync assumptions
   - Outputs: write `setOffsets(deviceId, partial)` only
   - Candidate approaches (template match / horizon / feature — high level, 2–3 options)
   - Risks (latency, false locks, FOV coupling)
   - Suggested spike milestones (offline fixture → live underlay → race soak)
   - Explicit: no Unity replacement criteria here
2. Link from `src/calibration/README.md` and optionally roadmap note
3. English, concise (≈1–3 pages)

## Out of scope

- Implementing CV / OpenCV / TensorFlow
- Changing `applyCalibration` math
- WHEP implementation (OUT 3.3)
- Studio 3.5 Results

## Acceptance criteria

- [ ] Spike plan doc exists and is linked from CAL README
- [ ] States CV writes same offset store only
- [ ] No `src/` runtime CV code required
- [ ] No secrets

## Report back

Standard five sections; suggested CAL memo bullets.

## Worker paste block

```
You are WORKER(DSP-CAL-20260728-01-cv-spike-plan).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-CAL-20260728-01-cv-spike-plan.md
2. docs/architecture/system-architecture.md §5.3
3. src/calibration/README.md + types/offsetsStore

Docs only — CV spike plan. No CV implementation, no WHEP/NDI.
Report back per dispatch.
```
