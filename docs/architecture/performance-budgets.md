# Performance budgets — studio frame time

**Status:** Studio 30 hitch failed live (BW 2026-08-28). Lock: AR 30 / 3D 30 / 2D on@30 via **60 Hz `studio:tick`**. On the PBO path AR and 3D may both FBO in the same tick (`DSP-OUT-20260829-04`). Sync `readPixels` fallback still arbitrates one FBO per window. Preview stays rAF.  
**Owner:** PRF (measurement + caps). SCN owns look. OUT owns pixels leaving the app.  
**Related:** [`ndi-alpha-electron.md`](./ndi-alpha-electron.md) · [`geospatial-terrain-cesium.md`](./geospatial-terrain-cesium.md) §5 · `DSP-OUT-20260818-01` · `DSP-OUT-20260812-06` · `DSP-PRF-20260826-01` · `DSP-PRF-20260829-01` · `HO-BW-PRF-20260828-05` · `DSP-OUT-20260828-01` · `DSP-OUT-20260828-02` · `DSP-OUT-20260828-04` · `DSP-OUT-20260829-04`

This is the source of truth for **how often** things run. Visual quality lives in SCN docs. Output path (chroma / NDI / SRT) lives in OUT.

## Caps (do not “just bump fps”)

| Path | Target | Clock | Notes |
| --- | --- | --- | --- |
| Ops WebGL **preview** | ~**60 fps** when the window is visible | `requestAnimationFrame` | Phase 15.1. Hidden window may fall back to `studio:tick`. Preview is **not** 60 because `STUDIO_TICK_FPS` is 60. |
| NDI **AR** (air plate) | ~**30 fps** | `studio:tick` (60 Hz) | Always on. Phase-accumulate gate (~32 nominal). Independent of 3D on the PBO path. PBO pack; `sendFrame` deferred off the tick. Do not patch `renderer.render`. |
| NDI **3D** | ~**30 fps** | `studio:tick` (60 Hz) | Always on. Same independent clock as AR. Sync `readPixels` fallback still refuses a second blocking FBO in the stagger window. |
| NDI **2D** (stream map) | **on @ 30** | `studio:tick` (deferred) | Canvas CPU grab, **off the FBO tick** (worker + transferable; sync `getImageData` fallback). Gate and send do not wait on AR/3D. Default **on**. NDI tab toggle may stop **only** this sender. |
| `desktop/main.cjs` `STUDIO_TICK_FPS` | **60** | main process | NDI capture clock. Preview stays rAF. Do not change this constant. |

On the PBO path both NDI FBO renders may share a tick. Async PBO **readback** may still complete on a skipped (rate-capped) tick. Check PBO slot capacity **before** the 1080p render. 2D is not an FBO and does not occupy a stagger slot. Sync-readback fallback keeps one blocking FBO per window.

## Dual clock (locked)

- Preview feels fast because it is on rAF (~60), not because NDI Send is 60 (NDI target is 30).
- NDI pumps stay on `studio:tick` at 60 Hz. On the PBO path AR and 3D each run their own ~32 fps phase gate so Send stays ~30+30 without alternating. IPC send is off the tick.
- Pose *presentation time* (matched NTP / `syncTrimMs`) picks **which** pose, never **how often** we render. TEL-08 / CAL must not change these clocks.

## What “slow” usually is

Measure before changing look.

1. **Preview fps HUD low, NDI cadence OK** — GPU scene cost (ocean, Cesium tiles, lights) or main-thread hitch. PRF + SCN.
2. **Preview OK, NDI drops / UI stalls when NDI is live** — `readPixels` / `getImageData` + encode. PRF + OUT. Do not silently drop a channel.
3. **SRT `decoded` / colour bars** — decode path, not frame budget. **OUT**, not PRF.
4. **Tile pop / hitch then recover** — Cesium compile/upload, not average fps. See terrain doc §5 (fade, unload budget, lock-tiles air mode).
5. **GPU % low (~10%) while preview hitch is high** — JS/renderer thread blocked (sync IPC clone of 8 MB, sync `readPixels`, or sync 2D copy). Defer `sendFrame` off the tick (`DSP-OUT-20260829-04`). 2D grab is deferred off the FBO stack (`DSP-OUT-20260828-07`).

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

### NDI stage timing (`DSP-PRF-20260829-01`) — what to turn on, what to read

Measurement only. Does **not** change caps, stagger, copies, or `STUDIO_TICK_FPS`. All three NDI channels stay on.

