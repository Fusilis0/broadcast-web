# Performance budgets — studio frame time

**Status:** Studio 30 hitch failed live (BW 2026-08-28). Lock: AR 30 / 3D 30 / 2D on@30 via **60 Hz `studio:tick` + one NDI FBO per tick** (`DSP-OUT-20260828-04`). Preview stays rAF.  
**Owner:** PRF (measurement + caps). SCN owns look. OUT owns pixels leaving the app.  
**Related:** [`ndi-alpha-electron.md`](./ndi-alpha-electron.md) · [`geospatial-terrain-cesium.md`](./geospatial-terrain-cesium.md) §5 · `DSP-OUT-20260818-01` · `DSP-OUT-20260812-06` · `DSP-PRF-20260826-01` · `HO-BW-PRF-20260828-05` · `DSP-OUT-20260828-01` · `DSP-OUT-20260828-02` · `DSP-OUT-20260828-04`

This is the source of truth for **how often** things run. Visual quality lives in SCN docs. Output path (chroma / NDI / SRT) lives in OUT.

## Caps (do not “just bump fps”)

| Path | Target | Clock | Notes |
| --- | --- | --- | --- |
| Ops WebGL **preview** | ~**60 fps** when the window is visible | `requestAnimationFrame` | Phase 15.1. Hidden window may fall back to `studio:tick`. Preview is **not** 60 because `STUDIO_TICK_FPS` is 60. |
| NDI **AR** (air plate) | ~**30 fps** | `studio:tick` (60 Hz) | Always on. One FBO render per stagger window; alternates with 3D. PBO pack. Do not patch `renderer.render`. |
| NDI **3D** | ~**30 fps** | `studio:tick` (60 Hz) | Always on. Same stagger: second FBO on the same tick is skipped, including PBO (`blocking: false`). |
| NDI **2D** (stream map) | **on @ 30** | `studio:tick` (deferred) | Canvas CPU grab, **off the FBO tick** (worker + transferable; sync `getImageData` fallback). Default **on**. NDI tab toggle may stop **only** this sender. |
| `desktop/main.cjs` `STUDIO_TICK_FPS` | **60** | main process | **NDI stagger only.** Spreads AR 30 + 3D 30 on alternate ticks. Preview stays rAF. Do not also render two FBOs on one tick. |

Two NDI FBO renders must not share a stagger window. Async PBO **readback** may still complete on a skipped tick. 2D is not an FBO and does not occupy that slot.

## Dual clock (locked)

- Preview feels fast because it is on rAF (~60), not because NDI Send is 60 (NDI target is 30).
- NDI pumps stay on `studio:tick` at 60 Hz; **one FBO render per tick** so Send stays ~30+30.
- Pose *presentation time* (matched NTP / `syncTrimMs`) picks **which** pose, never **how often** we render. TEL-08 / CAL must not change these clocks.

## What “slow” usually is

Measure before changing look.

1. **Preview fps HUD low, NDI cadence OK** — GPU scene cost (ocean, Cesium tiles, lights) or main-thread hitch. PRF + SCN.
2. **Preview OK, NDI drops / UI stalls when NDI is live** — `readPixels` / `getImageData` + encode. PRF + OUT. Do not silently drop a channel.
3. **SRT `decoded` / colour bars** — decode path, not frame budget. **OUT**, not PRF.
4. **Tile pop / hitch then recover** — Cesium compile/upload, not average fps. See terrain doc §5 (fade, unload budget, lock-tiles air mode).
5. **GPU % low (~10%) while preview hitch is high** — JS/renderer thread blocked (two FBOs on one tick, or sync 2D copy). Stagger + tick 60 feeds the card every ~16 ms. 2D is deferred off the FBO stack (`DSP-OUT-20260828-07`).

## Quality ladders (cost knobs, not new features)

PRF may ask SCN for cheaper defaults or ops toggles. PRF does not invent new VFX.

Known cost centers (inventory, not a rewrite list):

- Gerstner ocean / sea quality / foam
- Cesium `TilesRenderer` (multi-cam LOD, VRAM unload, lock-tiles)
- Wind strings count / tick
- NDI delay RAM buffer (OUT-05; allocate only when delay > 0)
- Four warm SRT decodes (OUT; cap 4 — do not raise)

## Measurement (PRF playbook)

- Ops **preview fps** (1 s window) — operator number for (1).
- Ops **GPU** string (`WEBGL_debug_renderer_info`) and **hitch/s** (`dt` > 50 ms in a 1 s window; `dt` > 33 ms is tooltip-only). Tile compile shows as hitch-then-recover, not a low average. Hidden-window studio ticks are ~16.7 ms at 60 Hz (not the 33 ms bucket).
- NDI **Send** fps on the Output rail is a live 1 s count of successful `sendFrame` calls (`getSendFps()`, `DSP-PRF-20260826-01`). Staggered-away FBO claims do not count. The rail hint documents the **caps** (AR 30 / 3D 30 / 2D on@30); Send is the measurement.
- Workers must not assert GPU fps in unit tests. Clock split, stagger, hitch-window math, and send-fps counters **are** unit-testable.
- Electron smoke (still open after PRF-01): GPU adapter string + preview fps + hitch/s + AR/3D/2D send fps, plus a one-line hitch note (tile compile vs sustained vs JS blocked). Chrome automation fps is not a studio number.
- Dual-GPU: pin `electron.exe` to the discrete GPU if the HUD GPU string is Intel (studio machine, not a product feature). WebGL `powerPreference: 'high-performance'` is the in-app hint (PRF-01).

## Operator request — Studio 30 Send (BW 2026-08-28; clock 60 for stagger)

UI/preview ~60 rAF already meets “not less than 30.” Product lock: **three NDI senders at 30 fps, always on.** Send is not 60. The capture clock is 60 Hz **only** to alternate AR vs 3D FBO renders.

| Wave | Status | Work |
| --- | --- | --- |
| 0 | **accepted** `DSP-OUT-20260828-01` | Async PBO / non-blocking readback. |
| 1 | **accepted in code** `DSP-OUT-20260828-02` | AR/3D/2D Send 30, 2D default on. Same-tick FBO **failed live** (hitch). |
| 1b | **in tree** `DSP-OUT-20260828-04` | One FBO per stagger window (incl. PBO). `STUDIO_TICK_FPS` 60 NDI-only. 2D stays on. Hitch is the gate. |
| 2 | **in tree** `DSP-OUT-20260828-07` | 2D deferred off the FBO tick; worker + transferable grab; fail closed to sync. SCN cost knobs only if preview **&lt;30** **and** GPU % is high. |

Pose smoothness (10 Hz WebSocket) is TEL (`DSP-TEL-20260828-01`), not a frame-budget bump.

## Refusal (PRF)

- “Make NDI **Send** 60 fps” / two FBOs on one 60 Hz tick → refuse (Send lock is 30/30/30; one FBO per tick).
- “Drop 3D or 2D back to 10 / off because hitch or low GPU %” → report numbers; do not silent-fallback.
- “Fix SRT colour bars / HEVC” → SRT / OUT.
- “Make the sea look better” → SCN (PRF only if the ask is *cheaper*).
