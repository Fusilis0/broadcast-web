# Phases Roadmap — broadcast-web

**Owner:** BW  
**Updated:** 2026-09-15  
**Design:** [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) · air: [`../ops/air-runbook.md`](../ops/air-runbook.md) · **Phase 19:** [`../architecture/phase19-senexus-qol.md`](../architecture/phase19-senexus-qol.md) · **20–22:** [`../architecture/3d-environment-buildings.md`](../architecture/3d-environment-buildings.md) · [`../architecture/commercial-video.md`](../architecture/commercial-video.md) · [`../architecture/srt-egress.md`](../architecture/srt-egress.md) · [`../architecture/srt-program-cameras.md`](../architecture/srt-program-cameras.md)

---

## Strategy lock (v1) — 2026-08-04

| Decision | Lock |
| --- | --- |
| **First version venue** | **Local studio** — Electron + Vite + VPS telemetry (`ws://…`). No cloud host required for v1. |
| **Hetzner / public SPA / WSS TLS** | **Deferred** — months later, optional; may never ship if local+LAN is enough. Checklist kept as archive: [`../ops/human-hetzner-wss-checklist.md`](../ops/human-hetzner-wss-checklist.md). |
| **Preferred air** | **Phase 22 open.** SRT AR/3D/2D; NDI hidden, code kept. Local OBS 30×3 first; VPS later. |
| **Frame budgets** | **PRF** — ops preview ~60 rAF. Never `STUDIO_TICK_FPS = 60`. NDI 30×3 **closed**. **SRT local Pass = 30×3 in OBS.** [`../architecture/performance-budgets.md`](../architecture/performance-budgets.md) |
| **SRT ingest** | **SRT** — Electron caller, catalog cams 1–27, HEVC decode / ffmpeg fallback. [`BOOTSTRAP_SRT.md`](../agentic/dispatches/BOOTSTRAP_SRT.md) |
| **App egress (SRT)** | **Phase 22** — three callers. 22.4 program cams. VPS later. [`../architecture/srt-egress.md`](../architecture/srt-egress.md) · [`../architecture/srt-program-cameras.md`](../architecture/srt-program-cameras.md) |
| **v1 focus** | **Visual parity + ops QoL** (assets, maps, tags, editor), then LAN project features, then Unity cutover. |

### Current pointer

**Open now: Phase 22.4 Human Pass** (workers code-complete). Eye-check **E–I + A** in [`../agentic/briefs/phase22/SRT_HUMAN_PASS.md`](../agentic/briefs/phase22/SRT_HUMAN_PASS.md). VPS **after** fps Pass.

Phase 21 cinematic is **code-complete**; Record Human Pass can finish in parallel and does not block this local SRT slice.

**10.1** Unity parallel-air **closed 2026-09-05** (operator: retire Unity; broadcast-web is primary). **10.2** console emit still waiting.  
**Done:** Phase 11 core (**V1-D**) + follow-up authoring workspace / calib+output into sidebar +
follow-up #2 (Close bug fix, resizable map/sidebar, Enter/Delete/drag editing, distinct
viewer-facing stream map) + follow-up #3 (P0 `window.prompt()` throws unconditionally in Electron,
breaking billboard chain, boat/drone/buoy placement, Save as, Rename, Duplicate — fixed by shared
`promptModal()` DOM utility, `DSP-SCN-20260811-07` + `DSP-PLT-20260811-03`, accepted 2026-08-12
after BW drove the real Electron renderer end-to-end) all accepted. See
`docs/architecture/world-authoring-workspace.md`. Phase 12 cloud still deferred.  
**Done:** Phase 11 (**V1-D**) + follow-ups; **Phase 13 complete** (13.1–13.8). Phase 12 deferred. **10.1 Unity retired 2026-09-05.**  
**Parked:** **10.2** console emit · NDI **30×3 closed** (do not reopen).

---

## What “3.6” and “5.6” mean

| # | Name | What it is | Why it matters | v1 timing |
| --- | --- | --- | --- | --- |
| **3.6** | Console deep-link | External **race console** opens broadcast-web with query params (`?race=`, mode, origin, tokens…). SPA parser exists; **console team must emit the URL** and ack the contract. | One-click load from console into air/editor PC. | After visuals; coordinate with console — not blocking local Fleet/Save. |
| **5.6** | Parallel air vs Unity cutover | Run a real (or dress) show: **Unity path and broadcast-web NDI side-by-side**, score gaps, then **explicit OK to retire Unity** (or keep Unity as backup). | Product go/no-go for replacing Unity on air. | After visual parity is “good enough”; human + BW decision. |

---

## Forward plan (do this order)

### Phase 8 — Visual & authoring QoL *(DONE — Milestone V1-A SCN)*

**Goal:** Scene looks and authors like the race product — not a stub. Owner: **SCN** (+ OUT for on-air 2D).

| # | Work | Notes |
| --- | --- | --- |
| 8.1 | **Stream / on-air 2D map** | **Done** (`DSP-SCN-20260804-04`) — CSS PiP; DOM-only vs NDI (`HO-BW-OUT-20260804-01`) |
| 8.2 | **Editor snap + validation** | **Done** (`DSP-SCN-20260804-01`) |
| 8.3 | **Hull + map-dot colours from categories** | **Done** (`DSP-SCN-20260804-02`) |
| 8.4 | **Tag billboard → preview cam** | **Done** (`DSP-SCN-20260804-03`) — scale per preview/air pass |
| 8.5 | **Unity visual asset port** | **First slice done** (`DSP-SCN-20260804-05`); optional backlog below |
| 8.6 | **Invisible / ghost boats** | **Done** (`DSP-SCN-20260804-06`) |
| 8.7 | **2D map polish / chrome** | **Done** (`DSP-SCN-20260804-07`) — shared `mapChrome`; Unity CW/RCW PNGs deferred |
| 8.8 | **3D world polish** | **Done** (`DSP-SCN-20260804-08`) — buoys/gates + water cue; no Cesium |

**Exit (Milestone V1-A):** **Met (SCN scope)** — live boat + authored course/sponsors/S/F air-ready in preview; free cam; editor QoL; ghost modes; map chrome; mild 3D polish. Optional later: BillboardChain, landmarks, CW/RCW PNG sprites, position markers as WorldFeature + editor.

**Stream map vs NDI:** DOM PiP only for v1 — not burned into NDI (`HO-BW-OUT-20260804-01`).

---

### Phase 9 — Project LAN (was 6.5–6.7) *(DONE — Milestone V1-B)*

