# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-09-09  
**Session role:** BW

## 2026-09-09 — DSP-SCN-20260909-02 code-complete (studio boot)

Cold start: race **empty**, Free cam, World authoring closed, aerial overlay, NDI Send off. `?race=` / `?editor=1` still win. Leftover session keys in the same tab still apply until changed.

## 2026-09-09 — DSP-SCN-20260909-01 code-complete (intro look)

West **Canada → UK**, then east **Russia → Turkey → İstanbul**. No USA hold. SSE globe **8** / ENU **3**. Needle pins. Yavuz 2.5 s. ENU seams shared. Çırağan operator GPS. Architecture `commercial-video.md` updated to match.

**Human next:** Play `intro-bosphorus` (countries shorter + flags; Yavuz = 3rd bridge; no Cesium pop after warm). Then **Save tile list**. Then Record if look Pass. Phase 22 later.

## 2026-09-09 — DSP-OUT-20260908-01 code-complete (Record)

Worker: canvas MediaRecorder 30 fps; ffmpeg remux if WebM. `#ops-cinematic-record` enabled. NDI untouched. `tsc` still red only in `videoDecodePipeline.ts` (pre-existing).

**Human Pass:** after look Pass on the **09-01** path, `npm run desktop:dev` → **Record** → Save-as `intro-bosphorus.mp4` → vMix. Good: ~60 s silent 1080p, no HUD. Fail: Chrome-only (`desktop only`), duration way off, HUD in frame.

## 2026-09-09 — operator notes while cinematic worker in flight

SCN recorded: `DSP-SCN-20260909-01` intro Human Pass; `DSP-SCN-20260909-02` studio boot **code-complete**; `HO-SCN-OUT-20260909-01` NDI Send default off **done**.

City path lock update vs 2026-09-08: **Canada → UK** (west) then **Russia → Turkey → İstanbul** (east). Label **Russia**, not Moscow. Record still after look Pass.

## 2026-09-09 — cinematic tiles: sharper + sequence URL list

Operator screenshot: peninsula dither + mushy Aerial. Dump button was a sidecar URL dump, not a map.

Fix in SCN chat: SSE 16 globe / 6 ENU; no fade/unload during cinematic; Play unlocked; **Save tile list** writes `tileWarm.contentUrls` onto the sequence JSON for other PCs. Bytes still local not git.

**Human next:** wait `tiles: warming`, Play `intro-bosphorus` (countries + peninsula should be sharper, no grey veil). Then **Save tile list**, commit the JSON. Second launch / other PC should prefetch from that list. Not Record until look Pass. Not Phase 22.

## 2026-09-08 — intro Human Pass: pins, no teleport, tile warm

Operator: mostly very good. (1) Country **pins** when zooming. (2) No teleport — spend hold time on transits; **country** in frame not cities. (3) Turkey = whole country + pin, then **smooth fly** to İstanbul. (4) **P0** prefetch: manifest in git, tiles on disk not git, check/download on project start. Countries coarse; İstanbul detailed.

Issued: `DSP-SCN-20260908-06`, `DSP-PLT-20260908-01`, then `DSP-SCN-20260908-07`. Handoffs `HO-BW-SCN-20260908-02`, `HO-BW-PLT-20260908-01`. Record still OUT.

## 2026-09-08 — Phase 21 cinematic **locked**; workers issued

Operator: **silent 1080p30 MP4**. vMix plays it; app waits (no play-then-live). Cities: Chicago → Winnipeg → London → Moscow (western Russia) → Turkey. Three **bridge meshes**. Rumeli Hisarı **not** in this clip. No credits. Strawman times accepted.

**Design:** `docs/architecture/commercial-video.md`. Briefs: `docs/agentic/briefs/phase21/`.

| Order | DSP | Chat |
| --- | --- | --- |
| 1 | `DSP-GEO-20260908-01-cinematic-globe` | GEO **code-accept 2026-09-08** |
| 2 | `DSP-SCN-20260908-01-cinematic-player` | SCN **code-complete 2026-09-08** |
| 3 | `DSP-SCN-20260908-02-intro-bosphorus` | SCN **code-complete 2026-09-08** |
| 4 | `DSP-SCN-20260908-06-country-pins-spline` | SCN **code-complete 2026-09-08** |
| 5 | `DSP-PLT-20260908-01-cinematic-tile-disk` | PLT **code-complete 2026-09-08** |
| 6 | `DSP-SCN-20260908-07-cinematic-tile-warm` | SCN **code-complete 2026-09-09** |
| 7 | `DSP-OUT-20260908-01-cinematic-mp4` | After look Pass |

No CIN orchestrator. Handoffs `HO-BW-GEO|SCN|OUT-20260908-01`.

**Human next:** Human Pass 07 — wait for `tiles: warming`, then **second** Play of `intro-bosphorus`. Country holds should not pop empty. Optional Dump warm URLs. Not Record until C+D Pass. Not Phase 22.

## 2026-09-08 — Phase 21 cinematic system (draft, not locked)

Operator: intro video ~60 s, **in our app**, no race setup. World → partial city zooms → Turkey → Istanbul → 3rd bridge → Maiden’s Tower → Historic Peninsula → Galata → Çırağan → live. Aerial + OSM + human glTF until IBB. Hide fog on world. Gerstner only after a **cloud** seam into the Bosphorus. Reusable JSON sequences.

**Design:** [`docs/architecture/commercial-video.md`](../../architecture/commercial-video.md) (draft). Canvas: `canvases/commercial-video.canvas.tsx`.

**No new orchestrator.** SCN owns player/look. GEO globe vs ENU. OUT record-to-file. PLT tile warm.

**Blocked on operator §8 questions** (live = MP4 vs in-app; city list; audio; 1080p30 vs 60/4K; hero list; timings; end card). **No DSP until lock.** Not Phase 22.

## 2026-09-07 — Phase 20–22 locked; SCN goes next

Operator order:

1. **Phase 20** Cesium OSM Buildings + hero glTF (**SCN now**)
2. **Return to BW** → **Phase 21** commercial video (details after 20)
3. **Phase 22** SRT **AR+3D+2D** at once; **NDI parked** (keep code, do not use on air). VPS later.

Docs: `docs/roadmap/phases-roadmap.md` · `docs/architecture/srt-egress.md` · `docs/architecture/commercial-video.md` · `docs/agentic/briefs/phase20/` · `HO-BW-SCN-20260907-01.md`

**Human next:** new chat, paste `docs/agentic/dispatches/BOOTSTRAP_SCN.md`.

## 2026-09-07 — Phase 20 on roadmap; SRT out design

Operator lock: **Cesium OSM Buildings + 3D Tiles buildings + hero glTF** is the first work. DIY Bosphorus survey closed. IBB parked.

**Roadmap Phase 20** (`docs/roadmap/phases-roadmap.md`): **20.1** buildings first ([`3d-environment-buildings.md`](../architecture/3d-environment-buildings.md)), then **20.2** SRT egress ([`srt-egress.md`](../architecture/srt-egress.md)). 19.18 superseded. NDI 30×3 stays closed.

**SRT out approach (design, not impl):** one opaque 1080 program from a chrome-free window; ffmpeg child + AMF encode; we **call** a listener. Race = LAN vMix (40–80 ms). Test = caller to a **relay** (not studio listen through NAT). Do not reuse NDI UYVY IPC.

No worker until remaining discussion settles (program plate, relay host) and BW issues DSP-20.1.

## 2026-09-06 — 3D environment **locked** (free)

Operator closed DIY Bosphorus photogrammetry. IBB mesh **parked** for a future agreement. Free on-air stack:

1. Keep Cesium World Terrain  
2. Add Cesium **OSM Buildings** (the 3D city — not a separate product from OSM)  
3. Hero historic glTF (CC-licensed first)

Google Photorealistic stays off air. No other free city stream fits with a different look. Implement only after remaining phase designs and a worker dispatch. Design: `docs/architecture/3d-environment-buildings.md`.

## 2026-09-06 — next goals: 3D environment (buildings)

Operator closed NDI 30×3; asked to design 3D environment next. Prefer service; pre-baked İstanbul if quality is high; asked whether Cesium already has 3D buildings.

**Design (not implemented):** `docs/architecture/3d-environment-buildings.md`

**Pick:** keep Cesium ion **terrain** + add Cesium **OSM Buildings** + **hero glTF** landmarks. IBB licensed mesh only if that still looks cheap. Google Photorealistic **out** for on-air. Do not stand up CesiumJS / MapLibre.

Q5 is no longer “swap globe vendor in silence.” Default is **add a buildings layer** on the existing 3D Tiles path. No SCN/GEO worker until operator locks this (and remaining phase designs).

## 2026-09-05 — SCN 19.2b + 19.17 Human Pass (`HO-SCN-BW-20260905-01`)

Accepted as Human Pass. **No `src/` in this chat.**

## 2026-09-05 — SCN 19.2b + 19.17 Human Pass (`HO-SCN-BW-20260905-01`)

Accepted as Human Pass. **No `src/` in this chat.**

| Item | Verdict |
| --- | --- |
| **19.2b** | Pass — stream 1920×1080; Boat size; names not numbers; no marks/drones on stream; S/F centered; buoy names + rounding (`DSP-SCN-20260905-02`) |
| **19.17** | Pass — Load paints chrome, 2D, Fleet, Assets before 3D remount (`DSP-SCN-20260905-03`). Stall was SCN remount, not Electron `races.read` (`DSP-PLT-20260905-01`). Load stays button-only. |
| **19.2** | Pass (earlier `DSP-SCN-20260829-03`) |

**SCN Phase 19 idle.** Do not open a new SCN chat for 19.17 follow-up unless Load still feels blocked. Do **not** send SCN a MapTiler / terrain-vendor worker. Sea 19.15 holes + 1/9 stay parked unless the operator reopens look-dev. Library 19.16 already seeded.

**Next orchestrator: OUT.** NDI fps (30×3 vs preview hitch) and **19.3 live proof** are still the open air gate in this memo (2026-09-02 Fail / later hitch+send Pass with 30×3 parked “fine for now”). Product 19.1 / 19.3 OBS / 19.4 are code+smoke Pass; the leftover is **live Send vs preview**, not authoring.

**GEO 19.18** only if the operator reopens **Q5**. Until then: no Cesium vendor switch.

Handoff out: `docs/agentic/handoffs/HO-BW-OUT-20260905-01.md`. Roadmap Phase 19 ticked 2026-09-05.

## 2026-09-02 — NDI vs preview (HO-OUT-BW-20260902-03) Fail

Operator after P0 PBO (`DSP-OUT-20260902-01`): banner still on (even NDI unchecked). NDI **off** → preview **>60**. One NDI → preview 15–20 / Send ~10–11. Three → preview ~8 / Send **0**. 2D content OK. Fullscreen snaps back.

**Dual clock ≠ two threads.** Preview rAF and NDI `studio:tick` are two schedules on the **same** Electron renderer JS thread. NDI capture/pack on that thread is why overlay dies.

**Do not** park NDI forever. **v1 still wants all three streams** (NDI first). Uncheck Send = **authoring workaround only**. **Continue OUT:** `HO-BW-OUT-20260902-04` — hitch-fix DSP, then a later slice for 3× on-air. If PBO still fails live, **skip capture** instead of `fallToSync`. Banner must clear when NDI is off.

PRF skipped this round (A/B is enough).

## 2026-09-02 — overlay ~8 fps, empty 2D, Send — (`HO-BW-OUT-20260902-02`)

