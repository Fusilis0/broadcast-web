# OUT_MEMO

**Last updated:** 2026-09-13  
**Status:** Phase **22** local SRT **open**. NDI UI hide + plates shipped in `DSP-SRT-20260909-01` (NDI pumps kept, defaults off).

## 2026-09-13 — Human Pass B (OBS 3D look)

Operator eye-check when on studio PC: SRT 3D must match studio (Gerstner + terrain + overlay), not heroes-only. Task **B** in `docs/ops/srt-human-pass.md`. No OUT worker unless that Fails after `srtOut:worldLook`.

## 2026-09-09 — DSP-SRT-20260909-01 plates + NDI hide

Worker (SRT-owned DSP, OUT files listed): chrome-free `?srtPlate=` 1080 windows; SRT AR/3D/2D toggles in Output; NDI Send in closed **Legacy NDI** fold. Enabling SRT forces that channel's NDI pump off. Pumps/`ndiSender` kept. Runbook `docs/ops/srt-local-obs.md`.

## 2026-09-09 — Phase 22 (HO-BW-OUT-20260909-01)

Operator: hide NDI; SRT AR/3D/2D; local OBS 30×3 first; VPS later. Design `srt-egress.md`. Worker is SRT-owned and lists OUT files. No second hide-NDI DSP.

## 2026-09-09 — HO-SCN-OUT-20260909-01 done (NDI Send off)

`NDI_CHANNEL_WANTED_DEFAULTS` is all **false**. Missing session → AR/3D/2D Send unchecked. Existing `bw.ndi.channelWanted` in this tab still wins. Not Phase 22. Not Record.

## 2026-09-09 — DSP-OUT-20260908-01 code-complete

Silent 1080p30 MP4 via canvas `MediaRecorder` (prefer H.264 MP4; WebM remuxed with ffmpeg). Record wired from `#ops-cinematic-record` in `main.ts`. SCN still owns play/seek/hide-race. Web-only → `desktop only`. Disk/permission → ops status, no throw. NDI / SRT / Phase 22 unchanged.

**Human Pass:** Play the **2026-09-09** path first (Canada→UK then Russia→Turkey→İstanbul). Then `npm run desktop:dev` → **Record**. Duration ~60 s (±0.5 s). App does not go live after.

## 2026-09-09 — NDI Send off at cold start (do not implement in SCN)

`HO-SCN-OUT-20260909-01`. Operator: AR/3D/2D Send **unchecked** on studio open. Change `NDI_CHANNEL_WANTED_DEFAULTS` to all false. Session still wins. Not Phase 22. Not cinematic Record.

## 2026-09-09 — SCN-07 warm in tree (do not implement here)

Prefetch on project start; Play waits. Record after operator Pass on **second** Play (no globe pop). Same hooks. File `intro-bosphorus.mp4`.

## 2026-09-08 — SCN-02 sequence in tree (do not implement here)

`intro-bosphorus` can Play 60 s. Record still this DSP. Start after operator Human Pass on that Play (path recognisable). Same hooks as SCN-01. File name `intro-bosphorus.mp4`.

## 2026-09-08 — SCN-01 Record hooks (do not implement here)

Player is **code-complete**. Record stays OUT. When Human Pass on Play (`_empty`):

- `scene.playCinematic()` / `pauseCinematic()` / `seekCinematic(t)` / `getCinematicTransport()`
- Canvas: `scene.renderer.domElement` (studio 1920×1080)
- Clock: `CINEMATIC_FPS` (30). Do not advance the spline from 60 rAF
- Hide-race already on while `isCinematicActive()`
- Enable `#ops-cinematic-record` (disabled stub)
- Silent MP4 only — no audio

DSP: `DSP-OUT-20260908-01-cinematic-mp4`. Do not start until Play works ~1 s.

## 2026-09-08 — Phase 21 cinematic MP4

Operator: vMix plays a **pre-recorded** silent 1080p30 file. App does not play-then-live. DSP: `DSP-OUT-20260908-01-cinematic-mp4` after SCN-01. Not NDI. Brief: `docs/agentic/briefs/phase21/OUT_PHASE21.md`.

## 2026-09-07 — NDI 30×3 closed; SRT is Phase 22

## 2026-09-06 — experiment B live

Operator: A did not move Send; continue with B. Not same-tick stagger. Not 2D yield-on-FBO.

**B in this tree:**

1. **Skip 1080 FBO when `canBegin()` is false** — already on AR and 3D. Kept.
2. **Cheaper `begin`** — persistent DRAW spy; cache `PACK_ALIGNMENT`; no pack-buffer `getParameter` each pack.
3. **PBO depth 3** + pixel ring 6.
4. **Matched delay** — 2D `delayMs += 31`.