**Turn on.** Run the Electron studio (`npm run desktop:dev`) with all three NDI senders on (2D toggle stays checked). SRT live is preferred so `present()` is in the tick. Open the ops **NDI** tab. The **Stage timing (1 s)** block is live; fallback warnings appear on that tab if sync `readPixels` or sync 2D `getImageData` is active (not a one-time console line).

**Copy a dump.** Click **Copy 10 s dump** (or paste `window.__perfDump()` from the DevTools console). The dump is text: 10 × 1 s stage rows plus ~10 s histograms. Paste that block into chat — a HUD screenshot is not enough.

| Number | What it is | Healthy | Sick |
| --- | --- | --- | --- |
| `tickIntervalMs` | Distribution of `studio:tick` arrivals (ms, floored). | Tight cluster on **16** (~16.7 ms → 60 Hz). Few `>20ms`. | Mean ~16.7 with a fat `18`/`19`/`≥20` tail → clock is not 60. Then ignore downstream. |
| `captureTicks ar/3d/2d` | **Studio ticks between consecutive successful captures**, as a histogram. **Do not average this.** | Tight cluster on **2** (30 fps on a 60 Hz tick). | **2-vs-3 split** or cluster on **3** and **4** → phase-lock of a knife-edge interval vs the 16.7 ms clock (the ~18 Send fps defect). |
| `stages mean/max` | Renderer work per named stage, 1 s mean and max ms. `totalTick` is the full sync `studio:tick` handler (before deferred 2D grab **and** deferred `sendFrame`). | `totalTick` well under 16 ms mean; FBO render visible but not dominating. `*EnqueueIpc` must **not** sit inside `totalTick`. | One stage's **max** near/over 16–33 ms is the wall for that second. `*EnqueueIpc` mean still **>12 ms** after slice-kill + defer → stop; that is the payload-size decision. |
| `skips/s` | Per channel: `rateCap` (phase gate), `stagger` (sync-fallback FBO claim), `busy` (renderer still sending). | `rateCap` ≈ 30 on AR/3D (the other tick of the 60 Hz clock). `stagger` ≈ 0 on PBO; non-zero only on sync `readPixels`. `busy` ≈ 0. | High `busy` → renderer thinks IPC is still in flight (rare today; send is fire-and-forget). |
| `main … dropBusy` | Keep-newest discards in main (`DSP-OUT-20260829-02`): a newer frame replaced a pending one while `grandi.video` was in flight. Not a silent busy-drop. | 0 at 30 fps arrival. | Non-zero at 30×3 → sender still back-pressured; Send fps can still look fine because arrivals were accepted. |
| `main … bgra / video` | `rgbaToBgra` ms and `grandi.video` promise ms, per channel, 1 s window. Native RGBA path leaves **bgra at 0**. | `rgbaToBgra` **0** (loop deleted); `video` not stuck at tens of ms. | `rgbaToBgra` back in the 5–15 ms range → BGRA fallback is on (`NDI_BGRA_FALLBACK_NOTE` in the studio terminal). Long `video` → SDK back-pressure (`dropBusy` will follow). |
| `overhead` | Cost of the instrument itself (record + `performance.now` pairs). | ≪ 0.2 ms per sample. | If overhead approaches a millisecond, the dump is lying; ignore. |
| Fallback banner | Sync readback / sync 2D grab while active. | Hidden. | Visible → that path is stalling the tick; PBO / 2D worker did not stick. |

**How to use the dump for the next fps dispatch.** Name the stage that was removed, do not guess. If `captureTicks` is 2-vs-3, the rate gate is quantising; if enqueue/IPC dominates `totalTick`, that copy is the wall; if `main … bgra` is back at ~7 ms the BGRA fallback is on; if `dropBusy` is non-zero at 30 fps arrival the sender is still back-pressured despite the keep-newest queue.

**First live dump (operator 2026-08-29).** Send AR 15 / 3D 15 / 2D 3. Clock not 60: 495 ticks / ~10 s, mean 20.2 ms, max 109.5, `>20ms=225`. `captureTicks` mixed 1…6+ (not a clean 2-vs-3). Named walls: `*EnqueueIpc` 17–23 ms (renderer slice + sync IPC, *inside* the tick); `2dGrab` 120–193 ms (worker `getImageData` of 1920×1080 after a 520 upscale — worker path was on); `rgbaToBgra` ~7 ms with `dropBusy=0` (main keeping up). FBO render ~1 ms. `present()` ~0.03 ms. PBO and 2D-worker fallbacks were off. Instrument overhead 0.005 ms/sample. This recut wave 3: defer IPC + drop slice (`OUT-04`), native 2D blit (`OUT-20260830-01`), keep the BGRA deletion for the 30×3 ceiling (`OUT-02`).

