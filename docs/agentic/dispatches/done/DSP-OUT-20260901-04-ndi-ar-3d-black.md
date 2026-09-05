# Dispatch DSP-OUT-20260901-04-ndi-ar-3d-black

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260901-04-ndi-ar-3d-black)
- Priority: P0
- Phase: Phase **19.3** — after OUT-03, AR + 3D NDI are **black** in OBS; **2D still works**
- Related: `done/DSP-OUT-20260901-03-ndi-stripes-followup.md` · operator 2026-09-01
- **Status: DONE (code)** — worker 2026-09-01; suite **1038 + 23** / build green. **Human OBS gate open.**

## Goal

Restore live **`broadcast-web`** (AR) and **`broadcast-web-3d`** pictures in OBS without bringing back vertical green/purple stripes. **`broadcast-web-2d` must keep working.**

## Acceptance criteria

- [x] Code: READ bind uses `begin(target)` RT FBO (`properties` / `__webglFramebuffer`), not DRAW==null fail-closed
- [x] Anti-stripe: drop when target FBO cannot be resolved (never default-FB / scene DRAW as UYVY)
- [x] 2D path unchanged (`createNdi2dAsyncCapture`; no `createNdiAsyncReadback`)
- [x] `npm test` + `npm run build` green — **1038 + 23**
- [ ] **Human OBS:** AR + 3D picture (not black, no stripes); 2D still OK — awaiting operator

## Worker report (summary)

OUT-03 copied `DRAW_FRAMEBUFFER_BINDING` onto READ and returned false when DRAW was null. On ANGLE/Electron that query is null after Three `setRenderTarget`, so every AR/3D `begin()` dropped → black. 2D never uses this helper. Fix: bind READ to the passed RT’s `__webglFramebuffer` (Three `properties.get` first). Fail closed only when that FBO is missing/incomplete — do not pack DRAW or the default FB as UYVY. Begin API unchanged.

## Files delivered

- `src/output/ndiAsyncReadback.ts`, `ndiAsyncReadback.test.ts`
- `src/output/ndi3dChannelPump.ts` (comment only)
- `src/output/ndiIndependentClocks.test.ts` (stagger isolation; not product)
- `src/output/README.md`

## Human OBS checklist

1. Electron studio, all three senders on. OBS: `broadcast-web`, `broadcast-web-3d`, `broadcast-web-2d`.
2. **Pass:** AR keys (UYVA), 3D matches in-app (UYVY, no vertical green/purple stripes), 2D map still letterboxed.
3. **Fail black:** AR/3D stay black (bind still dropping). **Fail stripes:** 3D/AR show scene-corner RGB as 4:2:2. Do not change OBS colour format.
