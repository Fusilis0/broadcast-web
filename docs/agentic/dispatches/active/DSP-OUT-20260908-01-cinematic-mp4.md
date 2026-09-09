# Dispatch DSP-OUT-20260908-01-cinematic-mp4

## Meta
- From orchestrator: OUT (BW issued 2026-09-08)
- Worker role: WORKER(DSP-OUT-20260908-01-cinematic-mp4)
- Priority: **P1**
- Phase: **21** — silent MP4 export
- Related: `HO-BW-OUT-20260908-01`. Design: `docs/architecture/commercial-video.md` §7. SCN player: `DSP-SCN-20260908-01`.
- Worker result: **code-complete 2026-09-09**. Canvas MediaRecorder 30 fps; Electron save + ffmpeg remux if WebM. `#ops-cinematic-record` enabled. NDI untouched. **Human Pass:** Electron Record → playable silent MP4 ~60 s.

## Goal

Record the cinematic **3D** view to a **silent 1920×1080 30 fps MP4** on disk (Electron). vMix will play that file. The app does not then go live.

## Background

NDI UYVY on the JS thread is the wrong capture. Prefer canvas `MediaRecorder` (vp9/h264) **or** ffmpeg grabbing a chrome-free buffer — pick the one that actually yields a playable MP4 on this Windows studio. SCN already hides HUD in cinematic mode; do not dual-render air POV.

## In scope

1. Ops **Record** (SCN may leave a stub) starts player at t=0, captures until sequence `durationSec`, writes `intro-bosphorus.mp4` (or Save-as path).
2. **Silent** — no audio track.
3. Clock: consume SCN’s **30 Hz** cinematic tick (do not record 60 rAF and speed the film).
4. Failures: disk/permission → ops status, no throw loop. Web-only (no Electron) → status “desktop only” is OK.
5. Tests: recorder refuses when cinematic inactive; mime/fps constants; no NDI import in the new module.
6. Docs: `src/output/README.md` one-liner — cinematic MP4 ≠ NDI.

## Out of scope

- Globe math, cloud look, sequence JSON
- Phase 22 SRT
- NDI
- Burning credits
- vMix setup (human)

## Likely files

- `src/output/cinematicRecorder.ts` (+ test)
- `desktop/` only if MediaRecorder needs a main-process save dialog
- Wire from SCN Record button via a callback in `main.ts` — keep file-disjoint: OUT owns encode, SCN owns play

## Inputs provided

- 1920×1080, 30 fps, silent, ~60 s
- SCN-01 hooks:
  - `scene.playCinematic()` / `pauseCinematic()` / `seekCinematic(t)` / `getCinematicTransport()`
  - `scene.renderer.domElement` (studio 1920×1080)
  - `CINEMATIC_FPS` = 30 — do not advance the spline from 60 rAF
  - `isCinematicActive()` already hide-race
  - Enable `#ops-cinematic-record` (currently disabled stub)

## Acceptance criteria

- [ ] Electron: Record → playable silent MP4 ~ sequence duration (±0.5 s).
- [ ] File is 1080p; vMix or a desktop player opens it.
- [ ] Preview/HUD not in the frame (cinematic hide).
- [ ] NDI pumps untouched.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Summary (MediaRecorder vs ffmpeg)  
2. Files  
3. How to Record (clicks)  
4. Follow-ups  
5. Memo bullets for OUT