**Live 2026-09-02 (`DSP-OUT-20260902-05`, operator Pass, 30×3 parked).** No SYNC READBACK banner. All Send off → preview **60**. One-on: 3D Send **20–25** / preview ~30; AR **17–20** / ~30; 2D **10** / preview 60. Three on: preview **11–12**, Send AR **14** / 3D **14** / 2D **5**, all Status **live**. Cap is still 30/30/30. Operator accepted this for now — do not drop a channel; do not treat uncheck as the plan.

Instrument overhead is in the dump (`instrument overhead`). Send fps with this on should stay within ~1 fps of Send fps with it off.

### Idle vs mousedown (`HO-BW-PRF-20260902-01`) — two dumps, then A/B/C

Do **not** productize click-to-go-faster. Do **not** fake mouse. `backgroundThrottling` is already false. `STUDIO_TICK_FPS` is already 60.

**Where to look (Electron studio only).** Left **Race ops** (expand): `preview` fps + `hitch`. Right **Output** (open): **Send** on AR / 3D / 2D, then **Stage timing** → **Copy 10 s dump** (after DSP-PRF-20260902-01: **Copy idle 10 s** / **Copy mouse 10 s**). Chrome Send is `—`.

**Run (operator, ~25 s).** 2D NDI stays on. Hands off the mouse except as written.

1. **Idle 10 s.** Do not touch mouse or keys. Watch Race ops `preview` / `hitch` and Output **Send**. Copy dump (label `idle`). Paste the dump **and** the four HUD numbers if the dump header lacks them.
2. **Mousedown + hover 10 s.** Hold left button on the WebGL canvas and move slowly. Copy dump (label `mousedown`). Paste dump + HUD numbers.
3. Hands off. Confirm idle returns to the low/crunchy feel.

| Verdict | What the two pastes show | Next |
| --- | --- | --- |
| **A** | Preview jumps with mouse; **Send stays ~8–15** (or flat). `tickIntervalMs` stays tight on **16**. | Dual-clock / compositor: click wakes **rAF**, not NDI. NDI is still the wall. No fake input. OUT only if a Send stage is also sick at idle. |
| **B** | **Preview and Send both** jump with mouse (e.g. ~8 → >40). | JS/renderer thread starved until input. Name the idle **stage max**: `3dCpuPack` / `3dReadbackDrain` / `3dEnqueueIpc` vs `2dGrab` vs `*EnqueueIpc`. If 3D CPU UYVY pack dominates → **HO-PRF-OUT** (correct GPU UYVY may return only with READ-proven dest, no `w*2===srcW` skip). |
| **C** | `tickIntervalMs` **fat idle** (mean ≫ 16, fat `≥20` tail); **tight on 16** while mouse is down. | Same class as B: the 60 Hz tick is not arriving. Still not a mouse feature. Name the hog from idle `totalTick` / pack stages, then OUT. |

HUD screenshot is not enough. Two text dumps + the four HUD numbers (preview, hitch, Send×3).

## Operator request — Studio 30 Send (BW 2026-08-28; clock 60 for stagger)

UI/preview ~60 rAF already meets “not less than 30.” Product lock: **three NDI senders at 30 fps, always on.** Send is not 60. The capture clock is 60 Hz so each channel can hit 30 with independent phase gates (`DSP-OUT-20260829-04`).

| Wave | Status | Work |
| --- | --- | --- |
| 0 | **accepted** `DSP-OUT-20260828-01` | Async PBO / non-blocking readback. |
| 1 | **accepted in code** `DSP-OUT-20260828-02` | AR/3D/2D Send 30, 2D default on. Same-tick FBO **failed live** (hitch). |
| 1b | **in tree** `DSP-OUT-20260828-04` | One FBO per stagger window (incl. PBO). `STUDIO_TICK_FPS` 60 NDI-only. 2D stays on. Hitch is the gate. |
| 2 | **in tree** `DSP-OUT-20260828-07` | 2D deferred off the FBO tick; worker + transferable grab; fail closed to sync. SCN cost knobs only if preview **&lt;30** **and** GPU % is high. |

Pose smoothness (10 Hz WebSocket) is TEL (`DSP-TEL-20260828-01`), not a frame-budget bump.

## Refusal (PRF)

- “Make NDI **Send** 60 fps” → refuse (Send lock is 30/30/30).
- “Drop 3D or 2D back to 10 / off because hitch or low GPU %” → report numbers; do not silent-fallback.
- “Fix SRT colour bars / HEVC” → SRT / OUT.
- “Make the sea look better” → SCN (PRF only if the ask is *cheaper*).
- “Fake mouse / hover loop / rAF keep-alive so idle stays 40” → refuse.
