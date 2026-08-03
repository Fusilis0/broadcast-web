# Phases Roadmap — broadcast-web

**Owner:** BW  
**Update memos when a phase gate passes.**  
**Design addendum (2026-07-29):** race projects, shared 3D/2D features, map editor, DB load, NDI optimum — see [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md).

---

## Phase 0 — Foundations (docs + scaffold)

**Goal:** Repo structure, agentic system, runnable empty Three canvas.

| # | Work | Owner | Gate |
| --- | --- | --- | --- |
| 0.1 | Agentic docs + rules (this pack) | BW | **Done** |
| 0.2 | Local git; private GitHub `Fusilis0/broadcast-web` | PLT / human / BW | **Done** (2026-07-22) |
| 0.3 | Vite + TS + Three scaffold | PLT → worker | **Done** (`npm run dev` OK) |
| 0.4 | Folder layout per architecture | PLT | **Done** |
| 0.5 | Stub HUD (mock/live toggle placeholder, status text) | SCN | **Done** (`DSP-SCN-20260723-01`) |
| 0.6 | Copy EGM96 into `public/` | GEO → worker | **Done** (`DSP-GEO-20260722-01`) |
| 0.7 | `config.json` + `.env.example` | PLT | **Done** |

**Exit:** Empty scene runs locally; agentic system usable. **Phase 0 complete** (incl. 0.5 HUD).

## Current phase pointer

**Active:** **Human ops** — Hetzner SPA + WSS + optional projects API ([`../ops/human-hetzner-wss-checklist.md`](../ops/human-hetzner-wss-checklist.md)).  
**Last gate:** Phase **6.4 stub Done** (`DSP-PLT-20260801-01`) — `server/` + SPA try-API-then-static.  
**Next worker when needed:** **6.5** auth roles (bearer stub enough for LAN until then).

---

## Phase 1 — Spine (geo + telemetry + one camera/boat)

**Goal:** Typed telemetry → ENU → one drone camera + one boat. Mock first.

| # | Work | Owner |
| --- | --- | --- |
| 1.1 | Port GeoOrigin / GeoUtils + tests — **Done** (`DSP-GEO-20260722-01`) | GEO |
| 1.2 | Port EGM96 loader — **Done** (`DSP-GEO-20260722-01`) | GEO |
| 1.3 | DTO + router + mock source — **Done** (`DSP-TEL-20260722-01`) | TEL |
| 1.4 | Replay fixture format — **Done** (`DSP-TEL-20260723-01`) | TEL |
| 1.5 | Pose apply + midpoint lerp — **Done** (GEO-02 + CAL-01 + SCN-01) | GEO+CAL+SCN |
| 1.6 | FOV default 66.8832° h — **Done** (`PoseEvent.fovHDeg`) | CAL/SCN |
| 1.7 | Simple 2D map for correction — **Done** (`DSP-SCN-20260723-01`) | SCN |
| 1.8 | Human offset sliders (basic) — **Done** (`DSP-CAL-20260723-01`) | CAL |
| 1.9 | Live switch wired but off by default — **Done** (`DSP-TEL-20260723-02`) | TEL |

**Exit (Milestone A):** Met (2026-07-23).

---

## Phase 2 — Race content

| # | Work | Owner |
| --- | --- | --- |
| 2.1–2.7 | glTF fleet, course, POV, sponsors, flags, name/colour — **Done** | SCN+TEL |

**Exit (Milestone B):** Content gate met (2026-07-27).

---

## Phase 3 — Output & ops

| # | Work | Owner | Gate |
| --- | --- | --- | --- |
| 3.1 | `preview` / `chroma` modes | OUT | **Done** |
| 3.2 | Visual timecode | OUT | **Done** |
| 3.3 | WebRTC underlay (WHEP) | OUT | **Done** |
| 3.4 | Connection/calib HUD harden | CAL+SCN | **Done** |
| 3.5 | Local vMix/OBS chroma experiment | OUT + human | **Pass** (2026-07-30, OBS) |
| 3.6 | Console deep-link | CON | **SPA done**; console ack pending |

**Exit (Milestone C):** Chroma overlay experiment recorded; underlay works. **Met** (2026-07-30).

---

## Phase 4 — Harden + world authoring

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 4.1 | Replay polish, reconnect — **Done** | TEL | |
| 4.2 | **Map ops + feature editor** | SCN | **Done** (`DSP-SCN-20260730-02`) |
| 4.2a | **Shared feature layout** | SCN+GEO | **Done** (`DSP-SCN-20260730-01`) |
| 4.2b | Stream / larger 2D map graphic | SCN+OUT | Optional on-air 2D from same features |
| 4.3 | Optional tiles/basemap under editor | SCN+GEO | Not required for air meshes |
| 4.4 | World modeling + **GeoJSON import/export** | SCN | **Done** (`DSP-SCN-20260731-03`) |
| 4.5 | CV research spike plan — **Done** | CAL | [`docs/research/cv-calibration-spike.md`](../research/cv-calibration-spike.md) |
| 4.6 | Hull + map-dot colours from categories | SCN | QoL from boat catalogue |
| 4.7 | Feature validation + editor QoL | SCN | Orphan gates, snap, bearing readout |

**Exit (Milestone E):** Operator can author course/sponsors/S/F/arrows on a map; 3D and 2D match; GeoJSON optional.

---

## Phase 5 — Deploy & first air path

