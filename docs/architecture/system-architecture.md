# System Architecture — broadcast-web

**Status:** Design extended (2026-07-29) — projects, shared world layers, NDI optimum  
**Master:** BW Orchestrator  
**Sibling reference:** Unity project `../broadcast` (analysis + assets + telemetry contracts)  
**Also see:** [`race-projects-and-world-authoring.md`](./race-projects-and-world-authoring.md)

---

## 1. Purpose

`broadcast-web` is a Three.js AR overlay for maritime race broadcast that:

1. Ingests race telemetry (mock → replay → live VPS).
2. Places boats / course / graphics in a geo-referenced ENU scene from a **race project** (JSON pack → later DB).
3. Drives a virtual camera from drone/cam pose + **runtime calibration offsets**.
4. Outputs pixels for ops preview and **vMix** (chroma first; **NDI camera view is the optimum long-term air path**).
5. Opens from the existing **web console** via redirect (`?race=` loads a project when packs exist).

**Runtime today:** browser SPA (Vite). **Future studio shell:** optional **Electron** (or native helper) when owned NDI out is required. Unity `broadcast` stays on-air until web output is trusted.

---

## 2. Context diagram

```
┌──────────────────────────┐
│ Web Console (other team) │
│ projects / telemetry UI  │
└────────────┬─────────────┘
             │ deep link ?race= (CON)
             ▼
┌────────────────────────────────────────────────────────────┐
│ broadcast-web (browser today; optional Electron later)     │
│                                                            │
│  Project pack (JSON/API) ──▶ feature layout (GEO ENU)      │
│         │                         │                        │
│         │              ┌──────────┴──────────┐             │
│         │              ▼                     ▼             │
│         │         SCN 3D AR              SCN 2D map        │
│         │         (air camera)           (ops / stream)    │
│  TEL ───┴──▶ pose + CAL offsets ──▶ active POV camera      │
│                         │                                  │
│                         ▼                                  │
│              OUT: preview │ chroma │ WHEP │ (NDI later)    │
└────────────────────────────────────────────────────────────┘
             │                         │
             ▼                         ▼
      VPS WebSockets              MediaMTX (WHEP)
      + Project API/DB (later)    underlay + CV
             │
             ▼
        vMix ◀── chroma capture  and/or  NDI (optimum)
```

---

## 3. Runtime placement

| Component | Where it runs |
| --- | --- |
| SPA bundle | localhost or **Hetzner** static |
| Three.js + geodesy + WS | **Browser** (or Electron renderer) on studio GPU |
| Project API / DB | Hetzner/VPS — **stores JSON packs only**, does not render |
| Telemetry server | Existing VPS |
| Compositor | vMix on studio LAN |
| NDI sender (later) | Electron main / native helper / third-party tool on studio PC |

Hetzner is **not** a render farm.

---

## 4. Logical modules

| Module | Orchestrator | Responsibility |
| --- | --- | --- |
| `src/telemetry/` | TEL | WS, mock, replay, live, DTOs |
| `src/geodesy/` | GEO | Origin, EGM96, ENU |
| `src/pose/` | GEO+CAL | Pose + offsets |
| `src/scene/` | SCN | 3D entities, 2D map, **feature consumers**, later map editor |
| `src/assets/` | SCN | glTF / textures |
| `src/output/` | OUT | Chroma, timecode, WHEP, later NDI bridge contract |
| `src/calibration/` | CAL | Offsets, UI, CV writes same store |
| `src/console/` | CON | Deeplink parse; later `race` → pack resolve |
| `src/config/` | PLT+BW | Config + later project merge |
| `src/projects/` (planned) | PLT+SCN | Pack load/save, schema, API client |
| `public/` / races API | PLT/SCN | Fixtures → race packs |

---

## 5. Data contracts

### 5.1 Telemetry

- Channels: drones `1–4`, cams `11–12`, boats `21–52`, pilots `81–84` (pilots deferred).
- Modes: `mock` | `replay` | `live`.

### 5.2 Geodesy

- ENU: `x=East, y=Up, z=−North` (right-handed Three / glTF). Drones: relative + takeoff + EGM96. Boats: HAE for now. Declination default `0`.

### 5.3 Calibration

Five fields per device; CV **only** writes `setOffsets` (see CV spike plan).

### 5.4 Console deep link

See [`../contracts/console-deeplink.md`](../contracts/console-deeplink.md).  
`race` becomes **project id** when packs/API exist (URL wins for mode/origin; pack supplies features/fleet).

### 5.5 Race project & shared features

Canonical design: [`race-projects-and-world-authoring.md`](./race-projects-and-world-authoring.md).

- One project → origin + fleet catalogue + **feature layers** (course, sponsors, S/F, arrows, flags, …).
- **Same normalized features** feed 3D AR and 2D map.
- Persist as JSON; later DB for far-PC load.
- Optional GeoJSON import (geojson.io compatibility).

### 5.6 Output modes

| Mode | Behavior |
| --- | --- |
| `preview` | Ops viewing; WHEP underlay allowed |
| `chroma` | Green clear for vMix window capture |
| WHEP underlay | MediaMTX behind AR (preview) |
| **NDI out (optimum)** | Named video source of AR camera view for vMix — requires Electron or native/third-party helper |

**Near-term air:** chroma + capture. **Optimum air:** NDI of the WebGL camera view (evaluate Electron + our sender vs helper vs third-party NDI).

---

## 6. External systems

| System | Interface |
| --- | --- |
| VPS telemetry | WS / WSS |
| MediaMTX | WHEP |
| vMix | Chroma capture and/or NDI ingest |
| Web console | Redirect + later project picker |
| Project API/DB (planned) | CRUD race JSON |
| Unity broadcast | Reference + parallel air backup |

---

## 7. Security & config

- No secrets in repo; tokens with console team.
- Project API auth later (operator vs editor roles).
- Tiles/globe optional under editor; custom world modeling preferred for air content.

---

## 8. Non-goals (near term)

- Server-side Three.js on Hetzner  
- Replacing full console product UI  
- In-browser NDI **without** Electron/native helper  
- Perfect multi-user live co-editing in V1  

**Revised (no longer hard non-goals):** Electron shell and owned NDI sender are **planned options** for the optimum air path (Phase 5.5 / 7).

---

## 9. Unity references

- `../broadcast/docs/project-analysis.md`
- `../broadcast/Assets/Scripts/` (GeoUtils, TelemetryReceiver, WorldAnchorManager, BillboardChainFromGeoJson, …)
- `../broadcast/Assets/StreamingAssets/EGM96_1deg.bin`
