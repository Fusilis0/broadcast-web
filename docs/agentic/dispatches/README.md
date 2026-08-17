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

### Active 2026-08-17 (Phase 14)

**No active worker dispatches.** Phase 14 engineering is complete (14.3c anemometer not issued — needs hardware). Optional later: FFT/wakes, 3D ribbons/flags/spray.

Human **10.1** (Unity cutover) still open.

### Accepted 2026-08-17 (Phase 14.3e)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260817-06-wind-streaks.md`](./done/DSP-SCN-20260817-06-wind-streaks.md) | Gerstner fragment gust mask; from-000° +Z; fade at ~0 m/s; no extra FBO |

### Accepted 2026-08-17 (Phase 14.2c + 14.3d)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260817-04-shore-foam.md`](./done/DSP-SCN-20260817-04-shore-foam.md) | Half-res terrain depth FBO; shore foam/shallow tint; no readPixels |
| [`done/DSP-SCN-20260817-05-map-wind-readout.md`](./done/DSP-SCN-20260817-05-map-wind-readout.md) | Ops + stream wind pills; travel arrow; from-000° screen-down |

### Accepted 2026-08-17 (Phase 14.2b + 14.3b)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260817-03-wind-coupled-ocean.md`](./done/DSP-SCN-20260817-03-wind-coupled-ocean.md) | Gerstner follows `windBus`; 3 s ramp; from-000° → +Z |
| [`done/DSP-TEL-20260817-02-open-meteo-wind.md`](./done/DSP-TEL-20260817-02-open-meteo-wind.md) | Open-Meteo poll ~10 min; operator hold 30 min; marine optional |

### Accepted 2026-08-17 (Phase 14.1 / 14.2a / 14.3a)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260817-01-cesium-ion-terrain.md`](./done/DSP-SCN-20260817-01-cesium-ion-terrain.md) | ion World Terrain + Bing drape; default off; DOM credits 3D-only |
| [`done/DSP-SCN-20260817-02-gerstner-ocean.md`](./done/DSP-SCN-20260817-02-gerstner-ocean.md) | Gerstner clipmap; shared-clock; `waterCue` hidden when realistic |
| [`done/DSP-TEL-20260817-01-wind-bus.md`](./done/DSP-TEL-20260817-01-wind-bus.md) | `windBus` + `windTravelSceneXZ` (from-N → +Z) + Ops row |

### Accepted 2026-08-17 (Phase 14.0)

| DSP | Result |
| --- | --- |
| [`done/DSP-GEO-20260817-01-enu-handedness-fix.md`](./done/DSP-GEO-20260817-01-enu-handedness-fix.md) | Scene ENU `x=East, y=Up, z=−North`; `East × North = +Y` |

Human **10.1** (Unity cutover) still open.

### Active 2026-08-12 (follow-ups) — closed

Soft: if Electron UI still janks after OUT-06, default **3D NDI off**.
Human smokes recommended (FPS, place/delete boats, Project Save).

### Accepted 2026-08-12 (follow-up trio)

| DSP | Result |
| --- | --- |
| [`done/DSP-OUT-20260812-06-ndi-capture-perf.md`](./done/DSP-OUT-20260812-06-ndi-capture-perf.md) | AR 30 / 3D 10 / 2D off@10; AR↔3D stagger |
| [`done/DSP-SCN-20260812-03-fleet-map-pose-sync.md`](./done/DSP-SCN-20260812-03-fleet-map-pose-sync.md) | Delete clears map icons; place seeds without telem |
| [`done/DSP-PLT-20260812-02-electron-project-save-ux.md`](./done/DSP-PLT-20260812-02-electron-project-save-ux.md) | Electron Save→folder; name + Load dropdown |

`npm test` **476 + 23** green at accept.

### Accepted 2026-08-12 (Phase 13 wave 3)

