# GEO_MEMO

**Last updated:** 2026-09-13  
**Status:** `DSP-GEO-20260908-01` **code-accept**. SCN-01 may import cinematic ECEF. No tileset look.

## 2026-09-13 — IBB mail waiting; 19 Eylül without them

Operator mailed IBB CBS for 3B API / enterprise. **No GEO worker.** If no reply: stay OSM + heroes on air; pay for IBB **tariff block** if sales will sell; else paid hero glTF; SHGM mapping firm only after the race. Google Photorealistic still reject on air. DIY Boğaz survey still **closed**. Details: `3d-environment-buildings.md` §3.2.

## 2026-09-08 — DSP-GEO-20260908-01 code done

Globe = ECEF metres + ellipsoid up at **eye**; AMSL via `amslToHae` (Istanbul N ≈ 37.43 m). ENU still `gpsToEnuAmsl`. Degenerate look → nadir. Exports: `geodeticToEcefMeters`, `ellipsoidUpEcef`, `ecefLookAt`, `enuKeyframeToScene`, `ECEF_LOOK_AT_EPSILON_M`. Cinematic tests 8/8. SCN owns tiles / ReorientationPlugin.

## 2026-09-08 — Phase 21 cinematic globe

BW locked intro MP4. GEO owns ECEF keyframes + ellipsoid up. ENU still `gpsToEnuAmsl`. Brief: `docs/agentic/briefs/phase21/GEO_PHASE21.md`. Handoff `HO-BW-GEO-20260908-01`.

## 2026-09-07 — Phase 20.1 buildings lock (GEO idle unless hero altitude)

No GEO worker for vendor switch. Hero bury/float still GEO if SCN hands off.

## 2026-09-06 — 3D buildings **locked** (free path)

Operator: DIY Bosphorus drone survey **closed**. IBB **parked** until a future agreement. Continue with **free** options.

**Lock:** Cesium World Terrain (keep) + **Cesium OSM Buildings** (this *is* the 3D buildings layer) + **hero historic glTF** (CC first). Google off air. No other free stream is a different look — MapTiler/Mapbox 3D = same OSM, wrong engine. Self-hosted OSM clip is the only fallback if ion dies.

GEO later: ENU place heroes, clip OSM footprints. No MapTiler buildings worker.

## 2026-09-06 — 3D buildings design (operator)

Operator: Cesium alternative OK; prefer **service**; pre-baked İstanbul only if historic places look good.

**Recommendation recorded in** `docs/architecture/3d-environment-buildings.md`:

- Keep Cesium World Terrain (do not rip the engine; CesiumJS still rejected).
- Add **Cesium OSM Buildings** (ion 96188) as a second 3D Tileset — city massing, not photogrammetry.
- Hero **glTF landmarks** for named historic places.
- IBB mesh only after a live look, licensed clip, not scrape `3bistanbul.ibb.gov.tr`.
- **Google Photorealistic 3D Tiles: reject on air** (logo + promo-video ≤30 s policy).

GEO work if this locks: ENU placement of heroes (`amslToHae`), occupancy clips vs OSM. Terrain vendor switch still not default.

## Phase 14.0 accepted 2026-08-17
- Scene Vector3 is `(east, up, −north)`; `East × North = +Y`.
- Named scalars stay geographic; use `northFromSceneZ` when reading `.z`.
- POV: no `UNITY_CAM_TO_THREE`; negate yaw+pitch at camera apply. Boats: negate yaw + 180° Y
  for `+Z` hulls. Pose `yawDeg` still compass for map icons.
- CAL yaw migration is still CAL’s call (`HO-BW-CAL-20260817-01`); geometry JSON does not migrate.
- Archived: `docs/agentic/dispatches/done/DSP-GEO-20260817-01-enu-handedness-fix.md`

## Focus
3D buildings design waiting on operator lock (`3d-environment-buildings.md`).

## Decisions
- ENU: `x=East, y=Up, z=−North` (right-handed Three / glTF)
- `enuToGps(east, up, north)` stays named geographic scalars
- Option B (`scale.z = -1`) rejected

## Done (recent)
- 14.0 handedness fix
- EGM96 + gpsToEnu path (Phase 1)
- Thin inverse for Phase 4.2 editor

## Next
SCN mounts OSM Buildings when BW issues a dispatch. GEO places hero glTF. IBB mail waiting (§3.2). DIY closed.
