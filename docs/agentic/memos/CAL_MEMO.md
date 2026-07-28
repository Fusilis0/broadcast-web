# CAL_MEMO

**Last updated:** 2026-07-28  
**Status:** Idle — 4.5 CV spike plan done

## Focus
None active. Waiting on BW for offline CV fixture spike (code) if desired.

## Decisions
- Offsets first-class; CV writes `setOffsets` only — no second pose pipeline
- Default hFOV **66.8832°**
- **3.4** multi-device picker — DONE
- **4.5** plan: `docs/research/cv-calibration-spike.md` (linked from CAL README + roadmap)

## Done
- DSP-CAL-20260722-01, DSP-CAL-20260723-01
- DSP-SCN-20260727-07 (CAL slice)
- **DSP-CAL-20260728-01-cv-spike-plan** — **DONE**

## Blockers
- Live CV milestones need OUT WHEP (now available) + ops policy for CV vs sliders

## Next
1. Idle until BW opens offline CV fixture spike
2. Optional: localStorage persistence for offsets