**Goal:** Multi-PC / venue without public cloud. Local `server/` stub + files OK.

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 9.1 | **Auth roles** (was 6.5) | PLT | **Done** `DSP-PLT-20260804-01` — editor vs air bearer |
| 9.2 | **Offline / venue pack** (was 6.6) | PLT | **Done** `DSP-PLT-20260804-02` — venue pack + IndexedDB |
| 9.3 | **Calib profiles on project** (was 6.7) | CAL+PLT | **Done** `DSP-CAL-20260804-01` — `calibration.byPovId` |

**Exit (Milestone V1-B):** **Met** — Save/load race + calib on LAN; venue pack offline; air role without Hetzner.

---

### Phase 10 — Cutover & console bridge *(10.1 done 2026-09-05; 10.2 future)*

**Handoff:** [`../agentic/dispatches/active/HO-BW-20260804-04-open-phase10-cutover.md`](../agentic/dispatches/active/HO-BW-20260804-04-open-phase10-cutover.md)

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 10.1 | **Parallel air vs Unity** (was **5.6**) | BW + human | **Done 2026-09-05** — operator retired Unity; broadcast-web is primary air |
| 10.2 | **Console deep-link ack** (was **3.6**) | CON | **SPA pack done** `DSP-CON-20260804-01`. **Future** — wait for console emit (operator 2026-09-05) |
| 10.3 | Studio NDI smoke checklist | OUT + human | **Done** `DSP-OUT-20260804-01` (Pass 2026-08-04; Studio Monitor + grandi) |

**Exit (Milestone V1-C):** **Met 2026-09-05** — broadcast-web is primary air (Unity retired). 10.2 console emit is later, not blocking air.

---

### Phase 11 — Unified ops sidebar & universal asset pipeline *(DONE — Milestone V1-D)*

**Design:** [`../architecture/unified-ops-sidebar.md`](../architecture/unified-ops-sidebar.md)

**Goal:** One collapsible left sidebar replaces scattered ops panels; 2D map is an authoring
surface; assets are listed/focusable/toggleable; universal asset library; NDI status tab.

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 11.1 | Sidebar shell + collapse for air | SCN | **Done** `DSP-SCN-20260811-01` |
| 11.2 | Buoy telemetry | TEL | **Done** `DSP-TEL-20260811-01` |
| 11.3 | Universal asset library | PLT | **Done** `DSP-PLT-20260811-01` |
| 11.4 | Project manager (rename/dup/archive + boat-id warn) | PLT | **Done** `DSP-PLT-20260811-02` |
| 11.5 | NDI controller tab | OUT | **Done** `DSP-OUT-20260811-01` (2nd map source stubbed) |
| 11.6 | 2D map authoring + buoy/billboardChain | SCN | **Done** `DSP-SCN-20260811-02` |
| 11.7 | Asset inspector | SCN | **Done** `DSP-SCN-20260811-03` |
| 11.8 | Revision history on packs | — | Optional, unscheduled |
| 11.9 | Misc UX from show notes | — | Optional, unscheduled |

**Exit (Milestone V1-D):** **Met (engineering)** — sidebar shell + Library/Project/Assets/NDI +
2D authoring + buoy/chain + soft visibility round-trip. Soft follow-ups: library catalogue content,
Save→Load smoke, multi-sender NDI bridge.

---

### Phase 12 — Cloud host *(deferred — not v1)*

Hetzner (or any) static SPA + WSS TLS + optional hosted `/api`.  
**Do not schedule workers for this until BW re-opens Phase 12.**  
Docs remain valid when needed: deploy / WSS / human checklist.

---

### Phase 13 — Multi-channel output (2D/3D/AR), realistic environment, NDI delay, AR calib overlay, local project saves
*(**Done** — all 13.1–13.8 accepted 2026-08-12)*

**Requested:** 2026-08-12 (user, with reference image for the 3D environment look).

**Design:** [`../architecture/multi-output-streaming.md`](../architecture/multi-output-streaming.md)
(channel model, multi-sender NDI bridge, delay buffer, switcher UI, resolution) ·
[`../architecture/realistic-3d-environment.md`](../architecture/realistic-3d-environment.md)
(sea + sky added to the existing 3D scene) ·
[`../architecture/ar-calibration-map-overlay.md`](../architecture/ar-calibration-map-overlay.md)
(coordinate overlay to visually compare AR against a real camera) ·
[`../architecture/project-api-and-database.md`](../architecture/project-api-and-database.md) §10
(local file save to `public/races/` from Electron, no server process).

**Goal:** Three always-on NDI outputs (2D map / 3D = same scene opaque + sea model / AR = today's
alpha plate) instead of today's single AR-only path, each independently delayable up to 30 s, with
a bigger local switcher, a manual calibration aid, and Save that writes straight into the repo's
existing `public/races/` project-saves folder instead of only downloading.

| # | Work | Owner | Dispatch / status |
| --- | --- | --- | --- |
| 13.1 | Multi-sender NDI bridge (`desktop/`) | OUT | `DSP-OUT-20260812-01` **accepted** |
| 13.2 | Sea/sky model on existing 3D scene | SCN | `DSP-SCN-20260812-01` **accepted** |
| 13.3 | 3D channel → own NDI sender | OUT | `DSP-OUT-20260812-02` **accepted** |
| 13.4 | 2D channel → own NDI sender | OUT | `DSP-OUT-20260812-03` **accepted** |
| 13.5 | Bigger 2D/3D/AR local switcher | OUT | `DSP-OUT-20260812-04` **accepted** |
| 13.6 | Per-channel NDI delay (0–30000 ms) | OUT | `DSP-OUT-20260812-05` **accepted** |
| 13.7 | AR calibration coordinate overlay | SCN | `DSP-SCN-20260812-02` **accepted** |
| 13.8 | Electron local file save + dropdown | PLT | `DSP-PLT-20260812-01` **accepted** |

**Optional polish (not blocking):** realistic water `tick` on 3D NDI while AR is transparent; typed
`outputDelayMs` in AppConfig; human studio smokes (vMix three sources + switcher + Save folder).

**BW locks (wave 1 / 3):** **1920×1080**; delay default **0**, max **30000**, buffer only if &gt;0,
warn &gt;3s; Electron saves → `public/races/` (dev) / `userData/races` (`--file`).

---

### Phase 14 — Geospatial terrain, real ocean, wind *(design — no dispatches yet)*

**Requested:** 2026-08-17 (user). "In Unity we used Cesium. It was a static model. Fine to use
Cesium 3D but we need waves, wind (with direction input) and a good looking sea model." Reference
image supplied; explicit brief: **"this is our bare minimum goal, we need something even better."**

