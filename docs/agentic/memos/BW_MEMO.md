# BW_MEMO — Broadcast-Web Master Orchestrator

**Last updated:** 2026-08-28  
**Session role:** BW

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