## 2026-09-02 — overlay ~8 fps, empty 2D, Send — (`HO-BW-OUT-20260902-02`)

Operator screenshot (Demo Istanbul, local **2D**): `SYNC READBACK`; `tickIntervalMs` ~111–124 ms; `captureTicks 2d` missed; NDI Status live, Send 0/—. Chrome on 2D (compass, wind) without course/fleet.

**Cause (BW):** OUT-05 left **sync `readPixels`** as the live AR/3D path when public FBO bind fails. That plus OUT-06 CPU UYVY runs on the **preview rAF thread**. Preview *can* be 60 when that work is not blocking (mouse extra BeginFrames, or before pumps hitch). Product cap is still preview ~60 / NDI 30 — **8 is a hitch, not a setting.**

**Do not** tell OUT to set preview 60. **Do not** fake mouse. **Next: OUT** `HO-BW-OUT-20260902-02` (restore PBO; 2D missed + Send HUD). Empty 2D *content* may still be SCN after PBO is back.

## 2026-09-02 — idle ~8 vs mouse >40 (`HO-OUT-BW-20260902-01`)

## 2026-09-02 — idle ~8 vs mouse >40 (`HO-OUT-BW-20260902-01`)

Not a product. Click/hover is Chromium **input → extra rAF / compositor BeginFrames**. Desktop already `backgroundThrottling: false`; main `STUDIO_TICK_FPS = 60`. Preview = rAF; NDI = `studio:tick`. OUT-06 3D send is **full RGBA → CPU UYVY** (GPU pack striped). That CPU pack can starve the **same** renderer thread that runs rAF + tick, so idle looks ~8/crunchy while mousedown makes preview HUD jump.

**Do not** ship mouse-to-boost, fake input, or “keep hovering.”

**Route:** **PRF first** (measure preview HUD vs Send idle vs mousedown) — `HO-BW-PRF-20260902-01`. **OUT** worker for a *correct* GPU UYVY only after PRF names CPU pack as the hog (no size heuristic). **Human:** 3D OBS glance for OUT-06 picture in parallel; 19.1/19.4 still blocked on 3D Pass.

**Human next:** PRF chat (paste below). Optional 30 s: look at `broadcast-web-3d` in OBS (stripes vs picture).

## Phase 19 locked 2026-09-01 — Senexus QoL

## Phase 19 locked 2026-09-01 — Senexus QoL

Operator notes (`c:\Users\PC\Desktop\senexus.md`) + Q&A in this BW chat. **No `src/` in BW.**

- Design: `docs/architecture/phase19-senexus-qol.md`
- Roadmap: `docs/roadmap/phases-roadmap.md` Phase 19
- Briefs: `docs/agentic/briefs/phase19/` (OUT, CAL, SCN, PLT, GEO, TEL)
- **Not opened:** CON, PRF, SRT (no notes in this set except 19.3 must not thrash fps)
- **Parked:** terrain **vendor** (Q5). Options in design §8. SCN 19.15 still does sea-over-assets.
- Absorbed: `DSP-OUT-20260829-03` → 19.1, `DSP-SCN-20260829-03` → 19.2
- Locks worth repeating: 1920×1080 16:9; hide barcode keep code; no PiP; roll ±200 too; NDI toggles not in project JSON; billboard `#2A6FA6` + AABAB weights; 3D-off keeps tags; 2D unaffected by ghost; library from existing PNGs + git uploads; no World Close (header toggle)

**Human next:** paste OUT prompt, then CAL in a second chat. SCN after OUT has 19.3 in flight or done. Do not open GEO for a MapTiler worker.

## Accepted 2026-08-30 — `DSP-OUT-20260830-02` capture flip (suite 1014 + 23)

BW verified: `npm test` **1014 + 23**, build green. `captureFlip.blit(target)` sits immediately before `readback.begin` in **both** pumps. Dest Y is `(0,h)→(w,0)`. 2D files have a negative wiring test. `desktop/` not in the diff.

Soft hole, not blocking: if `blitFramebuffer` is missing, blit returns an empty dest (black), not the unflipped source. Electron studio is WebGL2. If OBS is black rather than inverted, that is the first thing to check.

**Human still the gate:** one Electron restart covers flip orientation **and** the wave-3 fps dump.

## Accepted 2026-08-30 — Phase 18 wave 3 (suite 1007 + 23)

BW verified merged tree: `npm test` **1007 + 23**, `npm run build` green. Mid-wave `tsc` / panel / 2D-context failures were the usual parallel-merge artefact.

| DSP | Verified |
| --- | --- |
| `done/DSP-OUT-20260829-02` | `desktop/ndiSender.cjs` only (plus docs). `nativeRgbaActive()`, `FourCC.RGBA`, `Buffer.copy` into pool of 3, keep-newest increments `dropBusy`, `sendGen` on stop. Fallback note `NDI_BGRA_FALLBACK_NOTE`. **`fillSlot` ignores `bottomUp` on the RGBA path** — inversion is real. |
| `done/DSP-OUT-20260829-04` | `createNdiCaptureGate` ~32 nominal; `canBegin()` before AR/3D render; `ndiDeferredSend` `setTimeout(0)`; `takeNdiArrayBuffer` no slice when the view is the whole buffer. `ndiCaptureStagger` only on sync. |
| `done/DSP-OUT-20260830-01` | Worker `getImageData(0,0,srcW,srcH)` + `blitRgbaLetterbox`. Wiring test forbids 1080p dest `getImageData`. `letterboxRect.ts` extracted. `streamMapNdiPump.ts` not edited by this worker. |

**OUT-05 swizzle cancelled.** RGBA exists.

**New P0:** `DSP-OUT-20260830-02-ndi-capture-flip` — GPU Y-flip on AR/3D **before** `readback.begin`. Do not put a CPU walk back in main. 2D must not be flipped.

**Still required from the operator:** restart Electron, all three senders on, **Copy 10 s dump**. Deciding lines: `tickIntervalMs` (want 16), `captureTicks` (want 2), `2dGrab` (want ≪ 8 ms), `*EnqueueIpc` (if still **>12 ms**, that is 4:2:2). Also look at OBS: AR/3D will likely be **upside-down** until the flip worker lands; 2D should be upright; alpha should still key.

## Dump received 2026-08-30 — Phase 18 wave 3 released (recut)

Operator paste from a live studio session. Send rail: **AR 15 / 3D 15 / 2D 3**. OBS colour accepted (slightly bright, no work). Connect/Disconnect accepted. FPS still failed — this dump is why.

### What the numbers actually say

| Claim I made before the dump | Verdict |
| --- | --- |
| Phase-locked `minIntervalMs` pins the system at 20/15 | **Visible but not the wall.** `captureTicks` is a smear 1…6+, not a clean 2-vs-3. The clock itself has collapsed. |
| `rgbaToBgra` cannot carry 90 fps | **True as a 30×3 ceiling, false as the 15 fps cause.** 7 ms/frame, `n≈11`, **`dropBusy=0`**. Main is keeping up with what arrives. |
| 60 Hz tick is real | **False on this machine under this load.** 495 ticks / ~10 s ≈ 50 Hz. Mean 20.2 ms, max 109.5, `>20ms=225`. |

**Named walls:**

1. **`arEnqueueIpc` / `3dEnqueueIpc` 17–23 ms mean** (max ~29). `ArrayBuffer.slice` + sync `ipcRenderer.send` of 8 MB, inside the tick. Two of those plus `arReadbackBegin` 10–16 ms produce `totalTick` max 73–85 ms, which is why the next `studio:tick` is late. 22 ms × 30 × 2 FBO channels = 1.3 s of renderer work/s — **defer + kill-slice restores the clock but cannot alone create 30+30 if the clone stays 22 ms.** Gate: if enqueue is still >12 ms after those two changes, that is the 4:2:2 decision.
2. **`2dGrab` 120–193 ms mean.** Worker path is **on** (`sync2dCapture=false`). Source is 520²; worker upscales into 1920×1080 OffscreenCanvas and `getImageData`s the whole frame. 3–4 grabs/s = 3 fps. `2d busy` 41–51 /s is `grabbing` held for 160 ms. New dispatch `DSP-OUT-20260830-01`.
3. **Stagger** — AR `stagger` skips 10–30/s in the snapshots. Real limiter, secondary to (1). Still retire on PBO.
4. **`rgbaToBgra` 7 ms** — keep OUT-02. At 30×3 it becomes ~630 ms/s on main.

PBO path is live (`syncReadback=false`). FBO render is cheap (~1 ms). `present()` is free (0.03 ms). Instrument overhead 0.005 ms/sample — the dump is not lying.

### Wave 3 recut (three parallel, file-disjoint)

| DSP | Owns | Why this, not the original story |
| --- | --- | --- |
| `DSP-OUT-20260829-04` | pumps, stagger, readback | Defer IPC off tick; drop slice; retire stagger; phase-accumulate the gate |
| `DSP-OUT-20260830-01` | 2D grab helper + worker only | Native-size read + typed-array letterbox blit. Output stays 1920×1080 |
| `DSP-OUT-20260829-02` | `desktop/` only | RGBA probe + delete the 7 ms loop before 30×3; pool; keep-newest |

SCN-03 (PiP remove / 16:9 source) stays wave 4 and must **not** grow the stream-map canvas to 1080p.

## Accepted 2026-08-29 — Phase 18 wave 2 (suite 982 + 23)

BW verified the merged tree: `npm test` **982 + 23**, `npm run build` green, and all three workers' new test files present and passing (47 tests across `ndiStageTiming`, `srtDisconnect`, `flowPanel`, `flowTap`, `videoStreamManager`). Checked that explicitly because the merged count **982 exactly equals SRT-01's reported count** — a coincidence worth ruling out rather than assuming one worker's tree had won.

| DSP | Result |
| --- | --- |
| `done/DSP-PRF-20260829-01-ndi-stage-timing` | ★ Instrument only. Ops NDI tab: 1 s stage mean/max, skip-by-cause, capture-tick histogram, tick-interval distribution, main `rgbaToBgra` / `grandi.video` / `dropBusy`, sync-fallback banner. `window.__perfDump()` + **Copy 10 s dump**. Playbook in `performance-budgets.md`. Overhead calibrated at 0.00029 ms per `now()` pair, ≈0.004 ms/tick. |
| `done/DSP-TEL-20260829-02-flow-live-assets` | Registry ids always carded (including a deliberately-disconnected drone); non-registry ids only within `FLOW_CARD_RECENCY_MS = 5000`. `buildFlowCards(snapshot, registry, nowMs)` is pure. Prune on allow-list rebuild + project load. Matching buffers untouched. |
| `done/DSP-SRT-20260829-01-srt-disconnect` | Generation hold + `explicitlyDisconnected`; `srtReopenAllowed` consulted by the stall watchdog **and** `beginFfmpegH264Fallback` incl. the HEVC `onOpsError` path. Deliberate disconnect → **colour bars**, not the frozen frame. `beforeunload` → `close('all')`. `open failed` now logs povId only. |

**The region locks worked.** Three workers edited `src/main.ts` in parallel with zero conflicts; every hunk landed inside its owner's range. This is now the standing answer for shared-hub files — **region-lock the wave, do not serialise it.** The one cross-boundary edit was PRF-01 adding `?.` to `fleetPanel?.setSrtStatus` on a line SRT-01 had just created, purely to satisfy `tsc` on a nullable module-level `let`. BW checked it is not masking anything: `pushSrtPanelStatus()` already early-returns when the panel is null, so the optional chain is redundant-but-correct.

