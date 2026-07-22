# Dispatch DSP-GEO-20260722-02-pose-enu-bus

## Meta
- From orchestrator: GEO
- Worker role: WORKER(DSP-GEO-20260722-02-pose-enu-bus)
- Priority: P0
- Phase: Phase 1.5 (GEO slice — pose apply + midpoint lerp → ENU bus; SCN draws separately)
- Related handoffs: `HO-GEO-SCN-20260722-01` (draw / consume pose bus)
- Status: **active / awaiting worker**

## Goal

Bootstrap world origin from `public/config.json`, load EGM96, subscribe to TEL `telemetryBus`, convert drone/boat packets to Unity-compatible ENU with midpoint lerp, and publish smoothed poses on a **pose bus** for SCN. No Three meshes, no scene graph ownership.

## Background

- Architecture: `docs/architecture/system-architecture.md` §4 (`src/pose/`), §5.2 (alt contracts), §5.3 (CAL offsets later)
- BW: library accepted; next is config origin + `telemetryBus` → ENU; handoff draw to SCN
- TEL ready: `telemetryBus` events `drone` | `boat` | `stream_anchor` — see `src/telemetry/README.md`
- Geodesy ready: `applyConfigOrigin`, `gpsToEnu` / `gpsToEnuRelative`, `ensureEgm96Loaded` — `src/geodesy/`
- Unity reference (read-only): `WorldAnchorManager.cs` — `ProcessData` (drone relative + takeoff AMSL), `ProcessBoatPosition` (boat **HAE**), `SetNewTarget` midpoint lerp
- Mock poses orbit Istanbul (~`41.0082, 28.9784`); **config origin must not stay at 0,0** or ENU will be huge
- Handoff: `docs/agentic/handoffs/HO-GEO-SCN-20260722-01.md`

## In scope

1. **Config origin bootstrap**
   - Fetch `/config.json` (or reuse a tiny loader under `src/config/` if you add a minimal `loadConfig()` — allowed; keep PLT-owned and thin)
   - Call `ensureEgm96Loaded()` then `applyConfigOrigin(config.origin)` **before** processing poses
   - Update `public/config.json` `origin` to a sensible mock center near TEL mock tracks, e.g. `{ "lat": 41.0082, "lon": 28.9784, "altMsl": 0 }` (document chosen values in README)
   - Add optional `takeoffAltitudeMSL` (number, default `0`) to config for drone relative→HAE (Unity `WorldAnchorManager.takeoffAltitudeMSL`)

2. **Altitude contracts (match Unity / arch §5.2)**
   - **Drone** (`telemetryBus` `drone`): `gpsToEnuRelative(lat, lon, pos.alt, takeoffAltitudeMSL)`
   - **Boat** (`boat`): `gpsToEnu(lat, lon, alt)` — **HAE**, not AMSL
   - Ignore `stream_anchor` for pose (no ENU)
   - Declination / CAL yaw-pitch-roll-FOV offsets: **do not invent** — use `0` / identity; leave a clear TODO or thin hook for CAL DSP

3. **`src/pose/` pipeline**
   - Per-entity state keyed by telemetry `id` (mock drone `"1"`, boat `"21"`)
   - On packet: compute raw ENU (+ orientation from packet — drone Euler/gimbal as available; boat yaw from `brg`; declination `0`)
   - Midpoint lerp à la Unity `SetNewTarget` / `Update` (start → mid → target over measured packet interval; first packet snaps)
   - Drive lerp on `requestAnimationFrame` (or equivalent) **inside pose module** and emit **current** smoothed pose each frame (or when changed)
   - Public API roughly:
     - `startPosePipeline(options?)` / `stopPosePipeline()`
     - `poseBus` with events such as `pose` (or `drone` / `boat`) carrying:
       - `id`, `kind: 'drone' | 'boat'`
       - `position: { x, y, z }` ENU meters (`x=East`, `y=Up`, `z=North`)
       - `rotation`: document chosen shape (e.g. `{ yawDeg, pitchDeg, rollDeg }` and/or quaternion) — stable enough for SCN
       - `ts` from telemetry
   - Export from `src/pose/index.ts`; update `src/pose/README.md`

4. **Wire bootstrap in `main.ts` (minimal)**
   - After/with telemetry ingest: load config → EGM96 → origin → `startPosePipeline()`
   - Optional: extend the existing status line with last drone/boat ENU `(x,y,z)` rounded — **no new meshes**, keep/ignore wireframe cube (SCN removes later)
   - Do not create boat/camera helpers

5. **Tests**
   - Unit tests: boat HAE path vs drone relative path; origin from fixture config; lerp first packet snaps; second packet produces mid between start/target at t=half interval (pure math test OK)
   - `npm test` and `npm run build` pass

## Out of scope

- Three meshes, camera helpers, scene graph, 2D map, HUD redesign (SCN — see handoff)
- CAL offset UI / non-zero offsets / FOV 66.8832 application (CAL DSP)
- TEL replay/live, router changes (unless a one-line type import)
- Chroma / output (OUT)
- Unity edits
- Claiming Cesium-matched real race origin (mock-centered config is enough for 1.5 spine)

## Likely files

- `src/pose/*.ts` (pipeline, bus, lerp, index)
- `src/pose/README.md`
- `src/pose/*.test.ts`
- `public/config.json` (origin + optional `takeoffAltitudeMSL`)
- `src/config/*` (optional thin `loadConfig`)
- `src/main.ts` (bootstrap + optional ENU status)
- `src/geodesy/*` — import only unless a tiny export fix is required
- `package.json` — only if new test deps needed (prefer existing Vitest)

## Inputs provided

- Workspace: `C:\Users\PC\Documents\GitHub\broadcast-web`
- TEL: `telemetryBus`, DTOs in `src/telemetry/types.ts`
- GEO: `src/geodesy/`
- Unity: `../broadcast/Assets/Scripts/WorldAnchorManager.cs`
- Handoff contract for SCN: `docs/agentic/handoffs/HO-GEO-SCN-20260722-01.md`

## Acceptance criteria

- [ ] App boot: EGM96 loaded + origin from `config.json` applied before poses
- [ ] `public/config.json` origin near mock Istanbul track (not `0,0`)
- [ ] Subscribes to `telemetryBus` `drone` + `boat`; ignores `stream_anchor` for ENU
- [ ] Drone uses relative+takeoff; boat uses HAE
- [ ] Midpoint lerp runs; poses emitted on a documented `poseBus` (or equivalent)
- [ ] No Three meshes / scene entities added by this DSP
- [ ] `main.ts` starts the pipeline; optional ENU readout OK
- [ ] `npm test` + `npm run build` pass
- [ ] README documents axis contract, altitude rules, event payload for SCN

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (include sample ENU magnitudes — should be small meters near origin, not ~10⁶)
4. Follow-ups / blockers (esp. anything SCN/CAL need)
5. Suggested memo bullets for GEO

## Paste block (new worker chat)

```
You are WORKER(DSP-GEO-20260722-02-pose-enu-bus).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-GEO-20260722-02-pose-enu-bus.md (full)
2. docs/agentic/handoffs/HO-GEO-SCN-20260722-01.md
3. docs/agentic/DISPATCH_PROTOCOL.md (worker rules)
4. docs/architecture/system-architecture.md §5.2–5.3
5. src/telemetry/README.md + src/geodesy/README.md
6. Unity read-only: ../broadcast/Assets/Scripts/WorldAnchorManager.cs (ProcessData / ProcessBoatPosition / midpoint lerp)

Implement in scope only. No Three meshes. No SCN draw. No CAL UI.
When finished, report using the dispatch Report back section.
```
