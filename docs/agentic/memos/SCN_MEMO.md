# SCN_MEMO

**Last updated:** 2026-07-30  
**Status:** Active — 4.2a done; 4.2 map editor DSP issued

## Focus
Phase 4 world authoring — shared features landed; next map editor.

## Decisions
- Owns: `src/scene/`, `src/assets/`, stub HUD, 2D map, features; no chroma/NDI/DB
- **4.2a DONE:** `WorldFeature` / `LayoutFeature` + adapters; `layoutFeatures` + `gpsToEnuAmsl`; 2D map shows marks, gates, sponsors, flags
- `getLayoutFeatures()` / `setLayoutFeatures()` ready for editor
- Demo still boots via `courseUrl` / `sponsorsUrl` / `flagsUrl`

## Issued dispatches
- **DSP-SCN-20260730-01-shared-feature-layout** — **DONE**
- **DSP-SCN-20260730-02-map-feature-editor** — active (see `dispatches/active/`)

## Blockers
- None

## Next
1. Worker: map feature editor DSP
2. Later: 4.2b stream PiP; 3D-only from LayoutFeature; start/finish/arrow meshes
