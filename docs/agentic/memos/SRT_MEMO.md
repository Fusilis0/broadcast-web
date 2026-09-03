# SRT_MEMO

**Last updated:** 2026-09-03  
**Status:** Depth-2 ordered deferred-send queue shipped for AR and 3D. `?ndiQueueDepth=1` restores single-slot latest-wins. B (`?ndiDefer=microtask`) stays diag-only. C (cut rAF/tick load) is OUT/PRF, not started. No depth 3.

## Depth-2 keep-newest-of-2 queue 2026-09-03

Approved: **A now, depth 2 only**, drain-all-in-order when the late timer fires. Recovered frames can be up to **~31 ms older glass-to-glass**; newer frames follow immediately after. Depth 3 is a separate follow-up from new measurement if the 32–82 ms tail recurs.

### Coverage (not symmetry)

| Channel | Before (timeout healthy) | Why this depth |
| --- | --- | --- |
| **AR** | Send **~25.6**, evict **6.4/s**, begin ~32 | Depth **2** |
| **3D** | Send **~27.6**, evict **4.4/s**, begin ~32 | Depth **2** (better than AR, still real drops) |
| **2D** | 0 evicts in that window | Stay depth **1** |

Killswitch: `?ndiQueueDepth=1`. Default defer remains `setTimeout(0)`. `?ndiDefer=microtask` not shipped.

### Live after (same auto-connect URL, HEVC `decodedFps` 22–40, 64 s)

| | AR before | AR after | 3D before | 3D after |
| --- | --- | --- | --- | --- |
| **Send fps** | **25.6** | **30.5** (med 31, min 23, max 34) | **27.6** | **31.1** (med 32) |
| **evict/s** | **6.4** | **0.55** | **4.4** | **0.00** |
| begin n | ~32 | 31.2 | ~32 | 31.2 |
| `queueWait` mean | 17.9 ms | **27.5 ms** | 22.7 ms | 34.2 ms |

Send now tracks begin (~30–32). Eviction collapsed. `queueWait` is **not** shorter — the change tolerates the delay instead of dropping the older slot. Residual AR evicts (~0.55/s) are the depth-2 overflow tail (`queueWait` max 108 ms in this window). That tail is **not** depth 3 in this change.

## HEVC texture upload path 2026-09-03

### 1. Exact call (this repo)

`present()` does **not** call `texImage2D` / `texSubImage2D`. `videoDecodePipeline.present()` returns the WebCodecs `VideoFrame`; `uploadVideoFrameToTexture` assigns `tex.image = frame`, stamps `videoWidth`/`width`, sets `needsUpdate`. No `ImageBitmap`, no canvas 2D, no `createImageBitmap`.

The GPU upload happens later, when `videoBackground` draws and Three.js `WebGLTextures.uploadTexture` runs:

- `createVideoStreamTexture()` is `new THREE.Texture()` — **not** `VideoTexture` / `VideoFrameTexture`.
- Three.js r178: `useTexStorage = (texture.isVideoTexture !== true)`. Plain textures on WebGL2 allocate once with `texStorage2D`, then every unique frame is  
  `texSubImage2D(TEXTURE_2D, 0, 0, 0, format, type, videoFrame)`.
