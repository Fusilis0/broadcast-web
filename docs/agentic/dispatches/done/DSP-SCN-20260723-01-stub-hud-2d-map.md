# Dispatch DSP-SCN-20260723-01-stub-hud-2d-map

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260723-01-stub-hud-2d-map)
- Priority: P0
- Phase: Phase 0.5 (stub HUD) + Phase 1.7 (simple 2D map) — Milestone A exit items
- Related handoffs: none
- BW ask: stub HUD (mock/live placeholder + status) + 2D map (fleet points from `poseBus`); one DSP if small; no WS / geo formulas / chroma

## Goal

Add a small ops overlay: (1) stub HUD with telemetry-mode placeholder and live status text, and (2) a simple top-down 2D map showing fleet points from **`poseBus`**. Refactor the ad-hoc status strip out of `main.ts` into SCN-owned modules. Visuals only — no WebSocket, no lat/lon math, no chroma/output modes.

## Background

- Roadmap: `docs/roadmap/phases-roadmap.md` — 0.5 stub HUD; 1.7 simple 2D map; Milestone A exit needs map showing fleet
- Architecture: `docs/architecture/system-architecture.md` §4 (`src/scene/` SCN), ENU axes §5.2 (`x=East, y=Up, z=North`)
- Spine on main: `poseBus` emits `{ id, kind, position, rotation, fovHDeg, ts }` (`src/pose/types.ts`)
- Today: `src/main.ts` has a fixed bottom monospace strip (TEL counts + last ENU); scene already draws boat + drone cam from `poseBus`
- Config: `public/config.json` → `telemetryMode`: `mock` | `replay` | `live` via `loadConfig()`
- TEL **1.9** owns real live wiring later — this DSP’s mode control is a **placeholder** only
- Combined into **one** DSP: both are small DOM overlays sharing the same mount/`poseBus` subscribe

## In scope

### A — Stub HUD (0.5)

1. **SCN-owned HUD module** (e.g. `src/scene/stubHud.ts` or `src/scene/hud/`)
   - Mount into `#app` (or a dedicated overlay root) from `main.ts` / scene bootstrap — keep `main.ts` thin
   - Replace the inline status `div` currently created in `main.ts`

2. **Mode placeholder**
   - Visible control (select or segmented control) labeled for `mock` / `replay` / `live`
   - Initial value from loaded `config.telemetryMode`
   - Changing the control must **not** open WS, switch ingest, or call live VPS — either:
     - disabled with hint “not wired (TEL 1.9)”, or
     - updates local label only + optional `console.info` that live is deferred
   - Do not invent replay loading here (TEL 1.4)

3. **Status text**
   - Show at least: current mode string, TEL packet counters (`drone` / `boat` / `stream_anchor`), last ENU for drone + boat (from `poseBus`, same idea as today’s strip)
   - Readable fixed overlay (monospace OK); pointer-events only on the mode control, not blocking the WebGL canvas elsewhere

### B — 2D map panel (1.7)

4. **Simple top-down fleet map**
   - Small panel (e.g. corner overlay, ~200–280px) — canvas 2D or SVG; **not** Three.js required
   - Plot fleet from `poseBus` only: use ENU **East (x)** vs **North (z)**; Up (y) optional as label, not a third plot axis
   - Distinct markers for `kind === 'drone'` and `kind === 'boat'` (color or shape); label by `id` if cheap
   - Auto-fit bounds to recent points (with padding) **or** fixed scale + recenter — pick the simpler approach; document in a one-line comment
   - North-up: +N toward top of panel, +E toward right (standard)

5. **Subscribe hygiene**
   - One `poseBus.on('pose', …)` (or shared) for map + HUD ENU lines; unsubscribe on teardown with scene/app stop
   - Do **not** subscribe to `telemetryBus` for positions (counts only are OK for HUD)

### C — Polish / hygiene

6. Minimal CSS in `src/style.css` (or co-located) for HUD + map panel — keep dark preview look; no design-system sprawl
7. Update `src/scene/README.md` to mention HUD + 2D map ownership

## Out of scope

- WebSocket client, live VPS connect, replay fixtures (TEL 1.4 / 1.9)
- `gpsToEnu`, EGM96, GeoOrigin, pose pipeline changes (GEO)
- Calibration sliders / offset UI (CAL 1.8)
- Chroma / transparent / WebRTC / clear-color API (OUT)
- Map tiles, Cesium, satellite imagery, course/buoy polylines (later phases)
- glTF boats, sponsors, flags (Phase 2)
- Changing 3D boat/camera behavior beyond not breaking it
- Modifying Unity `../broadcast`
- Committing unless the human explicitly asks

## Likely files

- `src/scene/stubHud.ts` (and/or `src/scene/map2d.ts`, `src/scene/hud/`)
- `src/scene/index.ts` — export/start helpers if useful
- `src/main.ts` — mount HUD + map; remove inline status strip
- `src/style.css`
- `src/scene/README.md`
- Optional tiny unit test for map projection helper (ENU x/z → panel px) if extracted — not required

## Inputs provided

- `poseBus` contract: `PoseEvent` in `src/pose/types.ts` / `docs` in `src/pose/README.md`
- Axis: plot `position.x` (E), `position.z` (N)
- Mock ids: drone `1`, boat `21`
- Existing counters pattern in `src/main.ts` (TEL bus for counts only)
- Mode enum already in config types

## Acceptance criteria

- [ ] Stub HUD visible: mode placeholder + status (mode, TEL counts, last drone/boat ENU)
- [ ] Mode control does **not** enable live WS or change ingest behavior
- [ ] 2D map panel visible; drone + boat points update from `poseBus` while mock runs
- [ ] Map uses ENU x/z only — no lat/lon or `gpsToEnu` in scene/HUD/map code
- [ ] Ad-hoc status strip removed from `main.ts` (logic lives under `src/scene/`)
- [ ] 3D scene (boat + drone camera) still runs; dark preview clear unchanged
- [ ] `npm run build` succeeds; `npm test` still green (or only additive)
- [ ] `npm run dev`: HUD + map observable with mock motion
- [ ] Unity untouched; no secrets committed

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (`npm run build`, `npm test`, `npm run dev` observation)
4. Follow-ups / blockers
5. Suggested memo bullets for SCN (and note roadmap 0.5 + 1.7 for BW)

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-SCN-20260723-01-stub-hud-2d-map).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260723-01-stub-hud-2d-map.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/system-architecture.md §4, §5.2
4. src/pose/types.ts + src/pose/README.md (poseBus contract)
5. src/main.ts (current status strip to replace)

Implement in scope only. Consume poseBus for map/ENU status — no WS, no gpsToEnu, no chroma.
Mode control is a placeholder (do not wire live ingest). Report back per the dispatch.
```