**PRF-01 refused to fabricate the measurement, and that was correct.** It shipped the instrument and explicitly declined to name a wall from unit-test data, having never run a live studio session. That is the behaviour I want from a measurement dispatch — the alternative would have handed wave 3 a fake baseline.

### Wave 3 is GATED on an operator dump — not on any worker

The gate I recorded ("18.3 must name the stage it removed") needs a **before** baseline from real hardware. Operator action: `npm run desktop:dev`, all three NDI senders on, SRT live if possible, ops **NDI** tab → **Copy 10 s dump**. The deciding line is `captureTicks ar/3d/2d` — cluster on **2** is healthy 30 fps; a **2-vs-3 split** or cluster on **3/4** confirms the phase-locked rate gate. OUT-02 and OUT-04 stay in `active/` and unreleased until that text block exists.

### Third fps defect, found by PRF-01 and verified by BW — the burned stagger slot

Not in my original two-defect analysis. `tryClaimNdiHeavyCapture` commits the claim (`lastFboChannel`, `lastFboMs`) **before** the pump knows a readback slot exists. AR then renders a full 1080p pass and only afterwards calls `readback.begin` (`ndiFramePump.ts:307`); on PBO-pool exhaustion it returns at L309 **without releasing the claim**. Cost of one failure: a wasted 1080p render, no AR capture, and 3D rejected on the same tick (`preferNext = '3d'`). `preferNext` partially self-corrects next tick, but this fires precisely under the load being debugged, since pool exhaustion means readbacks are not draining.

Written into OUT-04. **Retiring the stagger removes the AR-blocks-3D half but not the wasted render** — the replacement must not commit to a render before a readback slot is known available, and the sync-readback fallback keeps exclusivity so it needs the release path too.

