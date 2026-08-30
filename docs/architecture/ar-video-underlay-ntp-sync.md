# AR video underlay + NTP-matched render

**Status:** **Shipped 2026-08-26** (TEL-08 matched-pose cutover). Phase 17.
**Owner:** BW (routing) · **SRT** (caller, catalog, demux/decode) · OUT (plate mode, compositing, NDI) · TEL (PTS→NTP, time-indexed telemetry) · CAL (residual bias, FOV) · PLT (native dep, packaging)
**Prerequisite reading:** [`ntp-matching.md`](./ntp-matching.md) — wire contracts and producer guarantees. This doc does **not** restate them.
**Supersedes in part:** [`ndi-alpha-electron.md`](./ndi-alpha-electron.md) §2 (AR clear contract) — see §7 C2.

## User locks (2026-08-26)

| # | Lock |
| --- | --- |
| **L1** | Alpha plate survives as a **mode**: `arBackground: 'alpha' \| 'video'`. No dual-send, no removal. |
| **L2** | **DJI only. GoPro is out of scope entirely** — do not build, test, or carry GoPro-specific paths. The LUT stays generic per `stream_id` because that costs nothing, but nothing is designed around GoPro. C4 is closed as not-applicable. |
| **L3** | broadcast-web dials `srt://…` as **caller**. |
| **L4** | **Adaptive** presentation latency, clamped **100–400 ms**. |
| **L5** | Keep **4** POVs warm. |
| **L6** | **HEVC is what the DJI SRT path sends today.** Keep H.264 decode as a working fallback. Probe `VideoDecoder.isConfigSupported`; HEVC-unsupported must be an actionable ops error, not a black frame. |
| **L7** | Live DJI (BW Electron 2026-08-28) sent `stream_id: dji-N` and **`kind:frame` only** — no usable 1 Hz periodic series on that tap. **Shipped (TEL-04):** alias `dji-N` onto the digit LUT; if pacing has &lt; 2 samples, frames **are** the OLS series (same 2 s extra). Periodic/`dji`/`gopro` ≥2 still uses frame as residual only. The 1 Hz path remains preferred when present. |
| **L8** | **`arBackground: 'video'` forces ocean / sky / Cesium off** (`opaqueClearSafe = false`), same as transparent. Operator does not also have to pick transparent. 3D NDI still mounts env during its opaque pass. |
| **L9** | SRT URL is a **hardcoded catalog** keyed by operator SRT id (cams **1–27**). Host **always** `49.13.20.49:9000` (user list had `91.98.150.21` on most rows — rewritten). Open as caller with query `streamid=read:camN:pubN:<token>` (convert `/read:camN:…` or `/publish:camN:…` path to that query — ffmpeg/libsrt never sees a path token). Shared `{srtId}` template remains an empty-by-default escape hatch. UI still: SRT id next to telemetry id. Unknown id → error, no invented URL. Tokens committed on this private studio repo (BW override, same class as ion token); never log them. |

---

## 1. What changes

| | Today | Target |
| --- | --- | --- |
| AR background | Transparent (`alpha = 0`) | Live **drone SRT video** behind the scene |
| Compositing | **vMix** keys AR over the camera input | **Our renderer** composites; NDI `ar` carries the finished program |
| Render time | *Now* — pose lerps toward the newest packet on `performance.now()` | **The presented video frame's capture time** — pose sampled at `t_ntp(pts)` |
| Camera switch | POV switch moves the render camera only | POV switch moves camera **and** video source |

The second and third rows are the substance. The first is a consequence.

### Why compositing has to move in-app

vMix can delay a layer, but it cannot know *when* a telemetry sample was taken. Only we hold both the `stream_anchor` PTS→NTP map and the pose/GPS buffer, so only we can render the overlay **at the video frame's timeline position** instead of at wall-clock now. Once the alignment lives here, the composite has to live here too — sending an alpha plate that was rendered for frame *N* and letting vMix pair it with whatever frame it happens to have would re-introduce the error we just removed.

### The inversion

