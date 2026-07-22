# CAL_MEMO

**Last updated:** 2026-07-22  
**Status:** Bootstrapped — blocked on pose path (PLT → GEO → SCN)

## Focus
Plan first worker DSP for `CalibrationOffsets` store + apply + minimal sliders (FOV default **66.8832°** h), once pose path exists. Do **not** issue until GEO ENU + SCN camera apply hook are real.

## Decisions
- Offsets are first-class; CV will write same knobs (no second pose pipeline)
- Default hFOV **66.8832°** for Mini 4 Pro (architecture §5.3; roadmap 1.6)
- Declination default **0** (coordinate with GEO; CAL does not own declination service)
- Unity parity knobs (read-only ref `WorldAnchorManager`): yaw/pitch/roll + altitude (+ optional east/north). Web V1 contract stays §5.3 five fields; east/north deferred unless BW expands contract
- Apply order (Unity-aligned): world yaw (+ declination later) × telemetry rot × local pitch/roll; alt on ENU Y; FOV on camera
- Owns `src/calibration/`; SCN applies offset-adjusted pose — CAL does not draw scene

## Issued dispatches
—

## Planned (do not issue until pose path green)
- **DSP-CAL-20260722-01-offsets-store-apply-sliders** — `CalibrationOffsets` typed store (per-device map), apply hook on pose path, default FOV 66.8832°, minimal yaw/pitch/roll/FOV/alt sliders + reset; localStorage optional in same DSP if cheap else follow-up
- Later: CV spike doc (Phase 4 / roadmap 4.5) — out of V1 spine

## Handoffs
—

## Blockers
- **PLT** scaffold active (`DSP-PLT-20260722-01-scaffold-vite-three`) — no `src/` / `src/calibration/` / `src/pose/` yet
- **GEO** not issued — ENU / GeoOrigin pending PLT green
- **SCN** idle — no camera apply path until stub scene + Phase 1 pose (roadmap 1.5)
- Unblock when: pose pipeline exists as `rawTelemetryPose → GEO → + CAL offsets → SCN camera` (even with mock pose)

## Next actions
1. Wait for PLT green + GEO port + SCN camera/pose apply (or BW notify that pose stub is ready).
2. Issue DSP-CAL-20260722-01; open new worker chat.
3. Refuse WS transport (TEL) / mesh art (SCN) / WebRTC (OUT) — handoff only.