**Design:**
[`../architecture/enu-frame-handedness.md`](../architecture/enu-frame-handedness.md) (prerequisite
frame fix) ·
[`../architecture/geospatial-terrain-cesium.md`](../architecture/geospatial-terrain-cesium.md)
(Cesium ion 3D Tiles in Three.js) ·
[`../architecture/ocean-waves-and-sea-state.md`](../architecture/ocean-waves-and-sea-state.md)
(Gerstner ocean, sea state) ·
[`../architecture/wind-data-and-vfx.md`](../architecture/wind-data-and-vfx.md) (wind sources +
visualisation).

**Goal:** replace the flat tinted pad + un-displaced `Water` plane with a real venue: streamed
Cesium ion terrain and imagery, an animated ocean whose swell follows a live wind vector, and wind
readouts/VFX — all inside the existing WebGL2 renderer and the existing three-channel NDI pipeline.

**BW locks (2026-08-17, user):** Cesium **ion** (World Terrain + aerial imagery), **not** Google
Photorealistic (attribution burn-in) · **WebGL2** renderer, no WebGPU migration · venue is
**online** · wave **direction follows wind = P0**, wave height/period = P1 *and droppable if
expensive* · wind source **undecided — build all three and test on site** · attribution shown on
the **3D channel + ops preview only, never on the AR plate**; broadcaster sign-off still required
before air · ion account/token **reused from the Unity project** (asset IDs pending) · **our ocean
renders on top of Cesium's baked water level** so the tileset's flat sea stays behind it (matches
`geospatial-terrain-cesium.md` §4) · 14.1 and 14.2 run **in parallel**.

**14.0 confirmed 2026-08-17:** the mirror is real, not theoretical — probe against the live
geodesy returned `East × North = −Y`, and no compensating negative scale exists anywhere in `src/`.

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 14.0 | **ENU handedness fix** | GEO + SCN | **Accepted** `done/DSP-GEO-20260817-01` |
| 14.1 | Cesium ion 3D Tiles terrain + imagery | SCN + GEO + PLT | **Accepted** `done/DSP-SCN-20260817-01` |
| 14.2a | Gerstner ocean (clipmap, whitecaps, glitter) | SCN | **Accepted** `done/DSP-SCN-20260817-02` |
| 14.2b | Wind coupling + sea-state presets | SCN | **Accepted** `done/DSP-SCN-20260817-03` (ramp + foam; no named UI) |
| 14.2c | Terrain↔ocean depth: shore foam, shallow tint | SCN | **Accepted** `done/DSP-SCN-20260817-04` |
| 14.2d/e | *(optional)* FFT cascade · boat wakes | SCN | Only if look-dev demands it |
| 14.3a | `windBus` + from/to convention helper + operator entry | TEL + SCN | **Accepted** `done/DSP-TEL-20260817-01` |
| 14.3b | Open-Meteo wind + marine provider | TEL | **Accepted** `done/DSP-TEL-20260817-02` |
| 14.3c | Anemometer telemetry channel | TEL | **Cancelled 2026-09-05** — operator: no hardware; Open-Meteo forecast is enough |
| 14.3d/e | 2D map wind readout · wind streaks in shader | SCN | **Accepted** `done/DSP-SCN-20260817-05` + `done/DSP-SCN-20260817-06` |
| 14.3f | *(optional)* 3D wind indicator, flags, spray | SCN | **Lite in 15.2** (vane + stronger streaks). Flags/spray still later. |

**Open decisions:** ion **asset IDs** from the Unity project (needed to finish 14.1, not to start
it) · broadcaster sign-off on the 3D-channel attribution line before air · Open-Meteo is the
**only** live wind source (14.3c anemometer **cancelled 2026-09-05**).

**Dispatch order (14):** 14.0 first and alone (`DSP-GEO-20260817-01`). Then 14.1 + 14.2a + 14.3a in
parallel. Engineering accepted 2026-08-17.

---

### Phase 15 — Studio 60, ocean polish, fleet authoring *(dispatches 2026-08-18)*

**Requested:** 2026-08-18 (user, after Phase 14 realistic sea). Ops preview too slow (goal **60 fps**); white clipmap seams; blown sea specular; wind VFX not readable; buoys need Unity CW/RCW dual-arrow rings; fleet hulls missing without telemetry; Save/Load drops custom boats back to demo names.

**BW locks:** 60 fps = **ops preview only** (rAF when visible). NDI AR stays ~30, NDI 3D stays ~10 — do not send 60 fps 3D NDI with terrain+ocean+`readPixels`. Dual clock, not `STUDIO_TICK_FPS = 60`. Glitter cut. Wind = stronger streaks + cheap 3D vane (no particles). Rounding per buoy `cw|ccw|none`. Embed `fleet.boats[]` in the pack; spawn hulls from planned GPS without telem.

| # | Work | Owner | Dispatch |
| --- | --- | --- | --- |
| 15.1 | Preview 60 via dual clock; NDI caps unchanged | OUT | **Accepted** `done/DSP-OUT-20260818-01` |
| 15.2 | Clipmap seams, cheaper/less glitter sea, readable 3D wind | SCN | **Accepted** `done/DSP-SCN-20260818-01` |
| 15.3 | Buoy CW/CCW spinning two-arrow ring | SCN | **Accepted** `done/DSP-SCN-20260818-02` |
| 15.4 | Static/movable hulls without telem; persist fleet in pack | SCN | **Accepted** `done/DSP-SCN-20260818-03` |

**Dispatch order:** all four in parallel; **accepted 2026-08-18**. Human Electron smoke still open.

---

### Phase 16 — Visual upgrade & ops QoL *(dispatches 2026-08-18 pm)*

**Requested:** 2026-08-18 (user, after Phase 15 smoke). Sea sparkle boils under camera motion; wind still not readable → wants **moving string VFX**; Cesium baked sea shows through (lift-Y idea dead) → terrain must render **land only**; buoy arrows must be **universal** by default (direction settable per buoy); billboards need SailGP-style **board/frame**; **procedural sailboat** with tintable sails; **category color palette**; nametag **leader line to mast top**; ops sidebar decluttered.

**Design:** [`../architecture/phase16-visual-upgrade.md`](../architecture/phase16-visual-upgrade.md)

**User locks:** wind strings on **ops + 3D only, never AR** · sailboat **procedural** (glTF later) · rounding default **CW when omitted** · ops layout grouping = BW call (two rails: setup left, broadcast right).

| # | Work | Owner | Dispatch |
| --- | --- | --- | --- |
| 16.1 | Sea shimmer AA + hide Cesium water (water mask / height discard) | SCN | **Accepted** `done/DSP-SCN-20260818-04` |
| 16.2 | Wind string/streamline VFX (ops+3D) | SCN | **Accepted** `done/DSP-SCN-20260818-05` |
| 16.3 | Procedural sailboat + category color palette + tag leader line | SCN | **Accepted** `done/DSP-SCN-20260818-06` |
| 16.4 | Sponsor billboard board/frame | SCN | **Accepted** `done/DSP-SCN-20260818-07` |
| 16.5 | Rounding arrows universal default | SCN | **Accepted** `done/DSP-SCN-20260818-08` |
| 16.6 | Ops two-rail layout (+ terrain water threshold row) | SCN | **Accepted** `done/DSP-SCN-20260818-09` |