The pose pipeline today is a **push** model: a packet arrives, `MidpointLerp.setTarget` aims at it, and the RAF loop renders whatever the smoother currently holds (`src/pose/pipeline.ts`, `src/pose/lerp.ts`). Nothing reads `TelemetryData.ts` for timing — it is stored on `PoseEvent` and never used.

The target is a **pull** model: a video frame is chosen for presentation, its PTS resolves to an NTP instant, and the scene asks telemetry *"where was everything at that instant?"*. That requires a time-indexed history and a `sampleAt(ntpMs)` API.

**Shipped (TEL-08):** `arBackground: 'video'` with a healthy LUT samples at `t_ntp = toNtp(pts) + syncTrimMs`. `arBackground: 'alpha'` keeps the push smoother (L1). **TEL-03 (2026-08-28):** LUT / `toNtp` miss is not a hold — while telem and SRT flow, pose free-runs until the LUT can sample; `sampleAt` unavailable past the history hold window emits newest pose rather than pinning the last match.

---

## 2. Pipeline

```
per POV, Electron main                          renderer
────────────────────────                        ────────────────────────────────────
srt://…  ──► SRT reader ──► MPEG-TS bytes ──IPC──► TS demux (pure, testable)
             (no transcode, PTS untouched)          │  { annexB AU, pts90k, keyframe }
                                                    ▼
                                            WebCodecs VideoDecoder
                                            (chunk.timestamp = pts→µs)
                                                    ▼
                                            VideoFrame ──► presentation queue
                                                                │
telemetryBus 'stream_anchor' ──► PtsNtpMap[stream_id]           │
telemetryBus 'drone'|'boat'|'buoy' ──► TimeIndexedHistory       │
                                                                ▼
                                 ┌──────────  present (studio:tick / rAF)  ──────────┐
                                 │ frame  = queue.pick(policy §4.3)                   │
                                 │ t_ntp  = ptsNtp[sid].toNtp(frame.pts) + trim[pov]  │
                                 │ state  = history.sampleAt(t_ntp)                   │
                                 │ render : bg quad(frame) → scene(state) → timecode  │
                                 └────────────────────────────────────────────────────┘
                                                    ▼
                                            NDI 'ar' (opaque program)
```

**Invariant, load-bearing:** PTS is never rewritten anywhere on this path. Main is a dumb byte pipe; demux reads the muxer's PTS; `EncodedVideoChunk.timestamp` carries it into the decoder; `VideoFrame.timestamp` carries it back out. If any stage re-stamps (an `ffmpeg` transcode, an MSE remux, a WebRTC hop), the `stream_anchor` LUT no longer describes the frames we hold and the entire feature is decorative.

---

## 3. Video path (OUT)

### 3.1 Why not WHEP, why not MSE

| Option | Verdict | Reason |
| --- | --- | --- |
| SRT → MediaMTX → **WHEP** (the existing `whepUrl` underlay) | **Rejected** | WebRTC re-stamps with RTP clocks and drops MPEG-TS PTS. There is no supported way to recover the muxer PTS on the receiving end, so `stream_anchor` becomes unusable. This kills the feature, not just degrades it. |
| SRT → remux fMP4 → **MSE `<video>`** | **Rejected** | MSE exposes `currentTime`, not per-frame PTS; frame identity is approximate and buffering is opaque. Also a DOM `<video>` is invisible to the NDI FBO readback (§3.4). |
| SRT → raw TS → **WebCodecs `VideoDecoder`** | **Chosen** | We set `chunk.timestamp` and read it back on `VideoFrame.timestamp`, so PTS round-trips exactly. Hardware-accelerated in Chromium. Electron `^37.2.6` (Chromium 138-class) has it unconditionally. |

### 3.2 Electron main — transport only

New bridge namespace alongside `ndi` / `races` / `config` in `desktop/preload.cjs`:

| Direction | Channel | Payload |
| --- | --- | --- |
| renderer → main | `srt:open` | `{ povId, url, streamId?, latencyMs, passphrase? }` |
| renderer → main | `srt:close` | `{ povId }` |
| renderer → main | `srt:status` | → `Record<povId, SrtStatus>` |
| main → renderer | `srt:data` | `{ povId, chunk: Uint8Array }` — raw MPEG-TS |
| main → renderer | `srt:status` | `{ povId, state: 'idle'\|'connecting'\|'live'\|'error', bitrateKbps, lastError }` |

