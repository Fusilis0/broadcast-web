# System Architecture — broadcast-web

**Status:** Design locked for agentic build (2026-07-22)  
**Master:** BW Orchestrator  
**Sibling reference:** Unity project `../broadcast` (analysis + assets + telemetry contracts)

---

## 1. Purpose

`broadcast-web` is a **browser-only** Three.js application that:

1. Ingests race telemetry (mock → replay → live VPS).
2. Places boats / course / graphics in a geo-referenced ENU scene.
3. Drives a virtual camera from drone/cam pose + **runtime calibration offsets**.
4. Outputs pixels for ops preview and eventually **vMix** (chroma first).
5. Opens from the existing **web console** via redirect (console owned by another team).

Unity `broadcast` continues on-air (NDI) until web output is trusted.

---

## 2. Context diagram

```
┌──────────────────────────┐
│ Web Console (other team) │
│ telemetry lists / ops UI │
└────────────┬─────────────┘
             │ deep link (CON)
             ▼
┌────────────────────────────────────────────────────────────┐
│ broadcast-web SPA (browser on studio PC or ops laptop)     │
│                                                            │
│  TEL ──events──▶ GEO (lat/lon/alt→ENU)                     │
│    │                │                                      │
│    │                ▼                                      │
│    │           SCN (Three.js scene)                        │
│    │                │                                      │
│    └────▶ CAL (offsets) ──▶ camera                         │
│                         │                                  │
│                         ▼                                  │
│                        OUT (canvas / chroma / WebRTC)      │
│                         │                                  │
│  PLT: Vite build, env, later Hetzner static host           │
└────────────────────────────────────────────────────────────┘
             │                         │
             ▼                         ▼
      VPS WebSockets              MediaMTX (WHEP video)
      drone/boat/cam              underlay + future CV
             │
             ▼
           vMix  ◀── chroma capture / later stream
           (Unity NDI remains parallel backup)
```

---

## 3. Runtime placement (critical)

| Component | Where it runs |
| --- | --- |
| SPA bundle | Served from localhost or **Hetzner** (static) |
| Three.js + geodesy + WS client | **Browser** on the machine that opens the page |
| Heavy GPU | Studio PC GPU — **not** Hetzner CPU |
| Telemetry server | Existing VPS (unchanged) |
| Compositor | vMix on studio LAN |

Hetzner is **not** a render farm.

---

## 4. Logical modules (map to orchestrators)

| Module path (planned) | Orchestrator | Responsibility |
| --- | --- | --- |
| `src/telemetry/` | TEL | WS, mock, replay, live, DTOs, router |
| `src/geodesy/` | GEO | Origin, EGM96, ENU |
| `src/pose/` | GEO+CAL | Apply geo pose + offsets → camera/boats |
| `src/scene/` | SCN | Three scene, entities, 2D map |
| `src/assets/` | SCN | glTF/textures loading |
| `src/output/` | OUT | Transparent/chroma, WebRTC, timecode |
| `src/calibration/` | CAL | Offset state, UI hooks, future CV |
| `src/console/` | CON | Deep-link parse, optional postMessage |
| `src/config/` | PLT+BW | `config.json`, env |
| `public/` | PLT/SCN | EGM96 bin, models |

Exact folder names may be adjusted by PLT scaffold dispatch; owners stay as above.

---

## 5. Data contracts

### 5.1 Telemetry (from Unity parity)

- Channels (initial config): drones `1–4`, cams `11–12`, boats `21–52`, pilots `81–84`.
- Transport: WebSocket JSON; classify `stream_anchor` vs pose (port `TelemetryWsJsonRouter` behavior).
- Modes: `mock` | `replay` | `live` (config switch). Live only when Version-1 ready.

### 5.2 Geodesy

- Axes: Unity-compatible ENU → Three `x=East, y=Up, z=North`.
- Drones: relative alt + `takeoffAltitudeMSL` + EGM96.
- Boats: **HAE** for now (revisit after tests).
- Declination default `0` (true-north MSDK assumption).

### 5.3 Calibration offsets (first-class)

```ts
// Conceptual — CAL owns
interface CalibrationOffsets {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  fovHDeg: number;      // start 66.8832 for Mini 4 Pro
  altMeters: number;
  // per-device id keyed in a map
}
```

Pipeline: `rawTelemetryPose → GEO → + CAL offsets → SCN camera`.

Future CV **only writes these offsets** (no second pose pipeline).

### 5.4 Console deep link (CON — design now, integrate later)

Proposed query shape (negotiable with console team):

```
https://<host>/overlay?race=<id>&token=<jwt>&originLat=&originLon=&mode=live|mock
```

No console repo access today — CON documents the contract only.

### 5.5 Output modes (OUT)

| Mode | Behavior |
| --- | --- |
| `preview` | Normal clear / sky or dark; ops viewing |
| `chroma` | Clear `(0,255,0)` or configurable key; for vMix |
| `transparent` | Alpha canvas where browser allows (limited for capture) |
| `webrtc-underlay` | MediaMTX WHEP behind AR |
| `egress` (later) | Stream out — design in Phase 5 |

**NDI:** not in SPA. Optional future **native helper** on studio PC consumes frames/stream — separate mini-project under OUT plan, not Phase 0.

---

## 6. External systems

| System | Owner | Interface |
| --- | --- | --- |
| VPS `49.13.20.49` | Existing infra | WS now; **WSS required** for HTTPS Hetzner pages |
| MediaMTX | Existing | WHEP underlay |
| vMix | Studio | Chroma/window or later stream ingest; Unity NDI parallel |
| Web console | Other team | Redirect button + future token |
| Unity broadcast | Sibling | Reference + asset export source |

---

## 7. Security & config

- No API keys in repo.
- `.env` / local config for live URLs.
- Deep-link tokens validated later with console team.
- Google/Cesium tiles deferred (Phase 4+); custom world modeling preferred long-term.

---

## 8. Non-goals (current)

- Electron shell  
- In-browser NDI SDK  
- Server-side Three.js render on Hetzner  
- Replacing console 2D telemetry UI  
- Perfect SRT sync Phase B on day one  

---

## 9. Reference materials (Unity)

Read-only sibling paths (when available on disk):

- `../broadcast/docs/project-analysis.md`
- `../broadcast/docs/threejs-migration-draft.md`
- `../broadcast/Assets/Scripts/` (GeoUtils, TelemetryReceiver, WorldAnchorManager, …)
- `../broadcast/Assets/StreamingAssets/EGM96_1deg.bin`
