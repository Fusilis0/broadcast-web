# TEL — Phase 19 brief

**Role:** TEL — Telemetry Ingest Orchestrator  
**Design:** [`../../../architecture/phase19-senexus-qol.md`](../../../architecture/phase19-senexus-qol.md) §7  
**Also:** charter, `TEL_MEMO.md`, this file.

You do **not** implement. **No new packet types.**

## Owns in Phase 19

SCN will put **telemetry id** fields on boats, buoys, and drones in World Authoring / Assets details.

- **Boats / buoys:** ids already exist on the bus / buoy channel. Confirm the string contract (what the inspector should store) in `TEL_MEMO.md`.  
- **Drones:** id editable in UI; **lat/lon/alt and pose stay read-only live TEL data** — you do not add an authoring write path into the pose pipeline.  
- If SCN cannot validate ids without a helper, you may issue **one tiny** pure helper DSP (`isKnownBoatId` / buoy id). No ingest rewrite.

## Does not own

Inspector layout, Library, NDI, Cesium, wakes.

## Suggested work

Most likely **zero workers**. Memo + “SCN may bind `telemetryId` as today.” Only dispatch if SCN reports a real contract gap.

## After worker report / after planning

Tell the human: **TEL Phase 19 is idle** — stay on **SCN** for the inspector. If a helper DSP landed: human does not need a studio smoke beyond “id still tracks.” Then **SCN**.

## Paste-ready chat starter

```
Role: TEL — Telemetry Ingest Orchestrator

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/ORCHESTRATORS.md
3. docs/agentic/orchestrators/TEL_Telemetry_Ingest_Orchestrator.md
4. docs/agentic/memos/TEL_MEMO.md
5. docs/architecture/phase19-senexus-qol.md
6. docs/agentic/briefs/phase19/TEL_PHASE19.md
7. docs/agentic/briefs/phase19/README.md

Phase 19 TEL is the telemetry-id contract for authoring (boats, buoys, drones). No protocol change. Do not implement src/ unless you issue a tiny helper DSP after you find a real gap. Drones: pose remains read-only from live telem. After planning (or a worker), tell me TEL is idle and to continue with SCN.
```