At ~8 Mbps a stream is ~1 MB/s over IPC — negligible even with four warm POVs. Main does no parsing, so the entire format-sensitive surface stays in the renderer where it is unit-testable under the existing vitest-node setup.

**Native dependency is the open packaging risk** (PLT). Two candidates: an `ffmpeg` child process with `-c copy -f mpegts pipe:1` (portable, preserves PTS, ~80 MB binary to ship), or a native SRT binding (smaller, but Windows prebuilds are historically unreliable). Decide by spike, not by preference.

### 3.3 Demux + decode (renderer)

Prefer a **minimal, video-only MPEG-TS demuxer written in-repo** over a library. It is ~400 lines, pure and synchronous, and PTS fidelity is the entire point of the feature — we should own that code and test it. `mpegts.js` and similar are structured around MSE and would fight us.

WebCodecs specifics that are easy to get wrong:

- `chunk.timestamp` is **microseconds**; PTS is 90 kHz ticks. Unwrap the 33-bit counter to a monotonic value *before* converting, or the first wrap (~26.5 h) corrupts everything.
- Annex-B in-band SPS/PPS means the decoder is configured **without** a `description` field. Supplying one switches Chromium to AVCC and it will reject the stream.
- **`VideoFrame.close()` is mandatory.** Every frame dropped by the presentation policy must be closed explicitly. Missing this exhausts the decoder pool and stalls decode within seconds — the classic WebCodecs failure and one that looks like a network problem.
- Set `THREE.SRGBColorSpace` on the video texture and honour BT.709 limited range, or the picture reads grey and flat next to the AR overlay.

### 3.4 Compositing must be inside WebGL

The AR NDI pump renders to an offscreen FBO and calls `readRenderTargetPixels` (`src/output/ndiFramePump.ts`). **It sees WebGL only.** The existing WHEP underlay is a DOM `<video>` under the canvas, which is exactly why it is documented as preview-only — it has never appeared in an NDI frame and never will.

So the video goes in as a **fullscreen background quad**, drawn before the scene with depth-write off and correct aspect fit. Not `scene.background` (aspect handling is wrong for non-matching ratios), not a DOM element.

### 3.5 Multi-stream and switching

Tear-down-and-reconnect on every POV switch costs an SRT handshake plus a wait for the next keyframe — roughly 0.5–2 s of black. That is not a live camera switcher.

**Keep every enabled POV warm** (SRT open, decoder running, texture updating) up to a cap; switching swaps which `{ texture, PtsNtpMap }` pair drives the composite, which is instantaneous. Four concurrent 1080p30 decodes are unremarkable on studio hardware; the cost is bandwidth (~4 × 8 Mbps) and decoder memory. **Cap = 4 (L5)**, configurable. Beyond the cap, evict the least-recently-active POV.

Each stream owns its own `PtsNtpMap` keyed by `stream_anchor.stream_id`, so switching needs no LUT rebuild.

---

## 4. Time matching (TEL)

### 4.1 We do **not** need an NTP client

Worth stating plainly because the source doc invites the opposite conclusion: matching never asks what time *this PC* thinks it is. Video carries NTP through `stream_anchor.ntp_capture_ms`; telemetry carries NTP in `ts` / `time`. Both were stamped on the phones against the shared VPS server. We correlate two producer-side timelines and the studio clock is irrelevant.

The PC clock is used only for liveness bookkeeping (packet age, watchdogs), where relative measures already suffice.

### 4.2 `PtsNtpMap` — and a departure from `ntp-matching.md` §4.a

The source doc specifies pairwise linear interpolation between bracketing anchors and says to **reject** a PTS after the last anchor. That is correct for a recording and **wrong for live**: the frame we want to present is always newer than the last periodic anchor. Applied literally, GoPro (periodic-only, ~1 Hz) could never present a single frame.

**Proposed instead:** a sliding-window **robust linear fit** over the pacing series (`kind ∈ dji | periodic | gopro`) across the last ~30 s.

