# Phases Roadmap — broadcast-web

**Owner:** BW  
**Updated:** 2026-08-28  
**Design:** [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) · air: [`../ops/air-runbook.md`](../ops/air-runbook.md)

---

## Strategy lock (v1) — 2026-08-04

| Decision | Lock |
| --- | --- |
| **First version venue** | **Local studio** — Electron + Vite + VPS telemetry (`ws://…`). No cloud host required for v1. |
| **Hetzner / public SPA / WSS TLS** | **Deferred** — months later, optional; may never ship if local+LAN is enough. Checklist kept as archive: [`../ops/human-hetzner-wss-checklist.md`](../ops/human-hetzner-wss-checklist.md). |
| **Preferred air** | Electron **alpha NDI** (chroma = fallback). |
| **Frame budgets** | **PRF** — ops preview ~60 rAF (≥30); NDI AR/3D/2D **30/30/30** always-on (`DSP-OUT-20260828-02`). PBO readback (`DSP-OUT-20260828-01`). Never `STUDIO_TICK_FPS = 60`. [`../architecture/performance-budgets.md`](../architecture/performance-budgets.md) |
| **SRT ingest** | **SRT** — Electron caller, catalog cams 1–27, HEVC decode / ffmpeg fallback. [`BOOTSTRAP_SRT.md`](../agentic/dispatches/BOOTSTRAP_SRT.md) |
| **App egress (WebRTC/SRT)** | Deferred (E0) — compositor program-out if remote needed. |
| **v1 focus** | **Visual parity + ops QoL** (assets, maps, tags, editor), then LAN project features, then Unity cutover. |

### Current pointer

**Active engineering:** hitch + PTS (OUT-04, OUT-05, SRT-01).  
**Active human:** after those workers, re-paste fps/hitch/Send and Sync PTS→NTP.

**Active:** **Phase 10.1** (Unity vs broadcast-web parallel air — human + BW) is the only remaining
open gate.  
**Done:** Phase 11 core (**V1-D**) + follow-up authoring workspace / calib+output into sidebar +
follow-up #2 (Close bug fix, resizable map/sidebar, Enter/Delete/drag editing, distinct
viewer-facing stream map) + follow-up #3 (P0 `window.prompt()` throws unconditionally in Electron,
breaking billboard chain, boat/drone/buoy placement, Save as, Rename, Duplicate — fixed by shared
`promptModal()` DOM utility, `DSP-SCN-20260811-07` + `DSP-PLT-20260811-03`, accepted 2026-08-12
after BW drove the real Electron renderer end-to-end) all accepted. See
`docs/architecture/world-authoring-workspace.md`. Phase 12 cloud still deferred.  
**Active:** human **Phase 10.1** (Unity vs broadcast-web parallel air).  
**Done:** Phase 11 (**V1-D**) + follow-ups; **Phase 13 complete** (13.1–13.8). Phase 12 deferred.  
**Next up:** Human **Phase 15 + 16 look-dev smoke** (preview ~60, sea AA under orbit, Cesium water gone, wind strings, sailboats + palette + tag leaders, sponsor boards, rounding rings, two-rail ops) then **10.1** cutover. Ion-token smoke, CAL yaw, Open-Meteo commercial key still open.

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

### Phase 10 — Cutover & console bridge *(ACTIVE)*

**Handoff:** [`../agentic/dispatches/active/HO-BW-20260804-04-open-phase10-cutover.md`](../agentic/dispatches/active/HO-BW-20260804-04-open-phase10-cutover.md)

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 10.1 | **Parallel air vs Unity** (was **5.6**) | BW + human | Dress/show criteria; Unity retire only on explicit OK |
| 10.2 | **Console deep-link ack** (was **3.6**) | CON | **SPA pack done** `DSP-CON-20260804-01` → `done/`; **pending console emit ack** |
| 10.3 | Studio NDI smoke checklist | OUT + human | **Done** `DSP-OUT-20260804-01` (Pass 2026-08-04; Studio Monitor + grandi) |

**Exit (Milestone V1-C):** Can run a show on broadcast-web as primary (or documented dual-path).

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
| 14.3c | Anemometer telemetry channel | TEL | Not issued — needs on-site hardware |
| 14.3d/e | 2D map wind readout · wind streaks in shader | SCN | **Accepted** `done/DSP-SCN-20260817-05` + `done/DSP-SCN-20260817-06` |
| 14.3f | *(optional)* 3D wind indicator, flags, spray | SCN | **Lite in 15.2** (vane + stronger streaks). Flags/spray still later. |

**Open decisions:** ion **asset IDs** from the Unity project (needed to finish 14.1, not to start
it) · broadcaster sign-off on the 3D-channel attribution line before air · Open-Meteo commercial
key before air (14.3b works on the free tier during development).

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

## Air / output priority (updated 2026-08-26)

1. **Electron + alpha NDI** — preferred studio air (`arBackground: 'alpha'`, unchanged default)
2. **Electron + composited AR over drone SRT** — Phase 17 (`arBackground: 'video'`); opaque program on the AR channel
3. **Chroma + window capture** — fallback
4. **WHEP underlay** — preview / CV only (cannot carry PTS; not a Phase 17 path)
5. **App WebRTC/SRT *egress*** — still deferred (use compositor out). Phase 17 is **ingest**; `egress-webrtc-srt-evaluation.md` E0 does not apply to it.

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
| Unity cutover + console deep-link | **10** *(active: 10.1 human)* |
| Unified ops sidebar / asset pipeline | **11** *(done — V1-D)* |
| Public host / WSS TLS | **12** (deferred) |
| Multi-channel output (2D/3D/AR), NDI delay, AR calib overlay | **13** *(done)* |
| Cesium terrain, real ocean + waves, wind data & VFX | **14** *(engineering done; 14.3c not issued)* |
