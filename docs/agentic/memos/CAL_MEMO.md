# CAL_MEMO

**Last updated:** 2026-07-22  
**Status:** Bootstrapped — DSP issued (pose-spine CAL slice)

## Focus
Worker implements default hFOV **66.8832°** + zero offsets map + pose-path apply (1.5/1.6). Sliders deferred to 1.8.

## Decisions
- Offsets are first-class; CV will write same knobs (no second pose pipeline)
- Default hFOV **66.8832°** for Mini 4 Pro (architecture §5.3; roadmap 1.6)
- Declination default **0** (coordinate with GEO; CAL does not own declination service)
- Unity parity knobs (read-only ref `WorldAnchorManager`): yaw/pitch/roll + altitude (+ optional east/north). Web V1 contract stays §5.3 five fields; east/north deferred unless BW expands contract
- Apply order (Unity-aligned): world yaw (+ declination later) × telemetry rot × local pitch/roll; alt on ENU Y; FOV on camera from offsets (not `cam.fov`)
- Owns `src/calibration/`; apply hook in `src/pose/`; SCN draws — CAL does not invent meshes
- **BW 2026-07-22:** small DSP only — no sliders in first worker

## Issued dispatches
- **DSP-CAL-20260722-01-default-fov-zero-offsets** — active  
  Path: `docs/agentic/dispatches/active/DSP-CAL-20260722-01-default-fov-zero-offsets.md`

## Planned
- **DSP-CAL-…-offset-sliders** (roadmap **1.8**) — minimal HUD + optional localStorage after store/apply lands
- Later: CV spike doc (Phase 4 / roadmap 4.5)

## Handoffs
—

## Blockers
- GEO/SCN pose-spine DSPs may land in parallel — worker exports apply API; full camera wiring is their call site if `main` has no hook yet

## Next actions
1. Human: open **new worker chat**, paste DSP-CAL-20260722-01 (or path above).
2. On worker report-back: move DSP to `done/`, update this memo, note any HO needed to SCN/GEO.
3. After green: plan 1.8 sliders DSP.
