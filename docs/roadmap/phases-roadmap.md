# Phases Roadmap — broadcast-web

**Owner:** BW  
**Updated:** 2026-08-04  
**Design:** [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) · air: [`../ops/air-runbook.md`](../ops/air-runbook.md)

---

## Strategy lock (v1) — 2026-08-04

| Decision | Lock |
| --- | --- |
| **First version venue** | **Local studio** — Electron + Vite + VPS telemetry (`ws://…`). No cloud host required for v1. |
| **Hetzner / public SPA / WSS TLS** | **Deferred** — months later, optional; may never ship if local+LAN is enough. Checklist kept as archive: [`../ops/human-hetzner-wss-checklist.md`](../ops/human-hetzner-wss-checklist.md). |
| **Preferred air** | Electron **alpha NDI** (chroma = fallback). |
| **App egress (WebRTC/SRT)** | Deferred (E0) — compositor program-out if remote needed. |
| **v1 focus** | **Visual parity + ops QoL** (assets, maps, tags, editor), then LAN project features, then Unity cutover. |

### Current pointer

**Active:** **Phase 10.1** (Unity vs broadcast-web parallel air — human + BW) is the only remaining
open gate.  
**Done:** Phase 11 core (**V1-D**) + follow-up authoring workspace / calib+output into sidebar +
follow-up #2 (Close bug fix, resizable map/sidebar, Enter/Delete/drag editing, distinct
viewer-facing stream map) + follow-up #3 (P0 `window.prompt()` throws unconditionally in Electron,
breaking billboard chain, boat/drone/buoy placement, Save as, Rename, Duplicate — fixed by shared
`promptModal()` DOM utility, `DSP-SCN-20260811-07` + `DSP-PLT-20260811-03`, accepted 2026-08-12
after BW drove the real Electron renderer end-to-end) all accepted. See
`docs/architecture/world-authoring-workspace.md`. Phase 12 cloud still deferred.

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

## Air / output priority (unchanged)

1. **Electron + alpha NDI** — preferred studio air  
2. **Chroma + window capture** — fallback  
3. **WHEP underlay** — preview / CV  
4. **App WebRTC/SRT egress** — deferred (use compositor out)

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
