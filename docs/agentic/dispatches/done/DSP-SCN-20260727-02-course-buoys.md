# Dispatch DSP-SCN-20260727-02-course-buoys

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260727-02-course-buoys)
- Priority: P0
- Phase: Phase 2.3 — course + buoys (SCN-only)
- Related handoffs: none
- BW ask: course + buoys; **no chroma**; **no 2.7** name/colour JSON

## Goal

Add static race **course geometry** (boundary + gates) and **buoy markers** in the Three.js scene, placed from a small JSON fixture of lat/lon waypoints converted to ENU via existing **GEO exports** (`gpsToEnuAmsl` / equivalent). Visible under default mock with the Istanbul origin. No boat name catalogue, no chroma, no TEL/WS changes.

## Background

- Roadmap: `docs/roadmap/phases-roadmap.md` Phase 2.3
- Architecture: SCN owns course/buoys meshes; GEO owns formulas — **call** `src/geodesy` APIs, do not reimplement ECEF/EGM96
- Unity reference (read-only):
  - `../broadcast/Assets/Scripts/CourseRenderer.cs` — waypoints `Mark` | `GateLeft` | `GateRight`; boundary through Marks (closed loop); gate segments pair Left/Right; water Y ≈ 0
  - `../broadcast/Assets/Scripts/BuoyMarker.cs` — pole at GPS AMSL; label; often hidden in broadcast (we **show** buoys for v1 web ops/calib)
- Origin today: `public/config.json` ≈ Istanbul (`41.0082, 28.9784`) — mock boats orbit nearby
- Fleet registry (2.2) unchanged; course is static world content, not `poseBus`-driven
- Names/colours JSON = **2.7** — buoy labels may use waypoint `name` from the course fixture only

## In scope

### 1. Course data fixture

1. Ship a small JSON under e.g. `public/fixtures/course/demo-istanbul.json` (path flexible)
2. Schema inspired by Unity `CourseWaypoint` (document in `src/scene/README.md` or next to fixture):
   - `waypoints[]`: `{ name, type: "mark"|"gateLeft"|"gateRight", lat, lon, altMsl? }`
   - Optional appearance: boundary/gate colors, line width, buoy size — defaults OK in code
3. Place **≥3 marks** forming a visible closed boundary near the committed origin (offsets of tens–hundreds of meters / small lat-lon deltas) so mock drone/fleet can see the course
4. Include **≥1 gate** (paired `gateLeft` + `gateRight`, same name prefix or explicit pair key — document pairing rule; mirror Unity “same name prefix” if simple)
5. Optional config key `courseUrl` (default the demo fixture) in `public/config.json` + `AppConfig` / `loadConfig` — keep PLT-thin; if extending config feels heavy, hardcode default URL in SCN and note follow-up for PLT — **prefer** adding `courseUrl` if cheap (matches `replayUrl` pattern)

### 2. ENU placement (consume GEO only)

6. After origin is set (`applyConfigOrigin` already runs in `main` before/with scene): convert each waypoint with **`gpsToEnuAmsl(lat, lon, altMsl)`** (or documented GEO helper)
7. Render course lines at water plane: use ENU **y** from conversion **or** force `y = 0` / config water Y like Unity `waterSurfaceY` — pick one, document it (Unity defaults water Y=0; AMSL alt 0 near Istanbul may sit at geoid offset — prefer **consistent** with boat HAE visuals: either force water Y=0 for graphics or use converted Y; document choice)
8. Do **not** copy/port GeoUtils math into `src/scene/`

### 3. Three.js visuals

9. **Boundary:** `THREE.Line` / `LineLoop` / fat-line alternative connecting Mark positions (close the loop)
10. **Gates:** line segment between each Left/Right pair (distinct color from boundary — Unity: orange boundary, green gate)
11. **Buoys:** simple pole/mesh (cylinder or cone) at each Mark (and optionally at gate ends); stub label = waypoint `name` (sprite/Text — reuse boat-tag spirit or simpler). Visible in preview (unlike Unity broadcast-hidden default)
12. Wire into `startScene` (or `loadCourse(scene, url)` called from `main` after origin + EGM96 ready)
13. Dispose geometry/materials on `scene.stop()`

### 4. 2D map (light)

14. Optionally draw course marks/boundary on the existing 2D map (ENU x/z) — **nice-to-have**; skip if it balloons scope, but prefer at least mark dots if easy

### 5. Docs / tests

15. Update `src/scene/README.md`
16. Unit-test pure helpers (JSON normalize, gate pairing, latlon→points given mocked ENU) — no need to WebGL-render in Vitest

## Out of scope

- Chroma / clear modes / WebRTC (OUT)
- Name/colour catalogue for boats (**2.7**)
- Sponsors, countdown flags (2.5–2.6)
- Multi-POV (2.4)
- TEL / WS / mock fleet changes
- Reimplementing geodesy; Cesium/tiles
- Live-editable course UI / inspector
- Unity project modifications
- Committing unless the human asks

## Likely files

- `public/fixtures/course/demo-istanbul.json` (or similar)
- `src/scene/course/` or `courseRenderer.ts`, `buoyMarkers.ts`, `loadCourse.ts`
- `src/scene/createScene.ts` / `src/main.ts` — boot hook after origin
- `src/config/types.ts`, `loadConfig.ts`, `public/config.json` — optional `courseUrl`
- `src/scene/README.md`
- Optional: `src/scene/course/*.test.ts`

## Inputs provided

- Unity `CourseRenderer` / `BuoyMarker` behavior notes above
- GEO: `gpsToEnuAmsl` after `applyConfigOrigin` + EGM96 loaded
- Origin + mock already Istanbul-centered
- Dark preview clear + existing lights — keep; no chroma green

## Acceptance criteria

- [ ] Demo course JSON loads; marks form a visible closed boundary in the 3D view under default mock
- [ ] ≥1 gate line visible between paired gate waypoints
- [ ] Buoy markers visible at marks (with stub names from fixture)
- [ ] Lat/lon → ENU uses GEO exports only (no duplicated ECEF math in scene)
- [ ] No boat name/colour JSON (2.7); no chroma
- [ ] Fleet registry / boats still work
- [ ] `npm test` + `npm run build` green
- [ ] `npm run dev`: course readable when camera sweeps toward fleet/course area
- [ ] Unity repo untouched; no secrets

## Report back

When done, reply with:
1. Summary (fixture path, water-Y choice, config key or not)
2. Files touched
3. Tests / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for SCN

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-SCN-20260727-02-course-buoys).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260727-02-course-buoys.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/architecture/system-architecture.md §4
4. src/scene/createScene.ts, README.md; src/geodesy/index.ts (gpsToEnuAmsl)
5. Unity (read-only): ../broadcast/Assets/Scripts/CourseRenderer.cs, BuoyMarker.cs

Implement 2.3 only. Course + buoys from JSON → GEO ENU → Three lines/markers.
No chroma, no 2.7 boat names, no TEL/WS. Report back per the dispatch.
```
