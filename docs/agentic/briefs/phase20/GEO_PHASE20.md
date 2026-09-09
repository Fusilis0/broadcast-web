# GEO — Phase 20 brief (heroes only)

**Role:** GEO — Geodesy & World Frame Orchestrator  
**You do not implement `src/` unless a worker dispatch you issued says so — and you still do not implement in this chat.**  
**Open only if SCN hands off** (`HO-SCN-GEO-…`). Default: SCN uses existing `gpsToEnu` + `amslToHae`. Idle until then.

## Owns if handed off

Hero landmark **lat / lon / alt MSL → ENU** (`x=East, y=Up, z=−North`). Residual terrain nudge must not bury heroes. Occupancy clip in **ENU metres** (not a second geoid).

## Does not own

Tileset mount, glTF art, ion token, OSM styling, SRT, NDI, MapTiler, Google Photorealistic, IBB.

## When done

Return the human to **SCN** to finish 20.1b, not to BW, unless the whole Phase 20 city layer is already Pass.

## Paste-ready chat starter

```
Role: GEO — Geodesy & World Frame Orchestrator

Read: docs/agentic/RULES.md, ORCHESTRATORS.md, GEO charter, GEO_MEMO.md, docs/architecture/3d-environment-buildings.md, docs/agentic/briefs/phase20/GEO_PHASE20.md.

You do not switch globe vendors. You only help ENU placement of hero glTF if SCN handed off. No src/ in this chat. No SRT, no commercial video.
```
