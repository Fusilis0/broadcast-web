# GEO — Phase 19 brief

**Role:** GEO — Geodesy & World Frame Orchestrator  
**Design:** [`../../../architecture/phase19-senexus-qol.md`](../../../architecture/phase19-senexus-qol.md) §8 and lat/lon/alt contract  
**Also:** charter, `GEO_MEMO.md`, `geospatial-terrain-cesium.md`, this file.

You do **not** implement. **You do not switch terrain vendors in Phase 19.**

## Owns in Phase 19

### Parked — 19.18 terrain provider (Q5)

Operator: Cesium used to work with the current token; now commercial-use watermark and `ion load failed (failed to fetch)`. They want options, **not** a pick today.

Your job when this chat is opened **now**:

1. Record in `GEO_MEMO.md` that Phase 19 **forbids** a provider switch until BW reopens Q5.  
2. Optionally expand the options table in the architecture doc **only if** BW asks — default is the table already in §8 (fix ion, land-only harder, MapTiler/Mapbox heightmap, local DEM, Google rejected).  
3. Confirm (memo only) that SCN place-by-lat/lon/alt should keep using existing `gpsToEnu` / inverse / AMSL. **No second frame.**

### Not yours unless SCN handoff

Sea waves covering platforms = **SCN 19.15**. Ion token Ops field = already shipped (SCN/PLT). You do not “quickly” patch `createTerrain.ts`.

## When BW reopens Q5

Then you write a **decision memo** (still no code): which option, keys, attribution, how seas are cut so **our** Gerstner remains the water. Only then may BW allow an SCN/PLT worker.

## After worker report

You should have **no** product worker until Q5. If you issued a docs-only DSP: tell the human **GEO is idle** — continue **SCN** / **OUT**. If they ask “fix Cesium now”, answer: **return to BW**, do not start MapTiler.

## Paste-ready chat starter

```
Role: GEO — Geodesy & World Frame Orchestrator

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/ORCHESTRATORS.md
3. docs/agentic/orchestrators/GEO_Geodesy_World_Frame_Orchestrator.md
4. docs/agentic/memos/GEO_MEMO.md
5. docs/architecture/phase19-senexus-qol.md
6. docs/architecture/geospatial-terrain-cesium.md
7. docs/agentic/briefs/phase19/GEO_PHASE19.md
8. docs/agentic/briefs/phase19/README.md

Phase 19 GEO: terrain provider is PARKED (Q5). Do not implement and do not dispatch a Cesium replacement. Update GEO_MEMO with the park + confirm lat/lon/alt authoring uses existing GEO convert. Tell me GEO is idle unless BW reopens Q5. If I ask for a new globe service anyway, refuse and send me to BW.
```
