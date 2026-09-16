# Dispatch DSP-SCN-20260915-04-srt-2d-program-cam

## Meta
- From: **BW**. Domain: **SCN**
- Worker: WORKER(DSP-SCN-20260915-04-srt-2d-program-cam)
- Priority: **P1** (after 03 or parallel with 03 if bar exists)
- Phase: **22.4e**
- Design: `docs/architecture/srt-program-cameras.md` §4

## Goal

OBS **2D** shows boats, and **zoom/pan is the 2D program cam** (studio local 2D = that picture). Follow **centroid** or **one boat**. Only boats with **active telemetry**. Offsets + zoom on the bottom bar. No drift with zero boats.

## Background

2D plate did not get studio map transform; auto-fit wandered; boats missing on stream map.

## In scope

1. Stream map **draws** telemetry boats (sail icons).
2. Program view: top-down; centroid of telemetry boats **or** selected boat (buttons). Empty set → freeze (last view or course). **No** planned-only boats in centroid.
3. Editable east/north offset (m) + zoom (metres across frame).
4. Studio local 2D shows this view (ops mini-map unchanged).
5. Tests: centroid ignores no-pose boats; freeze when empty; zoom changes view.

## Out of scope

3D program rig (03). AR look. `STUDIO_TICK_FPS`. OSM art.

## Likely files

- `src/scene/streamMap.ts`, `map2d.ts`, `createStreamMap2d`
- Bottom bar
- `src/main.ts` 2D plate

## Acceptance

- [x] OBS 2D: boats visible when telemetry exists
- [x] Studio 2D zoom = OBS 2D zoom
- [x] Centroid vs one-boat buttons
- [x] No GPS boats: no wander
- [x] No `STUDIO_TICK_FPS`

## Report

**Telemetry filter:** a boat is live for the 2D program cam only if `poseBus` delivered a boat packet within **`MAP2D_PROGRAM_STALE_MS` = 2000 ms** (same window as AR Follow / 3D Frame boats / `STATIC_HULL_LIVE_HOLD_MS`). Planned-only / map-dropped seeds call `updatePose` on the stream map (icons still draw) but **do not** `noteBoatPose`, so they never enter the centroid. Hidden 2D ids are skipped. Empty live set freezes last target, or course layout centroid, or origin — `autoFit` is off on the stream map.

**View:** default **Follow centroid**, east/north offset 0, zoom **250 m across** the 16:9 frame (`halfExtentN = metresAcross / (2 × 16/9)`). Bottom bar: Follow centroid + per-boat buttons + E/N/Across fields. Studio applies the view to the stream canvas (local 2D **is** that picture); ops mini-map still auto-fits/pans. `srtOut:map2dView` forwards the same viewport to the 2D plate so OBS zoom matches studio. Did not start PRF; `STUDIO_TICK_FPS` stays 60.
