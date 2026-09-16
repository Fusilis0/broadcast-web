# Dispatch DSP-SCN-20260915-03-srt-3d-program-cam

## Meta
- From: **BW**. Domain: **SCN**
- Worker: WORKER(DSP-SCN-20260915-03-srt-3d-program-cam)
- Priority: **P1** (after 02 for bottom bar; after 01)
- Phase: **22.4d**
- Design: `docs/architecture/srt-program-cameras.md` §2

## Goal

OBS **3D** is the **program rig**, not the ops free cam. **Control 3D program** on the bottom bar: off = ops look only; on = drive program rig (studio 3D **shows** that rig). Program motion **damped**.

## Background

Today `srtOut:previewView` copies ops free cam to the 3D plate. Operator: what I see and what I send must differ until takeover.

## In scope

1. Two rigs: ops (existing free/follow) vs program (new). 3D plate **only** program.
2. Stop pushing ops view to 3D SRT.
3. Bottom bar **Control 3D program** latch. Off: WASD/orbit = ops. On: WASD/orbit = program; studio 3D = program view.
4. Damping on program only. Optional **Frame boats** (telemetry boats).
5. Tests: ops move does not change program pose; takeover routes input to program.

## Out of scope

2D cam (04). AR follow (01). Visibility matrix (02, reuse bar). `STUDIO_TICK_FPS`. Capture.

## Likely files

- `src/scene/freeCam.ts` / createScene camera
- `src/main.ts` IPC `srtOut:previewView`
- Bottom bar from 02

## Acceptance

- [x] Move ops 3D: OBS 3D still
- [x] Control on: OBS 3D follows damped control; studio shows that view
- [x] Control off: studio ops cam again; OBS holds last program pose
- [x] No `STUDIO_TICK_FPS`

## Report

IPC retired/replaced; damping constant.