| DSP | Phase | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260812-04-local-channel-switcher.md`](./done/DSP-OUT-20260812-04-local-channel-switcher.md) | 13.5 | Local 2D/3D/AR switcher; never stops NDI |
| [`done/DSP-OUT-20260812-05-ndi-delay-buffer.md`](./done/DSP-OUT-20260812-05-ndi-delay-buffer.md) | 13.6 | Per-channel delay; default 0; max 30000; warn &gt;3s |

`npm test` **461 + 23** green at accept.

### Accepted 2026-08-12 (Phase 13 wave 2)

| DSP | Phase | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260812-02-3d-ndi-channel-pump.md`](./done/DSP-OUT-20260812-02-3d-ndi-channel-pump.md) | 13.3 | Continuous `broadcast-web-3d`; opaque+env pass; AR restore |
| [`done/DSP-OUT-20260812-03-2d-map-ndi-pump.md`](./done/DSP-OUT-20260812-03-2d-map-ndi-pump.md) | 13.4 | `broadcast-web-2d`; letterbox 1920×1080; stub flag **true** |
| [`done/DSP-SCN-20260812-02-ar-calib-coordinate-overlay.md`](./done/DSP-SCN-20260812-02-ar-calib-coordinate-overlay.md) | 13.7 | ENU grid/marks overlay; Calib checkbox; ops doc |

`npm test` **439 + 23** green at accept. Human vMix: confirm all three sources (`broadcast-web`,
`-3d`, `-2d`).

### Accepted 2026-08-12 (Phase 13 wave 1)

