# SCN_MEMO

**Last updated:** 2026-07-30  
**Status:** Idle — 4.2 editor V1 done; awaiting BW next slice

## Focus
Phase 4 world authoring — editor landed; ready for packs / GeoJSON / PiP as BW routes.

## Decisions
- **4.2a + 4.2 DONE**
- Editor: HUD checkbox or `?editor=1`; place/select/delete/export `world-features.json`
- Pipeline: editable `WorldFeature[]` → `layoutFeatures` → map + `remountWorldFromFeatures`
- GEO: `enuToGps` / `enuToGpsAmsl` for map clicks
- Start/finish/arrow: map stubs only (no 3D meshes yet)

## Issued dispatches
- **DSP-SCN-20260730-01** — DONE (shared layout)
- **DSP-SCN-20260730-02** — DONE (map editor V1)

## Blockers
- None

## Next
BW pick: Phase 6 local RaceProject pack / 4.4 GeoJSON / 4.2b stream PiP