Two instrument caveats also written into OUT-04 so nobody tunes against a lie: renderer-side `busy` is almost never true (`sendFrame` is fire-and-forget, so the meaningful counter is main-side `dropBusy`, which is OUT-02's), and 2D `rateCap` can double-count between schedule and deferred `runCapture`.

## Accepted 2026-08-29 — Phase 18 wave 1 (suite 950 + 23)

BW verified the merged tree, not the reports: `npm test` **950 + 23**, `npm run build` green. Four dispatches moved to `done/`. Two of the three ★ items are now closed in code; the ★ fps track is untouched and still ahead of us.

| DSP | Result | Verified how |
| --- | --- | --- |
| `done/DSP-OUT-20260829-01-ndi-color-space` | ★ `applyNdiCaptureColorSpace(target)` sets `texture.colorSpace = SRGBColorSpace`; called inside the create-or-resize branch of **both** AR (`ndiFramePump:208`) and 3D (`ndi3dChannelPump:140`) pumps, so a resize cannot silently revert it. `createScene` pins `renderer.outputColorSpace`. 2D deliberately untouched. | Read the diff at both call sites and confirmed each sits in the `!target || size changed` branch |
| `done/DSP-SCN-20260829-01-project-fleet-fidelity` | ★ `boats` present — **including `[]`** — is the complete fleet; `DEFAULT_BOAT_IDS` is never injected on a project load. | Every operator requirement has a named test: out-of-band `["1","2"]` round-trip, empty-fleet round-trip, legacy pack without `boats[]`, mismatched `boats[]` vs `boatIds` follows `boats[]`, 4-boat→1-boat load leaves only the new fleet, loaded pack beats stale session |
| `done/DSP-SCN-20260829-02-sponsor-flat-on-sea` | Sponsors flat via shared `applyFlatOnWaterPlacement` (`y = 0.08`, polygon offset −4 vs Gerstner's −2). `billboardChain` → `createUprightSponsorBillboard`. | Confirmed the chain call site actually changed factory, so the upright path is real and not just claimed |
| `done/DSP-TEL-20260829-01-telemetry-disconnect` | `disconnectLive()` + `intentionalStop` + **generation bump**; only Connect / Reconnect reopen. Uncheck Live closes that id now. | Diffstat confirms `srtBridge` / `desktop/srtReader.cjs` untouched, so SRT-01's file ownership is intact |

**`normalizeBoatIds` scope held.** `src/config/loadConfig.ts` is **not** in the diffstat. SCN-01 added a separate project-fleet reader instead of weakening the config helper, which is exactly the operator lock ("config/mock keeps its behaviour").

### The "pre-existing TEL flake" was neither — do not chase it

SCN-02 reported a flake in `src/telemetry/live.test.ts` (`retrying` vs `closed`) and labelled it pre-existing. **It is not pre-existing:** TEL-01 added 264 lines to that exact file in the same wave, including the retrying-state tests. **And it is not a flake:** BW ran that file **six consecutive times at HEAD — 22/22 every run**. The tests use `vi.advanceTimersByTimeAsync` with a `ManualWebSocket`, so they are deterministic by construction.

It was a **mid-merge artefact** — SCN-02 ran the suite with TEL-01's source present but its tests not yet merged (or the reverse). This is the third time a parallel wave has produced this exact false report (Phase 17 wave 2 OUT-07 `tsc`; the 2026-08-28 "cross-worker failures ... all resolved in HEAD"). **Standing rule for BW: a red result from a worker in a parallel wave is not evidence until it reproduces at merged HEAD.** Recorded in the dispatch index so no future worker hunts a ghost.

### Wave 1 human smoke — all still open, none of it run by a worker

Every worker explicitly declined to smoke. These are the operator's gates:

- **OBS colour (the real gate for OUT-01).** Restart Electron, add all three NDI sources. AR and 3D should now match the preview and 2D. **If AR/3D are now too bright, that is a double encode** — report it, do not "fix" 2D to match.
- **Telemetry Disconnect.** Live flowing → Disconnect: packets stop, Flow quiet, nothing returns on its own for a minute. Connect live resumes. Reconnect while connected: brief gap, no duplicate ids.
- **Sponsors.** From a drone or free cam, boards painted flat on the sea like the start/finish band. Problems look like walls still standing, z-fighting flicker on the water, or logos reading backwards (fix by swapping A/B).

### Carried forward

- **Sponsor depth.** SCN-02 flags `heightM: 8` may read thin from above now that boards are flat; the start/finish band is 12 m. Schema default left at 8. **BW: defer** — operator eyeballs it in the smoke above, and it is a one-value change if it looks skinny.
- SRT-01 is **unblocked** and now carries a "what TEL already landed" section so it copies the generation-guard pattern rather than inventing one.
- TEL-02 gained an explicit warning: a deliberately-disconnected drone is still in the registry and **keeps its empty card**. Disconnected ≠ deleted.

### Planning defect found while releasing wave 2 — `src/main.ts` is a three-way overlap

**My wave plan was wrong.** It advertised wave 2 as file-disjoint. It is not: all three wave-2 dispatches edit `src/main.ts` — PRF-01 for total-tick timing, TEL-02 for the registry prune and the `buildFlowCards` clock, SRT-01 for `onSrtDisconnect`, the stall-watchdog guard, and `beforeunload`. I only caught it by grepping the active dispatches for the filename before writing the worker prompts.

**Resolution: region locks, not serialisation.** The three regions genuinely do not overlap, and the operator wants parallelism, so each dispatch now names the exact line ranges it owns and the ranges it must not touch, plus a no-reformatting / no-import-reordering rule. PRF-01 is additionally told to prefer `src/output/*` over `main.ts` wherever it has the choice. Documented merge order if a conflict appears anyway: **PRF-01 → TEL-02 → SRT-01**, because wave 3 is blocked on PRF-01.

**Standing lesson for future wave planning:** "owns `X.ts`" in the wave table is not the same as "is the only dispatch that edits `X.ts`". `src/main.ts` is the wiring hub and will keep showing up as a hidden shared file. **Grep the active dispatch set for shared filenames before declaring a wave parallel**, not after the workers report conflicts.

## Phase 18 PLANNED 2026-08-29 — operator notes (10 items, 3 ★)

Roadmap written (`phases-roadmap.md` → Phase 18). **No dispatches issued yet** — held on operator answers below. BW traced every note to code first; no `src/` touched in this chat.

**Root causes found (not reported, traced):**

- **★ NDI too dark (18.1).** Renderer never sets `outputColorSpace`; AR/3D FBOs are `new WebGLRenderTarget(w,h,{depthBuffer,stencilBuffer})` with no `texture.colorSpace`. On three `^0.178.0` the canvas is sRGB-encoded, an unset render target stays **linear** → `readPixels` gives linear bytes → OBS shows them as sRGB → dark. **Prediction to confirm:** the 2D channel grabs a 2D canvas, so 2D NDI should look *right* while AR/3D look dark. If 2D is also dark, this diagnosis is wrong and it is the sender/OBS side.
- **★ 18 fps (18.2/18.3).** Not the GPU and not the cap. Tick is 60 with an 8 ms AR/3D stagger and `minIntervalMs = 1000/30` per channel — the design already targets 30. Cost is ~8 MB/frame copied 4×: pump `ArrayBuffer.slice` → structured-clone `ipcRenderer.send` (preload has **no** transfer list) → `Buffer.from` in main → synchronous scalar `rgbaToBgra` in main. 3 channels × 30 ≈ 700 MB/s of JS memcpy, sharing threads with demux/`present()`/preview render. Same shape as the "GPU idle ≠ weak PC" lock. Also: `ndiSender` **drops** when busy (no queue), 2D has no stagger slot, sync-readback fallbacks (`NDI_SYNC_READBACK_NOTE`, `NDI_2D_SYNC_CAPTURE_NOTE`) would each blow the tick.
- **★ Default boats on load (18.4).** `parseRaceProject` → `normalizeBoatIds` filters to band **21–52** and substitutes `['21','22','23','24']` when the result is empty — on **save and load**. Empty or out-of-band fleets cannot round-trip. Untracked `public/races/test/project.json` already has `boats[]` for `"1"`/`"2"` beside `boatIds: ["21".."24"]`. Secondary: session-storage fleet can override a `?race=` pack at boot.
- **Flow stale assets (18.6).** `buildFlowCards` unions the fleet registry with every id in `flowTap`; `flowTap.reset()` is test-only. Deleting drone 2 drops it from the registry but not from the tap.
- **Connections (18.5).** There is **no Disconnect control at all**. Connect live / Reconnect are genuine stop-then-start (`ingest.stop()` closes sockets + clears backoff); Connect SRT is genuine `close('all')` + reopen (ffmpeg killed via `taskkill /t /f`). But Live/Vid checkboxes close nothing, renderer unload never closes SRT, and `maybeFallbackSrtDecodeStall` can reopen SRT on its own.
- **Sponsors (18.7).** `createSponsorBillboard` uses basis `(along, up, normal)` at `y = heightM/2` — an upright wall. `createLineSignMesh` uses `(along, across, up)` at `y = 0.08` — flat on water. No schema field for flat vs upright.
- **Timecode (18.8).** `visualTimecodeOverlay.ts`, gated by `config.timecodeEnabled` (default **true**), installed as the **outer** `renderer.render` wrap over the video-background pre-pass. Removal must preserve that ordering for the underlay.
- **PiP vs 2D (18.9/18.10).** Two separate `Map2dHandle`s. The PiP card and the `'2d'` NDI channel share one canvas (`hud.getStreamMap()`), so removing the PiP must keep `redraw()` driven. `startStreamMapNdiPump` already accepts `outputWidth`/`outputHeight` — portrait is a wiring change plus a non-square map view.

**Gate recorded:** 18.2 (PRF measurement) lands **before** 18.3. The last perf round shipped four dispatches on a hypothesis and ended at 18 fps; 18.3 must name the stage it removed.

### Operator answers 2026-08-29 — locks

- **FPS.** All three channels on **together**, **min 30**, measured at ~18 in that config. Downrating or disabling a channel is refused (second time).
- **Colour — diagnosis CONFIRMED.** Operator: 2D NDI is correctly exposed in OBS while AR and 3D are dark. 2D is a 2D-canvas grab and never touches a WebGL FBO, so the asymmetry is exactly the render-target colour-space bug. 18.1 proceeds on that basis; if a fix makes AR/3D *bright*, it is a double encode.
- **Fleet.** "if project have boats on save inject them dont inject any other boat." → any id legal, empty fleet legal, **never** inject `DEFAULT_BOAT_IDS` on a project load. `normalizeBoatIds` keeps its behaviour for config/mock only.
- **Removals.** "delete ui elements but keep code maybe we use them later." → timecode and PiP leave the UI; modules and tests stay in-repo and must still re-enable cleanly.
- **2D resolution.** Portrait **cancelled** — "1080 1920 was mistake", 2D stays 1920×1080 like AR/3D. 18.10 struck. BW folded the surviving value into 18.9: the source canvas is a 520² square pillarboxed into 1920×1080, so once the PiP card goes the source becomes 16:9 and fills the frame. 2D **UI redesign deferred** — operator will bring details next iteration.
- **Sponsors.** `sponsor` flat only; **`billboardChain` stays upright**. BW decided `heightM` → depth across the water (start/finish band semantics), default 8 kept, no rename, no migration.
- **Disconnect.** Separate per path, each beside its own Connect. No master kill.

### Issued 2026-08-29 — 10 dispatches into `active/`

| Wave | DSP | Owner | Note |
| --- | --- | --- | --- |
| A | `DSP-OUT-20260829-01-ndi-color-space` | OUT | ★ FBO sRGB; pin `outputColorSpace`; must not disturb alpha plate |
| A | `DSP-PRF-20260829-01-ndi-stage-timing` | PRF | ★ **gate** — measure only, explicitly forbidden to optimise |
| A | `DSP-SCN-20260829-01-project-fleet-fidelity` | SCN | ★ fleet round-trip; `public/races/test/project.json` is the fixture |
| A | `DSP-SCN-20260829-02-sponsor-flat-on-sea` | SCN | share the `lineSignMesh` placement; chain untouched |
| B | `DSP-OUT-20260829-02-zero-copy-ndi-frames` | OUT+PLT | ★ **blocked on PRF-01**; ordered steps, re-measure each |
| B | `DSP-TEL-20260829-01-telemetry-disconnect` | TEL | lands first of the pair (shared `fleetLivePanel.ts`) |
| B | `DSP-SRT-20260829-01-srt-disconnect` | SRT | **blocked on TEL-01**; must suppress the stall-fallback reopen |
| B | `DSP-TEL-20260829-02-flow-live-assets` | TEL(+SCN) | cross-file, BW-authorised; recency rule 5 s + prune on change |
| C | `DSP-OUT-20260829-03-remove-timecode-ui` | OUT | default off, keep code; **watch the render-wrap order** |
| C | `DSP-SCN-20260829-03-remove-pip-minimap` | SCN | keep the canvas alive for `'2d'`; source → 16:9 |

**Cross-domain calls BW made rather than splitting:** `DSP-TEL-20260829-02` owns both `flowTap.ts` (TEL) and `buildFlowCards` in `flowPanel.ts` (SCN) — splitting would produce two half-working dispatches; `HO-TEL-SCN-20260829-01` records it. The two Disconnect dispatches were split by domain but **sequenced**, because both edit `fleetLivePanel.ts`.

**Known Electron limit written into OUT-02 so no worker burns time on it:** `ipcRenderer.postMessage` / `MessagePortMain.postMessage` accept only `MessagePort`s in the transfer list — an `ArrayBuffer` cannot be transferred to main. At least one serialization copy is unavoidable. If IPC volume is still the wall afterwards, the 4:2:2 packing of 3D/2D is a **new BW decision**, not worker discretion.

## FPS re-scoped 2026-08-29 03:30 — two named defects, wave 3 split by process

Operator amended the requirement: **"dont slice anything, all of them have min 30 fps independent from each other"**, read off Broadcast → Output. BW read the code rather than waiting for measurement and found two specific causes. The fps track is re-cut accordingly.

**(a) Phase-locked rate gate — can pin the system at 20 fps on its own.** `if (now - lastCaptureMs < minIntervalMs) return` (`ndiFramePump.ts:297`, `ndi3dChannelPump.ts:206`, `streamMapNdiPump.ts:247,279`) compares an observed delta against `1000/30 = 33.333 ms`. Two ticks of the 60 Hz clock is **exactly** 33.333 ms and `lastCaptureMs` is an observed `performance.now()`, not a grid position, so any negative jitter in the `setInterval`-over-IPC tick fails the check and the pump waits for the third tick. Rate is quantised: 2 ticks = 30, 3 = 20, 4 = 15, nothing between. A 2/3 alternation averages ~24; with overruns → the observed ~18. Fix is phase accumulation plus a half-tick tolerance.

**(b) Per-pixel conversion cannot carry 90 frames/s.** `rgbaToBgra` (`desktop/ndiSender.cjs:98–112`, called :242) is scalar JS, 4 byte reads + 4 byte writes per pixel, rows reversed for the AR/3D flip. 3×30 at 1080p ≈ **187 M px/s** on the main thread while it also deserializes ~750 MB/s. Between a large fraction of a core and more than one, continuously.

**Correction to the earlier "four copies" note:** `Buffer.from` at :231–234 is a **view on both branches**, not a copy. Real costs are the renderer `slice`, the IPC clone, and the conversion loop — and the loop dominates because it is per-pixel work, not bulk movement.

**Likely one-line escape:** NDI SDK supports RGBA/RGBX natively. If `grandi.FourCC` exposes them, the conversion is deleted outright. OUT-02 must probe and **report before doing anything else**; the answer decides whether OUT-05 exists.

**Trap recorded so no worker corrupts a frame:** drop-when-busy at `ndiSender.cjs:224` protects the single reusable `bgraScratch` from being overwritten while the async native send reads it. A queue **requires** a buffer pool first.

**Stagger retired (BW approval).** It was a mitigation for synchronous readback; on the PBO path a second 1080p render per tick is mostly GPU submission and the GPU is at 8%. Exclusivity survives **only** for the sync-readback fallback. Module and tests stay in-repo.

**Readout artefact — write this into acceptance, not into a bug hunt.** `createSendFpsCounter` returns a trailing-1000 ms count (`perfCounters.ts:42–45`). An exactly-30 cadence intermittently displays **29**. Operator's bar is literally "never below 30 on the panel", so pumps target **~32 nominal** while NDI-declared `frameRateN/D` stays **30/1**.

**Stale workspace rule flagged to workers:** `.cursor/rules/agentic-core.mdc` still says `never STUDIO_TICK_FPS = 60` and `NDI 3D ~10`. Both were superseded — tick 60 is deliberate under accepted `DSP-OUT-20260828-04` (comment at `desktop/main.cjs:86–89`) and 3D is locked at 30. Written into OUT-04's out-of-scope so nobody "fixes" it back. **The rule file itself should be corrected** — that is a PLT hygiene item, not part of Phase 18.

**Re-cut dispatches:** `DSP-OUT-20260829-02` is now **`desktop/` only** (probe, conversion, buffer pool, keep-newest queue). New `DSP-OUT-20260829-04` is **`src/output/` only** (rate gate, retire stagger, drop the renderer slice, independent clocks). They have **no shared file and run in parallel**. New `DSP-OUT-20260829-05` (GPU swizzle) is pre-written but **conditional** — released only if OUT-02's probe says RGBA is unavailable. PRF-01's rationale changed from "measure before you guess" to "land first because it touches every pump and the sender, and wave 3 needs it to prove 30"; it gained a **capture-interval histogram** requirement, which is the direct test for defect (a).

## Pulled 2026-08-29 01:55 — HEVC WebCodecs copy-decode (`1a4e0ae`)

Far-device fix on `main`. Not a DSP. **Root cause was our SPS parse, not Electron lacking HEVC.**

DJI Annex-B inserts emulation-prevention `0x000003`. `resolveCodecString` / `hevcCodecFromSps` read those `0x03` bytes as profile/level → garbage `hev1.*` → `isConfigSupported` false → ffmpeg HEVC→H.264. GPU VCN could decode Main HEVC; the codec string was wrong.

**Fix:** `unescapeRbsp` in `src/output/tsDemux.ts` (H.264/HEVC RBSP) before PTL parse. Tests: EPB drop; SPS with `000003` must not appear in `hev1`. ffmpeg **copy** (`-c copy`) is the live path again when WebCodecs accepts the string. Transcode fallback **stays** for real unsupported / `decoded=0` stall.

**Human:** Race ops should show `codec=hevc` (or `hev1…`) **without** `ffmpeg→h264` once Electron is restarted on this pull. `ffmpeg→h264` still means fallback. Store pack still not required. Shared-GPU / raw IPC still refused.

Lock restated: stay on Electron/Chromium for Three.js + NDI. Decode HEVC in WebCodecs (now unblocked) or fail-closed ffmpeg; do not swap Gecko/WebKit.

## Accepted 2026-08-28 night — TEL-04 (suite 912 + 23)

Worker queue **clear**. Live DJI LUT miss is closed in code.

- `done/DSP-TEL-20260828-04` — `/^dji-?(\d+)$/i` aliases onto digit LUT (raw `dji-1` kept). `kind:frame` is the OLS series when pacing has &lt; 2 samples; periodic/`dji`/`gopro` ≥2 still uses frame as residual only. Extra **2 s**. `pacingCount` follows the fit series.
- Handoff: `HO-BW-TEL-20260828-04-done`. L7 / §4.2 / C8 / `ntp-matching.md` “do not use frame for pacing” amended.

**Human:** restart Electron, `mode=live`, telem+SRT **1**, AR bg **video**. Expect Sync `PTS →` a real NTP (not `—`), FREE-RUN off after two frame anchors, overlay tracking picture not stick. GPS 0,0 and hitch/Send under live SRT are **not** this DSP.

## Live Electron 2026-08-28 23:23 — SRT NTP not engaging (closed by TEL-04)

BW launched studio (`mode=live`, POV+SRT **1**, AR bg video). Picture + pose flow. Sync **FREE-RUN**, PTS `28821000 → —`, pacing **0**. Flow anchor: `stream_id: "dji-1"`, `kind: "frame"`, `ntp_capture_ms` ≈ pose `ts` (~80 ms), PTS vs presented ≈ **833 ms**. Matching never started — alias + frame-only OLS missing. **Accepted TEL-04** same night.

Secondary (not TEL-04): preview 8 fps / hitch 9 / Send 15/16/4 under live SRT. GPS lat/lon 0 on this drone.

## Accepted 2026-08-28 night — TEL-03 + OUT-08 (suite 910 + 23)

Worker queue **clear**. World must move while telem + SRT flow.

- `done/DSP-TEL-20260828-03` — LUT miss free-runs; skip upsert only when `toNtp` works; long `unavailable` → newest pose
- `done/DSP-OUT-20260828-08` — empty LUT presents newest frame (`lut-miss-live`); stall-pin only with a working LUT

**Human:** AR bg **video**. Expect motion. Sync may show FREE-RUN until PTS maps; that is live-unsynced, not a freeze.

## Freeze 2026-08-28 night — match miss holds the whole world

Operator: telem no longer null; SRT + pose flow; AR **and** 3D stuck. Same `poseBus`; `videoClockActive` + `emitHeld` + infinite `lastMatched`.

**Lock:** never freeze the world while packets and SRT flow.

**Issued (accepted same night as TEL-03 / OUT-08):**
- `done/DSP-TEL-20260828-03-match-miss-freerun.md`
- `done/DSP-OUT-20260828-08-lut-miss-play-newest.md`

Handoffs: `HO-BW-TEL-20260828-03-done`, `HO-BW-OUT-20260828-08-done`. Alpha workaround no longer required.

## Accepted 2026-08-28 night — OUT-07 (suite 909 + 23)

Worker queue **clear**. `done/DSP-OUT-20260828-07` — 2D `onStudioTick` only schedules; grab via worker + transferable; fail closed to sync + `NDI_2D_SYNC_CAPTURE_NOTE`. 2D still on@30. PTS/ffmpeg untouched.

**Human (not a code gate):** restart Electron, leave 2D on. Paste preview / hitch / Send **and** Sync PTS → NTP + last pacing.

## Accepted 2026-08-28 night — 04 / 05 / SRT-01 (suite 900 + 23)

BW verified `npm test` **900 + 23**.

- `done/DSP-OUT-20260828-04` — tick 60; one FBO/tick including PBO; 2D stayed on
- `done/DSP-OUT-20260828-05` — `presentedPts90k` = 33-bit PES; LUT reset on H.264 fallback
- `done/DSP-SRT-20260828-01` — transcode `-copytb 1` + `-enc_time_base 1:90000`
- `done/DSP-OUT-20260828-06` — **superseded** (never started)

**Remaining worker:** none (OUT-07 accepted).

## Lock restated 2026-08-28 night — GPU idle ≠ weak PC

Operator: Electron ~**10% GPU**, app hitch, Send not 30. **Refused:** “device not strong enough” and 2D default off.

Cause: one JS thread. Two WebGL `render`s + sync `getImageData` block that thread; the 6750 XT finishes and **waits**. vMix still gets all three sources at 30 if we **pipeline** work (use more of the GPU across time), not if we drop channels.

**Amended OUT-04:** FBO stagger + tick 60; **2D stays on**.  
**Issued OUT-06:** async 2D grab.  
Handoffs: `HO-BW-OUT-20260828-06`, `HO-BW-PRF-20260828-08` (04 handoff amended).

## Live fail 2026-08-28 evening — hitch + PTS gap

**Perf (2D off):** preview **16**, hitch **12/1s**, Send AR/3D **22**. 2D on was worse (preview 6, Send ~10). GPU RX 6750 XT. PBO still **renders two FBOs per 30 Hz tick**.

**Sync:** pacing 20, PTS `10650000` → —, extra **33965 ms**, pose held. Anchors live; presented PTS ~34 s past last pacing. H.264 transcode vs DJI mux PTS.

**Issued:**
- `active/DSP-OUT-20260828-04-one-ndi-fbo-per-tick.md` — one FBO/tick; `STUDIO_TICK_FPS` 60 NDI-only; **2D stays on** (amended; 2D-off void)
- `active/DSP-OUT-20260828-05-pts-transcode-lut.md` — PES 33-bit to LUT; reset LUT on H.264 fallback
- `active/DSP-OUT-20260828-06-async-2d-ndi.md` — 2D grab off the JS tick; still default on @ 30
- `active/DSP-SRT-20260828-01-h264-keep-pts.md` — libx264 must keep input PTS

Handoffs: `HO-BW-OUT-20260828-04/05/06`, `HO-BW-SRT-20260828-01`, `HO-BW-PRF-20260828-07/08`.

## Phase 17.6 ACCEPTED 2026-08-28 — AR match hold + present-wait

BW re-ran merged tree: `npm test` **896 + 23**, `npm run build` green. Worker queue **clear**.

- `done/DSP-TEL-20260828-02` — `emitMatched` re-emits `lastMatched` when `sampleAt` is unavailable; overlay does not vanish. Debug: `tNtpMs` / `newestPoseNtpMs` / `poseMinusVideoMs` / `pacingCount`. No lerp-to-newest.
- `done/DSP-OUT-20260828-03` — PTS lookup ±32 µs or null (never µs as 90 kHz); LUT/`toNtp` all-null → stall-pin **400 ms**, not live-newest. copyts untouched.

**Human smoke (not a code gate):** AR bg=video, Output **Sync** on. Confirm:
1. `pacing` ≥ 2 and PTS maps to NTP — if `pacing 0`, producer is not sending `stream_anchor` (cannot match in-app).
2. Overlay stays on screen when Δ (newest−t_ntp) is negative (video ahead of pose) — hold, not vanish.
3. Picture does not look “live stick” while overlay is frozen unless Sync shows HELD + pacing 0 (then it is anchors, not these DSPs).
4. Flow `telem: null` at 4 Hz is still an empty card, not a dropped mesh.

Handoffs: `HO-BW-OUT-20260828-03`, `HO-BW-TEL-20260828-02`.

## Phase 17.6 ISSUED 2026-08-28 — AR match not engaging live

Operator: SRT plate and pose not synced; SRT *looks* earlier than telemetry; Flow sometimes **null**. Producer NTP note is **already** our 3-step design (PTS → `stream_anchor` → `sampleAt`). Not a missing interpolator.

**Likely live breaks (code, not theory):**
- OUT: `presentedPts90k` can fall back to WebCodecs µs; LUT-empty present() shows **newest** frame (video live, overlay held).
- TEL: `emitMatched` **skips** `unavailable` → mesh vanishes when video NTP is ahead of the pose buffer.

**Issued (parallel workers):**
- `active/DSP-OUT-20260828-03-present-wait-lut.md`
- `active/DSP-TEL-20260828-02-match-no-vanish.md`

If Flow Live JSON has **no** `stream_anchor` while SRT picture is up, matching cannot start — that is the phone/VPS, not Hermite. GoPro `type=anchor` still out of scope (L2).

Handoffs: `HO-BW-OUT-20260828-03`, `HO-BW-TEL-20260828-02`.

## Studio 30 + pose smoothing ACCEPTED 2026-08-28 (code)

BW re-ran merged tree: `npm test` **887 + 23**, `npm run build` green. Worker queue **clear**.

- `done/DSP-TEL-20260828-01` — cubic Hermite lat/lon/alt from NED vel (linear if vel NaN); xyzw slerp; boats cubic only when both ends DR-capable; `brg === 0` hold; matched `t_ntp` unchanged; alpha lerp not stacked
- `done/DSP-OUT-20260828-01` — WebGL2 PBO + fence; 1-tick latency; fail closed to sync; 2D left sync `getImageData`
- `done/DSP-OUT-20260828-02` — AR/3D/2D **30**, 2D default **on**, async claims share a tick; `STUDIO_TICK_FPS` stays **30**

**Human smoke (not a code gate):** Electron Output rail Send **~30 / ~30 / ~30** with hitch/s still ~0 and sidebar usable. If hitch explodes, report numbers — do not silent-drop 3D to 10. Watch for `NDI_SYNC_READBACK_NOTE` (PBO missed). 2D sync `getImageData` @ 30 is the likeliest hitch leftover.

Handoffs: `HO-BW-OUT-20260828-02`, `HO-BW-TEL-20260828-01`, `HO-BW-PRF-20260828-05`, `HO-BW-PRF-20260828-06`.

## Studio 30 lock 2026-08-28 (60 cancelled)

Operator: **all three** NDI (AR, 2D, 3D) send **30 fps all the time**, keep all three on. Preview may be **>30**, must not be **&lt;30**. Forget 60. Exclusive-single-NDI refused. Pose: ~10 Hz **is** the DJI WebSocket.

## Studio 60 ACCEPTED then CANCELLED 2026-08-28 (HO-PRF-BW-20260828-03)

Same-day lock change: operator dropped 60. Wave 0 PBO remains; 60 clock / 60 Send are **void**. Do not issue `STUDIO_TICK_FPS = 60`.

## Phase 17.4 ACCEPTED 2026-08-27 — matched hold + Flow panel

BW re-ran merged tree: `npm test` **856 + 23**. `matchedPipeline.test.ts` (17) green — SCN-10’s three failures were mid-merge, not a leftover bug.

- `done/DSP-TEL-20260826-10` — hold until video NTP; LUT alias; GPS-optional drones; `flowTap`
- `done/DSP-SCN-20260826-10` — Flow JSON windows (operator smoked in studio)

**Human smoke (not a code gate):** AR bg=video, Live JSON on. Confirm (1) overlay lags with the picture, not the stick, (2) Flow shows `stream_anchor` and drone `ts` even if lat/lon is 0. If no anchors, pose **holds** — that is the producer, not a free-run bug.

Soft leftover: boat packets with `t_sync === false` still dropped (TEL). PRF-01 still open.

## Phase 17.4 ISSUED 2026-08-26 evening — matched hold + flow panel

SRT picture works; NTP match does **not** (overlay tracks the pilot, not the delayed video). Cause: TEL-08 free-run when LUT/PTS missing + history drops no-GPS drones.

- P0 `active/DSP-TEL-20260826-10-matched-hold.md` — new **TEL worker** chat
- P1 `active/DSP-SCN-20260826-10-telem-srt-flow-panel.md` — new **SCN worker** chat after (or parallel with) tap API
- `handoffs/HO-TEL-SCN-20260826-01.md`

Missing lat/lon is **not** an excuse to ignore `ts` / anchors. No src/ in BW chat.

## PRF created 2026-08-26 evening

**PRF — Performance Orchestrator.** Budgets + measurement (preview ~60 rAF, NDI AR ~30, NDI 3D ~10, never `STUDIO_TICK_FPS = 60`). Look stays SCN; egress stays OUT. Bootstrap: `docs/agentic/dispatches/BOOTSTRAP_PRF.md`. Locks: `docs/architecture/performance-budgets.md`. Idle until an operator names a slow path. SRT colour bars remain **SRT**.

## SRT created 2026-08-26 evening

**SRT — SRT Ingest Orchestrator.** Caller, catalog 1–27, ffmpeg TS, demux/decode, HEVC fallback, Race ops SRT HUD. New workers `DSP-SRT-*`. Historical SRT shipped as OUT-03…09. Bootstrap: `docs/agentic/dispatches/BOOTSTRAP_SRT.md`. Picture is up; NTP match stays TEL-10. OUT keeps chroma/NDI/plate mode.

## Phase 17 follow-up ACCEPTED 2026-08-26 pm — SRT id catalog

**HEVC colour bars 2026-08-26 evening:** operator/device not at fault; OBS uses ffmpeg, Electron WebCodecs often does not. Store HEVC pack is **not** required. `live kbps` + `decoded=0` + no error = app stall (probe said supported, decoder emitted 0 frames, HUD hid `decodeError`). Fix: Race ops shows `codec`/`demux`/`decoded`; ffmpeg HEVC→H.264 after `HEVC not supported` **or** ~2.5 s live stall. Full Electron quit/restart after pull.

**L9 smoke 2026-08-26 pm:** dummy Fleet template `srt://host:…` was skipping the catalog (hostname `host`). BW treated that as empty → catalog. Colour bars = compositor placeholder until a decoded frame. SRT situation now lives on Race ops.

**L9 amended 2026-08-26 pm (BW, no dispatch):** catalog `streamid` is `read:camN:pubN:<token>` (was `publish:`). Same host `49.13.20.49:9000`, same tokens. Id 1 → `read:cam1:pub1:k3q9x7`. Id 18 → `read:cam18:pub18:***`.

`done/DSP-OUT-20260826-09` — BW verified `npm test` **818 + 23**. Empty template looks up cams 1–27; host `49.13.20.49`. No `91.98.150.21` in `src/`. Soft leftover: Electron connecting logs may still include raw `streamid` (main-process redact is passphrase-only).

## Phase 17 follow-up ISSUED 2026-08-26 pm — SRT id catalog

User: each camera has its own SRT URL/token, not one template. UI unchanged (SRT id field). Runtime lookup cams **1–27**. Host lock **`49.13.20.49`** (rewrite `91.98.150.21`). Open caller `streamid=publish:camN:pubN:token` (path form in the paste is not what ffmpeg sends). Tokens may live in this private repo (BW override); never log. No cam 30 in the list.

`active/DSP-OUT-20260826-09-srt-id-catalog`

## Phase 17 COMPLETE 2026-08-26 (engineering)

TEL-08 accepted. BW verified `npm test` **808 + 23**, `npm run build` green. Matched sampling is additive (`video` + healthy LUT); alpha isolation covered by `matchedPipeline.test.ts` + existing `pose.test.ts`. Worker queue **clear**.

**Human smoke (not a code gate):** live SRT token in Fleet template, Vid on, AR bg = video, hard yaw; trim `syncTrimMs` on a clapper and **report the number**; switch POVs; flip back to alpha; watch for FOV swim (DJI 84° vs CAL 66.8832). Mock anchors still keyed by `povIds[0]`, not SRT id — use live DJI.

## Phase 17 Wave 2 ACCEPTED 2026-08-26

BW re-ran merged tree: `npm test` **795 + 23**, `npm run build` green. OUT-07's mid-wave `tsc` on OUT-06 is gone. Archived 06/07. TEL-08 unblocked.

Live SRT picture **not a code gate** — no session token in the worker. HEVC `isConfigSupported` true on RX 6750 XT in Chromium; re-check inside Electron 37.

## Phase 17 Wave 1 ACCEPTED 2026-08-26

BW re-ran the **merged** tree: `npm test` **741 + 23**, `npm run build` green. Early parallel-red reports (OUT-04 wrap restore, TEL-02 unused locals) are gone in HEAD. Archived 01–05 to `done/`.

Shipped: `PtsNtpMap` (30 s OLS, live extra ≤2 s, wrap = mod `2^33`) · `telemetryHistory` (`brg===0` hold) · ffmpeg `-c copy` SRT caller (native addon rejected) · in-WebGL bg + `arBackground` · `syncTrimMs` stored, not applied.

**Doc amendment:** `ntp-matching.md` §4.a wrap helper was 32-bit `&` in JS — replaced with mod `2^33`; live mapper is the fit, not pairwise reject-after-last.

**Held Wave 2** until the user answers: (1) real `srt://` URLs or a `.ts`+anchor capture, (2) H.264 vs HEVC on the DJI wire, (3) whether `arBackground: video` must force ocean/sky/terrain **off** (today `preview`+`video` still mounts realistic env and hides the underlay), (4) SRT passphrase / `streamid` query, (5) confirm ffmpeg+libsrt on every studio PC (this machine has gyan full_build on PATH).

## Phase 17 ISSUED 2026-08-26 — 8 dispatches, 3 waves

User answered all seven questions. **Locks:** alpha plate survives as a **mode**
(`arBackground: 'alpha'|'video'`, alpha stays default + fallback; **dual-send declined**, so the
crash fallback is "flip the mode back") · **DJI only, no GoPro** (C4 closed as N/A) · SRT **caller** ·
**adaptive** latency clamped **100–400 ms** · **4** warm POVs · **H.264 + HEVC** · DJI
`sendPerAuFrameAnchors` **unknown** → the ~1 Hz periodic fit is the *primary* path, per-AU anchors
are validation only.

HEVC became a live risk once the user picked both codecs (C9 upgraded): Chromium HEVC is
platform/hardware dependent, so OUT-06 must probe `isConfigSupported` and emit an actionable ops
error. Software HEVC ×4 at 1080p30 is not a fallback — the answer is to reconfigure the airframe
for H.264. Confirm on the studio PC early.

Issued into `active/`:

| Wave | DSP | Owner |
| --- | --- | --- |
| 1 | `DSP-TEL-20260826-01-pts-ntp-map` | TEL |
| 1 | `DSP-TEL-20260826-02-telemetry-history` | TEL |
| 1 | `DSP-OUT-20260826-03-srt-transport` | OUT (+PLT dep) |
| 1 | `DSP-OUT-20260826-04-video-background` | OUT |
| 1 | `DSP-CAL-20260826-05-sync-trim` | CAL |
| 2 | `DSP-OUT-20260826-06-ts-demux-decode` | OUT (after 03+04) |
| 2 | `DSP-OUT-20260826-07-srt-config-sync-hud` | OUT (after 01) |
| 3 | `DSP-TEL-20260826-08-matched-pose-cutover` | TEL+SCN |

Wave 1 is fully parallel with disjoint file ownership (01 `ptsNtpMap.*` · 02 `telemetryHistory.*` ·
03 `desktop/*`+`srtBridge.*` · 04 `videoBackground.*`+`output/types.ts`+`main.ts` wiring ·
05 `calibration/*`). Only shared touch is append-only exports in `src/telemetry/index.ts` /
`README.md` between 01 and 02 — flagged in both. **Integration risk deliberately confined to wave 3.**

Two seams found during dispatch writing and written into the briefs:
- **Render-wrap ordering.** `visualTimecodeOverlay.ts` L177–193 wraps `renderer.render` as a
  post-pass; the video background must wrap as a **pre-pass** and be installed **before** it, with
  NDI pumps binding last (`ndiFramePump.ts` L128–129 already relies on this ordering for timecode).
  Also `autoClear` must be false around the scene call or you get black / no background.
- **`boatRawPose` ignores `spd`.** Harmless under the push model, but it would swallow TEL-02's dead
  reckoning under matched sampling. Assigned to TEL-08.

**Acceptance rule recorded for wave 3:** `arBackground: 'alpha'` must be byte-identical to today.
Regressing the shipped air path to ship a new feature is the one unacceptable outcome.

BW **override recorded** (RULES §10 / `ndi-alpha-electron.md` §2): AR now has **two** contracts,
alpha and video. Alpha remains the default and the documented fallback.

Roadmap Phase 17 added; output priority ladder updated (composited-over-SRT inserted at 2; WHEP
explicitly marked as *not* a Phase 17 path because it cannot carry PTS). Dispatch README updated.

## Phase 17 design 2026-08-26 — AR video underlay + NTP match

User supplied `docs/architecture/ntp-matching.md` (producer-side wire contracts + consumer math,
written by the telemetry/producer side) and asked to rebuild AR around it: **drone SRT video as
the AR background instead of the alpha plate**, video source switching with POV switching, and
**pose/GPS matched to the video frame's NTP time** via `stream_anchor` PTS→NTP.

Design written: `docs/architecture/ar-video-underlay-ntp-sync.md`. **This chat did not implement
`src/`.** Dispatches deliberately withheld pending user answers to Q1–Q7 (§9 of that doc).

**Core finding — the render model must invert.** `pose/pipeline.ts` is a *push* smoother
(`MidpointLerp` + `performance.now()`); `TelemetryData.ts` is stored on `PoseEvent` and never read
for timing. Matching needs a *pull* model: time-indexed history + `sampleAt(ntpMs)` driven by the
presented frame's NTP. Everything else in the design is plumbing around that inversion.

**Blocking conflicts found (full table §7 of the design):**
- **C1** SRT→MediaMTX→**WHEP kills the feature** — WebRTC re-stamps with RTP clocks and discards
  MPEG-TS PTS, so `stream_anchor` becomes unusable. Path must be raw TS → **WebCodecs**
  (`chunk.timestamp`/`VideoFrame.timestamp` round-trip PTS exactly; Electron ^37.2.6 has it).
  MSE also rejected (no per-frame PTS). Existing `whepUrl` underlay is unrelated and stays.
- **C2** Breaks the **locked alpha-NDI contract** (`ndi-alpha-electron.md` §2, RULES §10) and moves
  the show's single point of failure into our app — today a graphics crash leaves vMix a clean
  camera, after this it leaves black. Recommend `arBackground: 'alpha'|'video'` as a *mode*, not a
  replacement; optional dual-send of the alpha plate as a vMix fallback layer (second 1080p
  readback — measure first). **Needs an explicit BW override once the user answers Q1.**
- **C3** `ntp-matching.md` §4.a **cannot present live frames** — "reject after last anchor" is right
  for VOD, wrong for live (the newest frame is always past the last periodic anchor; GoPro is
  periodic-only ~1 Hz, so it could never present). Proposed replacement: sliding-window **robust
  linear fit** over the pacing series with bounded (~2 s) forward extrapolation; `kind:frame` kept
  out of the fit and used as a truth series. Source doc should be amended.
- **C4** GoPro anchors probably never arrive at all — its publisher uses query `type=anchor`, which
  the live router rejects (close 1008). Producer-side fix; not solvable from this repo.
- **C5** `anchorPreCallbackOffsetMs` and `anchorFfmpegBiasMs` both ship **0**, so a flawless
  implementation still lands with an unknown constant per-camera offset. Answer: **`syncTrimMs` per
  POV in `CalibrationOffsets`** — same character as `yawDeg`/`fovHDeg`, and it rides existing
  `calibration.byPovId` pack persistence for free.
- **C6** Timing is necessary but **not sufficient**: DJI reports `cam.fov = 84`, our calib default is
  `66.8832`, plus uncorrected lens distortion. Real video behind the render is also this project's
  first true ground truth — expect it to expose residual frame/yaw errors (`enu-frame-handedness.md`,
  open CAL yaw re-derivation) that have been invisible until now.

**Other locks recorded in the design:** compositing must be **in-WebGL** (fullscreen bg quad) because
the NDI pump reads an FBO and cannot see DOM `<video>` — this is exactly why WHEP is preview-only ·
Electron main is a **dumb byte pipe**, all demux/decode in the renderer (testable under vitest-node,
~1 MB/s IPC per stream) · **keep all enabled POVs warm** and swap `{texture, LUT}` on switch, since
reconnect-per-switch costs 0.5–2 s of black · adaptive presentation latency (present newest frame
whose `t_ntp` is covered by received pose, clamped) · **no NTP client needed in the app** — we
correlate two producer timelines, the studio clock is irrelevant · drone pose waits to bracket
(10 Hz, same device, cheap), boat GPS never waits (DR per §4.c; 0.55 m median step vs 5.1 m GNSS
noise) · no change to `previewFrameClock` / `STUDIO_TICK_FPS`.

**Cheap fallback worth knowing:** `ndiDelayBuffer` already does per-channel 0–30 s delay. If the only
error were a constant offset, an operator could dial it today. It is not a solution (SRT latency
varies; a uniform shift cannot resample a 500 ms-old GPS fix onto the video timeline) but it is the
right first thing to try on site if the full path misbehaves.

Indicative breakdown (§8): wave 1 = five **fully parallel** pure modules (PtsNtpMap · time-indexed
telemetry · SRT transport · bg quad · `syncTrimMs`), wave 2 = demux+decode + ops/sync HUD, wave 3 =
pose pipeline cutover. Integration risk deliberately confined to wave 3.

Also needed before wave 2: a real SRT endpoint **or** a recorded `.ts` capture with matching
`stream_anchor` JSON. `egress-webrtc-srt-evaluation.md` **E0 does not block this** — that was egress
(out), this is ingest (in); amend the wording so nobody cites it.

## Phase 16 COMPLETE 2026-08-18 pm (wave 2 accepted)

`DSP-SCN-20260818-09-ops-layout` accepted — BW verified `npm test` **654 + 23**, `npm run build` green, rail grouping matches the locked table, water-threshold row reaches `setTerrainWaterDiscardYM`. Two overlay rails (left = race setup, right = broadcast); `data-ops-section` ids unchanged (`ndi` = Output); widths/collapse/accordion persist in sessionStorage; canvas lock untouched (overlay, no reflow).

Approved deviations: `library` (PLT) and leftover `ops` (telemetry / POV / view / countdown / stream-map / preview fps / boot status) stay on the left — neither was in the BW table; backtick collapses **both** rails. Preview fps did not move to the top strip (strip host not rewritten) — acceptable, revisit only if the operator complains.

**Phase 16 engineering is done. No active workers.** Remaining: human look-dev (orbit boil, wide-orbit water removal, sail camber, tag height, rail ergonomics), optional glTF sailboat (needs a model with `sail`/`mastTop`; re-export via `scripts/export-boat-glb.mjs`), sponsor `panelColor`/`frameColor` inspector pickers. Human **10.1** Unity cutover still the open product gate.

## Phase 16 wave 1 accepted 2026-08-18 pm

SCN-04/05/06/07/08 all accepted. BW verified the **merged** tree: `npm test` **640 + 23**, `npm run build` green. The cross-worker failures each report cited (boat `uAxis`, tag-leader colour `f3827e` vs `e53935`, terrain `Type 'number' is not assignable to type '0.5'`) are all resolved in HEAD — no fix dispatch needed.

Shipped: mip-noise + `fwidth` + distance fade AA (`liftY` down to 0.08 m); Cesium **watermask discard** (height fallback +0.5 m) so terrain draws land only while the realistic ocean is mounted; 180-ribbon wind strings (~0.075 ms/tick, AR-safe); procedural sailboat + 10-swatch palette + `fleet.boats[].color` + mast-top tag leader; SailGP-style sponsor boards + additive `panelColor`/`frameColor`; rounding **omit = CW** with ~8–9 m white/red rings.

Deferred into **SCN-09** (approved, §8 of that dispatch): one Environment row for `setTerrainWaterDiscardYM` (default 0.5). Still open follow-ups: glTF sailboat re-export (`scripts/export-boat-glb.mjs`) if the user supplies a model; sponsor colour pickers in the inspector; human look-dev on orbit boil, sail camber, tag height, wide-orbit water removal.

Wave 2 = `DSP-SCN-20260818-09-ops-layout` (released 2026-08-18 pm).

## Phase 16 issued 2026-08-18 pm (visual upgrade & ops QoL)

User smoke of Phase 15 surfaced: sea sparkle **boils under camera motion** (procedural noise aliasing, no mips); wind still unreadable → wants **moving string VFX**; Cesium baked sea pokes through (lift-Y covering was user's call, now retracted — terrain must render **land only**, prefer quantized-mesh **water mask**, fallback height discard ~+0.5 m AMSL); buoy arrows invisible in user packs because 15.3 was opt-in → **universal default CW**, Details sets CCW/Off; billboards need SailGP **board/frame** (textured logos currently float bare); **procedural sailboat** (hull/mast/boom/main+jib, tintable sail; glTF later); **category color palette** (~10 presets, additive `color` on `fleet.boats[]`); nametag **leader line to mast top**; ops sidebar → **two rails** (setup left / broadcast right — BW-locked grouping).

**User Q&A locks:** wind strings **ops + 3D only, never AR** (inherits realistic-env gate) · boat = procedural · rounding universal · layout = BW call.

Design: `docs/architecture/phase16-visual-upgrade.md`. Issued (active/): `DSP-SCN-20260818-04` (shimmer + terrain water, P0), `-05` (wind strings, P1), `-06` (sailboat + palette + tag leader, P0), `-07` (billboard frames, P1), `-08` (rounding universal, P0 small), `-09` (ops two-rail layout, P1 **wave 2 after -06**). File ownership split per DSP; 04 owns gerstnerOcean/terrain, 05 owns realisticEnvironment + new module.

This chat did **not** implement `src/`.

## Phase 15 accepted 2026-08-18

All four workers accepted. BW re-ran `npm test` (**600 + 23**) and `npm run build` (green). Parallel-merge blockers in the reports (duplicate `SeaQuality`, `staticFleetHulls` `-0`) are gone in HEAD.

| DSP | Accept |
| --- | --- |
| OUT-01 | Dual clock: rAF preview when visible; NDI on `studio:tick` 30. AR capture no longer patches `renderer.render`. Caps unchanged. |
| SCN-01 | Clipmap overlap; glitter 0.16/78; inner 32 / 7 rings; sea high/low; vane + stronger streaks. |
| SCN-02 | `rounding` on marks/buoys/gates; spinning two-arrow ring; Istanbul corners CW. |
| SCN-03 | `fleet.boats[]`; static hulls; Load from pack rows not names catalogue. |

**Human smoke (not a code gate):** Electron HUD **preview** near 60 when visible; vMix AR ~30 / 3D ~10; park still sends NDI; no white sea hairlines; glitter not bleaching; wind vane readable; rounding rings spin; add boat without telem → hull; Save/Load keeps custom fleet.

**Not issued:** 60 fps NDI 3D; every-other-frame `terrain.tick` skip (only if preview stays <50); 3D boat gizmo; boatIds band 21–52 still filters out-of-band ids (pre-existing). If FPS still poor with realistic+terrain, default `seaQuality` to `low`.

## Phase 15 issued 2026-08-18 (design + worker dispatches)

User screenshot of realistic sea: looks OK, **low FPS** (goal 60), **white clipmap seams**, blown specular, **no visible wind**, buoys need Unity CW/RCW dual-arrow rings that spin and are settable, fleet hulls missing without telem even when **solid**, Save/Load restores demo Bora Aksu 21–24.

**Locks:** 60 fps = **ops preview only**. Dual rAF + 30 Hz NDI tick — do **not** set `STUDIO_TICK_FPS = 60` and do **not** raise NDI 3D to 60. Glitter cut. Wind = stronger streaks + cheap 3D vane (14.3f lite). Rounding `cw|ccw|none` per mark/buoy. Embed `fleet.boats[]`; hulls without poseBus.

## Phase 14 — planned 2026-08-17 (design only, no dispatches)

User asked to improve the 3D environment: Cesium (as in the Unity project, but no longer static),
waves, wind with a direction input, and a better sea model — reference image supplied with the
brief "this is our bare minimum goal, we need something even better." Four questions were asked
directly: Cesium with Three.js, Cesium 3D, wind from an API with VFX, and whether an LLM can
generate a sea model.

**Answers researched, not assumed:** CesiumJS the *engine* is rejected (own renderer/camera, would
need a second WebGL context — fatal for the NDI readback path); 3D Tiles the *format* is accepted
via `3d-tiles-renderer` (NASA-AMMOS, Apache-2.0, `three >= 0.167`, we are on 0.178). Wind: Open-Meteo
forecast + marine, free/no-key but **non-commercial** — needs a paid key for air. LLM-generated sea
model: **no** — an ocean is a simulation plus a shader, not a mesh; generative 3D gives a static
mesh that cannot animate, tile, LOD or follow the wind. AI helps by writing the GLSL.

**User locks:** Cesium **ion** (World Terrain + aerial, not Google Photorealistic — attribution
burn-in) · **WebGL2**, no WebGPU migration · venue **online** · wave **direction follows wind =
P0**, height/period P1 and droppable if expensive · wind source undecided, **build all three and
test on site** · attribution acceptability **unconfirmed** — flagged as a pre-air decision.

**P0 finding — the scene frame is a mirror of the real world.** While mapping the geodesy for
terrain alignment, found that `geoUtils.ts` packs the right-handed (east, north, up) triple into
Three as `(east, up, north)`, so `East × North = −Up` in scene space — a reflection, not a
rotation, and no camera quaternion can undo it. It is a literal port of Unity's left-handed
convention into right-handed Three.js. Cross-checked against `map2d.ts`'s `enuToMapPx`, which
projects the *same* ENU numbers conventionally (North up, East right) — so the 2D authoring map and
a north-up 3D view are currently mirror images of each other. Invisible today because every object
goes through the same transform and there is no photographic ground truth on screen; it becomes
visibly wrong the moment real Istanbul terrain lands. Written up as
`docs/architecture/enu-frame-handedness.md` with a **cheap empirical check to run before any
dispatch** — BW is not accepting the math as sufficient evidence. Risk flagged to CAL: saved
per-POV yaw offsets may need re-derivation.

Four design docs written, cross-referenced, each with an open-questions table:
`enu-frame-handedness.md` (GEO+SCN, prerequisite) · `geospatial-terrain-cesium.md` (SCN+GEO+PLT) ·
`ocean-waves-and-sea-state.md` (SCN) · `wind-data-and-vfx.md` (TEL+SCN+PLT).
`realistic-3d-environment.md` marked superseded-but-reused (Sky, the `opaqueClearSafe` gate and the
`simple|realistic` mode shape all survive). Roadmap: new **Phase 14** (14.0–14.3f).

**14.0 CONFIRMED same day.** BW ran a throwaway probe against the live `geoOrigin`/`gpsToEnu` code
(Bosphorus origin, points 500 m due east and due north): `East × North → (0, −1, 0)`. Real ENU
requires `+Up`; the scene gives `−Up`. Also grepped all of `src/` for a compensating negative scale
on any scene root — no matches, so nothing un-mirrors it downstream. Probe deleted after reading;
its assertions become permanent tests in the 14.0 dispatch. Doc status flipped to CONFIRMED.

**User decisions 2026-08-17 (round 2):** attribution → **3D channel + ops preview only, never the
AR plate**, broadcaster sign-off deferred to pre-air · ion token **reused from Unity**, asset IDs
to follow · terrain and ocean **in parallel** · our ocean sits **on top of Cesium's baked water
level** so the tileset's flat sea stays hidden behind it — which is what `geospatial-terrain-cesium.md`
§4 already specifies, so no design change.

**14.3e accepted 2026-08-17.** Gust streaks are a Gerstner fragment mask (from-000° +Z, fade
at 0 m/s). **Phase 14 engineering is complete.** No active workers. Not issued: 14.3c
anemometer, 14.2d/e FFT/wakes, 14.3f ribbons/flags/spray.

**CAL risk:** saved per-POV yaw offsets in `calibration.byPovId` may need re-derivation once the
mirror is removed. Handoff written (`HO-BW-CAL-20260817-01`).

## Strategy (v1)
Local studio first; Hetzner = Phase 12 deferred.

## Milestones
| Gate | Status |
| --- | --- |
| **V1-A** Phase 8 | **Met** |
| **V1-B** Phase 9 | **Met** |
| **V1-C** Phase 10 | **Partial** — 10.3 Pass; 10.2 SPA done / console ack pending; **10.1 open (human)** |
| **V1-D** Phase 11 | **Met** — core 11.1–11.7 + follow-up authoring/chrome + follow-up #2 (authoring fixes/two maps) + follow-up #3 (P0 `window.prompt()` Electron fix) all accepted |

## Phase 10 tracking
| # | Status |
| --- | --- |
| 10.3 NDI smoke | **Accepted Pass** |
| 10.2 Console deeplink | SPA pack done; formal ack → console team |
| 10.1 Unity parallel | **Open** — only remaining product cutover gate |

## Phase 11 + follow-up closed 2026-08-11
Core V1-D + chrome/authoring fix:
- SCN-04 World Authoring workspace (discoverable tools)
- OUT-02 output → Ops sidebar
- CAL-01 calib → Calib sidebar

Design: `unified-ops-sidebar.md`, `world-authoring-workspace.md`.

Optional later: library catalogue content; Save→Load smoke; multi-sender NDI; 11.8/11.9.

## Phase 11 follow-up #2 — accepted 2026-08-11 (SCN)
User tested the workspace and found real breakage; BW reproduced live via `npm run dev` before
writing dispatches, then **independently re-verified both worker reports** before accepting
(did not just trust the reports):
- **Close button doesn't hide the panel** — `.world-authoring` CSS `display: flex` beats
  `[hidden]`; status text flips but the ~960px window stays on screen. Root cause confirmed by
  BW pre-dispatch; fix confirmed post-dispatch via CDP (`display:none`, zero-size rect on close,
  restored on reopen — screenshots were unreliable/stale on this canvas-heavy page in-session, so
  CDP `getComputedStyle`/`getBoundingClientRect` + a synthetic `PointerEvent` drag were used as
  ground truth instead of trusting pixels).
- Resizable authoring map + sidebar rail — confirmed drag handles exist; simulated sidebar drag
  moved width 340px → 460px.
- Enter/Delete/drag point editing — accepted on code review (`onEditorKeyDown`, `hitTestVertex`
  wiring present and matches spec) + test suite coverage.
- Viewer-facing "stream" map now has its own bigger (520px), framed, compass+branding look;
  ops/authoring map metrics pinned unchanged (regression-tested).
- `npm test` — 388 client + 23 server green. `npm run build` — green.

Both dispatches accepted → `docs/agentic/dispatches/done/DSP-SCN-20260811-05…` and `-06…`. SCN
memo has full bullets + BW acceptance notes are in each dispatch file.

## Phase 11 follow-up #3 — issued 2026-08-11 (P0, active — root-caused, not yet worker-fixed)
User: billboard chain still won't finish (button or Enter) even after `-05` shipped. **Root cause
found, not just reported**: Electron's own renderer setup unconditionally overrides
`window.prompt()` to throw (`window-setup.ts`; Electron team closed this "won't fix" years ago).
`window.alert`/`window.confirm` are unaffected. This is exactly why BW's own acceptance testing of
`-05` (done via a plain Chromium browser tab, not Electron) missed it — `window.prompt` works fine
in a normal browser tab.

Grepped **every** `window.prompt(` call site in the repo — 7 across 5 files, all silently broken
in the real Electron app: billboard-chain texture + spacing (`editorPanel.ts`,
`stubTexturePicker.ts`), boat/drone/buoy id placement (`editorPanel.ts`), texture-picker free-text
(`texturePicker.ts`), **Save as** (`main.ts`), **Rename**/**Duplicate** (`projectManagerPanel.ts`).
Split into two dispatches by file ownership (protocol requires this), same root cause, each
references the other:
- `active/DSP-SCN-20260811-07-electron-prompt-modal` (SCN, P0) — builds a shared promise-based
  `promptModal()` DOM utility (`src/ui/`), fixes its own 5 call sites (incl. the reported bug).
- `active/DSP-PLT-20260811-03-electron-prompt-fixes` (PLT, P0) — reuses that utility for its 2 call
  sites (Save as / Rename / Duplicate). Should start after or coordinate with SCN's utility.

**Process lesson for BW:** going forward, any dispatch touching `window.prompt`/`alert`/`confirm`
or other browser-native dialogs needs acceptance testing in the **actual Electron app**, not just
a browser tab pointed at the Vite dev server — logged in both memos so future acceptance checks
catch this class of bug.

## Phase 11 follow-up #3 — accepted 2026-08-12 (SCN + PLT)
Both workers reported done but neither had a way to click through the real Electron GUI in their
own sessions (no automated Electron UI driver available to them). BW did not just trust the
reports — launched the real `desktop/node_modules/electron/dist/electron.exe` directly (against
the already-running Vite dev server, **not** a browser tab) and drove the live renderer via
`webContents.executeJavaScript` from a throwaway Node/Electron script (no repo files touched,
temp script deleted after):
- Confirmed `window.prompt()` genuinely throws (`"prompt() is not supported."`) in that exact
  renderer — the root cause is real, not theoretical.
- **Billboard chain (the original user-reported bug):** selected the `billboardChain` tool,
  dispatched two synthetic `click`s on the map canvas, dispatched a window `keydown Enter` →
  texture `promptModal` appeared (default `"1"`) → submitted → spacing `promptModal` appeared
  (default `"12"`) → submitted → no modal left open → feature count went 13 → 14 and a new
  `Chain 3 · billboardChain` row appeared in the Assets sidebar list. This is the exact flow the
  user reported broken; now proven fixed end-to-end, not just code-reviewed.
- **Save as:** clicked the button → id `promptModal` (`"Save as — project id"`) → **Cancel** →
  clean abort, no leftover modal. Re-ran: submitted the id modal → name `promptModal`
  (`"Save as — display name"`) → **Escape** → clean abort, no crash either time.
- Rename/Duplicate share the identical `promptIdName` → `promptModal` primitive already proven
  above; not separately re-driven live (would need a configured `projectsApiBase` + local server)
  — accepted on code review + green suite instead, given the shared-primitive risk was retired.
- `npm test` (394 client + 23 server) and `npm run build` green at HEAD.

Both dispatches moved to `done/`; full write-up in
`docs/architecture/world-authoring-workspace.md` § "Follow-up #3".

## Phase 13 follow-ups accepted 2026-08-12
- `done/DSP-OUT-20260812-06` — NDI capture perf (AR30 / 3D10 / 2D off; stagger)
- `done/DSP-SCN-20260812-03` — fleet map pose sync (delete/place)
- `done/DSP-PLT-20260812-02` — Electron Project Save→folder + Load dropdown
Suite **476 + 23**. Soft: default 3D NDI off if UI still janks.

## Phase 13 — complete 2026-08-12
All **13.1–13.8** accepted (waves 1–3). Optional non-blocking polish noted above.

## Phase 13 — wave 2 accepted 2026-08-12
**Accepted** (`npm test` 439+23 green):
- `done/DSP-OUT-20260812-02` — 3D NDI pump (`broadcast-web-3d`)
- `done/DSP-OUT-20260812-03` — 2D map NDI (`broadcast-web-2d`, 1920×1080 letterbox)
- `done/DSP-SCN-20260812-02` — AR calib coordinate overlay

## Phase 13 — wave 1 accepted 2026-08-12; wave 2 issued — wave 2 done; see above
**Accepted** (`npm test` 418+23 green at the time):
- `done/DSP-OUT-20260812-01` — multi-sender bridge; AR name `broadcast-web`
- `done/DSP-SCN-20260812-01` — sea/sky + `setEnvironmentOpaqueClearSafe`
- `done/DSP-PLT-20260812-01` — `races:*` local save

## Phase 13 — planned 2026-08-12 (design only, no dispatches) — historical
User asked for: three simultaneous NDI outputs (**2D** map / **3D** virtual environment / **AR** —
the existing transparent alpha plate, formalized as one of three channels), a realistic
sea+sky environment for the new 3D channel (reference image provided — shaded waved ocean, not
photoreal), a bigger local 2D/3D/AR switcher (screen focus only, never gates NDI), an adjustable
per-output NDI delay (RAM buffer, ms, max **30000**), and an AR-calibration coordinate overlay to
visually compare synthetic marks against a real camera feed. Explicit instruction: **"add these to
roadmap and design docs. later i will ask for dispatches"** — no worker dispatches written.

**Follow-up (same day):** user clarified the "3D channel" is **not** meant as different rendering
logic — "just adding sea model to 3d environment basically." Docs updated to say plainly: 3D reuses
the AR render path verbatim (same scene, same active-POV camera), just opaque clear + a sea/sky
model, not a second content pipeline. Also requested: a "project saves" folder (override on same
name, new file on new name) + a dropdown of what's in it. **That folder already exists** —
`public/races/` — and the dropdown already exists (`listLocalRaceIds`); the only gap is that
nothing today writes back into it (Save only downloads). Added
`docs/architecture/project-api-and-database.md` §10: a new `races:*` Electron IPC (same pattern as
`ndi:*`) so Save/Save as write directly into `public/races/` in addition to the download, reusing
the existing overwrite-current-id / new-id-via-`promptModal` semantics as-is.

Four design docs now exist (cross-referenced, each with its own open-questions table):
- `docs/architecture/multi-output-streaming.md` (OUT) — channel model, multi-sender NDI bridge
  requirement (today is a single `grandi` sender), memory-cost math for the delay buffer
  (~7.5 GB/channel for a full 30 s buffer at 1080p — flagged as a decision, not silently shipped),
  and the resolution ask (`1080×1920` as literally requested — **portrait**, opposite of today's
  `1920×1080` landscape lock — flagged for confirmation, not silently changed).
- `docs/architecture/realistic-3d-environment.md` (SCN) — there is **no** ocean/sky render today
  (`waterCue.ts` is a flat tinted plane; sky is just the clear color); proposed `three/examples/jsm`
  `Water` + `Sky`, hard-constrained to the opaque 3D channel only (must never leak into AR's
  transparent clear). Explicitly scoped as additive, not a rewrite.
- `docs/architecture/ar-calibration-map-overlay.md` (CAL + SCN) — manual, read-only precursor to
  the existing `docs/research/cv-calibration-spike.md` automated CV plan; renders a dense
  ENU-grid/marks overlay through the calibrated camera for a human to eyeball against the WHEP
  underlay real-camera feed.
- `docs/architecture/project-api-and-database.md` §10 (PLT) — Electron-side direct write to
  `public/races/`, additive to the existing download + HTTP/SQLite API paths.

Roadmap: new **Phase 13** (13.1–13.8) added, explicitly marked "not scheduled for workers."

## Ion token git-share (2026-08-17 follow-up)

User asked that the Unity ion token **transfer with git** and be enterable in the
studio app. BW override of RULES §11: `public/config.json` `cesiumIonToken` **may**
be committed on this private repo. Ops **ion token + Apply** writes that file in
`desktop:dev`. Chrome stays session-only until the same field is pasted/committed.
Do not deploy a filled token to a public Hetzner SPA.

## Next (human)
1. Smoke: environment **realistic**, terrain **on** (paste ion token in Ops → Apply →
   commit `public/config.json`), Ops from-deg rotates swell + streaks, map wind pill,
   shore foam along the coast (if foam covers the whole sea, tweak **nudge m**).
2. **10.1** Unity cutover. CAL yaw eyeball after the ENU mirror fix (`HO-BW-CAL-20260817-01`).
3. Open-Meteo commercial `customer-` key before air.

## Idle
Worker queue **clear**. Open human: **10.1**, commit ion token, CAL yaw, Open-Meteo licence.

## Compaction recovery
`BOOTSTRAP_BW.md` → this memo → roadmap Phase 14 engineering done; 10.1 human

## Idle
Worker queue: **14.0 GEO only**. Parallel 14.1–14.3a written but blocked. Open human: **10.1**.

## Compaction recovery
`BOOTSTRAP_BW.md` → this memo → roadmap Phase 14 (14.0 dispatched; 14.1–14.3a blocked; 10.1 human)
