# Handoff HO-BW-OUT-20260804-01 — Stream map vs NDI

## From → To
BW → OUT (closes SCN ask `HO-SCN-OUT-20260804-01`)

## Decision (BW lock 2026-08-04)

**v1: DOM-only stream map is enough.**  
Do **not** burn the stream map into the NDI/alpha WebGL plate for now.

| Path | Stream map? |
| --- | --- |
| Browser / Electron **window** (ops PiP) | Yes — CSS overlay when toggled |
| Electron **NDI** (`readPixels`) | No — air stays clean active-POV AR |
| Chroma window capture of full UI | May include PiP if visible — ops should keep stream map **off** for chroma air |

## Rationale
- Preferred air is NDI of the AR plate, not a composite ops HUD.
- Avoid green-key clutter and dual-render complexity this sprint.
- Revisit burn-in only if a show explicitly needs map on the NDI feed (new OUT DSP then).

## Asks of OUT
- [x] Decision recorded (this handoff)
- [x] Update `OUT_MEMO` + air-runbook one-liner: stream map = preview/ops; off for NDI/chroma air (`DSP-OUT-20260804-01`)
- [x] No burn-in DSP unless BW reopens

## Urgency
Closed — P1 ask answered; no worker.