**Dispatch order:** 16.1–16.5 ran in **parallel**, all accepted 2026-08-18. 16.6 followed as wave 2. **Phase 16 engineering complete** — final tree `npm test` **654 + 23**, `npm run build` green.

**Phase 16 follow-ups (not dispatched):** glTF sailboat re-export if the user supplies a model (`scripts/export-boat-glb.mjs`); sponsor `panelColor`/`frameColor` pickers in the inspector; human look-dev (orbit boil, wide-orbit water removal, sail camber, tag height vs drone framing).

---

### Phase 17 — AR video underlay + NTP-matched render *(dispatches 2026-08-26)*

**Requested:** 2026-08-26 (user, with `docs/architecture/ntp-matching.md` supplied by the producer side). Put the **drone SRT stream behind the AR scene** instead of the alpha background; switch the video source when the POV switches; and **match telemetry to the video frame's NTP time** so the overlay is rendered at the instant the frame was captured.

**Design:** [`../architecture/ar-video-underlay-ntp-sync.md`](../architecture/ar-video-underlay-ntp-sync.md) · **Contracts:** [`../architecture/ntp-matching.md`](../architecture/ntp-matching.md)

**The structural change:** the pose pipeline inverts from **push** (packet arrives → smooth toward it → render now) to **pull** (present a frame → resolve its PTS to NTP → sample telemetry at that instant → render). Everything else is plumbing around that.

**User locks:** alpha plate survives as a **mode** (`arBackground: 'alpha' | 'video'`, alpha remains default and fallback) · **DJI only — no GoPro** · SRT **caller** · **adaptive** presentation latency clamped 100–400 ms · **4** warm POVs · **H.264 + HEVC** · DJI per-AU frame anchors unconfirmed, so the ~1 Hz periodic fit is the primary path.

**BW decisions:** WHEP/WebRTC and MSE are **rejected** for this path — both destroy the MPEG-TS PTS the anchors key against; raw TS → **WebCodecs** is the only PTS-preserving route · compositing must be **in-WebGL** (the NDI pump reads an FBO and cannot see DOM `<video>`) · Electron main is a **dumb byte pipe**, all demux/decode in the renderer · `ntp-matching.md` §4.a's "reject after last anchor" is replaced by a sliding-window robust fit with bounded forward extrapolation, because the literal rule cannot present a live frame.

| # | Work | Owner | Dispatch |
| --- | --- | --- | --- |
| 17.1 | `PtsNtpMap` — PTS→NTP fit, wrap, extrapolation, health | TEL | **Accepted** `done/DSP-TEL-20260826-01` |
| 17.2 | NTP-keyed telemetry history + `sampleAt`; boat DR | TEL | **Accepted** `done/DSP-TEL-20260826-02` |
| 17.3 | SRT caller in Electron main → TS over IPC | OUT (+PLT) | **Accepted** `done/DSP-OUT-20260826-03` |
| 17.4 | In-WebGL background quad + `arBackground` mode | OUT | **Accepted** `done/DSP-OUT-20260826-04` |
| 17.5 | `syncTrimMs` per POV (uncalibrated producer bias) | CAL | **Accepted** `done/DSP-CAL-20260826-05` |
| 17.6 | TS demux (H.264/HEVC) + WebCodecs + presentation queue | OUT | **Accepted** `done/DSP-OUT-20260826-06` |
| 17.7 | Per-POV SRT config + sync-debug overlay | OUT | **Accepted** `done/DSP-OUT-20260826-07` |
| 17.8 | Matched-time render cutover + POV stream switch | TEL+SCN | **Accepted** `done/DSP-TEL-20260826-08` |

**Dispatch order:** 17.1–17.8 **accepted 2026-08-26**. Phase 17 engineering complete. Human: live SRT + `syncTrimMs` clapper; FOV (C6) still a separate CAL track.

**Known limits, not bugs to chase:** producer bias knobs ship at 0, so a constant per-camera offset remains — hence `syncTrimMs` · boat GPS is ~2 Hz with ~6 s holes when still · timing alone will not align the overlay if FOV/distortion are wrong (DJI reports 84°, our default is 66.8832°) — separate CAL track, expected to surface at first smoke.

**Open inputs:** a real SRT endpoint or a recorded `.ts` + `stream_anchor` capture (blocks wave 2 acceptance); the SRT URL scheme and who operates it; whether the studio PC can hardware-decode HEVC.

---

### Phase 18 — Studio air-readiness (operator notes 2026-08-29) *(wave 1 accepted 2026-08-29; waves 2–4 open)*

**Requested:** 2026-08-29 (operator, ten notes after a live studio session; three marked ★ important). Everything here is "the studio works, now make it broadcastable". No new architecture — this phase is defect + fidelity work against the shipped Phase 17 studio.

**Evidence gathered by BW before writing this phase** (read-only code trace, no `src/` edits):

