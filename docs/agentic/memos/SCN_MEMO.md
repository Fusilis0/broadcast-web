# SCN_MEMO

**Last updated:** 2026-07-22  
**Status:** Active — 1.5 visuals DSP drafted; blocked on GEO pose ENU API

## Focus
Phase 1.5 SCN slice: one boat primitive + drone camera consuming GEO/pose ENU (replace demo cube).

## Decisions
- V1 freeze: 1 drone + boats + course + 2D map; sponsors/flags can follow (BW)
- Owns: `src/scene/`, `src/assets/`, stub HUD (DOM), 2D map; applies CAL transforms, does not invent geodesy/WS/chroma
- **1.5 visuals:** consume ENU only — no `gpsToEnu`, no WS in scene code
- Temporary camera hFOV **66.8832** until CAL owns FOV/offsets
- Stub HUD (0.5) deferred behind P0 pose spine (BW priority)

## Issued dispatches
- **DSP-SCN-20260722-01-boat-drone-camera** — `docs/agentic/dispatches/active/DSP-SCN-20260722-01-boat-drone-camera.md`  
  Status: **drafted / awaiting GEO pose surface + worker**  
  Goal: boat primitive + drone PerspectiveCamera from ENU; remove demo cube

## Handoffs
- **HO-SCN-GEO-20260722-01** — request GEO export pose/ENU consume API (`src/pose/` preferred) before/with SCN worker  
  Path: `docs/agentic/handoffs/HO-SCN-GEO-20260722-01.md`

## Blockers
- **GEO pose path** — `src/pose/` empty; origin-from-config + `telemetryBus` → ENU not wired for SCN yet
- Worker for this DSP should not start until GEO documents the consume API (or will immediately blocker-report)

## Next
1. GEO accepts HO + issues/lands 1.5 pose DSP → notify SCN
2. Human opens **new worker chat** with DSP paste block
3. After green: optional 0.5 stub HUD DSP; then 1.7 2D map plan