- `THREE.VideoTexture` exists specifically to skip texStorage and use `texImage2D` every frame (Chromium video bug [40915685](https://issues.chromium.org/issues/40915685)). This repo never sets `isVideoTexture`.

First unique HEVC `present()` → next `renderer.render()` that samples the map (AR FBO / preview) is the upload. First `readPixels`/`packPbo` after that upload is the 15–25 ms wait. That is why idle/AR/3D whichever packs first after the composite pays, and why packing before `present()` only moved the stall to 3D.

### 2. Chromium / ANGLE (not just “our PBO”)

Blink `WebGLRenderingContextBase::TexImageHelperMediaVideoFrame`:

- GPU-GPU fast path `use_copy_texture_chromium` is **`params.function_id == kTexImage2D` only** (plus default rect, `TEXTURE_2D`, sRGB unpack, `CopyTextureCHROMIUM`). **`texSubImage2D` never takes this path.**
- Shared-image frames then `CopySharedImageDirectlyToGLTexture` / `CopyVideoFrameTexturesToGLTextureViaIntermediateSI` (WaitSyncToken + CopyTextureCHROMIUM / keyed-mutex DXGI). That work is queued in the GPU process; the **next synchronizing GL call on this context** (our `readPixels`) waits for it.
- `texSubImage2D` falls through to `CreateAcceleratedImageFromVideoFrame` → `TexImageStaticBitmapImage` (YUV→RGB via canvas resource provider). Known slow: [w3c/webcodecs#421](https://github.com/w3c/webcodecs/issues/421) / Chromium **1279351** (`texSubImage2D` of D3D11VideoDecoder `VideoFrame` stayed slow after `drawImage` was fixed). Three.js [#28980](https://github.com/mrdoob/three.js/issues/28980): VideoFrame on a storage texture is **~5× worse on ANGLE**; workaround is `isVideoTexture = true` → `texImage2D`.

Software fix is **possible** as a GL entry-point change (texImage2D / VideoTexture flag), not as another NDI pack reorder. ImageBitmap would skip `TexImageHelperVideoFrame` entirely (`TexImageHelperImageBitmap`) — extra conversion, not the documented fast path. A post-upload `gl.flush()` does not wait; `gl.finish()` would only relocate the 15 ms on the same studio tick.

### 3. Live `texImage` vs production `texSubImage` (2026-09-03)

Diag (off by default): `?ndiUploadProbe=texImage` sets `isVideoTexture` + no-op `update()`. Logs `stage:upload-probe` and first `VideoFrame.format` = **NV12** (1920×1088 coded / 1080 display). Production pack-after-render. Solo Electron after idle instance killed.

| Window | AR Send | AR busy | arReadbackBegin mean/p90 / ms/s | arFboRender | 3d begin |
| --- | --- | --- | --- | --- | --- |
| First 15 s healthy | **24.3** (22–26) | **1%** | **2.62 / ~4 / ~84** | **0.98 ms** | 6.2 |
| Last 40 s | 16.1 (14–18) | 65% | **3.20 / 5.8 / ~96** | 1.31 ms | 9.7 |
| Prior contended texSubImage | 12–15 | 74–84% | **15 / 23 / 410** | ~1 | 6–8 |

The 15 ms first-pack stall is **gone**; it did **not** move into `arFboRender` or 3D. Later Send 16 is a **different** bottleneck (`2dGrab` 42 → 78 ms) — next investigation (OUT/PRF), not this pass.

### 4. Colour contract + ship 2026-09-03

Do **not** pin `texStorage2D(SRGB8_ALPHA8)` on the `isVideoTexture` path: Three.js `DECODE_VIDEO_TEXTURE` already applies `sRGBTransferEOTF` in `map_fragment` ([#26516](https://github.com/mrdoob/three.js/issues/26516) — SRGB8_ALPHA8 + video is not reliable). Hardware SRGB8_ALPHA8 (old texSubImage) and shader EOTF (new texImage) are the same IEC sRGB transfer; combining both would double-decode (too dark).

Production `createVideoStreamTexture()` now sets `isVideoTexture` + `SRGBColorSpace` + `internalFormat=null` → GL **RGBA8** + shader decode. Killswitch: `?ndiUploadProbe=texSubImage`. Default auto-connect URL is the new path. Commit `0e1838e`.

## AR Send 22–26 after texImage2D (not closed) 2026-09-03

Same healthy 15 s as the texImage report (`decodedFps>20`, AR Send 22–26, `arReadbackBegin` ~2.6 ms, busy ~1%). Symptom 10–15 fps is improved, not fixed.

### 1. Skip histogram (exact, not busy share)

Per 1 s decode-present row, AR skips:

| cause | mean n/s | range | share of skips |
| --- | --- | --- | --- |
| **rateCap** | **25.67** | 24–28 | **99.0%** (92.6–100) |
| stagger | **0** | 0 | 0% |
| busy | **0.27** | 0–2 | **1.0%** (0–7.4) |

Stagger is dead (PBO path, `blocking: false`). Busy is gone. **Every refused tick is `rateCap`.**

### 2. Rate-cap target vs achieved begin vs Send

- Declared AR/3D/2D `fps: 30`. `STUDIO_TICK_FPS = 60` (`desktop/main.cjs` `setInterval`).
- Gate (`ndiCaptureClock.ts`): declared ≥30 → **`NDI_CAPTURE_NOMINAL_FPS = 32`**, interval **31.25 ms**, tolerance **half a 60 Hz tick (8.33 ms)**. Designed so a 1 s Send readout never shows 29; resyncs when >1 interval behind (**no burst**).
- `noteNdiSkip('ar','rateCap')` is `!captureGate.isDue(now)` on that studio:tick — “not due yet”, not a 22–26 ceiling.

| 1 s mean | AR | 3D |
| --- | --- | --- |
| studio ticks (`presentHz`) | **57.7** | same clock |
| rateCap skips | 25.7 | ~24 |
| **readback begin n** | **32.1** (30–33) | **32.3** |
| **arEnqueueIpc / Send** | **24.4 / 24.3** (22–26) | **28.5 / 28.5** (26–31) |
| begin − Send | **~7.7 fps dropped** | **~3.8 fps dropped** |
| IPC stage mean | **7.04 ms** | **4.79 ms** |

**The 32 fps gate is hitting its target.** 57.7 ticks − 25.7 rateCap ≈ 32 admits. Send 22–26 is **after** a successful begin.

### 3. Where frames die (keep-newest deferred send)

`ndiDeferredSend`: `setTimeout(0)` off the tick; **one pending slot**; a second `enqueue` **releases the older buffer and keeps newest** (intentional: 8 MB `ipcRenderer.send` used to collapse the tick to ~50 Hz).

`arEnqueueIpc` is counted inside `sendFrameData` (the deferred `send`), not at `ipc.enqueue`. Sustained begin 32 vs Send 24 for 15 s is not pipeline fill. Completions that land while a send is in flight / a flush already scheduled replace `pending` → drop. AR UYVA send is slower (7.0 vs 4.8 ms) and drops more (~8 vs ~4), same mechanism.

Worker `uyvyWorker.pack` is unbounded async; PBO `begin`+`drain` on the same tick can post two packs close together. Those resolve into the same keep-newest slot.

### 4. Tick jitter vs Send jitter

`tickInterval` 10 s window: mean **17.33 ms** (~**57.7 Hz**, not 60), **>20 ms = 211 / 576 (~37%)**. Matches earlier ~38%.

`captureTicks` AR (10 s): **1** and **2** and **3** mixed (e.g. 1:115–142, 2:109–146, 3:45–60) — not `tight on 2`. Long ticks (>20 ms) make the 31.25 ms gate due on the *next* tick (gap **1**); phase then waits a gap **3**. That **spaces** captures; it does **not** cut begin below 32.

Send 22–26 (min–max 4) is the 1 s send **count** moving as keep-newest drops vary, not the rate-cap refusing 22–26 by design. 2dGrab **42 ms** mean @ ~10 fps (~420 ms/s main thread) lengthens the macrotask queue under the same `setTimeout(0)` — correlates with drops; not measured as a skip cause.

No fix this pass. Diag stays. `0e1838e` stays.

### 5. AR vs 3D send cost, eviction timing, 2dGrab (2026-09-03, no fix)

Diag-only: per-channel enqueue→evict wait, `duringSend` vs `awaitingMacrotask`, send-start `queueWait`, 2dGrab wall vs `createImageBitmap` occupancy. Logged as `[diag:srt-fps] stage:deferred-send`. Restarted Electron to load it; SRT ingest stayed `connecting`/`error` (no `decodedFps>20` with these counters). Two windows still answer the three questions:

| Window | HEVC | AR begin n | AR Send | AR evict/s |
| --- | --- | --- | --- | --- |
| **A** 15 s post-restart | none (`streams: []`) | **32.3** | **27.7** (23–31) | **4.3** |
| **B** 192 s HMR on old instance | already dead | **31.6** | **17.8** (14–18) | **13.7** |

Window A is the 32-admit → ~28-send gap (same class as 22–26, milder). Window B is the contended later-Send-16 class. Eviction *kind* is identical in both.

**1. Why AR send is slower — size, not extra send-path CPU**

Live bytes on every send: **AR 6,220,800** (UYVA 1920×1080×3) vs **3D 4,147,200** (UYVY 1920×1080×2 = GPU 960×1080 RGBA8). Ratio **1.50×**. `bytesAfterSend` equals `bytes` — the ArrayBuffer is still attached after `sendStudioNdiFrame` (not a MessagePort transfer; full clone).

| | AR | 3D | ratio |
| --- | --- | --- | --- |
| payload | 6.221 MB | 4.147 MB | 1.50 |
| Window A send mean | **7.16 ms** | **4.97 ms** | **1.44** |
| A effective BW | 869 MB/s | 834 MB/s | ~1 |
| Window B send mean | 8.30 ms | 5.76 ms | 1.44 |
| B effective BW | 750 MB/s | 720 MB/s | ~1 |

The 7.0/4.8 (~1.46×) from the healthy 15 s matches the byte-size ratio. Same memcpy bandwidth; AR is not disproportionately worse.

AR extra CPU (`rgbaToUyva` = Rec.709 UYVY + copy the A plane, **no premultiply**) runs on `uyvyWorker` **before** `ipc.enqueue`. 3D GPU UYVY is packed before enqueue too. `arEnqueueIpc` / `3dEnqueueIpc` wrap only `sendStudioNdiFrame`. Main `fillSlot` is `Buffer.copy` for both `uyvy` and `uyva` (no `rgbaToBgra`).

**2. Drop mechanism is queue delay, not in-flight send**

Capture interval is 31.25 ms; a 7 ms send cannot occupy multiple intervals unless flush is delayed.

| | A AR | A 3D | B AR | B 3D |
| --- | --- | --- | --- | --- |
| `evictDuringSend` | **0** | **0** | **0** | **0** |
| `evictAwaitingMacrotask` | **100%** (4.3/s) | 100% (1.5/s) | **100%** (13.7/s) | 100% (12.6/s) |
| enqueue→evict wait mean / max | **11.2 / 28.8 ms** | 5.8 / 23.4 | **21.7 / 81.8 ms** | 19.4 / 42.6 |
| send-start `queueWait` mean / max | **16.8 / 40.8 ms** | 19.8 / 37.6 | **23.0 / 101 ms** | 27.7 / 73.7 |
| `queueWait` >16 ms (per s) | 16.0 / 28 sends | 23.2 / 31 | 11.9 / 18 | 16.2 / 19 |

**0 of 2242** AR evict samples in window B were `duringSend`. The pending slot is replaced while `setTimeout(0)` is still queued — typically **8–32 ms** after enqueue (B buckets: 16–32 ms = 1481, 32+ = 433, 8–16 = 400). Completions bunch from async UYVA pack; they do not wait on a 7 ms in-flight IPC.

**3. 2dGrab does not raise the drop rate**

`2dGrab` wall (~42 ms @ ~10.6/s) is **awaiting the worker**, not a 42 ms main-thread block. `createImageBitmap` occupancy is **0.63 ms/s** (A) / **6.7 ms/s** (B). Evicts *do* run during the grab wall (main thread is free). Drop **rate** is **lower** during the wall than in the gaps:

| AR evict/s | during 2dGrab wall | outside (gaps) | wall share of time |
| --- | --- | --- | --- |
| A | **1.5–2.9** | **5.3–6.4** | 43% |
| B | **8.8** | **16.1** | 40% |

`evictDuringGrabBitmap` ≈ 0. A samples after a grab: mean `afterGrabMs` **~43 ms** (next gap), not a spike in the 8 ms after grab (`evictAfterGrab8ms` 0.3/s vs 4.3 total). 2dGrab is **not** a proven `setTimeout(0)` blocker for these drops.

No production queue/policy/2dGrab change. Diag stays.

### 6. What delays setTimeout(0) (2026-09-03, no fix)

The delayed timer is **`src/output/ndiDeferredSend.ts` in the Electron renderer** (Chromium), not Node’s main-process timers/check phases. Main still *feeds* `studio:tick` IPC (~60 Hz `setInterval` + `webContents.invalidate()`). ffmpeg stdout / NDI `fillSlot` run on main **during** `sendStudioNdiFrame`, i.e. after flush starts — they cannot explain enqueue→flush `queueWait`.

**Renderer macrotasks sharing the thread with the deferred send:** `studio:tick` IPC (present + AR FBO + 3D FBO + 2D `setTimeout(0)` schedule, several `ipcRenderer.on` handlers in one turn); **rAF preview** (`previewFrameClock`, full scene); three keep-newest send timers (AR/3D/2D); 2D grab defer; UYVA `uyvyWorker` messages. `flushInTickN = 0` (send never runs inside the tick, as designed).

Live 59 s, `?ndiDefer` default timeout, ingest live, AR Send ~25, begin ~32:

| AR | |
| --- | --- |
| `queueWait` mean / max | **17.9 / 103 ms** |
| studio ticks during wait | mean **1.57**, max **8** |
| enqueue on tick | **0** (worker completions) |
| evict preceding | **100% `uyvyWorker`** |
| late flush preceding (`queueWait>8`) | **rAF 67%** (832), **studio:tick:end 26%** (324), flush:2d 5%, 2dDefer/flush:3d <2% |

3D enqueues **on-tick** (`enqueueInTickN` = all 32). Late 3D flush preceding is **flush:ar 57%** (serial behind AR’s 7 ms clone), then rAF 16%, studio:tick:end 13%. Evict preceding **100% `studio:tick`**.

**Scheduler experiment** (probes scheduled at the same enqueue as the real defer; then a 42 s `?ndiDefer=immediate` run):

| primitive | AR fire delay | 3D fire delay | actual send path |
| --- | --- | --- | --- |
| `setTimeout(0)` | **20.7 ms** | 22.7 ms | baseline: Send 25.6, evict 6.4/s, wait 17.9 |
| MessageChannel (`setImmediate` stand-in) | **20.8 ms** | 22.7 ms | `?ndiDefer=immediate`: Send **25.1**, evict **6.8/s**, wait **18.8** — **no win** |
| `queueMicrotask` | **0.05 ms** | **6.2 ms** | not used for send (would run before rAF; 3D’s 6.2 ms is leftover tick work after in-tick enqueue) |

Immediate and timeout are the same stall: Chromium is busy with **rAF + queued studio:tick** before *any* macrotask (timer or port message). Microtask is the only primitive that fires before that work. Using it for send would put AR IPC at worker-completion (~0 ms extra) and 3D IPC at end-of-tick (~6 ms, then rAF waits). That is the original tick-collapse risk; not a fix this pass.

**Queue depth (symptom, not cause).** This timeout window, 377 AR evicts: **96.3% wait <32 ms**, 3.4% 32–48, 0.3% 48–64. At 32 fps (~31 ms arrivals), **depth 2** (keep-newest, 2 slots) covers ~one extra frame → ~95% of *this* window. Contended window B had **16.5% of evicts ≥32 ms** (max 82 ms) — depth 2 would miss that tail; depth 3 (~62 ms) would be closer. Depth increase does **not** stop rAF/tick from delaying the first send; it only keeps extra newest frames until the late macrotask finally runs.

Default defer remains `setTimeout(0)`. `?ndiDefer=immediate|microtask` is diag-only.

## contended idle + early 2026-09-03
Early-pack instance recovered overnight (first `decodedFps>20` ~line 62942). Reported that window, then force-stopped (one GPU) and launched solo `ndiReadbackProbe=idle`. Idle reached contention in **<1 min** (no 12-frame stall this time).

### Idle probe — contended 40 s (log **125507–125591**)
`decodedFps>20`, AR Send **12–15**. Idle 16×16 packed **after** this tick’s AR composite and **before** the real AR pack (same queue slot AR used to occupy).

| Metric | Idle 16×16 | AR 1080p (after idle) | 3D UYVY |
| --- | --- | --- | --- |
| begin mean / p90 | **15.76 / 23.18 ms** | **0.82 / 1.16 ms** | 6.81 / 8.18 ms |
| n / ms/s | 25.8 / **404** | 25.8 / **21** | ~26 / 175 |
| AR Send / busy | **12.88** / 83.7% | | 3D Send 13.1 |
| present unique/decoded | 29.75 / 29.75 (1.000), min-clamp~50% / repeat~50% | | |

Idle matches the original AR stall (~14–22 ms, **410–480 ms/s**). AR’s own 1080p pack is cheap once idle has paid. **Not AR-plate-specific.**

### Early-pack probe — contended 40 s AR Send 10–12 (log **125165–125275**)
Previous FBO packed **before** `present()` and before `arFboRender`.

| Metric | AR (early) | 3D (still after present+AR render) |
| --- | --- | --- |
| begin mean / p90 | **4.38 / 11.08 ms** | **23.08 / 28.51 ms** |
| n / ms/s | 20.8 / **91** | 20.8 / **476** |
| Send / busy | AR **10.32** (10–12), busy **93.8%** | 3D Send 10.35 |
| present unique/decoded | 29.41 / 29.39 (0.999) | |

AR begin **410 → 91 ms/s**, but AR Send stays ~10: the stall **moves to 3D** `3dReadbackBegin` (476 ms/s). Drain stays ~0.3 ms.

### Mechanism
Same-context command-order behind unique HEVC `present()` / texture upload. The **first** `packPbo`/`readPixels` after that upload blocks ~15–25 ms (idle 16×16 or AR 1080p). Later packs on the same tick are cheap. Packing AR before `present()` makes AR begin cheap and dumps the cost on 3D’s still-late pack. Reordering **AR only** will not restore AR Send fps while 3D still packs after `present()`.

Proposed next (not implemented): either pack **both** AR and 3D before `present()` (3D still previous-tick FBO), or keep 3D from issuing PBO begin after HEVC upload on this context this tick. Then re-measure AR Send, not only `arReadbackBegin`.

## diagnosis 2026-09-02 — queue-pressure probes (measurement only)
Query: `ndiReadbackProbe=idle|early` (`diagNdiReadbackProbe.ts`). Default URL still production pack-after-render. `npx vitest run src/output`: **352 passed**.

### 3. WebGL / ANGLE (logged `webgl-context`, this machine)
Three.js: `antialias: true`, `alpha: true`, `powerPreference: 'high-performance'`. **Not set:** `desynchronized` (false), `preserveDrawingBuffer` (false). Live `getContextAttributes()`: alpha/antialias/depth true, stencil false, premultipliedAlpha true, xrCompatible false, failIfMajorPerformanceCaveat false. Unmasked: **ANGLE (NVIDIA GeForce RTX 5080, Direct3D11 vs_5_0 ps_5_0, D3D11)**. Backend is D3D11, not D3D9/GL/Vulkan.

### 4. Size vs AR stall (a+c contended window 48538–48621)
| Path | Read size | begin mean | ms/s |
| --- | --- | --- | --- |
| AR PBO | 1920×1080 RGBA (~8 MB) | **15.12 ms** | **410** |
| 3D PBO | GPU UYVY **960×1080** (~4 MB) | **6.03 ms** | **162** |

Size ratio ~2×, time ~2.5× — not a clean bytes-linear story. During HEVC **decode stall** (no unique present), AR 1080p begin drops to **~0.5–2 ms / ~70 ms/s** while 3D stays **~7–8 ms**. **Volume does not explain the AR-only 15 ms stall.**

### 1. Idle 16×16 pack after this tick’s AR composite (before AR pack)
Separate PBO; pixels discarded. **No contended `decodedFps>20` window** this evening (burst 12 decoded, outstanding=12, never recovered; first idle launch also overlapped the leftover a+c Electron — ignore that GPU load). Solo idle while HEVC stalled (`probe-idle-solo`): idle begin **~1.1–2.7 ms** (n≈32), AR begin **~0.5 ms**, AR Send **~23–27**. First pack-after-render of a tiny unused FBO is **not** 15–25 ms when `present()` is not uploading unique HEVC frames.

### 2. Pack previous AR FBO **before** `present()` and before `arFboRender`
`probe-early`, listener registered before videoStreamManager. Same decode stall: AR begin **~1.7–2.1 ms / ~70 ms/s**, Send **~23–26**, busy ~0. **Cannot score queue-position vs 410 ms/s baseline without a healthy HEVC window.** Cheap early-pack during stall is consistent with “no HEVC upload in the queue,” not a proof that reordering would help under contention.

### Mechanism so far (not a fix)
The 15 ms `arReadbackBegin` **tracks unique HEVC `present()` / texture upload**, not “this FBO was just drawn” (ping-pong already falsified that) and not “any PBO after some GPU work” (idle 16×16 and 1080p AR are both cheap when decode is stuck; 3D still renders). Next measurement needed: **one** idle-probe run with `decodedFps>20` and AR Send 10–19 — if idle is also ~15 ms, queue-behind-HEVC-upload; if idle stays ~2 ms, AR-plate-specific. Then one early-pack run in that same contended regime. Do not ship a reorder until those two numbers exist.

**Watch:** `--dev` still self-exits on some long runs; HEVC 12-frame then outstanding=12 stall is frequent and can last >12 min. Dual Electron on `broadcast-web-repro` invalidates GPU timings.

## (c) AR skip `gl.flush()` + (a)+(c) live 2026-09-02
**Flush guarantee (not “it’ll flush eventually”):** Chromium WebGL2 `GLES2Implementation::ClientWaitSync` writes the wait into the command buffer then `WaitForCmd()` (`CommandBufferHelper::Finish()`), which submits pending commands (including the preceding `fenceSync`) to the GPU process. AR `captureAirTarget` calls `drainReadback` → `poll()` → `clientWaitSync(fence, 0, 0)` on the same tick as `begin()`, so that wait is the submit — not a later canvas swap, and not 3D’s remaining `gl.flush()` (3D is often `rateCap` on the same tick). `flushAfterPack` defaults **true** (3D); AR passes **false**.

**Tests:** `npx vitest run src/output` **348 passed** (344 after (a); +4: no-GL-between fence/wait CONDITION_SATISFIED, ALREADY_SIGNALED, TIMEOUT then SATISFIED, AR/3D source wiring).

**Live:** same auto-connect URL / `BROADCAST_NDI_NAME=broadcast-web-repro`. Vite serving `flushAfterPack: false`. Ingest live HEVC copy immediately; decode **1 s burst then 0** (outstanding=13) until recovery ~**8 min** later (log **48117+**). Window: last 40 s `decodedFps>20` and AR Send ≤19 (lines **48538–48621**). Electron still running at ~12 min this pass (has not self-exited yet). **Watch:** `--dev` has now exited cleanly on its own twice before (9 min, 67 min) — relevant if a long measurement window dies.

| Metric | This window (a+c) | Original contended (`340fade` / `fb3ff08`) |
| --- | --- | --- |
| presentHz | **59.02** (min 56.56) | 58.73 / 59.28 |
| unique / decoded | **29.71 / 29.76** (ratio **0.998**) | 1.001 / 0.997 |
| reasonCounts | min-clamp **50.3%**, repeat **49.7%**. catch-up **0** | ~50/50, catch-up 0 |
| NDI AR Send | **13.88** (min 12, max 16) | 10–19 (14.65 / 11.58) |
| AR NdiSkip busy | **73.7%** (min 52.9, max 100) | 71.2% / peak 93.5% |
| arReadbackBegin | mean **15.12** / p90 **23.19** / n≈27 / **410 ms/s** | ~14–22 / ~21–27 / n≈23–28 / **410–480 ms/s** |
| arReadbackDrain | mean **0.37** / p90 **1.1** / n≈87 | ~0.29 / ~0.98 — still cheap, not stalling |

Verdict: dropping AR `gl.flush()` did **not** regress drain. Combined with ping-pong it also did **not** move `arReadbackBegin` or AR Send off the contended baseline. Stall is still inside `readback.begin()` / `packPbo` (`readPixels`+`fenceSync` on the shared context after this tick’s FBO render), not the explicit flush.

## contended re-baseline 2026-09-02 (`340fade`)
Kept watching the already-running retry (same auto-connect / `broadcast-web-repro`). Decode stalled immediately after live (1 s burst then 0); **recovered ~4 min later** without a restart. Window: last 40 s HEVC `decodedFps>20` and AR Send ≤19 (log **40256–40336**).

| Metric | Value |
| --- | --- |
| presentHz | **58.73** (min 55.21) |
| unique / decoded | **29.99 / 29.97** (ratio **1.001**) |
| reasonCounts | min-clamp **1218 (51.1%)**, repeat **1167 (48.9%)**. catch-up = 0 |
| NDI AR Send | **14.65** (min 13, max 17) |
| NDI 3D / 2D Send | 15.13 / 6.45 |
| AR skips | rateCap 28.8% / **busy 71.2%** / stagger 0 |
| 3D skips | rateCap 65.4% / **busy 34.6%** / stagger 0 |
| 2D skips | busy **88.5%** / rateCap 11.5% |
| arReadbackBegin | mean **14.52** / p90 **21.22** / n≈28 / **410 ms/s** |

Earlier 75 s peak in the same recovery (39574–39731): AR Send **10.6**, `arReadbackBegin` **22.6 ms / 480 ms/s**, AR busy **93.5%**. Labeling fix lights up `busy` when readback is the bottleneck. No `arReadbackBegin` / `present()` change this pass.

## skip-cause busy 2026-09-02 (`340fade`)
AR `captureFrame` returned at `!readback.canBegin()` with no `noteNdiSkip`, so readback-blocked skips were omitted and the histogram read 100% `rateCap`. Same gate on 3D. Fix: `noteNdiSkip(ch, 'busy')` at that return only — no change to when capture is skipped. Tests: `ndiFramePump.skipCause.test.ts` + source regex in `ndiIndependentClocks.test.ts`. `npx vitest run src/output`: **339 passed**.

Re-measure (same auto-connect URL / `BROADCAST_NDI_NAME=broadcast-web-repro`): `"state":"live"` line 39064, `transcodeToH264=false`, ffmpeg 29.90 fps / 0.995x. HEVC AUs ~30 fps but decoded stuck at 0 after a 1 s burst (~19 decoded, outstanding=12). **No `decodedFps>20` window** (unlike 37908–38032). ~2 min after live (lines 39065–39316):

| Metric | Value |
| --- | --- |
| unique / decoded | **~0 / ~0** (100% `repeat` after burst) |
| NDI AR Send | **28.7** (min 21) |
| AR skips | rateCap **99.3%**, busy **0.7%** (22), stagger 0 |
| 3D skips | rateCap **99.5%**, busy **0.5%** (15), stagger 0 |
| 2D skips | busy **70.6%**, rateCap 29.4% |
| arReadbackBegin | mean **2.11** / p90 **4.57** / n≈32 / 68 ms/s |

Busy is no longer identically 0 (the old mislabel). Share is small because this window is **not** the contended readback case (`arReadbackBegin` was 18.6 ms / AR Send 11.6 when present was healthy). Do not treat this as a re-baseline of the stall; need HEVC `decodedFps>20` for that. No `arReadbackBegin` timing fix this pass.

## concurrent present+NDI 2026-09-02 (`fb3ff08`) — HEVC-healthy window
Logging only (already on `fb3ff08`). Relaunch same no-click URL + `BROADCAST_NDI_NAME=broadcast-web-repro`. Ingest `error` ~70 s (no ffmpeg child) then `connecting` → `"state":"live"` line **37729**, `transcodeToH264=false`, HEVC copy. Prior `--dev` instance had exited cleanly (`exit_code` 0) after ~9 min; this pass did not investigate that. This instance still up at ~3 min when the window was read.

**Window:** last 40 s HEVC `decodedFps>20` (log lines **37908–38032**).

| Metric | Value |
| --- | --- |
| presentHz | **59.28** (min 56.60) |
| unique / decoded | **28.89 / 28.98** (ratio **0.997**) |
| reasonCounts | min-clamp **1171 (48.7%)**, repeat **1232 (51.3%)**. catch-up = 0 |
| ffmpeg | 29.79 fps / 0.996x / copy |
| NDI AR Send | **11.58** (min 10, max 14) |
| NDI 3D / 2D Send | 11.95 / 5.43 |
| AR skips | rateCap **100%**, stagger 0, busy 0 |
| 3D skips | rateCap **100%**, stagger 0, busy 0 |
| 2D skips | rateCap 4.2% / busy **95.8%** / stagger 0 |
| arReadbackBegin | mean **18.59** / p90 **26.3** / n≈23 / **432 ms/s** |
| arEnqueueIpc | mean 7.49 / p90 8.14 / n≈11.8 / 89 ms/s |
| arReadbackDrain | mean 0.29 / p90 0.98 / n≈83 |
| arFboRender | mean 1.12 / p90 1.46 / n≈23 |
| 2dGrab | mean **87.55** / p90 **95.1** / n≈5.5 / 477 ms/s |
| totalTick | mean 11.61 ms, max 59, n≈60 (`p90` n/a) |

Morning session (decode stall, unique=0) had AR Send **~29** and `arReadbackBegin` **~1.6 ms**. This HEVC-healthy session matches 4404a68 present **and** the screenshot AR Send 10–19.

Verdict: **yes, NDI capture is the concurrent bottleneck while present() is healthy.** The AR stage that consumes disproportionate time is **`arReadbackBegin`** (GPU readback begin, p90 26 ms, 432 ms/s), not `arEnqueueIpc` (cheap; n≈12 is the *result* of slow readback). AR `NdiSkipCause` stays 100% `rateCap` because `!readback.canBegin()` does not `noteNdiSkip('busy')`. 2D `2dGrab` is also saturated (OUT/PRF). No present()/NDI logic change this pass.

## no-click repro 2026-09-02
No existing query/config auto-connect. Checkboxes = sessionStorage tab cache (not restored as Connect). Connect SRT is an explicit `operatorConnected` hold. `arBackground` is `config.json` (`alpha`); URL had `outputMode` only. Order: Vid/Live checkboxes → Connect live and Connect SRT (independent) → AR video can be anytime (no SRT/autoplay gate; ffmpeg is main-process). `desktop/configFs.cjs` does not persist these. Diag query params; POV ids must be in the URL (no default POV in source).

Verified `6fe97cd`: launch Electron `--dev` with
`BROADCAST_WEB_URL=http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent&arBackground=video&autoConnectLive=1&livePov=1&autoConnectSrt=1&srtPov=1`
(POV `1` from the prior live HUD / pack `srtByPovId`, not a source default). `diag-srt-fps.log` `[diag:auto-connect]` then ingest `connecting` → `live` in ~6–8 s from process start. `start-studio.ps1` default URL unchanged.

## live verify log 2026-09-02 (4404a68, post tray-quit)
New session starts at log line 2751 (`sameFrameUpload` field). Steady HEVC copy, `decodedFps>20`, `kfRise=0`, **n=148 s**.

| Metric | Steady mean |
| --- | --- |
| ffmpeg | 29.69 fps / 0.982x / 0.007 CPU cores |
| ipcDropPerSec | 0.06 (10 drops whole session) |
| auFps / decodedFps / uniquePresentFps | **29.87 / 29.71 / 29.73** (unique/decoded = **1.001**) |
| presentHz | **58.80** (min 54.65, never <50) |
| reasonCounts | min-clamp **4468 (50.57%)**, repeat **4368 (49.43%)**. max-clamp/stall-pin/lut-miss-live/**other = 0** |
| AU per present | 0: 77.4%, 1: 2.0%, 2: 13.1%, 3: 7.6%, 4+: 0 |
| latency / queue | 113 ms / depth 5.4 |

First 20s rollup uniquePresent **13.93** is idle+connect dilution (~10 empty seconds). Seven later 20s windows unique **28.1–29.8**. Verdict **(c)**: present() unique tracks decode; studio:tick still feeds present() at ~59 Hz. Pre-restart HUD AR Send 10–19 / `arEnqueueIpc n≈11–13` is downstream NDI capture, not this skip bug. `droppedFps≈decoded` is prevPresented recycle (one drop per unique advance), not hole-skip.

## live verify after present() fix 2026-09-02
Running instance (no restart this pass): Electron `--dev` pid 29452 started 11:22:32; Vite pid 34280 since 08:54; HEAD `bdb4c73` 09:38:51, clean tree. Vite is serving `allowsCatchUpSkip` from `videoDecodePipeline.ts`. Packaged app is not in use.

Existing HUD (this process, SRT already connected): `pov 1 srt=1 live ~4.6–5.1 Mbps codec=hevc picture=yes err=Decoding error.` Cumulative demux/decoded ~25–28 fps session average (e.g. demux 10123 / decoded 9506 at ~6.5 min). **No `reason`, uniquePresent, dropped, or queueDepth** on the Race SRT HUD. Sync debug is off and below the NDI fold. NDI AR Send oscillating **10–19 fps**; `arEnqueueIpc n≈11–13`; `3dFboRender n≈21–25`; `2dGrab ~80ms n=6`; studio tick mean ~17ms but `>20ms` ~38%. `dropBusy=0`.

Cannot tell skip-vs-catch-up-vs-NDI from this HUD. Diag `diag:` commit restores ingest+decode logs plus per-reason counts / AU-per-present hist / uniquePresentFps. **Needs tray-quit (not park) + Connect SRT ~20s.** Do not patch `present()` until that log is read.

## present() 2:1 skip 2026-09-02
Live: copy HEVC ~30 decoded, `presentHz` ~60, `uniquePresentFps` ~14. Cause: `dropQueued` of every `pts < pick` when `frameAtLatency(100ms)` jumped two PTS steps on a decode burst. Fix: snap pick to the next queued PTS for `min-clamp` / `adaptive` / `fixed`; skip-jump only for `max-clamp` / `stall-pin` / `lut-miss-live`. Tests: paired 87/90 after (44/90 before), asymmetric 87/90 after (29/90 before), smooth already 87/90. Diag instrumentation reverted.

## FPS collapse bisect 2026-09-02 (measured)
`diag-srt-fps.log` after Electron restart + Connect SRT. First live run ~116s; `transcodeToH264=false` (bitstream copy), `codec=hevc`.

Steady seconds (`kfRise=0`, `decodedFps>20`, n=110): ffmpeg **29.60 fps** / **0.98x** / **~0.009 CPU cores**; `ipcDropPerSec` **0** (7 drops in the whole run); `auFps` **29.06**; `decodedFps` **29.06**; `droppedFps` **29.01**; `uniquePresentFps` **14.31**; `presentHz` **59.19**; `kfRise` **0**. Latency pinned ~100 ms; reason `min-clamp` / `repeat`.

Collapse is **presentation skip** (suspect 4), not ingest/IPC/tick/transcode. Brief HEVC `"Decoding error."` seconds dip decode further (secondary). Diag `6099188` reverted in `23c37e7`.

## HEVC SPS RBSP unescape 2026-08-29 (pulled main)
Far-device `fix(srt): unescape HEVC SPS so WebCodecs can copy-decode DJI`.

- Annex-B EPB `0x000003` was parsed into `hev1.*` → WebCodecs rejected → transcode.
- `unescapeRbsp` before HEVC SPS/VPS PTL. Feed AUs stay Annex-B (no `description`).
- Intended live path: ffmpeg **`-c copy`** + WebCodecs **HEVC** (D3D11VA / VCN). `transcodeToH264` only on true unsupported or ~2.5 s `decoded=0`.
- No Store pack. No raw-frame IPC. No shared GPU. Electron stays the shell.

## Keep-PTS accepted 2026-08-28 (BW)
`done/DSP-SRT-20260828-01`. Transcode: `-copytb 1` + `-enc_time_base 1:90000`. Copy path untouched. File round-trip kept muxer PTS. Live ~34 s extra is operator + OUT-05 PES identity. No `setpts` / `setts` next.

## Role
SRT Ingest Orchestrator (`SRT`). Caller, catalog, ffmpeg TS, demux/decode, HEVC fallback, Race ops SRT HUD. New workers: `DSP-SRT-*`. Historical SRT code shipped as `DSP-OUT-03`…`09`.

## Locks
- Caller, DJI only, catalog 1–27 @ `49.13.20.49:9000`, `read:camN:pubN:<token>`
- Empty / dummy `host` template → catalog
- No `%3A` in `streamid`; never log tokens
- HEVC on wire; WebCodecs HEVC after RBSP-unescaped `hev1` (2026-08-29). ffmpeg→H.264 on WebCodecs fail or live `decoded=0` stall (~2.5 s)
- Transcode must keep **muxer 90 kHz PTS** (not a new origin). Colour bars ≠ drone. Cap 4. Present 100–400 ms
- No Store HEVC pack. No WHEP. No `STUDIO_TICK_FPS = 60`

## Leftovers (not this dispatch)
- Electron `desktop/srtHelpers.cjs` `redactSrtUrl` may still be passphrase-only on some log paths
- PLT: vendor gyan **full** `ffmpeg.exe` (libx264) in extraResources — still needed for fallback
- Confirm Race ops: `codec=hevc`, no `ffmpeg→h264`, PTS still maps (TEL-04)

## Handoffs / dispatches
- `HO-BW-SRT-20260828-01` / `DSP-SRT-20260828-01` **accepted**
- 2026-08-29 HEVC unescape: no DSP (direct `main` commit `1a4e0ae`)