- **Colour** — the renderer never sets `outputColorSpace`, and the AR/3D NDI render targets are created bare (`new WebGLRenderTarget(w, h, { depthBuffer, stencilBuffer })` in `ndiFramePump.ts` / `ndi3dChannelPump.ts`). On three `^0.178.0` the canvas gets sRGB output encoding but a render target whose `texture.colorSpace` is unset stays **linear**, so `readPixels` hands NDI linear-light bytes that OBS then shows as sRGB. That is exactly a "too dark, colours wrong" picture. The 2D channel grabs a 2D canvas instead, so it should look *correct* — that asymmetry is the confirming test.
- **FPS** — the tick is already 60 Hz with an 8 ms AR/3D stagger and a 30 fps cap per channel, so the design already asks for 30/30/30. Two separate defects stop it arriving, both found by reading the code:

  **(a) The rate gate is phase-locked to a knife edge.** Each pump refuses to capture unless a full `1000/30 = 33.333 ms` has elapsed (`ndiFramePump.ts:297`, `ndi3dChannelPump.ts:206`, `streamMapNdiPump.ts:247,279`), and `lastCaptureMs` is stamped with an observed `performance.now()`. Two ticks of a 60 Hz clock is *exactly* 33.333 ms, so any negative jitter in the `setInterval`-over-IPC tick fails the comparison and the pump waits for the **third** tick instead. The achievable rate is therefore quantised: every second tick is 30 fps, every third is 20, every fourth is 15. Nothing in between exists. An alternation between the second and third tick averages about 24, and adding real overruns lands squarely on the observed ~18. This defect alone can hold the system at 20 no matter how cheap the frames get.

  **(b) The per-pixel conversion cannot sustain 90 frames/s.** `rgbaToBgra` (`desktop/ndiSender.cjs:98–112`, called at :242) is a scalar JS loop doing four byte reads and four byte writes per pixel, walking rows in reverse for the AR/3D vertical flip. Three channels at 30 fps is **~187 million pixels/s** through that loop, on the Electron main thread, which is simultaneously deserializing ~750 MB/s of frame data. That is between a large fraction of a core and more than a core, continuously. Correction to an earlier note: `Buffer.from` at :231–234 makes a **view, not a copy**, on both branches — the real costs are the renderer-side `slice`, the IPC clone, and this loop, and the loop dominates because it is per-pixel work rather than bulk memory movement.

  **The likely one-line escape:** the NDI SDK supports RGBA and RGBX video formats natively. If the `grandi` binding exposes them (`Object.keys(grandi.FourCC)` answers it), the conversion is deleted outright and readback bytes go straight to the sender. Otherwise the swizzle moves to a shader, which costs the GPU nothing at 8% utilisation.

  **Also found:** the drop-when-busy at `ndiSender.cjs:224` is not laziness — it protects the single reusable `bgraScratch` Buffer from being overwritten while the asynchronous native send is still reading it. Any queue must come with a buffer pool or it will corrupt frames.
- **Fleet** — `parseRaceProject` runs `normalizeBoatIds`, which filters to band **21–52** and substitutes `['21','22','23','24']` whenever the result is empty. That fires on both save and load, so an empty or out-of-band fleet cannot round-trip; the untracked `public/races/test/project.json` already shows `boats[]` for ids `"1"`/`"2"` alongside `boatIds: ["21".."24"]`.
- **Flow panel** — `buildFlowCards` unions the live fleet registry with every id ever seen in `flowTap`, and `flowTap.reset()` is only ever called from tests. Deleting a drone removes it from the registry but not from the tap, so its card survives.
- **Connections** — there is **no** Disconnect control anywhere. Connect live / Reconnect do a real stop-then-start (`ingest.stop()` closes sockets and cancels backoff), Connect SRT does `close('all')` then reopen (real ffmpeg kill), but the Live/Vid checkboxes close nothing, and renderer unload never closes SRT.
- **Sponsors** — `createSponsorBillboard` builds basis `(along, up, normal)` and sits at `y = heightM/2`: an upright wall. `createLineSignMesh` (start/finish) builds `(along, across, up)` at `y = 0.08`: flat on the water. The operator's ask is to move sponsors onto the second pattern; no schema field for flat-vs-upright exists.

| # | Work | Owner | Priority |
| --- | --- | --- | --- |
| 18.1 | **NDI colour parity** — AR/3D FBO output colour space so NDI matches preview | OUT | ★ P0 — **code accepted 2026-08-29**; OBS smoke open |
| 18.2 | **Per-stage tick instrumentation** — prove where the missing 12 fps goes before optimising | PRF | ★ P0 — **instrument + dump accepted 2026-08-30**. Walls: `*EnqueueIpc` 22 ms, `2dGrab` 160 ms. Clock ~50 Hz under load. |
| 18.3 | **NDI send path cost removal** (`desktop/` only) — drop the per-pixel conversion, pool the scratch buffers, queue instead of drop | OUT + PLT | ★ P0 — **accepted 2026-08-30**; native RGBA. Live `main … bgra` dump still open |
| 18.11 | **Independent per-channel clocks** (`src/output/` only) — defer 8 MB IPC off the tick, drop `slice`, retire stagger, fix the rate gate | OUT | ★ P0 — **accepted 2026-08-30** in code; live Send dump open |
| 18.13 | **2D native-size grab** — stop `getImageData(1920×1080)` after upscaling the 520 map; blit into a pooled 1080p buffer | OUT | ★ P0 — **accepted 2026-08-30** in code; live `2dGrab` dump open |
| 18.12 | **GPU colour-order swizzle** | OUT | ★ — **cancelled 2026-08-30**; `grandi` has RGBA |
| 18.14 | **GPU Y-flip on AR/3D capture** — grandi rejects negative stride; native RGBA no longer row-reverses | OUT | ★ P0 — **accepted 2026-08-30**; OBS orientation smoke open |
| 18.4 | **Project fleet fidelity** — save the fleet that exists, load only the fleet in the file, no default injection | SCN | ★ P0 — **accepted 2026-08-29** |
| 18.5 | **Connection lifecycle** — Connect / Disconnect / Reconnect that really open and close telemetry and SRT | TEL + SRT | P1 — **both halves accepted 2026-08-29**; Electron smoke open |
| 18.6 | **Flow panel shows only live assets** — reset/prune `flowTap` on fleet and project change | TEL + SCN | P1 — **accepted 2026-08-29** |
| 18.7 | **Sponsor boards flat on the sea** — share the start/finish placement instead of the upright wall | SCN | P1 — **accepted 2026-08-29**; free-cam smoke open |
| 18.8 | **Remove the timecode / qlock burn-in** | OUT | P2 — **moved to Phase 19.1** (`DSP-OUT-20260829-03`) |
| 18.9 | **Remove the PiP minimap** — keep 2D NDI, fill 16:9 | SCN | P2 — **moved to Phase 19.2** (`DSP-SCN-20260829-03`) |
| ~~18.10~~ | ~~2D map portrait 1080×1920~~ — **cancelled**; 2D stays 1920×1080. On-air 2D UI polish is **Phase 19.2b**. | — | — |