| Property | Why it matters here |
| --- | --- |
| Extrapolates naturally | Forward projection past the newest anchor is just evaluating the line — no special case, which is what live needs. |
| Rejects outliers | One bad `ntp_capture_ms` cannot hinge a segment the way it does in pairwise interpolation. |
| Slope is diagnostic | PTS→NTP is a line of slope ≈ 1; measured drift is a direct health signal for the producer's clock. |
| Smooth | No discontinuity every time a new anchor lands, so no 1 Hz judder in the matched pose. |

Guard rails: 33-bit wrap via shortest signed difference; `kind: "frame"` stays **out of the pacing array**. When pacing has ≥2 `dji`/`periodic`/`gopro` samples, frames are residual-only (truth series). When pacing has &lt; 2, frames **are** the fit (TEL-04 — live DJI can omit the 1 Hz series). Reject on clock step; require `stream_id` to equal the decoded stream (plus `dji-N` → digit alias); bound forward extrapolation (**2 s**) and flag degraded beyond it.

### 4.3 Presentation policy — how far behind live to sit

We need bracketing telemetry (samples on both sides of `t_ntp`) to interpolate rather than guess. Two modes:

**Adaptive — the locked default (L4).** Present the newest frame whose `t_ntp` is already covered by received drone pose:

```
presentPts = max{ pts : toNtp(pts) ≤ newestPoseNtp(povId) }, clamped to [100 ms, 400 ms] behind newest
```

Self-tuning — it sits exactly as far back as the telemetry actually requires and no further. The clamps are load-bearing in both directions: the 100 ms floor absorbs decoder and network jitter, and the 400 ms ceiling stops a telemetry stall from walking the buffer away indefinitely (on stall, pin at 400 ms and flag degraded rather than drifting).

**Fixed.** A constant target latency, operator-selectable, for commissioning or if adaptive misbehaves on site.

Either way, presentation is driven by the existing clocks: NDI keeps its steady `studio:tick` cadence and takes whatever frame the policy selects, so a video stall repeats the last frame rather than dropping NDI output. Preview at 60 fps simply shows each 30 fps frame twice. **No change to `previewFrameClock` or `STUDIO_TICK_FPS`.**

### 4.4 Sampling telemetry at `t_ntp`

Ring buffer per entity, keyed by NTP (`TelemetryData.ts`, `BoatTelemetry.time`), ~30 s deep.

| Entity | Policy | Rationale |
| --- | --- | --- |
| **Drone pose** (10 Hz, `id` = video `stream_id`) | Interpolate between bracketing samples; short `vel`-based extrapolation ≤ ~150 ms; degrade beyond | Same device as the video, so the common NTP offset largely cancels. This is what governs whether the overlay sits on the image. |
| **Boat GPS** (~0.5–2 Hz, 6 s holes when still) | Dead reckon per `ntp-matching.md` §4.c; **never** wait for a bracketing fix | Waiting would mean seconds of latency. Measured median inter-fix step is 0.55 m against 5.1 m GNSS accuracy — DR error is well under the noise floor. |

That split is the whole latency argument: waiting on 10 Hz same-device pose is cheap and buys real accuracy; waiting on 2 Hz cross-device GPS is expensive and buys almost nothing.

Existing gaps to close along the way: `boatRawPose` ignores `spd` entirely, and `tryParseStreamAnchor` drops the delay fields (fine — they are already baked into `ntp_capture_ms`, but diagnostics may want them).

### 4.5 Free-run fallback

No anchors for a stream (old firmware, or GoPro per §7 C4) → fall back to today's behaviour: render at now, show video unmatched, and **say so in ops**. A silent degradation to "looks roughly right" is worse than a visible badge, because nobody will investigate a feature that appears to work.

---

## 5. Residual bias and the manual trim (CAL)

`ntp-matching.md` §3.2 and §3.3 are explicit: `anchorPreCallbackOffsetMs = 0` and `anchorFfmpegBiasMs = 0`. Neither producer has measured sensor-photon → anchor delay. DJI anchors are NAL-callback-accurate; GoPro carries an uncalibrated camera + Wi-Fi + FFmpeg residual that is plausibly 150–400 ms.

