# Dispatch DSP-SCN-20260803-01-free-cam-ops-view

## Meta
- From orchestrator: BW (ops feedback 2026-08-03)
- Worker role: WORKER(DSP-SCN-20260803-01-free-cam-ops-view)
- Priority: P0
- Phase: Ops view (SCN); coordinates with OUT NDI lock DSP
- Related: `createScene.ts`, `droneCamera.ts`, `povSwitcher.ts`, stub HUD
- BW ask: Operator must freely look around the 3D world; not stuck only on drone lens for ops preview
- **Status: DONE** (BW accepted 2026-08-03)

## Goal

Add an **ops free cam** (orbit/fly) toggle so the on-screen preview can inspect the course/fleet while air framing stays owned by active POV (see companion OUT DSP).

## Background

- Single `PerspectiveCamera` driven only by active POV pose; `renderer.render(scene, drone.camera)`.
- No OrbitControls / free look today → live with empty drone packets freezes the “view”.
- Product: ops may watch free cam **or** a drone cam in the window; **air/NDI** follows **active cam** only (OUT DSP).

## In scope

1. Free cam mode: mouse orbit/pan/zoom (or fly) around ENU origin / scene center.
2. HUD/Fleet toggle: **Free cam** | **Follow active POV**.
3. When Follow: existing POV switch (`1–4`, Fleet Cam) drives the preview camera.
4. Free cam does **not** change `activePovId` (active cam remains the air selection).
5. Document UX in `src/scene/README.md`.
6. Basic tests or manual checklist; build green.

## Out of scope

- Implementing dual-render NDI FBO (OUT owns contract; may stub “preview vs air” flag for OUT).
- World-anchor fields
- Live socket hygiene
- Cesium

## Acceptance criteria

- [ ] Can orbit/look around world with free cam even if drone telemetry idle
- [ ] Switching back to Follow uses active POV pose again
- [ ] Free cam does not mutate active POV id
- [ ] `npm test` + `npm run build` green

## Worker paste block

```
You are WORKER(DSP-SCN-20260803-01-free-cam-ops-view).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260803-01-free-cam-ops-view.md
2. docs/agentic/dispatches/active/DSP-OUT-20260803-01-ndi-active-cam-lock.md
3. src/scene/createScene.ts, droneCamera.ts, povSwitcher.ts
4. src/scene/stubHud.ts

Implement ops free cam toggle. Do not make NDI follow free cam — leave air lock to OUT DSP (coordinate render hook if needed).
Report back per dispatch.
```
