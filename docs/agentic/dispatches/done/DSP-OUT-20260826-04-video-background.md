# Dispatch DSP-OUT-20260826-04-video-background

## Meta
- From orchestrator: BW → OUT
- Worker role: WORKER(DSP-OUT-20260826-04-video-background)
- Priority: P0
- Phase: Phase 17.1 — in-WebGL AR background
- Design: `docs/architecture/ar-video-underlay-ntp-sync.md` §3.4, §6
- Parallel-safe with: TEL-01, TEL-02, OUT-03, CAL-05. **You own** `src/output/videoBackground.*`, `src/output/types.ts`, and the `main.ts` wiring. OUT-03 owns `desktop/*` and `srtBridge.ts` — stay out.
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` 741+23, `npm run build` green). Wrap order: background → timecode → NDI. Follow-up: `preview`+`video` still mounts realistic env.

## Goal

Draw an arbitrary texture as a fullscreen background **behind the AR scene, inside WebGL**, so it appears in the AR NDI output — and add the `arBackground: 'alpha' | 'video'` mode that gates it.

You build the compositor. **You do not need video to exist.** Develop and test against a canvas test pattern; OUT-06 swaps in real decoded frames later behind the same `setTexture` call.

## Background

### Why this cannot be a DOM element

`src/output/ndiFramePump.ts` renders to an offscreen FBO and calls `readRenderTargetPixels`. **It sees WebGL only.** The existing WHEP underlay is a DOM `<video>` beneath the canvas (`src/style.css` `.whep-underlay`, z-index 0 vs canvas z-index 1), which is exactly why it is documented preview-only and has never appeared in an NDI frame.

So the background must be drawn *inside* the render pass. Also: not `scene.background` — its aspect handling is wrong when the video ratio does not match the viewport, and we need explicit fit control.

### The seam to use

`src/output/visualTimecodeOverlay.ts` L177–193 already establishes the pattern: wrap `renderer.render`, call through, then draw an ortho overlay with `autoClear = false`. Do the mirror image — draw **before** calling through.

Ordering matters and is easy to get wrong. Install order must be:

```
videoBackground  (wraps first  → innermost → draws BEFORE the scene)
visualTimecode   (wraps second → outermost → draws AFTER the scene)
NDI pumps        (bind renderer.render last → capture both)
```

`ndiFramePump.ts` L128–129 binds `renderer.render` at pump start with the comment *"caller starts this pump after startVisualTimecode"* — the same constraint now applies to you, one layer deeper. Wire yourself in `main.ts` **before** `startVisualTimecode` (currently L1799–1806).

Clear handling: your pass clears, then the scene render must **not** clear. Set `autoClear = false` around the scene call and restore it. Getting this backwards yields either a black frame or an invisible background — test both preview and the FBO path.

### Where it must NOT appear

| Context | Background? | Why |
| --- | --- | --- |
| AR NDI, `arBackground: 'video'` | **Yes** | the point of the phase |
| AR NDI, `arBackground: 'alpha'` | No | alpha plate stays intact (L1) |
| 3D NDI channel | **No** | `ndi3dChannelPump` renders the same scene with opaque clear + realistic environment; a drone camera feed behind it is wrong |
| 2D map channel | No | different canvas entirely |
| Ops preview, free cam | **No** | a drone-POV feed behind a free-flying camera is nonsense imagery |
| Ops preview, following active POV | Yes | matches air |

Take a `shouldDraw()` callback rather than hard-coding these — the pumps and `main.ts` know the state, your module should not.

## In scope

1. New `src/output/videoBackground.ts`:
   - `startVideoBackground({ renderer, shouldDraw, getTexture?, fit? })` → handle.
   - Wraps `renderer.render` as above; ortho scene + fullscreen quad, `depthTest: false`, `depthWrite: false`, `toneMapped: false`.
   - `setTexture(tex: THREE.Texture | null)` — the seam OUT-06 will drive. Null → no draw.
   - **Aspect fit** against the drawing-buffer size (not CSS size — same reason `visualTimecodeOverlay.layout()` uses `el.width`, so it stays correct when Electron letterboxes the window). Support at least `cover` (default) and `contain`; the source ratio comes from the texture.
   - `THREE.SRGBColorSpace` on the sampled texture path — a video texture left in linear reads grey and flat next to the AR overlay.
   - `stop()` restores the original `renderer.render` and disposes geometry/material. Follow the timecode module's teardown shape.
2. `arBackground: 'alpha' | 'video'` mode:
   - Add to `src/output/types.ts` + a normaliser next to `normalizeOutputMode` (unknown → `'alpha'`, i.e. today's behaviour).
   - Add `arBackground` to `AppConfig` (`src/config/types.ts`) and `public/config.json`, default `'alpha'`. **Existing packs and configs must behave exactly as they do today** — this is a mode, not a replacement (L1).
   - An ops control to flip it. Right rail, Output section (`data-ops-section="ndi"`) is the natural home — follow `startOutputModeControl` in `src/output/outputModeControl.ts`.
3. Wire in `main.ts`: start before `startVisualTimecode`; supply `shouldDraw` reflecting mode + local focus + preview-vs-air camera; stop on teardown alongside `visualTimecode`.
4. **3D pump suppression.** Confirm and make explicit that the 3D channel never gets the background — either via `shouldDraw` reading pass state, or coordinate with `ndiOpaquePass`. Cover it with a test; this is the most likely silent regression in the dispatch.
5. Tests: `src/output/videoBackground.test.ts` — pure logic (fit maths, `shouldDraw` gating, mode normalisation, wrap install/restore ordering with a stubbed renderer). Follow `applyOutputMode.test.ts` / `localChannelSwitcher.test.ts` precedent.
6. Docs: `src/output/README.md`; add the mode row to `docs/architecture/ndi-alpha-electron.md` §2 (BW override recorded — AR now has **two** contracts, alpha and video; alpha remains the default and the fallback).

## Out of scope

- SRT, demux, decode, `VideoFrame` — OUT-03/06.
- Per-POV stream config, sync HUD — OUT-07.
- Any telemetry timing. This dispatch draws a texture; it knows nothing about NTP.
- `whepUnderlay.ts` — untouched (it stays a preview-only tool).
- Changing the environment gate. Realistic ocean/sky/terrain already force off when the clear is not opaque-safe, which is what we want in AR — **verify** it still holds with `arBackground: 'video'` and report if not, but do not redesign it.
- Depth-only terrain occlusion (explicitly deferred in the design).
- `previewFrameClock` / `STUDIO_TICK_FPS`.

## Likely files

- `src/output/videoBackground.ts` (+ test, new)
- `src/output/types.ts`, `src/output/index.ts`
- `src/output/outputModeControl.ts` (or a sibling control)
- `src/config/types.ts`, `public/config.json`
- `src/main.ts` (wiring only)
- `src/output/README.md`, `docs/architecture/ndi-alpha-electron.md`

## Inputs provided

- Render-wrap precedent: `src/output/visualTimecodeOverlay.ts` L177–193 (post-pass; you are the pre-pass)
- Drawing-buffer layout precedent: same file, `layout()` L120–144
- Pump binding + ordering constraint: `src/output/ndiFramePump.ts` L128–129, L312–317
- Mode/normaliser precedent: `src/output/applyOutputMode.ts`
- Camera state: `scene.getActivePovCamera()` / `getPreviewCamera()` — `src/scene/createScene.ts` L841–843

## Acceptance criteria

- [ ] Test pattern set → visible behind the AR scene in ops preview, correctly aspect-fitted, not stretched.
- [ ] **It appears in the AR NDI frame**, not just on screen. Verify against the FBO capture path, not by looking at the canvas — this is the whole reason the DOM approach was rejected.
- [ ] `arBackground: 'alpha'` → no background drawn; the transparent plate is **byte-identical to today**. Regression-check this hard; it is the shipped air path.
- [ ] 3D NDI channel never shows the background.
- [ ] Ops free cam → suppressed on screen; NDI (active POV) unaffected.
- [ ] Timecode barcode still renders **on top** of both scene and background, still sharp.
- [ ] `stop()` fully restores `renderer.render`; start/stop cycles do not stack wrappers.
- [ ] Window resize / Electron letterbox keeps the fit correct (drawing-buffer based).
- [ ] Old configs and race packs with no `arBackground` behave exactly as before.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (fit modes, gating design, wrap ordering, how you verified the FBO path)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers — especially the `setTexture` contract OUT-06 must satisfy, stated precisely
5. Suggested OUT memo bullets
