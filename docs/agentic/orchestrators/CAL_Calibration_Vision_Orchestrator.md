# CAL — Calibration & Vision Orchestrator

## Full name
Calibration & Vision Orchestrator

## Owns
- Per-device `CalibrationOffsets` state
- Human calibration UX (sliders, presets, reset-after-drone-reboot workflow)
- Default FOV policy (Mini 4 Pro **66.8832°** hFOV)
- Declination policy coordination (default 0)
- Future **CV** module plan: match video frame ↔ synthetic view → write same offsets
- Persistence of offsets (localStorage / config export)

## Does not own
- Raw WS (TEL)
- ENU conversion (GEO)
- Drawing boats (SCN) — SCN applies your offset-adjusted pose
- WebRTC transport (OUT) — you consume video frames when CV starts

## Critical product rule
CV must **not** create a second pose pipeline. It only updates offsets.

## First dispatches
1. Offset store + apply hook in pose path  
2. Minimal slider HUD  
3. CV spike doc (Phase 4)  

## Memo
`docs/agentic/memos/CAL_MEMO.md`