**Live (2026-09-06 Debug vs A lock mid-teens / 2D ~3, begin ~7–10 ms):**

| | A lock | B live |
|---|---|---|
| `arBegin` / `d3Begin` mean | ~7–10 ms | **~0.03–0.07 ms** (max usually 0.1–0.3) |
| AR/3D FBO n / 1s | ~15–18 | **~17–24** |
| Skips | mostly **busy** | mostly **rateCap** (gate); busy often 0–6 |
| HUD Send | AR ~14–18, 3D ~12–18, 2D ~3 | **AR ~15–21 (typ 17–20), 3D ~14–20 (typ 16–18), 2D ~3–6 (typ 4)** |
| 2D delay | 0 | **31 ms** |
| 2D grab | ~80–150 ms, n~3 | unchanged wall (~70–175 ms, n 3–5) |

**H2 cheaper begin:** CONFIRMED. **H3 Send:** modest, not 30. **H4 2D:** not worse. **H5 delay:** 31 ms.

**Wall now:** 2D grab still ~100 ms on the JS thread (tick max ~140–190 ms). AR/3D are gate-limited ~20 unique FBO/s, Send a bit under that (pack/IPC). Not 30×3.

## 2026-09-06 — 2D Send off; NDI 30×3 closed; switch to SRT out

Operator: 2D Send off. AR and 3D **did not go above ~20**. Stop NDI 30×3 climb. Next: **SRT out**. Operator will send design plans for later phases; enhance those, then implement.

**Call:** NDI three-channel 30 fps is **not reachable on this machine** via the current WebGL/JS/PBO/IPC path. 2D grab is not the AR/3D cap. Do not reopen deeper PBO, 3D GPU UYVY, compress-before-send, fake 2D FBO, JPEG, or merge `origin/30_FPS`.

**Keep in product:** unique present PTS, VideoFrame texImage2D, deferred send `maxPending: 2`, SRT IPC queue 32, AR freshness skip, AR/3D FBO ping-pong, 2D independent clock, AR opaque UYVY, 2D identity pack + paint-generation skip, cheaper PBO begin, PBO depth 3, 2D +31 ms delay.



## 2026-09-06 — experiment A (2D grab) live fail

Operator: implement A, then Debug-mode test. Do not start B until A is checked.

**A in this tree (kept):**

1. **Identity 1080 pack** — worker skips matte fill + `blitUyvyNearest` when source is already 1920×1080.
2. **Skip unchanged** — `getPaintGeneration`; same gen skips grab+IPC. Pump does **not** call `redraw()` when generation is wired (that bump made skip always 0).
3. **SCN wire** — `map2d` `paintGeneration` on `redraw()`; `main.ts` passes it.

**Live 1 (pre skip-order fix):** HUD **AR 14–18 / 3D 12–18 / 2D 2–4**, preview **~8–13**. `skipUnchanged=0`, `ensureDrawn=3–4`, identity 1920×1080, **grabMean ~110–150 ms**.

**Live 2 (post-fix):** `ensureDrawn=0` (pump no longer double-paints). **`skipUnchanged` still 0** — stream rounding is 10 Hz and grab is ~80–150 ms, so generation has always moved by the next grab. HUD **d2 2–5** (typical **3**), AR/3D mid-teens, preview **~8–14**. Grab cost unchanged. **A did not raise 2D Send.**

**Wall:** worker `getImageData` + UYVY (~100 ms), not letterbox blit or extra `ensureDrawn`. Next candidate is experiment B (AR/3D PBO busy) only if the operator asks.

**Not in A:** fake FBO, JPEG/gzip, PBO busy skip (B), merge `30_FPS`.

## 2026-09-06 — operator locks 17/17/3; NDI compress-before-send is a no

Operator: keep the idea-port HUD as-is. New idea: compress frames because 1080p is ~8 MB and NDI has compression.

**Decision: do not compress before `sendFrame`.** NDI already SpeedHQ-compresses on the **LAN** after `grandi.sender.video()`. The 8 MB number is **RGBA8 in process** (1920×1080×4). We already pack to UYVY (~4.1 MB) / UYVA (~6.2 MB) for IPC. The stall is renderer-thread readback/pack/IPC clone, not NIC fill. JPEG/gzip/H.264 in JS would add CPU on the same thread and still need raw UYVY/UYVA for `grandi` (no SHQ FourCC on that binding). NDI-HX is a different send type (higher latency).