**A flawless implementation of this document still lands with an unknown constant offset per camera model.** No amount of consumer-side work removes it.

So: **`syncTrimMs` per POV**, an operator-adjustable millisecond offset applied to `t_ntp` after LUT lookup. This belongs in `CalibrationOffsets` next to `yawDeg`/`fovHDeg` — it is a per-camera calibration constant of exactly the same character, and it then rides the existing `calibration.byPovId` persistence into race packs for free.

Commissioning procedure: point a drone at a clapper or a visible strobe, or use a hard boat manoeuvre, and trim until the overlay stops leading or trailing. Once measured per airframe it is stable.

**Sign (CAL-05):** `t_ntp = toNtp(pts) + syncTrimMs`. **Positive samples a later world state, so the overlay leads the video.** If the overlay lags the picture, raise the trim; if it leads, lower it. Range ±500 ms, step 5. `0` is a no-op (today's behaviour). TEL-08 applies this; CAL only stores it.

---

## 6. Rendering and ops details

| Item | Decision |
| --- | --- |
| **Environment gate** | Realistic ocean / sky / Cesium terrain stay **off** in AR — the real sea is in the video. Existing `setEnvironmentOpaqueClearSafe` already enforces this; no change. Depth-only terrain as an occluder (boats hidden behind a hill) is an attractive later addition, explicitly out of scope now. |
| **Free-cam preview** | Ops free cam with a drone-POV video background is nonsense imagery. Suppress the background on screen whenever preview camera ≠ air camera; NDI (always active POV) keeps it. |
| **Timecode** | Unchanged — still burned into the same canvas after the scene, so it survives NDI readback. |
| **3D / 2D channels** | Untouched. This affects the `ar` channel only. |
| **Sync-debug overlay** | New, and not optional: presented PTS, resolved NTP, pose-sample age, anchor rate and fit slope, extrapolation flag, effective latency, decoder drops. Commissioning this feature blind is not realistic. |
| **Per-POV stream config** | `{ povId, srtUrl, streamId }` on the race project + Fleet Live panel session, following the existing `wsUrl` / `povIds` pattern. Note `stream_anchor.stream_id` is the **producer's** id and need not equal our `povId` — the mapping must be explicit, not assumed. |

---

## 7. Gaps and conflicts

| # | Issue | Severity | Resolution |
| --- | --- | --- | --- |
| **C1** | **WHEP/WebRTC destroys PTS.** If the intended topology was SRT → MediaMTX → WHEP, NTP matching is impossible. | **Blocking** | Raw TS → WebCodecs (§3.1). The existing `whepUrl` underlay stays as an unrelated preview tool. |
| **C2** | **Breaks the locked alpha-NDI contract.** `ndi-alpha-electron.md` and RULES §10 fix AR as an alpha plate that vMix composites. Opaque AR moves the show's single point of failure into our app: today a graphics crash leaves vMix with a clean camera, after this it leaves black. | **Resolved (L1)** | `arBackground: 'alpha' \| 'video'` — a mode, not a replacement. Alpha stays the default and remains the documented fallback; the operator flips to `video` deliberately. **BW override recorded:** `ndi-alpha-electron.md` §2 is amended to describe two AR contracts rather than one. Dual-send declined by the user, so the crash-fallback is "switch the mode back", not a second channel. |
| **C3** | **`ntp-matching.md` §4.a cannot present live frames.** "Reject after last anchor" is right for VOD, wrong for live. | High | Sliding-window robust linear fit with bounded forward extrapolation (§4.2). Source doc should be amended. |
| **C4** | **GoPro anchors likely never arrive** (`AnchorPublisher.buildAnchorUrl` uses query `type=anchor`; the live router accepts only `drone\|boat\|client` and closes 1008). | **Closed (L2)** | Not applicable — GoPro is out of scope entirely. Left recorded so nobody re-derives it if GoPro returns. |
| **C5** | **`ntp_capture_ms` is not photon time.** Both bias knobs ship at 0. | High | Per-POV `syncTrimMs` (§5). Accept that a constant residual is inherent, not a bug to chase in code. |
| **C6** | **Time sync is necessary but not sufficient.** DJI reports `cam.fov = 84`; our calibration default is `66.8832`. FOV mismatch and uncorrected lens distortion will misregister the overlay no matter how perfect the timing is. | High | CAL work, parallel track. Real video behind the render is also the first true ground truth this project has had — it will expose any residual frame error (cf. `enu-frame-handedness.md`) and any stale per-POV yaw offset. That is a benefit, but expect the first session to surface alignment bugs that have been invisible until now. |
| **C7** | **Boat GPS rate.** ~2 Hz moving, ~6 s holes when still. Rendering at video time means DR-projecting across those holes. | Medium | Accept + gate + badge. Fine while moving; boats will visibly lag or jump out of the still-holes. Not fixable consumer-side. |
| **C8** | **Anchor volume.** DJI `sendPerAuFrameAnchors` defaults **true** = 30 msg/s per drone on the same socket as pose. Four warm POVs ≈ 120 anchors + 40 pose per second. | Medium | Bounded ring buffers; keep `kind:frame` out of the **pacing array**. Frame-only OLS (TEL-04) when pacing &lt; 2. Bus fan-out and HUD counters off the hot path. Q7. |
| **C9** | **HEVC in WebCodecs** is platform- and hardware-dependent in Chromium, unlike H.264 which decodes everywhere. Both are in scope (L6), and DJI airframes do encode H.265. | Medium — **live risk, narrowed 2026-08-29** | Probe `isConfigSupported`. **2026-08-29:** live transcode was a **garbage `hev1` from Annex-B EPB** (`unescapeRbsp` in `tsDemux.ts`), not missing Store pack. Copy + WebCodecs HEVC is the intended path; ffmpeg→H.264 remains fail-closed. True GPU/Electron unsupported still → H.264 airframe or transcode. Software HEVC ×4 is not a fallback. |
| **C10** | **Native dependency + packaging.** `ffmpeg` binary or native SRT module in Electron; Windows prebuilds are the historical failure mode. | Medium | PLT spike before committing to either. Blocks nothing else — the rest of the pipeline can develop against a file-fed byte source. |
| **C11** | **`egress-webrtc-srt-evaluation.md` E0** says "no app SRT." That decision was about **egress** (out); this is **ingest** (in). | Low | No substantive conflict, but amend the wording so nobody cites E0 to block this. |
| **C12** | **Audio** is unaddressed. | Low | Assume video-only; audio stays on vMix's camera path. Confirm. |

### One thing that is cheaper than it looks

`ndiDelayBuffer` already ships per-channel delay (0–30 s). If the *only* problem were "AR is a constant X ms ahead of the video," an operator could dial that in today and stop. That is worth knowing as a commissioning tool and a fallback.

It is not a solution, because the offset is not constant: SRT latency varies with network conditions, and — more fundamentally — a fixed delay still renders a 500 ms-old GPS fix as though it were current. It shifts everything uniformly; it cannot resample telemetry onto the video's timeline. But it is the right first thing to try on site if the full path misbehaves during a show.

---

## 8. Work breakdown — Phase 17 (issued 2026-08-26)

| Wave | Dispatch | Owner | Scope | Depends on |
| --- | --- | --- | --- | --- |
| 1 | `DSP-TEL-20260826-01-pts-ntp-map` | TEL | Per-`stream_id` sliding-window fit, wrap-safe, bounded extrapolation, gating, health. Pure module + tests. | — |
| 1 | `DSP-TEL-20260826-02-telemetry-history` | TEL | NTP-keyed ring buffer + `sampleAt(ntpMs)`; drone interpolation + boat DR. Pure module + tests. | — |
| 1 | `DSP-OUT-20260826-03-srt-transport` | OUT (+PLT dep) | Electron main SRT caller, `srt:*` IPC, `broadcastStudio.srt`, status, dep spike. | — |
| 1 | `DSP-OUT-20260826-04-video-background` | OUT | In-WebGL fullscreen quad via the `renderer.render` wrap, aspect fit, `arBackground` mode, free-cam + 3D suppression. Test-pattern texture. | — |
| 1 | `DSP-CAL-20260826-05-sync-trim` | CAL | `syncTrimMs` on `CalibrationOffsets`, slider, `calibration.byPovId` round-trip. | — |
| 2 | `DSP-OUT-20260826-06-ts-demux-decode` | OUT | Video-only TS demuxer (H.264 + HEVC), WebCodecs decode, presentation queue, `VideoFrame` lifecycle, capability probe. | 03 contract, 04 sink |
| 2 | `DSP-OUT-20260826-07-srt-config-sync-hud` | OUT | Per-POV SRT config (Fleet panel + race pack); sync-debug overlay. | 01 health shape |
| 3 | `DSP-TEL-20260826-08-matched-pose-cutover` | TEL/SCN | Drive the scene from `sampleAt(presentedNtp)`; free-run fallback; POV switch wiring; end-to-end. | waves 1–2 |

Wave 1 is **fully parallel** — five workers, disjoint file ownership, every module testable in isolation with no live stream and no hardware. That structure is deliberate: it confines the risky integration to wave 3, by which point the hard parts (the fit, the sampler, the transport, the compositor) are each independently green.

File-ownership split, since wave 1 runs concurrently:

| Owner | Exclusive files |
| --- | --- |
| 01 | `src/telemetry/ptsNtpMap.*` |
| 02 | `src/telemetry/telemetryHistory.*` |
| 03 | `desktop/*`, `src/output/srtBridge.*` |
| 04 | `src/output/videoBackground.*`, `src/output/types.ts`, the `main.ts` wiring block |
| 05 | `src/calibration/*` |

Both 01 and 02 append to `src/telemetry/index.ts` and `src/telemetry/README.md` — export-only additions at the end of the file, which merge cleanly. Flagged in both dispatches.

---

## 9. Questions — answered 2026-08-26

| # | Question | Answer |
| --- | --- | --- |
| **Q1** | Alpha plate: mode, replace, or dual-send? | **Mode** (L1) |
| **Q2** | DJI only, or DJI + GoPro? | **DJI only — no GoPro** (L2) |
| **Q3** | SRT caller or listener? | **Caller** (L3) |
| **Q4** | Sync buffer latency? | **Adaptive, clamped 100–400 ms** (L4) |
| **Q5** | Warm POVs? | **4** (L5) |
| **Q6** | Codec? | **H.264 + HEVC** (L6) |
| **Q7** | DJI per-AU frame anchors in production? | **Unknown** — must work on the 1 Hz fit alone (L7) |

### Still outstanding (does not block wave 1)

**A real SRT endpoint, or a recorded `.ts` capture with the matching `stream_anchor` JSON stream.** The demuxer, LUT, and history modules are all pure and can be built and tested against synthetic data — that is exactly why wave 1 is structured the way it is. But nothing on this path is trustworthy until it has run against real producer output, and the residual-bias trim (§5) cannot be measured at all without it. Needed before wave 2 closes.

Also unconfirmed: the **SRT endpoint URL scheme and who operates it** (L3 fixes us as caller but not what we dial), and whether the studio PC can hardware-decode HEVC (C9).

---

## Related

| Doc | Role |
| --- | --- |
| [`ntp-matching.md`](./ntp-matching.md) | Wire contracts, producer guarantees, consumer math |
| [`ndi-alpha-electron.md`](./ndi-alpha-electron.md) | Current AR alpha contract (§2 affected — C2) |
| [`multi-output-streaming.md`](./multi-output-streaming.md) | 2D / 3D / AR channel model |
| [`ar-calibration-map-overlay.md`](./ar-calibration-map-overlay.md) | Manual overlay-vs-camera alignment (C6) |
| [`enu-frame-handedness.md`](./enu-frame-handedness.md) | Scene frame ground truth (C6) |
| [`../ops/egress-webrtc-srt-evaluation.md`](../ops/egress-webrtc-srt-evaluation.md) | E0 = no app **egress**; this is ingest (C11) |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, WHEP underlay, NDI pumps, frame clock |
| [`../../src/telemetry/README.md`](../../src/telemetry/README.md) | Ingest, bus, `stream_anchor` routing |