| DSP | Phase | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260812-01-multi-sender-ndi-bridge.md`](./done/DSP-OUT-20260812-01-multi-sender-ndi-bridge.md) | 13.1 | Multi-sender `ar`/`3d`/`2d`; AR name still `broadcast-web` |
| [`done/DSP-SCN-20260812-01-sea-sky-environment.md`](./done/DSP-SCN-20260812-01-sea-sky-environment.md) | 13.2 | Water+Sky; forced off for transparent/chroma |
| [`done/DSP-PLT-20260812-01-electron-local-races-save.md`](./done/DSP-PLT-20260812-01-electron-local-races-save.md) | 13.8 | `races:*` IPC; public vs userData roots |

`npm test` **418 + 23** green at wave-1 accept (suite now **439 + 23** after wave 2). Human Electron
checklists (Save folder + vMix) still recommended.

### Accepted 2026-08-11 (Phase 11 follow-up — authoring + chrome)

Design: [`../../architecture/world-authoring-workspace.md`](../../architecture/world-authoring-workspace.md)

| DSP | Owner | Goal | Status |
| --- | --- | --- | --- |
| [`done/DSP-SCN-20260811-04-world-authoring-workspace.md`](./done/DSP-SCN-20260811-04-world-authoring-workspace.md) | SCN | Dedicated World Authoring window | **Accepted** |
| [`done/DSP-OUT-20260811-02-output-mode-into-sidebar.md`](./done/DSP-OUT-20260811-02-output-mode-into-sidebar.md) | OUT | Output mode → Ops sidebar | **Accepted** |
| [`done/DSP-CAL-20260811-01-calib-into-sidebar.md`](./done/DSP-CAL-20260811-01-calib-into-sidebar.md) | CAL | Calib sliders → Calib sidebar | **Accepted** |

### Accepted 2026-08-11 (Phase 11 follow-up #2 — authoring bugs + two 2D maps)

User testing found: Close button doesn't hide the workspace (CSS bug), nothing resizable
(map/sidebar), placement/editing is mouse-only (no Enter/Delete/drag), and the viewer-facing
stream map needs its own bigger/stylish look distinct from the ops map. BW reproduced the Close
bug live before dispatching, and re-verified both worker reports live (CDP + tests) before
accepting. Design addendum: [`../../architecture/world-authoring-workspace.md`](../../architecture/world-authoring-workspace.md#follow-up-workspace-usability-bugs-found-after-scn-04-shipped-2026-08-11)

| DSP | Owner | Goal | Status |
| --- | --- | --- | --- |
| [`done/DSP-SCN-20260811-05-authoring-workspace-fixes.md`](./done/DSP-SCN-20260811-05-authoring-workspace-fixes.md) | SCN | Close bug, resizable map + sidebar, Enter/Delete/drag editing | **Accepted** |
| [`done/DSP-SCN-20260811-06-stream-map-broadcast-graphic.md`](./done/DSP-SCN-20260811-06-stream-map-broadcast-graphic.md) | SCN | Distinct bigger/stylish viewer-facing 2D map | **Accepted** |

No active Phase 11 follow-up #2 workers.

### Accepted 2026-08-12 (Phase 11 follow-up #3 — `window.prompt()` throws in Electron, P0)

User found billboard chain still won't finish (button or Enter) after `-05`. BW root-caused it:
Electron unconditionally overrides `window.prompt()` to throw — it's not a UI quirk, it's an
uncaught exception that silently kills whatever async function called it. Grepped every
`window.prompt(` call site in the repo; **7 call sites across 5 files** were affected (billboard
chain texture + spacing, boat/drone/buoy id placement, texture picker free text, Save as, Rename,
Duplicate). Split by owner per protocol — same root cause, coordinating note in each dispatch.

| DSP | Owner | Goal | Status |
| --- | --- | --- | --- |
| [`done/DSP-SCN-20260811-07-electron-prompt-modal.md`](./done/DSP-SCN-20260811-07-electron-prompt-modal.md) | SCN | Shared `promptModal()` utility + fix editor/texture-picker call sites | **Accepted** |
| [`done/DSP-PLT-20260811-03-electron-prompt-fixes.md`](./done/DSP-PLT-20260811-03-electron-prompt-fixes.md) | PLT | Swap Save as / Rename / Duplicate to `promptModal()` | **Accepted** |

Neither worker could click through the real Electron GUI themselves (no automated Electron UI
driver in their sessions), so BW did before accepting — launched the actual
`desktop/node_modules/electron/dist/electron.exe` against the running Vite dev server (not a
browser tab) and drove the real renderer via `webContents.executeJavaScript`:
- Confirmed `window.prompt()` genuinely throws (`"prompt() is not supported."`) in this exact
  renderer — the bug is real, not theoretical.
- Billboard chain: selected the tool, dispatched two `click`s on the map canvas, dispatched a
  window `keydown Enter` → texture `promptModal` appeared (default `"1"`) → submitted → spacing
  `promptModal` appeared (default `"12"`) → submitted → no modal left open → feature count went
  13 → 14 and a new `Chain 3 · billboardChain` row appeared in the Assets sidebar list. Proves the
  exact user-reported P0 (Enter-to-finish) is fixed end-to-end.
- Save as: clicked the button → id `promptModal` appeared (`"Save as — project id"`) → **Cancel**
  → aborted cleanly, no modal left open. Re-ran, submitted the id modal → name `promptModal`
  appeared (`"Save as — display name"`) → **Escape** → aborted cleanly, no modal left open, no
  crash either time.
- Rename/Duplicate share the same `promptIdName` → `promptModal` primitive already proven above;
  not separately re-driven live (needs a configured `projectsApiBase`), accepted on code review +
  green test suite.
- `npm test` (394 client + 23 server) and `npm run build` green at HEAD.

### Accepted 2026-08-11 (Phase 11 — V1-D unified ops sidebar)

Design: [`../../architecture/unified-ops-sidebar.md`](../../architecture/unified-ops-sidebar.md)

| DSP | Owner | Goal | Status |
| --- | --- | --- | --- |
| [`done/DSP-SCN-20260811-01-ops-sidebar-shell.md`](./done/DSP-SCN-20260811-01-ops-sidebar-shell.md) | SCN | Sidebar shell | **Accepted** |
| [`done/DSP-TEL-20260811-01-buoy-telemetry.md`](./done/DSP-TEL-20260811-01-buoy-telemetry.md) | TEL | Buoy telemetry | **Accepted** |
| [`done/DSP-PLT-20260811-01-asset-library.md`](./done/DSP-PLT-20260811-01-asset-library.md) | PLT | Asset library | **Accepted** |
| [`done/DSP-OUT-20260811-01-ndi-controller-tab.md`](./done/DSP-OUT-20260811-01-ndi-controller-tab.md) | OUT | NDI controller tab | **Accepted** (2nd source stubbed) |
| [`done/DSP-SCN-20260811-02-2d-map-authoring.md`](./done/DSP-SCN-20260811-02-2d-map-authoring.md) | SCN | 2D map authoring | **Accepted** |
| [`done/DSP-PLT-20260811-02-project-manager-sidebar.md`](./done/DSP-PLT-20260811-02-project-manager-sidebar.md) | PLT | Project manager | **Accepted** |
| [`done/DSP-SCN-20260811-03-asset-inspector-panel.md`](./done/DSP-SCN-20260811-03-asset-inspector-panel.md) | SCN | Asset inspector | **Accepted** |

**Milestone V1-D met.** No active Phase 11 workers. Optional: 11.8 revision history, 11.9 show-notes UX.

### Active (Phase 10 — Cutover & console)

| Item | Role |
| --- | --- |
| **10.1** human + BW | Unity vs broadcast-web parallel dress — [`../handoffs/HO-BW-20260804-05-v1c-remaining.md`](../handoffs/HO-BW-20260804-05-v1c-remaining.md) |
| Console emit ack | [`../handoffs/HO-CON-console-team-20260804-01.md`](../handoffs/HO-CON-console-team-20260804-01.md) |

10.2 SPA → `done/DSP-CON-20260804-01` (pending console). 10.3 → `done/DSP-OUT-20260804-01` (**Pass**). No active OUT/CON workers.

### Accepted 2026-08-04 (Phase 9 — V1-B LAN)

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-PLT-20260804-01-auth-roles-lan.md`](./done/DSP-PLT-20260804-01-auth-roles-lan.md) | PLT | Editor vs air bearer |
| [`done/DSP-PLT-20260804-02-offline-venue-pack.md`](./done/DSP-PLT-20260804-02-offline-venue-pack.md) | PLT | Offline venue pack |
| [`done/DSP-CAL-20260804-01-calib-profiles-on-project.md`](./done/DSP-CAL-20260804-01-calib-profiles-on-project.md) | CAL | Calib on RaceProject |