**Operator locks 2026-08-29 (answers to BW's scoping questions):**

- **FPS** — all three channels stay on, together, **never below 30**, read off the ops **Broadcast → Output** rail. Measured at ~18 with all three on. Dropping or downrating a channel is not an acceptable answer.
- **FPS, amended 2026-08-29 (operator):** "dont slice anything, all of them have min 30 fps independent from each other." The AR/3D stagger is therefore to be **retired**, not tuned — each channel runs its own clock. BW accepts this: the stagger was a mitigation from when readback was synchronous, and with the PBO path a second 1080p render in the same tick is mostly GPU command submission while the GPU sits at 8%.
- **Readout caveat (BW):** `createSendFpsCounter` returns the count of sends in a trailing 1000 ms window (`perfCounters.ts:42–45`). A perfect 33.333 ms cadence produces exactly 30 per second, so window boundaries will occasionally show **29** on a healthy system. Because the operator's requirement is literally "never below 30 on the panel", the pumps must target slightly above 30 — about **32** — while still declaring `frameRateN/D = 30/1` to NDI. Otherwise a correct system will look broken.
- **Colour** — confirmed: the 2D NDI source is correctly exposed in OBS while AR and 3D are dark. That asymmetry matches the render-target diagnosis exactly, since 2D never goes through a WebGL FBO.
- **Fleet** — "if project have boats on save inject them dont inject any other boat." Any boat id is legal, an empty fleet is legal, and no default fleet may ever be injected during a project load.
- **Removals** — "delete ui elements but keep code maybe we use them later." Both the timecode burn-in and the PiP minimap come out of the UI; their modules and tests stay in the repo.
- **2D resolution** — 1920×1080, not portrait. The earlier 1080×1920 note was a mistake.
- **Sponsors** — `sponsor` features go flat on the sea; **`billboardChain` stays upright**. BW's call on the schema: `heightM` becomes the board's depth across the water, matching the start/finish band, with the default of 8 kept.
- **Disconnect** — separate Disconnect controls for telemetry and for SRT, each beside its own Connect. No master kill.

**Wave plan — file ownership is disjoint inside each wave, so everything in a wave runs in parallel:**

| Wave | Dispatches | Files each one owns |
| --- | --- | --- |
| ~~**1**~~ | ~~`OUT-01` colour · `SCN-01` fleet · `SCN-02` sponsors · `TEL-01` telemetry disconnect~~ — **accepted 2026-08-29**, BW verified merged tree `npm test` **950 + 23** + build green | capture-target creation · `src/projects/*` · `src/scene/sponsors/*` · `fleetLivePanel.ts` + `liveSource.ts` |
| ~~**2**~~ | ~~`PRF-01` instrumentation · `TEL-02` flow panel · `SRT-01` SRT disconnect~~ — **accepted 2026-08-29**, BW verified merged tree `npm test` **982 + 23** + build green | every pump + sender (call sites) · `flowTap.ts` + `flowPanel.ts` · `fleetLivePanel.ts` SRT half + `desktop/srtReader.cjs` — **plus three region-locked slices of `src/main.ts`** |
| **3** | `OUT-04` clocks + defer IPC · `OUT-20260830-01` 2D native grab · `OUT-02` send path — **released 2026-08-30** after the dump recut | pumps / stagger · `ndi2dAsyncCapture` + worker · **`desktop/` only** |
| **4** | `OUT-03` timecode · `SCN-03` PiP — **moved to Phase 19** (19.1 / 19.2). `OUT-05` cancelled. | — |

**Wave 1 accepted 2026-08-29.** BW verified the merged tree rather than the worker reports: `npm test` **950 + 23**, `npm run build` green. Two of the three ★ items are closed in code — colour parity (18.1) and fleet fidelity (18.4) — plus sponsors (18.7) and the telemetry half of the connection lifecycle (18.5). The ★ fps track is untouched and is now the whole of waves 2 and 3. `src/config/loadConfig.ts` was deliberately **not** modified, so `normalizeBoatIds` keeps its behaviour for config and mock exactly as the operator locked it.

**Wave-1 process finding, recorded so it stops recurring:** a worker reported a "pre-existing flake" in `src/telemetry/live.test.ts`; BW re-ran that file six times at merged HEAD and got 22/22 every time. The tests are deterministic (fake timers). It was a mid-merge artefact — the third time a parallel wave has generated a false red. **A red result from a worker mid-wave is not evidence until it reproduces at merged HEAD.**

**Wave 2 accepted 2026-08-29.** BW verified the merged tree: `npm test` **982 + 23**, build green, and all three workers' new test files confirmed present and passing rather than inferred from the total. Everything in Phase 18 outside the fps track is now closed in code: 18.5 (both Disconnect halves), 18.6 (Flow panel), and the 18.2 instrument. **The `src/main.ts` region locks held with zero conflicts** — that is now the standing approach for shared hub files: region-lock the wave rather than serialising it.

**Wave 3 released 2026-08-30.** The dump falsified the original two-defect story as the cause of 15/3 fps. Clock collapsed to ~50 Hz because the renderer blocks on `*EnqueueIpc` (17–23 ms, inside the tick) and `2dGrab` (120–193 ms, 1080p `getImageData` after a 520 upscale). `rgbaToBgra` is 7 ms with `dropBusy=0` — keep deleting it so 30×3 does not immediately lose on main. Phase-lock is a smear, not a 2-vs-3 split. New `DSP-OUT-20260830-01` owns the 2D grab; `OUT-04` must report if enqueue is still >12 ms after slice-kill + defer (that is the 4:2:2 gate).

**Third fps defect, added to `OUT-04` after PRF-01 (BW-verified):** `tryClaimNdiHeavyCapture` commits the stagger claim *before* the pump knows a readback slot is free. AR then renders a full 1080p pass and only afterwards calls `readback.begin`; on PBO-pool exhaustion it returns without releasing the claim, so one failure costs a wasted render **and** 3D's capture on the same tick. Retiring the stagger removes the AR-blocks-3D half but not the wasted render.

**Why `PRF-01` lands before the fps fixes, revised:** not because the cause is unknown — reading the code has now identified both defects specifically. It goes first because its instrumentation call sites touch every pump *and* the sender, so it would collide with both wave-3 dispatches. Landing it first also means wave 3 can prove it hit 30 rather than assert it.

**Why wave 3 still parallelises:** three file sets, no overlap. `OUT-02` is `desktop/` only. `OUT-04` is the FBO pumps + stagger + readback + `streamMapNdiPump` tick/gate. `OUT-20260830-01` is `ndi2dAsyncCapture.ts` + worker only. `OUT-02` still reports the `grandi.FourCC` probe early so `OUT-05` can be cancelled or started.

**Dispatches issued 2026-08-29** into `docs/agentic/dispatches/active/`: `DSP-OUT-20260829-01` colour · `DSP-PRF-20260829-01` instrumentation · `DSP-OUT-20260829-02` NDI send path · `DSP-OUT-20260829-04` independent channel clocks · `DSP-OUT-20260829-05` GPU swizzle (conditional) · `DSP-SCN-20260829-01` fleet · `DSP-SCN-20260829-02` sponsors · `DSP-TEL-20260829-01` telemetry disconnect · `DSP-SRT-20260829-01` SRT disconnect · `DSP-TEL-20260829-02` Flow panel · `DSP-OUT-20260829-03` timecode · `DSP-SCN-20260829-03` PiP.

---

### Phase 19 — Senexus studio QoL *(SCN Human Pass 2026-09-05; next OUT)*

**SCN:** 19.2 / 19.2b / 19.17 **Human Pass** (`HO-SCN-BW-20260905-01`). SCN **idle** — no further Phase 19 dispatch unless look-dev reopens. **No MapTiler.**  
**Next orchestrator: OUT** — NDI fps / 19.3 live proof still in `docs/agentic/memos/BW_MEMO.md`. Handoff: [`../agentic/handoffs/HO-BW-OUT-20260905-01.md`](../agentic/handoffs/HO-BW-OUT-20260905-01.md).  
**GEO 19.18** parked until Q5.  
**Handoff / briefs:** [`../agentic/briefs/phase19/`](../agentic/briefs/phase19/) · design [`../architecture/phase19-senexus-qol.md`](../architecture/phase19-senexus-qol.md)

**Requested:** 2026-09-01 (operator notes `senexus.md` + BW Q&A). Studio is on-air capable; this phase is **ops QoL + one P0 picture bug** (3D NDI stripes). Not a new render pipeline.

**Design:** [`../architecture/phase19-senexus-qol.md`](../architecture/phase19-senexus-qol.md)  
**Briefs (one file per orchestrator):** [`../agentic/briefs/phase19/`](../agentic/briefs/phase19/)

**BW locks:** 2D **1920×1080 16:9** · hide barcode keep code · no PiP · yaw/pitch/**roll ±200** · NDI toggles **not** in project JSON · billboard default `#2A6FA6` + fair-interleave weights · boat 3D-off **keeps tags** · 2D map **unaffected** by ghost/hidden · Library seeded from in-repo sponsor PNGs and **git-tracked** · terrain **vendor parked (Q5)** · start/finish **uniform ×2**.

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 19.1 | Hide timecode barcode; keep modules | OUT | **Done** (`DSP-OUT-20260829-03`; smoke Pass) |
| 19.2 | PiP off; 16:9 2D source; local 2D stays | SCN | **Human Pass** (`DSP-SCN-20260829-03`) |
| 19.2b | On-air 2D UI polish | SCN | **Human Pass 2026-09-05** (`DSP-SCN-20260905-02`) |
| 19.3 | 3D NDI green/purple stripes | OUT | **Done** OBS Pass 2026-09-02. HUD live proof 2026-09-05. **30×3 wait for operator call** |
| 19.4 | Hand on/off AR/3D/2D NDI | OUT | **Done** `DSP-OUT-20260901-02` (smoke optional with PBO) |
| 19.5 | Calib yaw/pitch/roll ±200 | CAL | **Done** `DSP-CAL-20260901-01` |
| 19.6 | World Authoring header toggle; no Close | SCN | **Done** `DSP-SCN-20260901-01` |
| 19.7 | Authoring inspector + lat/lon Add/Edit; instant Assets | SCN | **Human Pass** `DSP-SCN-20260902-04` |
| 19.8 | Tags stay when 3D off; ghost persist leak | SCN | **Human Pass** `DSP-SCN-20260902-05` |
| 19.9 | Save/Load status under buttons | SCN | **Done** `DSP-SCN-20260901-02` |
| 19.10 | Start + finish band ×2 | SCN | **Done** `DSP-SCN-20260901-03` |
| 19.11 | Billboard plate, weights, height vertical, library picker | SCN | **Human Pass** `DSP-SCN-20260902-03` + `20260903-02` |
| 19.12 | OSM zoom/coverage | SCN | **Human Pass** `DSP-SCN-20260902-06` |
| 19.13 | Boat foam wakes | SCN | **Human Pass** `DSP-SCN-20260903-03` |
| 19.14 | Billboard vanish (investigate) | SCN | **Closed 2026-09-05** — no second repro. Reopen only on a new live case |
| 19.15 | Sea over assets (not new globe) | SCN | **Closed 2026-09-05** — flat-sea + texture Pass (`04-08`). Holes/Gerstner punch **cancelled**. **Not MapTiler.** |
| 19.16 | Seed library + git-trackable uploads | PLT | **Done** `DSP-PLT-20260901-01` |
| 19.17 | Instant project switch (UI+2D+list) | PLT+SCN | **Human Pass 2026-09-05** (`DSP-SCN-20260905-03`; PLT investigate `DSP-PLT-20260905-01`) |
| 19.18 | Terrain provider options | GEO | **Superseded by 20.1** — OSM Buildings + heroes; not MapTiler; IBB parked |

**Human open order:** No Phase 19 worker. Next is **Phase 20 SCN**. NDI 30×3 **closed**.

**Exit:** Notes inventory in the design doc §2 all done or parked (19.18 → 20.1). 14.3c cancelled. 19.14 / 19.15 closed 2026-09-05.

---

### Phase 20 — City 3D (OSM Buildings + heroes) *(NEXT — SCN)*

**Design:** [`../architecture/3d-environment-buildings.md`](../architecture/3d-environment-buildings.md)  
**Brief:** [`../agentic/briefs/phase20/SCN_PHASE20.md`](../agentic/briefs/phase20/SCN_PHASE20.md)  
**Handoff:** [`../agentic/handoffs/HO-BW-SCN-20260907-01.md`](../agentic/handoffs/HO-BW-SCN-20260907-01.md)

Keep Cesium World Terrain. Add Cesium **OSM Buildings** (ion 96188) as the 3D city tileset. Add **hero historic glTF** (CC first). Clip OSM under heroes. Never on AR plate. IBB mail waiting (`3d-environment-buildings.md` §3.2). DIY survey closed. Google Photorealistic off air.

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 20.1a | OSM Buildings tileset | SCN | Second `TilesRenderer`, same origin, lock-tiles, credits on 3D+Ops |
| 20.1b | Hero glTF + OSM hole | SCN (+ GEO if ENU wrong) | Short CC pack OK |
| 20.1c | Ops on/off + attribution | SCN | Never burn credits into AR |

**Exit:** Human Pass on 3D — city massing visible, a few landmarks recognizable if heroes shipped, AR still clean. **Then operator opens BW** for Phase 21. SCN must not start 21 or 22.

---

### Phase 21 — Cinematic sequences / intro video *(OPEN — GEO then SCN then OUT)*

**Design:** [`../architecture/commercial-video.md`](../architecture/commercial-video.md) **Locked 2026-09-08.**  
**Briefs:** [`../agentic/briefs/phase21/README.md`](../agentic/briefs/phase21/README.md)

Silent **1080p30 MP4**. vMix plays it; app waits. Globe + ENU, cloud seam. Aerial + OSM + human glTF (three bridges). No race chrome, no audio, no credits. Rumeli Hisarı not in this clip.

| # | Work | Owner | DSP |
| --- | --- | --- | --- |
| 21.0 | ECEF / globe keyframes | GEO | `DSP-GEO-20260908-01` |
| 21.1 | Player + hide-race + cloud | SCN | `DSP-SCN-20260908-01` |
| 21.2 | `intro-bosphorus.json` | SCN | `DSP-SCN-20260908-02` **code-complete** |
| 21.2b | Country pins + continuous globe | SCN | `DSP-SCN-20260908-06` |
| 21.2c | Intro Human Pass (west/east, HD, ENU seams) | SCN | `DSP-SCN-20260909-01` **code-complete** |
| 21.3a | Tile cache dir (not git) | PLT | `DSP-PLT-20260908-01` |
| 21.3b | Prefetch + lock-tiles | SCN | `DSP-SCN-20260908-07` **code-complete** |
| 21.4 | Silent MP4 | OUT | `DSP-OUT-20260908-01` **code-complete** |

**Exit:** Operator accepts the MP4 **and** can swap JSON for a later video. Phase 22 local SRT is **open in parallel** (does not wait on Record Pass).

---

### Phase 22 — SRT AR + 3D + 2D out; NDI parked *(OPEN — local first)*

**Design:** [`../architecture/srt-egress.md`](../architecture/srt-egress.md) · [`../architecture/srt-program-cameras.md`](../architecture/srt-program-cameras.md)  
**Briefs:** [`../agentic/briefs/phase22/README.md`](../agentic/briefs/phase22/README.md)

Three SRT **caller** publishes at once; per-channel stop. ffmpeg children + GPU encode; **not** NDI UYVY IPC. NDI **code kept**, UI **hidden**. **OBS 3D picture Pass 2026-09-15.** 22.4 workers **code-complete**; Human Pass **E–I + A** open. VPS/relay **after** fps Pass.

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 22.1 | Three program surfaces + ffmpeg SRT to `127.0.0.1` | SRT + OUT + PLT | `DSP-SRT-20260909-01` **code-complete**. Human **A** still fps; **B** 3D look **Pass 2026-09-15** |
| 22.2 | Hide NDI Send UI | OUT (in 22.1 DSP) | Defaults already off; do not delete pumps |
| 22.1b | LAN: one other PC listens | Human | Task **C** in `srt-human-pass.md` |
| 22.4a | AR plate **1920×1080** (no 2K crop) | OUT | `DSP-OUT-20260915-01` **code-complete** — Human **E** |
| 22.4b | AR look: no terrain/sea/heroes; freeze until telemetry | SCN | `DSP-SCN-20260915-01` **code-complete** — Human **F** |
| 22.4c | Per-channel visibility + bottom bar layers | SCN | `DSP-SCN-20260915-02` **code-complete** — Human **G** |
| 22.4d | 3D **program rig** + Control 3D program | SCN | `DSP-SCN-20260915-03` **code-complete** — Human **H** |
| 22.4e | 2D program cam (centroid / boat / offsets) | SCN | `DSP-SCN-20260915-04` **code-complete** — Human **I** |
| 22.4f | OBS **~30/30/30** (16×3 Fail) | PRF | `DSP-PRF-20260915-01` **code-complete** — Human **A**. **Do not** change `STUDIO_TICK_FPS` |
| 22.3 | Relay URLs | SRT + PLT | **Wait** — after 30×3 Pass, operator gives VPS |

**Local exit:** Human **A** fps + AR/2D picture per `srt-program-cameras.md`. **3D look already Pass.**  
**LAN exit:** Human **C**. Fan-out / VPS only after fps Pass.

---

## Air / output priority (updated 2026-09-09)

Phase 22 execute: **SRT AR/3D/2D is air** (local OBS first). NDI stays in the binary, UI hidden.

1. **Electron SRT program out ×3** — Phase **22** (local OBS now; LAN / VPS later)
2. **Electron + composited AR over drone SRT** — Phase 17 **ingest**
3. **Chroma + window capture** — fallback
4. **WHEP underlay** — preview / CV only
5. **NDI** — parked after 22 (code remains)

---

## Completed history (Phases 0–7) — summary

Do not re-open unless a regression. Details live in `docs/agentic/dispatches/done/` and older roadmap revisions in git.

| Phase | Exit | Status |
| --- | --- | --- |
| **0** Foundations | Empty Three + agentic pack | **Done** |
| **1** Spine | Mock TEL → ENU → boat + drone cam | **Done** (Milestone A) |
| **2** Race content | Fleet, course, POV, sponsors, flags, names | **Done** (Milestone B) |
| **3** Output & ops | preview/chroma, timecode, WHEP, HUD | **Done** (Milestone C); **3.6** moved → Phase 10.2 |
| **4** Authoring core | Map editor, shared features, GeoJSON | **Core done**; leftovers → **Phase 8** |
| **5** Deploy & air path design | Runbooks, NDI eval, egress E0 | **Docs/spikes done**; Hetzner human → **Phase 12**; **5.6** → Phase 10.1 |
| **6** Race projects | Schema, Save/Save as/Load, API stub | **Done through 6.4 stub**; **6.5–6.7** → **Phase 9** |
| **7** NDI optimum | Electron + alpha NDI + active-POV lock | **Done** (Milestone G code path) |
| **8** Visual & authoring QoL | Editor, colours, stream map, Unity slice, ghost, map chrome, 3D polish | **Done** (Milestone V1-A SCN) |

### Ops polish landed 2026-08-03/04 (folded into product)

- Live `type=client&subscribe=<id>`, socket hygiene, free cam, Frame boats, world-anchor UI, NDI dual-render, Save as/Load  

---

## Capability map (forward)

| Focus | Phase |
| --- | --- |
| Auth, offline pack, calib-on-project | **9** *(done)* |
| Unity cutover + console deep-link | **10** *(10.1 Unity retired 2026-09-05; 10.2 future)* |
| Unified ops sidebar / asset pipeline | **11** *(done — V1-D)* |
| Public host / WSS TLS | **12** (deferred) |
| Multi-channel output (2D/3D/AR), NDI delay, AR calib overlay | **13** *(done)* |
| Cesium terrain, real ocean + waves, wind data & VFX | **14** *(engineering done; 14.3c cancelled — Open-Meteo only)* |
| Studio 60, ocean polish, fleet authoring | **15** *(done)* |
| Visual upgrade & two-rail ops | **16** *(done)* |
| AR SRT underlay + NTP match | **17** *(engineering done)* |
| Studio air-readiness (NDI colour/fps/fleet) | **18** *(waves 1–3 in code; 30×3 **closed**)* |
| Senexus QoL (authoring, NDI stripes, library) | **19** *(notes Pass; 19.18 → **20.1**)* |
| OSM city + hero landmarks | **20** *(code-complete)* |
| Commercial video | **21** *(code-complete; Record Pass optional parallel)* |
| SRT AR+3D+2D out; NDI hidden | **22** *(OPEN — local OBS 30×3 first; VPS later)* |
