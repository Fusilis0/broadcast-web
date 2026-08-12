# Unified ops sidebar & universal asset pipeline (Phase 11)

**Status:** Locked (BW decision) — 2026-08-11
**Owner:** BW (design) → SCN / PLT / OUT / TEL (implementation)
**Supersedes:** old Phase 11 bullets (11.1 hide-HUD, 11.2 rename/archive, 11.4 boat-id validation, 11.5 basemap) — folded into this doc.

## 1. Why

Ops UI grew ad-hoc: `stubHud.ts` (mode/POV/view/countdown/editor toggle/race select/origin),
`fleetLivePanel.ts` (boats/drones/live sockets), `features/editor/editorPanel.ts` (map feature
tools) are three separately-mounted overlays in `.ops-overlay` (`src/main.ts`). User wants one
left-side control surface: project switcher on top, a real 2D authoring map, a live list of
everything placed in the project (with focus/show-hide/details), a universal (cross-project)
asset library, and an NDI status/controller tab.

## 2. Hard invariant — NDI is never the sidebar

The sidebar is a **DOM overlay**, not a WebGL scene object. NDI capture (`ndiFramePump.ts`) reads
pixels from the **WebGL framebuffer** (`renderer.render` → `readRenderTargetPixels` on the air
camera), never the DOM. Making the sidebar bigger/heavier changes nothing about NDI correctness —
it already dual-renders the active POV camera regardless of what's on screen (free cam, panels
open, etc.). Every dispatch below must **not** move any ops control into the Three.js canvas/scene
graph. This must stay true even as panels grow; each SCN/OUT dispatch adds a regression check
(screenshot or pixel-format assertion) confirming NDI output is unaffected by sidebar open/closed
state.

## 3. Sidebar shell contract

One shell (`src/scene/sidebar/` — new), collapsible, ~340px, docked left, overlaying the canvas
(same z-layer trick as today's `.ops-overlay`, not a flex reflow of the canvas — avoids resize
churn). Sections register into the shell instead of each panel creating its own floating box:

```ts
type SidebarSection = {
  id: string
  label: string
  /** Renders into a provided container; returns a handle with `dispose()`. */
  mount: (container: HTMLElement) => { dispose: () => void }
  order: number
}
sidebar.registerSection(section: SidebarSection): void
sidebar.setCollapsed(collapsed: boolean): void // air/show mode — replaces old 11.1
```

Top-to-bottom layout:

1. **Header** — project name + switcher + Save / Save as / Load / Rename / Duplicate / Archive
   (PLT-02).
2. **World Map** — 2D authoring map: anchor, drag-place, billboard-chain tool, buoy tool (SCN-02).
3. **Assets** — everything placed in the current project: focus / show-2D / show-3D / details
   (SCN-03).
4. **Library** — universal (cross-project) upload/browse of images & models (PLT-01).
5. **Live** — existing Fleet/Live panel content (boats/drones/WS status) — same behavior, new home.
6. **NDI** — controller tab: air source status, (stretch) 2D-map source toggle (OUT-01).
7. **Ops** — leftover misc controls from `stubHud` (mode select, POV switch, ops view, countdown,
   origin Apply) that don't fit elsewhere — smallest possible section, mostly a lift-and-shift.

