# OUT — Phase 19 brief

**Role:** OUT — Output & Compositing Orchestrator  
**Design (must read):** [`../../../architecture/phase19-senexus-qol.md`](../../../architecture/phase19-senexus-qol.md)  
**Also:** charter, `OUT_MEMO.md`, `DISPATCH_PROTOCOL.md`, this file.

You do **not** implement. You write a domain roadmap in `OUT_MEMO.md` and issue **one DSP per worker**.

## Owns in Phase 19

| Item | Notes |
| --- | --- |
| **19.1** Hide barcode | Keep code. Adopt existing [`../../dispatches/active/DSP-OUT-20260829-03-remove-timecode-ui.md`](../../dispatches/active/DSP-OUT-20260829-03-remove-timecode-ui.md) — retitle phase to 19, do not clone. |
| **19.3** 3D NDI green/purple stripes | **P0.** Image: vertical pink/green bars in OBS. Diagnose **AR and 3D**. Suspect FourCC vs packed UYVY/UYVA. |
| **19.4** Manual NDI on/off | AR / 3D / 2D independent. **Not** `project.json`. Session OK. Default all on. |

## Does not own

PiP DOM, 2D map art, World Authoring, Cesium, calib slider range, library files, boat wakes.

## Suggested worker split (you may refine)

1. **19.3** first (air is unusable if 3D is striped).  
2. **19.1** barcode (file-disjoint from pumps if you keep it to config + boot gate).  
3. **19.4** toggles in `ndiControllerPanel` + pump start/stop.

If 19.1’s wrap-stack hazard collides with 19.3, **serialise** those two.

## Acceptance (your memo ticks these)

- [x] Default: no barcode on preview or NDI; modules still in repo; `timecodeEnabled: true` still works  
- [x] 3D NDI looks like the 3D view (no stripes); AR reported (clean or still broken) with evidence  
- [x] Three hand toggles; off stops that sender; not written to race JSON  
- [x] After each worker: you told the human test vs next DSP vs BW  

## After worker report

Follow [`README.md`](./README.md) “After a worker reports back”.

- After **19.3**: human **must** test in OBS (AR + 3D + 2D). Then 19.1 or 19.4.  
- After **19.4**: human tests toggling each channel. Then tell them to open **SCN** (or CAL if CAL is not done).  
- If 19.3 is a scene-clear / colour-space issue that is actually SCN: **stop**, handoff to SCN, do not “fix” the picture by changing scene content.

## Fps / 19.3 live proof (2026-09-05)

BW: `HO-BW-OUT-20260905-01`. Product 19.1 / 19.3 OBS / 19.4 remain Pass. Track is **live Send vs preview**, not authoring.

**This wave:** human live proof first. **No worker DSP** until OBS+HUD are re-confirmed or a dump names a hog.

- Do not clone `DSP-OUT-20260902-01` / `-03` / `-05`.
- Do not restore skip-forever or `fallToSync` as always-on.
- 30×3 stays the cap. Do not write “one channel is enough.”
- Do not HO-PRF-OUT until a dump names a stage (`DSP-PRF-20260902-01` still unlanded).
- GEO 19.18 / MapTiler: not OUT. Parked until Q5.

**After live proof:** one fps DSP only from a named wall (`2dGrab` / `*EnqueueIpc` / CPU pack). Keep 19.3 picture locks if pack/FourCC moves.

## Paste-ready chat starter

```
Role: OUT — Output & Compositing Orchestrator

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/ORCHESTRATORS.md
3. docs/agentic/orchestrators/OUT_Output_Compositing_Orchestrator.md
4. docs/agentic/memos/OUT_MEMO.md
5. docs/architecture/phase19-senexus-qol.md
6. docs/agentic/briefs/phase19/OUT_PHASE19.md
7. docs/agentic/briefs/phase19/README.md

Phase 19 is locked by BW. Do not implement src/. Write your OUT roadmap in OUT_MEMO.md, then issue worker dispatches (start with 19.3 NDI stripes). After each worker reports, tell me whether to test, run the next OUT dispatch, or open another orchestrator.
```
