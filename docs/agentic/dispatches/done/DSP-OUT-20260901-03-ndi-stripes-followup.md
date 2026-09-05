# Dispatch DSP-OUT-20260901-03-ndi-stripes-followup

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260901-03-ndi-stripes-followup)
- Priority: P0
- Phase: Phase **19.3 follow-up**
- Related: `done/DSP-OUT-20260901-01-ndi-yuv-stripes.md`
- **Status: DONE (code)** — worker 2026-09-01; suite **1035 + 23** / build green. **Human OBS gate open.**

## Goal

Close remaining OBS vertical green stripes after OUT-01 (Three DRAW-only bind vs WebGL2 READ for `readPixels`).

## Acceptance criteria

- [x] Root cause identified: READ vs DRAW
- [x] DRAW → READ bind before PBO; fail-closed if incomplete
- [x] `npm test` + `npm run build` green — **1035 + 23**
- [ ] **Human OBS:** `broadcast-web-3d` no stripes — awaiting operator

## Worker report (summary)

WebGL2 `readPixels` samples READ_FRAMEBUFFER; Three `setRenderTarget` binds DRAW only. OUT-01 rebound was DRAW-only → PBO still read scene FBO corner. Fix: copy DRAW FBO onto READ before pack; drop frame if DRAW missing/incomplete. AR side-effect: READ now samples Y-flipped dest after blit.

## Files delivered

- `src/output/ndiAsyncReadback.ts`, `ndiAsyncReadback.test.ts`, `ndi3dChannelPump.ts` (comments), `ndiGpuUyvy.test.ts`, `README.md`