A collapse toggle (button + hotkey, e.g. `` ` `` or `Tab`) hides the whole rail for air/show — this
*is* old roadmap item **11.1**. Collapsed state does not stop telemetry/editor state; it only hides
chrome.

## 4. 2D map authoring upgrade (SCN-02)

- Keep the existing ENU/GPS canvas map as the **always-available fallback** (offline-safe — no
  internet dependency required for v1 studio use).
- Add pan (drag) + zoom (wheel/pinch) — today's map is a fixed-size box.
- **Optional** raster tile basemap layer (OSM tiles, no API key) rendered *underneath* the existing
  canvas drawing, toggle-able per project; if tiles fail to load (no internet at venue) the map
  silently falls back to the plain grid. This is the pragmatic "Google-Maps-like" v1 — no billed
  API, no hard network requirement. A full offline vector basemap is explicitly **out of scope**
  (future Phase 12+ if ever).
- Click/drag on the map to place: boat, drone/POV, sponsor billboard, **billboard chain** (draw a
  polyline of ≥2 points → evenly spaced billboard instances along it, one texture from the Library),
  **buoy** (new type; see §5). Placing a boat/drone writes into the existing fleet registry
  (`boatIds`/`povIds` + an approximate GPS point held client-side until live telemetry overrides
  it) — it does **not** invent a new telemetry packet.
- New `WorldFeatureType` values: `'buoy'`, `'billboardChain'`. `billboardChain` reuses `points`
  (≥2) + adds `spacingM` + `textureUrl` (from Library). Keep `WorldFeature`/`LayoutFeature`
  additive — no breaking change to `race-project.md` schema (new optional fields only).

## 5. Buoys (SCN-02 UI + TEL-01 telemetry)

Buoys are visually and physically boat-like (they float and drag on the sea) but are a distinct
asset class. Reuse the **existing boat telemetry shape** (`BoatTelemetry`: lat/lon/spd/brg) rather
than inventing a new wire format:

- TEL-01 adds a `buoy` kind tag alongside `boat`/`drone` in the telemetry bus (same packet shape,
  separate id namespace so a buoy id never collides with a boat id), OR — if a live buoy tracker
  isn't available yet at a venue — the buoy simply holds its placed static GPS point (no telemetry
  bound). Binding a live id to a buoy is optional per-buoy, set from the Assets/details panel
  (SCN-03).
- No new "drag physics" simulation is in scope — "drags on sea" is satisfied by live telemetry
  updating position, same as boats. A cosmetic bob/sway shader is optional polish, not required for
  acceptance.

## 6. Universal asset library (PLT-01)

"Universal" = not embedded in one project's JSON; a shared, git-trackable catalogue any project can
reference by URL, matching how `public/textures/sponsors/*.png` already work today (manually
committed). PLT-01 formalizes this with an upload/browse UI instead of manual file drops:

- Storage convention: `public/assets/library/<kind>/<slug>-<shortHash>.<ext>` (`kind` = `image` |
  `model`), catalogue manifest `public/assets/library/index.json` (id, kind, filename, label,
  addedAt). Files here are ordinary repo-tracked static assets — "saved like on GitHub" per the
  request — no opaque DB blob.
- LAN mode: small `server/` upload endpoint (multipart, size-limited, extension allow-list:
  `png/jpg/jpeg/webp/glb/gltf`) writes into that same `public/assets/library/` tree and appends the
  manifest. Static-only mode (no `server/` running): Library tab is browse-only against a prebuilt
  manifest — never silently fails to save, always says clearly whether the write path is live.
- Selecting a library item in a WorldFeature's details (sponsor/billboardChain texture, buoy/boat
  model override) sets that feature's existing `textureUrl` field (or a new optional `modelUrl` —
  additive) — no schema break.
- Reuse `collectVenuePackUrls.ts` — library URLs referenced by a project are already swept into
  venue packs via the existing nested-URL walk; no separate venue-pack path needed.

## 7. Per-asset inspector (SCN-03)

**Assets** section lists every entity in the current project — boats, POVs/drones, sponsors,
billboard chains, buoys, marks/gates/start-finish — grouped by type. Each row:

- **Focus** — free-cam `frameTarget` on that entity (3D) + centers/zooms the 2D map on it.
- **Show/Hide 3D** — reuses `boatVisibility` pattern (`solid`/`ghost`/`hidden`) for boats; adds an
  equivalent per-feature 3D visibility flag for other types.
- **Show/Hide 2D** — independent toggle for map-dot/icon visibility (already partially exists for
  ghost boats' "still on map" behavior — generalize it).
- **Details** — opens a type-specific form: sponsor (size/rotation/texture), billboard chain
  (spacing/point count/texture), buoy (telemetry id binding, static fallback point), POV/camera
  (FOV, calibration offsets — read-only mirror of CAL's `offsetsStore`, edits stay CAL's domain,
  this panel only links out/displays).

## 8. NDI controller tab (OUT-01)

- Ships the **status/controls UI** for the existing single air NDI source (source name, fps, error,
  active POV id) — data already available from `NdiFramePumpHandle`; today it's not surfaced in any
  panel.
- **Stretch, gated:** a second, independent NDI source carrying only the 2D stream map (resolves
  the deferred `HO-SCN-OUT-20260804-01` "map burn-in" question by making it opt-in instead of
  never). Ship only if the Electron `studioBridge`/main-process NDI wrapper can support a second
  named sender without refactoring the whole bridge; otherwise land the tab with the 2D toggle
  visibly disabled + a one-line "not supported by current bridge" note, and file a follow-up — do
  **not** block the rest of Phase 11 on this.

## 9. Sequencing

| Wave | Dispatch | Depends on |
| --- | --- | --- |
| 1 | `DSP-SCN-20260811-01-ops-sidebar-shell` | — |
| 1 (parallel) | `DSP-TEL-20260811-01-buoy-telemetry` | — |
| 2 | `DSP-PLT-20260811-01-asset-library` | Wave 1 shell (Library section mounts into it) |
| 2 | `DSP-PLT-20260811-02-project-manager-sidebar` | Wave 1 shell |
| 2 | `DSP-OUT-20260811-01-ndi-controller-tab` | Wave 1 shell |
| 3 | `DSP-SCN-20260811-02-2d-map-authoring` | Wave 1 shell, PLT-01 (billboard-chain texture picker), TEL-01 (optional buoy live-bind) |
| 4 | `DSP-SCN-20260811-03-asset-inspector-panel` | SCN-02 (new feature types to list), PLT-01 (details texture/model picker) |

Workers may start a wave-2/3/4 dispatch before its listed prerequisite is merged **only** if they
build against the documented contract in this file and flag any drift in their report-back — do not
block hard on sequencing for solo-dev velocity, but call out integration risk explicitly.

## 10. Explicit non-goals (this phase)

- No offline vector-tile pipeline / self-hosted map server.
- No physics-simulated buoy drag (telemetry-driven motion only).
- No multi-user concurrent editing / conflict resolution beyond existing revision `If-Match`.
- No change to the RaceProject schema in a breaking way — every addition here is optional/additive.
- Hetzner/cloud still deferred (Phase 12) — the asset library and second NDI source are LAN/local
  concerns only.