| # | Work | Owner | Gate |
| --- | --- | --- | --- |
| 5.1 | Hetzner static deploy | PLT | **Done** (`DSP-PLT-20260731-01`); human upload pending |
| 5.2 | WSS or proxy for live TEL | PLT+TEL | **Done** (`DSP-PLT-20260731-02`); human TLS/proxy pending |
| 5.3 | Air runbook (now preferred NDI + chroma fallback) | OUT+BW | **Done** (`DSP-OUT-20260731-01`); updated 7.6 — `docs/ops/air-runbook.md` |
| 5.4 | Evaluate WebRTC/SRT egress | OUT | **Done** (`DSP-OUT-20260731-07`) — defer app egress; E3 compositor out for remote; [`../ops/egress-webrtc-srt-evaluation.md`](../ops/egress-webrtc-srt-evaluation.md) |
| 5.5 | **NDI path evaluation** (third-party vs helper vs Electron) | OUT+PLT+BW | **Done** (`DSP-OUT-20260731-02`) — BW ack **C → B → A**; [`../ops/ndi-path-evaluation.md`](../ops/ndi-path-evaluation.md) |
| 5.6 | Parallel air vs Unity; cutover criteria | BW | |

**Exit (Milestone D):** Documented chroma air path; NDI options scored; Unity decommission only after explicit OK.

---

## Phase 6 — Race projects & remote load

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 6.1 | **RaceProject schema** + folder/JSON pack | PLT+SCN | **Done** (`DSP-PLT-20260730-01`) |
| 6.2 | Local pack CRUD UI (create/duplicate/save) | SCN+PLT | **Done** (+ **2026-08-03** Save as / Load + optional API write — `DSP-PLT-20260803-01`) |
| 6.3 | `?race=` / console loads pack | CON+PLT | **Done** for local static (in 6.1); far-PC needs host |
| 6.4 | **Project API + database** | PLT | Design + **stub done** (`DSP-PLT-20260801-01`) — [`../architecture/project-api-and-database.md`](../architecture/project-api-and-database.md) · [`../ops/projects-api.md`](../ops/projects-api.md) · `server/` |
| 6.5 | Auth roles (editor vs air-only) | PLT+CON | With console team |
| 6.6 | Offline pack download / venue mode | PLT | QoL |
| 6.7 | Calib profiles stored on project | CAL+PLT | Per POV |

**Exit (Milestone F):** Create project → save to DB → open on another computer → scene matches.

---

## Phase 7 — Optimum air: NDI camera view

Entry criteria and A/B/C scores: [`../ops/ndi-path-evaluation.md`](../ops/ndi-path-evaluation.md).  
**BW lock (2026-07-31):** full product = **A (Electron) + NDI with alpha** (not green-key NDI). Preferred studio air = Electron alpha NDI; chroma = fallback ([`../ops/air-runbook.md`](../ops/air-runbook.md)). Skip **7.2 (B)** unless A is blocked.

| # | Work | Owner | Notes |
| --- | --- | --- | --- |
| 7.1 | Spike: third-party NDI from capture/window | OUT+human | **Done / fail for production** (`DSP-OUT-20260731-03`) — [`../ops/ndi-c-spike-runbook.md`](../ops/ndi-c-spike-runbook.md) |
| 7.2 | Spike: **native NDI helper** sidecar | OUT | **Deferred** — skip unless A blocked |
| 7.3 | Spike: **Electron + our NDI sender** (**A** + alpha) | OUT+PLT | **Done** — 7.3a shell (`04`); 7.3b transparent + `grandi` send (`05`); name `broadcast-web` |
| 7.4 | Choose production NDI path (BW + studio) | BW | **Done** — A + alpha (human Pass 2026-07-31) |
| 7.5 | Production NDI out of active POV camera | OUT | **Done** via 7.3b; **2026-08-03** dual-render lock vs free cam (`DSP-OUT-20260803-01`) |
| 7.6 | vMix NDI input runbook + cutover | OUT+BW | **Done** (`DSP-OUT-20260731-06`) — [`../ops/air-runbook.md`](../ops/air-runbook.md) |

**Exit (Milestone G):** Studio receives AR camera view as **NDI with alpha**; chroma remains fallback.

---

## Capability map (skills → phase)

| Skill | Phase |
| --- | --- |
| Telemetry / geo / calib / chroma / WHEP / deeplink parser | 0–3 (mostly done) |
| Course, sponsors, flags, boat names/categories | 2 (done) |
| Map editor, shared 3D+2D features, GeoJSON, stream 2D | **4** |
| Hetzner, WSS, chroma air runbook, NDI evaluate | **5** |
| Project packs, DB, far-PC load, roles | **6** |
| Owned/third-party NDI camera out | **7** |

---

## Priority of output technologies (BW lock — updated 2026-07-29)

1. **Chroma + window/screen capture** — first air path (now)  
2. **WebRTC underlay (WHEP)** — preview + CV  
3. **SRT/WebRTC egress** — when remote matters (Phase **5.4:** defer app sender; use compositor program out — [`../ops/egress-webrtc-srt-evaluation.md`](../ops/egress-webrtc-srt-evaluation.md))  
4. **NDI out of AR camera view** — **optimum** studio path (Electron + alpha; locked)  

Browser-only SPA cannot emit NDI; Electron or a native/third-party bridge is required for optimum.

---

## QoL backlog (pull into phases as needed)

- Project list: rename, archive, “duplicate last race”  
- Revision history on packs  
- Hide ops HUD for air; editor chrome separate  
- Snap / bearing while drawing arrows  
- Validate boat ids vs catalogue  
- Venue offline pack cache  
- Boat tags billboard toward preview cam during free look (SCN polish)  

### Ops polish landed 2026-08-03 (not a numbered phase)

- Live socket hygiene (enabled ids + nopkt/age) — `DSP-TEL-20260803-01`  
- Free cam ops view — `DSP-SCN-20260803-01`  
- World-anchor HUD — `DSP-SCN-20260803-02`  
- NDI active-cam lock — `DSP-OUT-20260803-01`  
- Project Save as / Load — `DSP-PLT-20260803-01`  

---
