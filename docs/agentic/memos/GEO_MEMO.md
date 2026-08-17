# GEO_MEMO

**Last updated:** 2026-08-17  
**Status:** Idle — `DSP-GEO-20260817-01` **accepted**

## Phase 14.0 accepted 2026-08-17
- Scene Vector3 is `(east, up, −north)`; `East × North = +Y`.
- Named scalars stay geographic; use `northFromSceneZ` when reading `.z`.
- POV: no `UNITY_CAM_TO_THREE`; negate yaw+pitch at camera apply. Boats: negate yaw + 180° Y
  for `+Z` hulls. Pose `yawDeg` still compass for map icons.
- CAL yaw migration is still CAL’s call (`HO-BW-CAL-20260817-01`); geometry JSON does not migrate.
- Archived: `docs/agentic/dispatches/done/DSP-GEO-20260817-01-enu-handedness-fix.md`

## Focus
None.

## Decisions
- ENU: `x=East, y=Up, z=−North` (right-handed Three / glTF)
- `enuToGps(east, up, north)` stays named geographic scalars
- Option B (`scale.z = -1`) rejected

## Done (recent)
- 14.0 handedness fix
- EGM96 + gpsToEnu path (Phase 1)
- Thin inverse for Phase 4.2 editor

## Next
Idle unless 14.1 terrain alignment needs a GEO follow-up.
