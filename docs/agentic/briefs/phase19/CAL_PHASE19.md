# CAL — Phase 19 brief

**Role:** CAL — Calibration & Vision Orchestrator  
**Design:** [`../../../architecture/phase19-senexus-qol.md`](../../../architecture/phase19-senexus-qol.md) §4  
**Also:** charter, `CAL_MEMO.md`, this file.

You do **not** implement. One small domain. One worker is enough unless tests force a split.

## Owns in Phase 19

**19.5** Yaw, pitch, **and roll** slider (and any matching number inputs) **±200°**. Step 0.1. FOV, alt, `syncTrimMs` **unchanged**.

Today: `src/calibration/offsetSliders.ts` `OFFSET_SLIDER_SPECS` ±45 for yaw/pitch/roll.

## Does not own

NDI, scene meshes, World Authoring, token/ion.

## Suggested dispatch

`DSP-CAL-YYYYMMDD-01-offset-range-200` — specs + tests + any docs that cite ±45 as the product limit.

## Acceptance

- [ ] Yaw, pitch, roll can be set to ±200 in the Calib rail  
- [ ] Values persist the same way they do today (`offsetsStore` / project calib)  
- [ ] Tests updated; `npm test` / build green in the worker report  

## After worker report

Human **tests** in Electron: drag yaw/pitch/roll to the new ends, confirm the camera moves further than ±45. Then tell them: **CAL Phase 19 is done** — return to **OUT** if still open, else **SCN**.

## Paste-ready chat starter

```
Role: CAL — Calibration & Vision Orchestrator

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/ORCHESTRATORS.md
3. docs/agentic/orchestrators/CAL_Calibration_Vision_Orchestrator.md
4. docs/agentic/memos/CAL_MEMO.md
5. docs/architecture/phase19-senexus-qol.md
6. docs/agentic/briefs/phase19/CAL_PHASE19.md
7. docs/agentic/briefs/phase19/README.md

Phase 19 CAL is only yaw/pitch/roll ±200. Do not implement src/. Issue one worker dispatch. After the worker reports, tell me to test the sliders, then which orchestrator to open next (OUT or SCN).
```
