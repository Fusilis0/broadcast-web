# Ops sidebar shell

Owned by **SCN**. Collapsible left rail that hosts ops panels as **registered sections**.
Phase 11.1 (`DSP-SCN-20260811-01`); later dispatches (library, inspector, NDI tab, map authoring)
mount additional sections into this shell.

Design: [`docs/architecture/unified-ops-sidebar.md`](../../../docs/architecture/unified-ops-sidebar.md).

## Hard invariant — NDI is never the sidebar

The sidebar is a **DOM overlay**. NDI (`ndiFramePump.ts`) reads the **WebGL framebuffer** only.
Do not move ops controls into the Three.js scene graph. Collapsing / expanding the rail must not
change air/NDI pixels.

## Public API

```ts
import { createSidebar, type SidebarSection } from '../sidebar'

const sidebar = createSidebar({ container: app })

sidebar.registerSection({
  id: 'library',          // stable id
  label: 'Library',       // accordion header
  order: 40,              // lower = higher in the rail
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

sidebar.setCollapsed(true)   // air/show — hides rail; sections stay alive
sidebar.isCollapsed()
sidebar.getOverlayHost()     // full-viewport host for PiP overlays (stream map)
sidebar.dispose()
```

### Collapse

- Button in the rail chrome + edge tab when collapsed.
- Hotkey: `` ` `` (backtick / Backquote). Skipped when focus is in an input/select/textarea.
- Collapse does **not** call section `dispose()` and does **not** stop telemetry/editor.
- CSS: `.ops-sidebar[hidden] { display: none }` — required because the rail uses author
  `display: flex`, which otherwise beats the UA `[hidden]` rule.

### Resize

- Drag the **right-edge handle** (`.ops-sidebar__resize`) to set rail width (clamped ~280–560px).
- Width persists in `sessionStorage` (`bw.opsSidebar.widthPx`) for the tab session.
- Sets CSS var `--ops-sidebar-width` on the root so World Authoring / stream-map left offsets track.


### Default section order (11.1+)

| order | id | label | Content |
| --- | --- | --- | --- |
| 10 | `project` | Project | Race Load/Save/Pack + world origin |
| 20 | `world-map` | World Map | **Open authoring** launcher + status (tools live in World Authoring workspace) |
| 30 | `assets` | Assets | Per-entity Focus / Show-3D / Show-2D / Details (SCN-03) |
| 35 | `calib` | Calib | CAL offset sliders + SCN **Calibration overlay** checkbox (ENU grid/marks) |
| 40 | `library` | Library | Universal asset browse/upload (PLT-01) |
| 50 | `live` | Live | Fleet / Live panel |
| 55 | `ndi` | NDI | Air source status (OUT); 2D-map second source stubbed |
| 60 | `ops` | Ops | Output mode (OUT), mode, POV, view, countdown, stream-map toggle, status |

### Assets section (`startAssetInspector`)

Lists boats, POVs, and `WorldFeature`s grouped by type. Focus frames free cam + map
(`frameEnuPoint` / `focusEnu`). Boats reuse `solid`/`ghost`/`hidden` for 3D; features use soft
`visible3d` / `visible2d`. Texture Details prefer Library catalogue, stub list as fallback.

### World Map + Authoring workspace (SCN-04)

World Map section is the **launcher** only (`Open authoring` / `Close authoring`). The dedicated
**World Authoring** window mounts on `getOverlayHost()` (DOM overlay — never WebGL / NDI): large
2D map (≥560px default, user-resizable 420–900px) + grouped tool palette (Course / Graphics /
Fleet / Anchor). Editor role defaults the workspace open; air stays closed. `?editor=1` /
`?editor=0` override. Ops **authoring** checkbox mirrors the same open state (not a second gate).
Close uses `hidden` + `.world-authoring[hidden] { display: none }` so the panel actually disappears.


```ts
import {
  createWorldAuthoringWorkspace,
  mountWorldMapAuthoringLauncher,
  resolveAuthoringInitiallyOpen,
} from '../worldAuthoringWorkspace'

const workspace = createWorldAuthoringWorkspace({
  container: sidebar.getOverlayHost(),
})
mountWorldMapAuthoringLauncher(worldMapSection, workspace)
```

## Stream / PiP map

The on-air stream map stays **outside** the rail (absolute PiP). Mount it under
`sidebar.getOverlayHost()` (still a DOM overlay — never WebGL). Only the show/hide checkbox
belongs in the Ops section.

## CSS

Shell: `.ops-sidebar-root`, `.ops-sidebar`, `.ops-sidebar__*`.
Panels keep their existing classes (`ops-hud__*`, `ops-editor__*`, `fleet-live__*`, `calib-panel`); sidebar-scoped
rules neutralize legacy `position: fixed/absolute` so controls flow in the accordion body.
