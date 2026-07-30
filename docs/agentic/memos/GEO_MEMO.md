# GEO_MEMO

**Last updated:** 2026-07-30  
**Status:** Idle — enu→GPS inverse landed for map editor

## Focus
None active.

## Decisions
- ENU: x=East, y=Up, z=North; water graphics Y=0 where applicable
- **New:** `enuToGps` / `enuToGpsAmsl` (+ `haeToAmsl`) for SCN map editor clicks; round-trip tested

## Done (recent)
- EGM96 + gpsToEnu path (Phase 1)
- Thin inverse for Phase 4.2 editor (SCN DSP touch)

## Next
Idle until BW/GEO DSP (declination, tiles, etc.)