### Accepted 2026-08-04 (Phase 8 — V1-A SCN)

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-SCN-20260804-01-editor-snap-validation.md`](./done/DSP-SCN-20260804-01-editor-snap-validation.md) | SCN | Editor snap + bearing + validation |
| [`done/DSP-SCN-20260804-02-hull-map-dot-colours.md`](./done/DSP-SCN-20260804-02-hull-map-dot-colours.md) | SCN | Hull + map-dot category colours |
| [`done/DSP-SCN-20260804-03-tag-billboard-preview-cam.md`](./done/DSP-SCN-20260804-03-tag-billboard-preview-cam.md) | SCN | Billboard scale per preview vs air pass |
| [`done/DSP-SCN-20260804-04-stream-2d-map.md`](./done/DSP-SCN-20260804-04-stream-2d-map.md) | SCN | Stream/on-air 2D map (CSS PiP) |
| [`done/DSP-SCN-20260804-05-unity-visual-assets-first-slice.md`](./done/DSP-SCN-20260804-05-unity-visual-assets-first-slice.md) | SCN | Unity visual assets first slice |
| [`done/DSP-SCN-20260804-06-ghost-boats.md`](./done/DSP-SCN-20260804-06-ghost-boats.md) | SCN | Ghost / invisible boats (8.6) |
| [`done/DSP-SCN-20260804-07-map-chrome.md`](./done/DSP-SCN-20260804-07-map-chrome.md) | SCN | Map chrome — sail icons + S/F pills (8.7) |
| [`done/DSP-SCN-20260804-08-world-3d-polish.md`](./done/DSP-SCN-20260804-08-world-3d-polish.md) | SCN | Mild 3D polish — buoys/gates + water cue (8.8) |

Handoff: [`../handoffs/HO-BW-20260804-01-open-scn-phase8.md`](../handoffs/HO-BW-20260804-01-open-scn-phase8.md) (closed). OUT follow-up: [`../handoffs/HO-SCN-OUT-20260804-01.md`](../handoffs/HO-SCN-OUT-20260804-01.md).

### Accepted 2026-08-03 (ops polish batch)

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-TEL-20260803-01-live-socket-hygiene.md`](./done/DSP-TEL-20260803-01-live-socket-hygiene.md) | TEL | Enabled-id sockets + last-packet status |
| [`done/DSP-SCN-20260803-01-free-cam-ops-view.md`](./done/DSP-SCN-20260803-01-free-cam-ops-view.md) | SCN | Ops free cam (preview) |
| [`done/DSP-OUT-20260803-01-ndi-active-cam-lock.md`](./done/DSP-OUT-20260803-01-ndi-active-cam-lock.md) | OUT | NDI = active POV (dual-render) |
| [`done/DSP-SCN-20260803-02-world-anchor-ui.md`](./done/DSP-SCN-20260803-02-world-anchor-ui.md) | SCN | World-anchor lat/lon/altMsl UI |
| [`done/DSP-PLT-20260803-01-project-save-as-load.md`](./done/DSP-PLT-20260803-01-project-save-as-load.md) | PLT+SCN | Save / Save as / Load project |
