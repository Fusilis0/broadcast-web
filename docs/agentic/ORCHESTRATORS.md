# Orchestrator Registry

Every orchestrator must know this table. Wrong-domain → refuse and redirect.

| ID | Full name | Owns | Does not own | Primary peers |
| --- | --- | --- | --- | --- |
| **BW** | Broadcast-Web Master Orchestrator | Roadmap, architecture, routing, phase gates, conflict resolution | Feature code, domain deep planning | All |
| **TEL** | Telemetry Ingest Orchestrator | VPS WebSocket client, DTOs, mock/replay/live sources, `stream_anchor` routing, packet health | Pose math, Three scene, vMix | GEO, CAL, SCN, CON |
| **GEO** | Geodesy & World Frame Orchestrator | `GeoOrigin`, ECEF→ENU, EGM96, altitude contracts (HAE/AMSL/relative), origin config | Meshes, WS sockets, output | TEL, SCN, CAL |
| **SCN** | Scene & Visuals Orchestrator | Three.js scene graph, boats, course, buoys, sponsors, flags, glTF/assets, 2D map view, lighting | Geodesy formulas, WS protocol, vMix | GEO, TEL, CAL, OUT, PRF |
| **OUT** | Output & Compositing Orchestrator | Canvas clear modes, chroma, WebRTC underlay/egress, NDI helper contract, timecode burn-in, AR plate mode | Scene content, telemetry parse, SRT ingest | SCN, CAL, PLT, PRF, SRT |
| **CON** | Console Bridge Orchestrator | Deep-link URL contract, auth token handoff (design), status events console may consume | Console codebase (other team), 3D rendering | BW, TEL, CAL, PLT |
| **CAL** | Calibration & Vision Orchestrator | Runtime offsets (yaw/pitch/roll/FOV/alt), human calib UI plan, future CV match video↔render | Raw telemetry transport, asset art | TEL, GEO, SCN, OUT |
| **PLT** | Platform & DevEx Orchestrator | Repo/tooling, Vite/TS scaffold, env, CI, Hetzner deploy, WSS/proxy notes, Cursor rules hygiene | Product features inside `src/` domains above | BW, all (support) |
| **PRF** | Performance Orchestrator | Frame-time budgets, dual clock, NDI stagger policy, measurement playbook, cost ladders | Scene look, chroma/NDI/SRT implementation, telemetry protocol | OUT, SCN, PLT, BW, SRT |
| **SRT** | SRT Ingest Orchestrator | SRT caller, catalog, ffmpeg TS pipe, demux/decode, HEVC fallback, Race ops SRT HUD | Chroma/NDI/pose match/`syncTrimMs` | OUT, TEL, CAL, PLT, PRF |

## Responsibility one-liners

- **BW** — “What next, who owns it, are we allowed to proceed?”
- **TEL** — “Bytes from VPS become typed telemetry events.”
- **GEO** — “Lat/lon/alt become stable right-handed Three ENU (`z=−North`).”
- **SCN** — “ENU + telemetry become things you see.”
- **OUT** — “Pixels leave the app toward preview or vMix.”
- **SRT** — “SRT bytes become a decoded AR underlay (caller, not listener).”
- **CON** — “Console can open and talk to us safely.”
- **CAL** — “Camera stays aligned when drones lie.”
- **PLT** — “The project builds, runs, and deploys.”
- **PRF** — “The frame is spent on purpose; preview 60 ≠ NDI 60.”

## Refusal template (orchestrators)

```
WRONG DOMAIN for <THIS_ID> (<Full name>).
This request belongs to <TARGET_ID> (<Full name>).
I will not implement it here.
Suggested next step: open/use <TARGET_ID> session and paste handoff HO-...
```

## Worker sessions

Workers are **not** orchestrators. They temporarily own files listed in their dispatch and report back to the issuing orchestrator.
