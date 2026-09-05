# Ops sidebar shell

Owned by **SCN**. Two collapsible rails that host ops panels as **registered sections**.
Phase 11.1 (`DSP-SCN-20260811-01`); Phase 16.6 (`DSP-SCN-20260818-09`) split left = race setup /
right = broadcast. Later dispatches (library, inspector, NDI tab, map authoring) still mount
into this shell — ids stay stable.

Design: [`docs/architecture/unified-ops-sidebar.md`](../../../docs/architecture/unified-ops-sidebar.md)
(§3 grouping superseded by [`phase16-visual-upgrade.md`](../../../docs/architecture/phase16-visual-upgrade.md) §7).

## Hard invariant — NDI is never the sidebar

The sidebar is a **DOM overlay**. NDI (`ndiFramePump.ts`) reads the **WebGL framebuffer** only.
Do not move ops controls into the Three.js scene graph. Collapsing / expanding the rails must not
change air/NDI pixels. Studio canvas lock / letterbox is untouched (`createScene.resize`).

## Public API

```ts
import { createSidebar, type SidebarSection } from '../sidebar'

const sidebar = createSidebar({ container: app })

sidebar.registerSection({
  id: 'library',          // stable id — also selects left vs right rail
  label: 'Library',       // accordion header
  order: 40,              // lower = higher in that rail
  mount(container) {
    // Build your panel into `container` (appendChild root, etc.)
    const panel = startMyPanel({ container, /* … */ })
    return {
      dispose() {
        panel.stop() // or dispose()
      },
    }
  },
})

sidebar.setCollapsed(true)              // left rail (compat)
sidebar.setRailCollapsed('right', true) // independent
sidebar.isCollapsed()
sidebar.getOverlayHost()     // full-viewport host (local 2D map host, World Authoring)
sidebar.getHeaderActionsHost('left') // Race setup chrome slot (World toggle)
sidebar.dispose()
```

### Collapse

- Button in each rail's chrome + edge tab when that rail is collapsed.
- Hotkey: `` ` `` (backtick / Backquote) toggles **both** rails (air/show). Skipped when focus is in an input/select/textarea.
- Collapse does **not** call section `dispose()` and does **not** stop telemetry/editor.
- CSS: `.ops-sidebar[hidden] { display: none }` — required because the rail uses author
  `display: flex`, which otherwise beats the UA `[hidden]` rule.
- Collapse flags persist (`bw.opsSidebar.leftCollapsed` / `rightCollapsed`).

### Resize

- Left rail: drag the **right-edge** handle. Right rail: drag the **left-edge** handle.
- Width clamped ~280–560px; independent; persist `bw.opsSidebar.widthPx` / `bw.opsSidebar.rightWidthPx`.
- Inset CSS vars `--ops-sidebar-inset-left` / `--ops-sidebar-inset-right` are **0 when that rail is collapsed** so World Authoring / stream-map / top strip track 0/1/2 rails without reflowing WebGL.

### Accordion

- Per-section open/closed persists in `bw.opsSidebar.accordion`.
- Defaults: Project + Fleet & Live open on the left; Output (`ndi`) open on the right.

### Default section order (16.6)

| rail | order | id | label | Content |
| --- | --- | --- | --- | --- |
| left | 10 | `project` | Project | Race Load/Save/Pack + world origin |
| left | 20 | `live` | Fleet & Live | Fleet / Live panel |
| left | 30 | `assets` | Assets | Per-entity Focus / Show-3D / Show-2D / Details (SCN-03) |
| left | 50 | `library` | Library | Universal asset browse/upload (PLT-01; pragmatic left) |
| left | 60 | `ops` | Race ops | Leftover stubHud: telemetry, POV, view, countdown, status |
| right | 10 | `ndi` | Output | Output mode (OUT) + NDI controller / delay |
| right | 15 | `flow` | Flow | Per-entity telem + SRT JSON inspector (SCN-10; DOM-only; default off) |
| right | 20 | `calib` | Calibration | CAL offset sliders + SCN **Calibration overlay** checkbox |
| right | 30 | `environment` | Environment | simple/realistic, sea, terrain, ion token, **sea m** (ocean Y), **Cesium hide m** (tile discard) |
| right | 40 | `wind` | Wind | source / from-deg / hold |

Section **ids** (`data-ops-section`) stay stable for remaining panels so existing hooks keep working. `world-map` was removed in 19.6 (header **World** toggle). Output mode moved into `ndi`; env/wind rows moved out of `ops`.

### Assets section (`startAssetInspector`)

Lists boats, POVs, and `WorldFeature`s grouped by type. Focus frames free cam + map
(`frameEnuPoint` / `focusEnu`). Boats reuse `solid`/`ghost`/`hidden` for 3D; features use soft
`visible3d` / `visible2d`. Details match World Authoring (19.7): name/label, lat/lon/alt/height,
start/finish both ends, sponsor + chain logos via `openLibraryLogoPicker`. Buoy / mark / gate
Details add Full 3D / Buoy mesh / Tag checkboxes (`visibleBuoyMesh` / `visibleTag`, omit = on;
full hide stays `visible3d`) plus rounding Off/CW/CCW. Sponsor and chain
Details include plate colour + alpha (`panelAlpha` 0–1). Drones: telemetry id
and name/label editable; pose GPS read-only from TEL. Billboard-chain Details: logo rows with
integer weights; `spacingM` = logo pitch on the ribbon; empty list = solid `#2A6FA6` plate.

### World Authoring workspace (SCN-04 / 19.6)

There is **no World accordion**. A compact **World** toggle sits on the Race setup header
(`getHeaderActionsHost('left')`). Click opens the workspace; click again closes it (overlay has
no Close button). The dedicated **World Authoring** window mounts on `getOverlayHost()` (DOM
overlay — never WebGL / NDI): large 2D map (≥560px default, user-resizable 420–900px) + grouped
tool palette (Course / Graphics / Fleet / Anchor). OSM / Fit stay on the map toolbar inside the
window. Editor role defaults the workspace open; air stays closed. `?editor=1` / `?editor=0`
override. Ops **authoring** checkbox mirrors the same open state (not a second gate). Hide uses
`hidden` + `.world-authoring[hidden] { display: none }` so the panel actually disappears.

```ts
import {
  createWorldAuthoringWorkspace,
  mountWorldMapAuthoringLauncher,
  resolveAuthoringInitiallyOpen,
} from '../worldAuthoringWorkspace'

const workspace = createWorldAuthoringWorkspace({
  container: sidebar.getOverlayHost(),
})
mountWorldMapAuthoringLauncher(sidebar.getHeaderActionsHost('left'), workspace)
```

## Stream / 2D map (Phase 19.2)

The on-air stream map is **not** a PiP overlay. Mount it under `.local-2d-map-host`
(created in `main.ts` on `sidebar.getOverlayHost()`): off-screen for 2D NDI, on-screen
for local **2D** focus. Source canvas is **1920×1080**. **Boat size** slider sits under
the map in 2D focus only. There is no ops show/hide checkbox. To restore a PiP later,
re-add `#ops-stream-map` and absolute corner CSS (see `style.css` comment on `.stream-map`).

## CSS

Shell: `.ops-sidebar-root`, `.ops-sidebar`, `.ops-sidebar--right`, `.ops-sidebar__*`.
Panels keep their existing classes (`ops-hud__*`, `ops-editor__*`, `fleet-live__*`, `calib-panel`); sidebar-scoped
rules neutralize legacy `position: fixed/absolute` so controls flow in the accordion body.