**Live check (2026-09-06, studio left open):** AR send is **UYVY 4.1 MB** (`pixelFormat: uyvy`, `bytes: 4147200`). HUD still **AR ~16 / 3D ~14 / 2D ~3**, preview **~11**, hitch 10/1s. `arEnqueueIpc` still ~13 ms. 2D grab ~100–150 ms. Alpha drop did not move the HUD.

## 2026-09-06 — port coworker FPS ideas without merging


Operator: do not merge `30_FPS`; take ideas that can raise Send without breaking Phase 19. Keep `demo-istanbul`. Keep `STUDIO_TICK_FPS = 60`. Keep CPU UYVY on 3D (no GPU half-width pack / stripes). No DIAG, no `debug-173fbb.log`, no `127.0.0.1:7438`, no query auto-connect.

**Taken (this tree):**

| Idea | Where |
| --- | --- |
| Unique `present()` PTS hole-fill (`ptsDiff33` / catch-up skip) | `videoDecodePipeline.ts` |
| VideoFrame **texImage2D** (`isVideoTexture` + `renderer.initTexture`) | `videoStreamManager.ts`, `main.ts` |
| Deferred send **maxPending: 2** on AR, 3D, **and** 2D | `ndiDeferredSend.ts` + pumps |
| SRT IPC **`MAX_QUEUED_CHUNKS = 32`** | `desktop/srtHelpers.cjs` |
| AR freshness skip (same present PTS) + **forceAdmit** on new PTS | `ndiPresentPts.ts`, `ndiFramePump.ts`, `ndiCaptureClock.ts` |
| AR **and** 3D FBO ping-pong + `flushAfterPack: false` | `ndiAirTargetPingPong.ts`, both pumps |
| 2D on its own **`setInterval`** (not `studio:tick`) | `streamMapNdiPump.ts` |

**Left on their branch (do not take):**

- `demo-istanbul` pack swap
- 3D `createNdiGpuUyvyPack` live path
- 1 Hz DIAG / ingest / auto-connect
- PBO same-tick stagger (`blocking: true` only for sync `readPixels`)
- 2D yield-to-death on FBO `canBegin()` / `isNdiFboReadbackPressured` (that zeroed 2D Send)
- `presentPace` ring / HUD 30/30/30 promise
- Removing `ndiChannelWanted` / `setEnabled`

**Delay:** ping-pong adds **one FBO tick** on AR and 3D only (2D has no FBO). Shared `delayMs` still applies to all three. Operator accepted extra delay if it is matched; 2D cannot share the FBO extra tick.

**Proof:** coworker worktree also did not hit HUD 30×3 on this machine. This port is “less waste / more unique frames,” not a 30×3 claim.

## Operator calls (2026-09-05)

| Item | Call |
| --- | --- |
| NDI **30×3** | **Closed.** 2D Send off still **~20** on AR/3D. Do not reopen NDI climb. Next is **SRT out**. |
| **10.1 Unity** | **Retire Unity.** Broadcast-web is primary air. |
| **10.2 Console deep-link** | **Future.** SPA already parses; wait for console emit. |
| **19.14 Billboard vanish** | **Close.** Did not happen again. Reopen only on a new live case. |
| **19.15 Sea holes** | **Close.** Flat-sea + texture is enough. No more ocean punch-through. |
| **14.3c Anemometer** | **Cancelled.** Open-Meteo forecast is enough. Do not issue a live wind-sensor channel. |
| **19.18 / Cesium vendor** | Still parked (Q5). Not this list. |

HUD lock (2026-09-06 idea-port, three-on): Send **17 / 17 / 3**, preview **~10**. No yellow banner.

## Phase 19 OUT (product)

| Item | Status |
| --- | --- |
| 19.1 / 19.3 OBS / 19.4 | Done |
| Hitch `02-03` / Send `02-05` | Pass |
| 30×3 climb | **Closed.** 2D off still ~20 AR/3D. Next is SRT out. |

## Locks
- Dual clock = two timers, **one** JS thread.
- Send checked ⇒ send. Skip = one busy tick.
- No skip-forever / no `fallToSync` as always-on.
- Do not clone `DSP-OUT-20260902-01` / `-03` / `-05`.
- `STUDIO_TICK_FPS` stays 60. Do not fake mouse.
- Do not merge `origin/30_FPS`.
- Do not compress before NDI `sendFrame` (SDK already compresses on the wire).

## Next
Phase **22** local SRT is **open**. Worker `DSP-SRT-20260909-01` (OUT files listed). Do not implement in OUT chat. VPS after OBS 30×3 Pass. NDI pumps kept, UI hidden.
