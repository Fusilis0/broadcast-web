# Dispatch DSP-SCN-20260722-01-boat-drone-camera

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260722-01-boat-drone-camera)
- Priority: P0
- Phase: Phase 1.5 — pose apply visuals (SCN slice)
- Related handoffs: `HO-SCN-GEO-20260722-01` (pose/ENU consume contract)
- BW ask: one boat primitive + drone camera from GEO/pose ENU; may replace demo cube; no WS / no geo formulas

## Goal

Wire the Three.js view so mock race motion is visible: one boat mesh (primitive) and one PerspectiveCamera driven by **GEO/pose ENU outputs**. Remove or stop using the scaffold demo cube once entities render. SCN draws only — it does not convert lat/lon, open WebSockets, or invent calibration math.

## Background

- Architecture: `docs/architecture/system-architecture.md` §4 (`src/scene/` SCN), §5.2 axes `x=East, y=Up, z=North`, §5.3 pipeline `rawTelemetryPose → GEO → + CAL offsets → SCN camera`
- Roadmap: Phase 1.5 pose apply; V1 freeze = 1 drone cam + boats (+ later course / 2D map)
- Scaffold today: `src/main.ts` owns scene/renderer/loop + wireframe cube; TEL mock already ticks drone `1` + boat `21` on `telemetryBus`
- GEO library ready (`src/geodesy/*`); **`src/pose/` still empty** — GEO’s 1.5 DSP / this handoff must expose ENU poses before (or as blocker for) this worker
- CAL FOV 66.8832° / offsets: **not** this DSP — use temporary camera FOV constant; CAL will own later
- Unity sibling `../broadcast` is **read-only** reference (optional orientation hints only)

## In scope

1. **Scene module skeleton** under `src/scene/`
   - Create/own renderer loop wiring moved out of (or thinly called from) `main.ts`: scene, resize, `requestAnimationFrame`, render
   - Clear color stays dark preview (OUT owns chroma later) — do not change to green

2. **Boat entity (primitive)**
   - One boat visual for mock boat id `21` (or first ENU boat pose from pose API)
   - Primitive is fine (box / elongated box / simple group) — **no glTF** in this DSP
   - Position from ENU: Three `position.set(east, up, north)` matching GEO axis contract
   - Optional: yaw from bearing / pose heading if pose API provides it; else leave default orientation

3. **Drone camera**
   - Use (or replace) the main `PerspectiveCamera` as the drone/cam view
   - Position from drone ENU pose
   - Orientation from pose-provided world/camera attitude (yaw/pitch/roll or quaternion — **as exported by GEO/pose**, do not re-derive from lat/lon)
   - Temporary hFOV: **66.8832** (Mini 4 Pro default per architecture / roadmap 1.6) until CAL owns FOV
   - Near/far sensible for ~tens–hundreds of meters ENU (e.g. near `0.5`–`1`, far `2000`+)

4. **Consume ENU / pose — do not compute it**
   - Import from GEO-owned pose surface once available (preferred: `src/pose/` exports, or documented GEO helper that already returns ENU)
   - Subscribe / poll latest boat + drone poses each frame or on pose events
   - If pose module / consume API is missing when work starts: **stop**, report blocker citing `HO-SCN-GEO-20260722-01` — do **not** call `gpsToEnu` / touch `telemetryBus` lat-lon → ENU yourself

5. **Replace demo cube**
   - Remove rotating wireframe cube (or leave disabled) once boat + camera path is live

6. **Keep TEL status strip**
   - Existing bottom status / counter UI in `main.ts` may stay; do not build full stub HUD (that is Phase 0.5 / separate DSP)

## Out of scope

- WebSocket / live / replay sources (TEL)
- `gpsToEnu`, EGM96, `GeoOrigin`, origin-from-config wiring (GEO)
- Midpoint lerp / pose smoothing math if not already exported by pose module (GEO+CAL)
- Calibration offset store / sliders (CAL)
- Chroma / WebRTC / clear-mode API (OUT)
- glTF boats, course, buoys, sponsors, flags (Phase 2)
- 2D map panel (Phase 1.7)
- Stub HUD mock/live toggle polish (Phase 0.5)
- Modifying Unity `../broadcast`
- Committing unless the human explicitly asks

## Likely files

- `src/scene/` — new modules (e.g. `createScene.ts`, `boatEntity.ts`, `droneCamera.ts`, `index.ts`)
- `src/main.ts` — thin bootstrap: start ingest (unchanged TEL), start scene, leave counters
- `src/scene/README.md` — update ownership note
- Possibly read-only imports from `src/pose/` and/or `src/geodesy/` **types/exports only as documented by GEO**

## Inputs provided

- Axis contract: ENU → Three `x=East, y=Up, z=North`
- Mock ids: drone `1`, boat `21` (`src/telemetry/mockSource.ts`)
- Temporary FOV: `66.8832` degrees horizontal
- Pose consume contract: see `HO-SCN-GEO-20260722-01` (worker must not invent a parallel ENU pipeline)
- Current canvas: `src/main.ts` cube + dark clear

## Acceptance criteria

- [ ] Demo cube gone or no longer the on-air content
- [ ] One boat primitive visible in the WebGL view, moving when mock + pose pipeline runs
- [ ] Main view is the drone PerspectiveCamera positioned/oriented from ENU pose (not a fixed `z=3` look-at-cube camera)
- [ ] No lat/lon→ENU math and no WS client code added under `src/scene/`
- [ ] `npm run build` succeeds
- [ ] `npm run dev`: boat motion + camera motion observable (or clear blocker if pose API absent)
- [ ] Unity repo untouched; no secrets committed

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (`npm run build`, `npm run dev` observation)
4. Follow-ups / blockers (especially if GEO pose not ready)
5. Suggested memo bullets for SCN

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-SCN-20260722-01-boat-drone-camera).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260722-01-boat-drone-camera.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-SCN-GEO-20260722-01.md
4. docs/architecture/system-architecture.md §4, §5.2, §5.3

Implement in scope only. Consume GEO/pose ENU — no gpsToEnu, no WS, no chroma.
If pose API missing → stop and report blocker. Report back per the dispatch.
```
