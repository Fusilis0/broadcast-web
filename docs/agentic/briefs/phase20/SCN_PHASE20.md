# SCN — Phase 20 brief (OSM Buildings + heroes)

**Role:** SCN — Scene & Visuals Orchestrator  
**You do not implement `src/`.** You plan, write `DSP-SCN-*` worker dispatches, update `SCN_MEMO.md`.  
**Design (must read):** [`../../../architecture/3d-environment-buildings.md`](../../../architecture/3d-environment-buildings.md)  
**Also:** charter, `SCN_MEMO.md`, [`geospatial-terrain-cesium.md`](../../../architecture/geospatial-terrain-cesium.md), this file, [`README.md`](./README.md).

Phase 20 is **only** the free city layer. After Human Pass you **return the operator to BW**. You do **not** own SRT out, NDI kill, or the commercial video.

## Owns

| Item | What |
| --- | --- |
| **20.1a** | Second 3D Tileset: **Cesium OSM Buildings** (ion asset **96188**), same `3d-tiles-renderer` + ion token as World Terrain. Same `ReorientationPlugin` origin (`amslToHae`). Opaque-env gate: **never** on AR/chroma. Lock-tiles / unload budget like terrain. |
| **20.1b** | **Hero historic glTF** (CC-licensed first): Hagia Sophia, Sultan Ahmed, Topkapı, Maiden’s Tower, Rumeli Hisarı, Galata, bridges as available. Place via GEO ENU. **Clip/hide OSM** under each hero. |
| **20.1c** | Ops: terrain already has ion token. Add buildings on/off (default **on** when realistic+terrain on, or off until smoked — pick one and document). Attribution: OSM + ion on **3D + Ops only**, never AR plate. |

OSM Buildings **is** the 3D buildings layer. Do not add CesiumJS. Do not MapTiler/Mapbox GL. Do not Google Photorealistic. Do not IBB. Do not DIY photogrammetry.

## Does not own

Geodesy formulas (GEO). NDI/SRT pumps (OUT/SRT). Commercial video (BW, later). Library re-seed (PLT). `STUDIO_TICK_FPS`.

## Suggested worker splits (small)

1. **`DSP-SCN-…-osm-buildings`** — mount OSM Buildings tileset + tests + 3D-only credits. Heroes stub OK (empty).  
2. **`DSP-SCN-…-hero-gltf`** — load/place a **short** CC pack (even 2–3 landmarks beats none); OSM occupancy clip. If ENU/altitude is wrong → **handoff GEO** (`GEO_PHASE20.md`), do not guess geoid.  
3. Optional polish DSP only after human smoke of 1+2.

File-disjoint: 20.1a owns `src/scene/terrain/*` (or a sibling `buildings/` next to terrain). 20.1b owns a new `src/scene/landmarks/` (or similar). Do not rewrite Gerstner/ocean in these DSPs.

## Issued 2026-09-07 (SCN)

| DSP | Item | Status |
| --- | --- | --- |
| [`DSP-SCN-20260907-01-osm-buildings`](../../dispatches/active/DSP-SCN-20260907-01-osm-buildings.md) | 20.1a + 20.1c | **Human Fail** — no extruded volumes (fixed by 03) |
| [`DSP-SCN-20260907-03-osm-buildings-visible`](../../dispatches/active/DSP-SCN-20260907-03-osm-buildings-visible.md) | 20.1a follow-up | **Human Pass 2026-09-07** — white OSM boxes |
| [`DSP-SCN-20260907-04-grey-aerial`](../../dispatches/active/DSP-SCN-20260907-04-grey-aerial.md) | 20 look — desaturated Bing | **Human Fail 2026-09-07** — B&W filter, not road map |
| [`DSP-SCN-20260907-05-road-overlay`](../../dispatches/active/DSP-SCN-20260907-05-road-overlay.md) | 20 look — Bing Maps Road ion 4 | **Human Pass 2026-09-07** — keep road + aerial |
| [`DSP-SCN-20260907-02-hero-gltf`](../../dispatches/active/DSP-SCN-20260907-02-hero-gltf.md) | 20.1b | **Code-accept 2026-09-07** — named proxies; Human Pass pending |

Locks: buildings checkbox **default ON**; ion **96188** is 3D Tiles (no quantized-mesh on that renderer); occupancy API in 01; heroes use `gpsToEnuAmsl` or hand off GEO.

## After each worker

Tell the human to **test now** (exact clicks). Good: 3D shows city **massing** (boxes), not a flat photo-only coast; AR plate still has **no** buildings/terrain; lock-tiles still works; fps not worse than today’s realistic+terrain in a way that bricks ops.

## When Phase 20 is done (Human Pass)

**Return to BW.** Paste:

- Open a **new** chat with `docs/agentic/dispatches/BOOTSTRAP_BW.md`
- Phase 20 city layer **Human Pass**
- Next is **Phase 21 commercial video** (operator will detail). **Not** SRT, **not** NDI.

Do not open SRT/OUT for egress. Do not start Phase 21 design in the SCN chat.

## Paste-ready chat starter

```
Role: SCN — Scene & Visuals Orchestrator

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/ORCHESTRATORS.md
3. docs/agentic/orchestrators/SCN_Scene_Visuals_Orchestrator.md
4. docs/agentic/memos/SCN_MEMO.md
5. docs/architecture/3d-environment-buildings.md
6. docs/architecture/geospatial-terrain-cesium.md
7. docs/agentic/briefs/phase20/README.md
8. docs/agentic/briefs/phase20/SCN_PHASE20.md

Phase 20 only: Cesium OSM Buildings + hero historic glTF. Plan in SCN_MEMO, then small DSP-SCN workers. No src/ in this chat. No CesiumJS, no Google Photorealistic, no IBB, no MapTiler engine, no SRT out, no NDI, no commercial video. After Human Pass, send me to BW (BOOTSTRAP_BW.md).
```
