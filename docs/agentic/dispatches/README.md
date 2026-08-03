# Dispatches index

## Bootstrap (open orchestrator chats)

| File | Opens |
| --- | --- |
| [`BOOTSTRAP_BW.md`](./BOOTSTRAP_BW.md) | Broadcast-Web Master Orchestrator |
| [`BOOTSTRAP_PLT.md`](./BOOTSTRAP_PLT.md) | Platform & DevEx — **start here after BW** |
| [`BOOTSTRAP_TEL.md`](./BOOTSTRAP_TEL.md) | Telemetry Ingest |
| [`BOOTSTRAP_GEO.md`](./BOOTSTRAP_GEO.md) | Geodesy & World Frame |
| [`BOOTSTRAP_SCN.md`](./BOOTSTRAP_SCN.md) | Scene & Visuals |
| [`BOOTSTRAP_OUT.md`](./BOOTSTRAP_OUT.md) | Output & Compositing |
| [`BOOTSTRAP_CON.md`](./BOOTSTRAP_CON.md) | Console Bridge |
| [`BOOTSTRAP_CAL.md`](./BOOTSTRAP_CAL.md) | Calibration & Vision |

## Active / done worker dispatches

Orchestrators save concrete `DSP-*.md` files into:

- `active/` — not finished  
- `done/` — completed (optional archive)

Templates: see `../DISPATCH_PROTOCOL.md`.

### Accepted 2026-08-03 (ops polish batch)

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-TEL-20260803-01-live-socket-hygiene.md`](./done/DSP-TEL-20260803-01-live-socket-hygiene.md) | TEL | Enabled-id sockets + last-packet status |
| [`done/DSP-SCN-20260803-01-free-cam-ops-view.md`](./done/DSP-SCN-20260803-01-free-cam-ops-view.md) | SCN | Ops free cam (preview) |
| [`done/DSP-OUT-20260803-01-ndi-active-cam-lock.md`](./done/DSP-OUT-20260803-01-ndi-active-cam-lock.md) | OUT | NDI = active POV (dual-render) |
| [`done/DSP-SCN-20260803-02-world-anchor-ui.md`](./done/DSP-SCN-20260803-02-world-anchor-ui.md) | SCN | World-anchor lat/lon/altMsl UI |
| [`done/DSP-PLT-20260803-01-project-save-as-load.md`](./done/DSP-PLT-20260803-01-project-save-as-load.md) | PLT+SCN | Save / Save as / Load project |

No active worker DSPs.
