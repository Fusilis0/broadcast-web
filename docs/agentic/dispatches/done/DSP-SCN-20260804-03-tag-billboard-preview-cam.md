# Dispatch DSP-SCN-20260804-03-tag-billboard-preview-cam

## Meta
- From orchestrator: BW → SCN (Phase 8.4)
- Worker role: WORKER(DSP-SCN-20260804-03-tag-billboard-preview-cam)
- Priority: P0
- Phase: Phase 8 — Visual & authoring QoL
- Related: free cam, boat tags, countdown plates, NDI air lock (do not break)
- **Status: DONE** (SCN+BW accepted 2026-08-04)

## Goal

All ops billboards (boat tags, countdown plates, and any similar sprites) face the **preview camera** (free or follow). Air/NDI may use active POV — tags on the **NDI plate** should face the **air** camera when dual-rendering (preview ≠ air).

## Background

- README claims preview billboard; ops still report free-cam tags wrong / air tags following free cam.
- OUT dual-render: screen = preview, NDI = air FBO — tag `lookAt` must use the camera being rendered for that pass.

## In scope

1. Audit `updateTag` / flag sprites / any billboard — which camera is passed in `createScene` tick and NDI air pass.
2. Fix: preview render → preview cam; air/NDI render → active POV cam.
3. Manual checklist in scene README (free cam + NDI note).
4. Unit test if a pure helper exists; build green.

## Out of scope

- New tag art / Unity font port
- Stream 2D map
- Changing NDI = active POV contract

## Likely files

- `src/scene/createScene.ts`, `boatTag.ts`, `freeCam.ts`
- `src/scene/flags/*`, `src/output/ndiFramePump.ts` (only if air-pass hook needed — coordinate OUT)
- `src/scene/README.md`

## Acceptance criteria

- [x] Free cam: tags face free cam on screen
- [x] NDI (or air FBO): tags face active POV when preview is free
- [x] Follow mode unchanged / sane
- [x] Docs + build green

## Worker report (summary)

Sprites already auto-face the WebGL render camera; the bug was **distance-scale** stuck on the preview camera during the NDI air FBO pass. Added `orientOpsBillboards` + NDI `prepareCameraPass` so dual-render orients for air then preview. Countdown clock tick split from billboard orient. Pure helper `resolveBillboardCamera` unit-tested. Scene README manual checklist added. NDI = active POV contract unchanged.

## Report back

1. **Summary:** Per-pass billboard scale for preview vs air; NDI no longer inherits free-cam tag scales.
2. **Files:** `createScene.ts`, `countdownController.ts`, `countdownTimerSprite.ts`, `boatEntity.ts`, `billboardPassCamera.ts`(+test), `ndiFramePump.ts`, `main.ts`, `scene/README.md`, `output/README.md`, `scene/index.ts`
3. **Tests:** `npm test` 264 passed; `npm run build` green
4. **Follow-ups:** Manual Electron free-cam + NDI checklist in scene README (ops verify)
5. **SCN memo bullets:** `DSP-SCN-20260804-03` DONE — billboard scale per render pass; OUT `prepareCameraPass` wired

## Worker paste block

```
You are WORKER(DSP-SCN-20260804-03-tag-billboard-preview-cam).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260804-03-tag-billboard-preview-cam.md
2. docs/agentic/dispatches/done/DSP-OUT-20260803-01-ndi-active-cam-lock.md (dual-render)
3. src/scene/createScene.ts tick / tag update
4. src/output/ndiFramePump.ts air pass

Fix billboard camera per render target (preview vs air). Do not make NDI follow free cam.
Report back per dispatch.
```
