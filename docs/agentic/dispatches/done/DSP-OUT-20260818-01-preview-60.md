# Dispatch DSP-OUT-20260818-01-preview-60

## Meta
- From orchestrator: BW → OUT
- Worker role: WORKER(DSP-OUT-20260818-01-preview-60)
- Priority: P0
- Phase: Phase 15.1 — studio preview 60 fps
- Related: user 2026-08-18 — realistic sea “looks fine” but FPS is too low; goal **60 fps**
- Parallel-safe with: `DSP-SCN-20260818-01` (ocean cost — shaders only). Do **not** both rewrite `createScene.ts` frame-clock wiring; this DSP owns the clock. SCN-01 may add a sea-quality uniform SCN exposes; OUT does not edit GLSL.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (`npm test` 600+23; `npm run build` green). Human Electron smoke still recommended.

## Goal

Make the **ops WebGL preview** run at **~60 fps** while the window is visible, without raising NDI 3D capture to 60 (that path is `readPixels` + terrain + ocean and will not hit 60).

## Background

Electron studio today replaces `requestAnimationFrame` with the main-process `studio:tick` clock (`desktop/main.cjs` `STUDIO_TICK_FPS = 30`). `startScene({ frameClock })` therefore presents the local 3D view at **30 fps max**. That is the cap the operator feels — not only GPU cost.

NDI pumps also subscribe to `onStudioTick`. Caps from `DSP-OUT-20260812-06` (keep them):

| Channel | Default |
| --- | --- |
| AR NDI | ~30 fps, always on |
| 3D NDI | ~10 fps, staggered vs AR |
| 2D NDI | off @ ~10 when enabled |

A naive `STUDIO_TICK_FPS = 60` would present preview at 60 **and** run `terrain.tick` + NDI subscribers at 60 Hz. Do not do that.

BW lock (2026-08-18): **60 fps = ops preview only.** NDI AR stays ~30, NDI 3D stays ~10. If the user later asks for 60 on NDI 3D, that is a new dispatch (likely “3D NDI off while authoring”).

## In scope

1. **Dual clock**
   - Visible / focused studio window: drive `createScene` preview with **rAF** (~display refresh, typically 60).
   - NDI pumps stay on `studio:tick` (~30) with existing per-channel fps + AR↔3D stagger.
   - Minimized / `document.hidden`: keep today’s minimize-safe studio tick so NDI does not freeze (do not rely on Chromium rAF when hidden).
   - Document the split in `src/output/README.md` and `docs/ops/air-runbook.md`.

2. **Do not** raise 3D NDI fps. Do not capture AR+3D on the same tick.

3. **Ops FPS readout** (if none exists on the 3D path): show preview fps (smoothed, e.g. 1 s window) so the operator can see 60 vs 30 vs 15. Reuse HUD chrome; do not add a new sidebar tab.

4. **Cheap preview pass (optional if still <50 after dual-clock):** skip `terrain.tick` on every other rAF frame while 3D NDI is not capturing that tick. Do not skip the preview `renderer.render`. Measure before adding; do not add if dual-clock alone hits ~60 on a mid GPU with realistic env on.

5. Tests: clock split is unit-testable (preview subscriber ≠ NDI subscriber; hidden → studio tick still fires NDI). Do not require a GPU fps assertion.

## Out of scope

- Raising NDI 3D or AR to 60.
- Ocean clipmap / glitter / wind shaders (`DSP-SCN-20260818-01`).
- Fleet persist, boats, buoys.
- Async PBO `readPixels` (still a later stretch).
- Changing studio lock resolution.

## Likely files

- `desktop/main.cjs` (keep 30 tick unless a comment-only change)
- `src/scene/createScene.ts` (frameClock vs rAF when visible)
- `src/output/studioBridge.ts`, NDI pumps only if they must ignore rAF
- `src/main.ts` (wire dual clock)
- `src/output/README.md`, `docs/ops/air-runbook.md`
- Tests next to the clock helper

## Inputs provided

- `createScene.ts` `frameClock` / `tick()` / rAF fallback already exist.
- `desktop/main.cjs` `STUDIO_TICK_FPS = 30`.
- NDI caps: `ndiFramePump.ts`, `ndi3dChannelPump.ts`, `ndiCaptureStagger.ts`.

## Acceptance criteria

- [ ] Visible Electron studio 3D preview is no longer hard-capped at 30 fps (rAF when visible).
- [ ] AR NDI still ~30, 3D NDI still ~10, stagger unchanged, 2D default off.
- [ ] Minimized studio still sends NDI (studio tick path).
- [ ] Ops can see a preview fps number.
- [ ] `npm test` + `npm run build` green.

## Report back

When done, reply with:
1. Summary (clock split, any terrain-tick skip, measured preview fps if smoked in Electron)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested OUT memo bullets
