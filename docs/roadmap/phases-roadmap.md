# Phases Roadmap — broadcast-web

**Owner:** BW  
**Update memos when a phase gate passes.**

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

**Active:** **Phase 3** — **3.1 + 3.2 + 3.4 done**. **3.6** DSP issued (`DSP-CON-20260728-01`). **3.5** human-pending. **3.3** WHEP deferred.  
**Last gate:** DSP-SCN-20260727-07 (connection/calib HUD) accepted (2026-07-28).

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

**Exit (Version 1 spine / Milestone A):** Mock boat+drone move correctly; geodesy tests green; 2D map shows fleet point. **Met** (2026-07-23).

**Phase 1 complete** (2026-07-23). Live VPS soak is human-gated (config URLs + field).

---

## Phase 2 — Race content

| # | Work | Owner |
| --- | --- | --- |
| 2.1 | glTF boat + tags — **Done** (`DSP-SCN-20260723-02`) | SCN |
| 2.2 | Full boat channel config — **Done** (TEL `DSP-TEL-20260724-01` + SCN `DSP-SCN-20260727-01`) | TEL+SCN |
| 2.3 | Course + buoys — **Done** (`DSP-SCN-20260727-02`) | SCN |
| 2.4 | Multi POV switch — **Done** (TEL `DSP-TEL-20260727-01` + SCN `DSP-SCN-20260727-03`) | SCN+TEL |
| 2.5 | Sponsors subset — **Done** (`DSP-SCN-20260727-04`) | SCN |
| 2.6 | Countdown flags — **Done** (`DSP-SCN-20260727-05`) | SCN |
| 2.7 | Name/colour JSON — **Done** (`DSP-SCN-20260727-06`) | SCN |

**Exit (Milestone B):** Visual parity good enough for side-by-side vs Unity. **Content gate met** (2026-07-27) — fleet + course + POV + sponsors + flags + name/colour tags; BW/studio side-by-side still human.

---

## Phase 3 — Output & ops

| # | Work | Owner | Gate |
| --- | --- | --- | --- |
| 3.1 | `preview` / `chroma` modes | OUT | **Done** (`DSP-OUT-20260727-01`) |
| 3.2 | Visual timecode | OUT | **Done** (`DSP-OUT-20260727-02`) |
| 3.3 | WebRTC underlay (WHEP) | OUT | |
| 3.4 | Connection/calib HUD harden | CAL+SCN | **Done** (`DSP-SCN-20260727-07`) |
| 3.5 | Local vMix chroma experiment | OUT + human | |
| 3.6 | Console deep-link design doc agreed | CON | **DSP issued** (`DSP-CON-20260728-01`) |

**Exit (Milestone C):** Chroma overlay experiment recorded; underlay works.

---

## Phase 4 — Harden + world tools

| # | Work | Owner |
| --- | --- | --- |
| 4.1 | Replay polish, reconnect | TEL |
| 4.2 | Top-down map ops UX | SCN |
| 4.3 | Optional tiles/globe tools (not air) | SCN+GEO |
| 4.4 | Custom world modeling pipeline notes | SCN |
| 4.5 | CV research spike plan | CAL |

**Exit:** Ops-ready preview; CV approach written.

---

## Phase 5 — Deploy & air path

| # | Work | Owner |
| --- | --- | --- |
| 5.1 | Hetzner static deploy | PLT |
| 5.2 | WSS or proxy solution | PLT+TEL |
| 5.3 | Air runbook (local Chrome + chroma) | OUT+BW |
| 5.4 | Evaluate WebRTC/SRT egress | OUT |
| 5.5 | Evaluate native NDI helper (only if needed) | OUT |
| 5.6 | Parallel air vs Unity; cutover criteria | BW |

**Exit (Milestone D):** Documented air path; Unity decommission only after explicit BW+studio OK.

---

## Priority of output technologies (BW lock)

1. **Chroma** — primary first air path  
2. **WebRTC underlay** — required early for preview/CV  
3. **SRT/WebRTC egress** — when remote matters  
4. **Native NDI helper** — contingency  

---

