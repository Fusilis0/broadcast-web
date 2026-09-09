# GEO — Phase 21 brief (cinematic globe)

**Role:** GEO — Geodesy & World Frame Orchestrator  
**You do not implement `src/`.** Plan, issue `DSP-GEO-*`, update `GEO_MEMO.md`.  
**Design:** [`../../../architecture/commercial-video.md`](../../../architecture/commercial-video.md)

## Owns

Geodetic keyframes → **ECEF metres** (globe domain) and reuse **ENU** (`gpsToEnuAmsl`) for strait shots. Ellipsoid **up** at lat/lon. Origin switch during the cloud is a GEO contract (new origin lat/lon/altMsl → `applyConfigOrigin` / existing origin API) — **do not** invent HAE.

Issued worker: [`DSP-GEO-20260908-01-cinematic-globe`](../../dispatches/active/DSP-GEO-20260908-01-cinematic-globe.md) — **code-accept 2026-09-08**. Idle unless origin-switch during cloud needs a GEO follow-up.

## Does not own

Tileset mount, ReorientationPlugin on/off (SCN). Cloud look. MP4. OSM. Heroes. CesiumJS.

## After Human Pass

Tell the human to open **SCN** Phase 21 (`SCN_PHASE21.md`) if the player is not started. Do not record MP4.
