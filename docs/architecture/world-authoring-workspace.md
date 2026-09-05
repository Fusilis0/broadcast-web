# World authoring workspace + floating chrome cleanup (Phase 11 follow-up)

**Status:** Locked (BW) — 2026-08-11  
**Why:** After V1-D, two UX gaps remain:

1. **Collision:** CAL offset sliders (`.calib-panel`, fixed top-left) and OUT output-mode dropdown
   (`.output-mode-control`, fixed bottom-left) sit **outside** the ops sidebar and overlap it.
2. **Authoring invisible:** Map feature tools (`startMapFeatureEditor`) already implement
   billboard-chain / start / finish / flags / buoy / etc., but the panel defaults to
   `hidden` unless `?editor=1` or the Ops “editor” checkbox is on — and even then they live
   inside a ~340px accordion. Ops cannot discover or use 2D→3D world building.

## Decisions

### A. Relocate floating chrome into the sidebar
| Floating today | New home |
| --- | --- |
| Output mode select | Sidebar **Ops** section (above mode/POV) — OUT owns the panel code |
| Calib sliders | Sidebar **Calib** section (new, order ~35 — between Assets and Library) — CAL owns the panel code |

Both lose `position: fixed` when hosted in `.ops-sidebar`; use the same neutralize pattern as
`.ops-sidebar .fleet-live`. No second copy of either control on the canvas.

### B. Dedicated World Authoring workspace (SCN)
Not “unhide the cramped accordion tools” — a **special authoring window**:

- Mounted as a DOM overlay on `sidebar.getOverlayHost()` / `app` (never WebGL — NDI invariant).
- Large 2D map (≥ ~520px, pan/zoom already shipped) + **always-visible tool palette** when open.
- Tools (already in `EDITOR_TOOL_ORDER`): select, mark, gates, sponsor, **billboard chain**, buoy,
  flags, **start**, **finish**, arrow, place boat/drone, set anchor.
- Opening the workspace remounts 3D on edit via existing `onApply` — user sees 2D + 3D update
  together.
- Race setup header **World** toggle opens/closes the workspace (second click closes; overlay has
  **no Close** control). OSM / Fit stay on the map toolbar inside the window.
- Default: workspace **open for editor role**; air role stays closed. Drop reliance on
  `?editor=1` as the only way to see tools (keep query as optional override).
- Close/collapse workspace without disposing editor state (same spirit as sidebar collapse).

## Sequencing

| # | Dispatch | Owner |
| --- | --- | --- |
| 1 | `DSP-SCN-20260811-04-world-authoring-workspace` | SCN — P0 |
| 1 (parallel) | `DSP-OUT-20260811-02-output-mode-into-sidebar` | OUT |
| 1 (parallel) | `DSP-CAL-20260811-01-calib-into-sidebar` | CAL |

OUT/CAL can ship independently of SCN-04 (different files). SCN-04 is the product-critical one.

## Follow-up: workspace usability bugs found after SCN-04 shipped (2026-08-11)

BW reproduced these live via `npm run dev` before dispatching fixes — not just user report:

1. **Close does not actually hide the panel.** `.world-authoring` sets `display: flex`
   unconditionally in `src/style.css`; there is no `[hidden]` override, so `root.hidden = true`
   (set by `setOpen(false)`) has no visual effect — an author-origin `display` rule always beats
   the browser's default `[hidden] { display: none }` UA rule regardless of specificity. The
   status line correctly reads "Authoring: closed" while the ~960px window stays fully visible.
2. **Nothing is resizable** — neither the authoring map (`sizePx` fixed at construction, no
   `ResizeObserver`/drag handle) nor the sidebar rail (`width: min(340px, …)`, no drag handle).
3. **Placement/editing is mouse-only** — no `keydown` handling in `editorPanel.ts` at all: no
   Enter-to-confirm (polyline finish requires a separate button click; two-click tools require a
   literal second click), no drag-to-move an existing point (`select` tool only highlights), no
   Delete-key removal (mouse button only).
4. **Only one visual style for two different jobs.** The viewer-facing "stream" map
   (`createStreamMap2d`) reuses the exact same utilitarian draw path as the ops/authoring map —
   no distinct "broadcast graphic" treatment for the audience.

Dispatched as two follow-ups (same owner, sequenced to avoid file conflicts — see each dispatch's
"Sequencing" note):

| # | Dispatch | Owner | Priority |
| --- | --- | --- | --- |
| 2 | `DSP-SCN-20260811-05-authoring-workspace-fixes` | SCN | P0 — close bug, resize, Enter/Delete/drag editing |
| 3 | `DSP-SCN-20260811-06-stream-map-broadcast-graphic` | SCN | P1 — distinct viewer-facing map style |

Prefer landing #2 before starting #3 (both touch `map2d.ts`/`style.css`).

## Addendum — 19.7 inspector + coordinate place (2026-09-03)

World Authoring overlay form (not the Project section):

- **Show:** name, label, type, lat / lon / alt MSL / height for every world type; type extras (buoy telem + rounding + Full 3D / mesh / tag; sponsor Library picker; chain logos/weights/plate; `spacingM` = ribbon logo pitch; start/finish both GPS ends).
- **Hide:** project id, project name, pack metadata. Save project still uses stored meta.
- **Add:** type + numbers + Add mutates the in-memory feature/fleet store immediately → map + Assets list. 3D remount may follow (`onApply`). No wait-for-disk.
- **Select:** Add becomes **Edit**; Edit writes the selected feature in place.
- Map click remains. Drones: id/name/label editable; lat/lon/alt read-only from live TEL (`HO-TEL-SCN-20260901-01`).
- Visibility fields OK. Do not change 19.8 (`hidden` = hull off, tag on).
- GEO: existing `gpsToEnuAmsl` / `enuToGpsAmsl` only. No OSM / Cesium vendor / ribbon rewrite.

## Addendum — SCN-05 decisions (2026-08-11)

| Topic | Decision |
| --- | --- |
| Close bug | Keep `root.hidden` API; add `.world-authoring[hidden] { display: none }` (same for `.ops-sidebar[hidden]`) |
| Map resize | Corner drag handle on map wrap; clamps 420–900px; `sessionStorage` key `bw.worldAuthoring.mapSizePx`; `getMapSizePx` / `onMapSizeChange` re-layout canvas via `setSizePx` |
| Sidebar resize | Right-edge drag; clamps 280–560px; `bw.opsSidebar.widthPx`; CSS var `--ops-sidebar-width` |
| Keyboard | Enter confirms pending placement; Delete/Backspace removes selection; Escape cancels pending (guard: skip when focus in text fields) |
| Vertex drag | `select` + `hitTestVertex` claims pointerdown (skips pan); live `pushLayout` + throttled `onApply`; exact apply on pointerup |

## Follow-up #3 — `window.prompt()` throws in Electron, resolved 2026-08-12

After SCN-05 shipped, the user reported billboard chain still wouldn't finish via button **or**
Enter. Root cause: Electron's renderer unconditionally overrides `window.prompt()` to throw
(`"prompt() is not supported."` — Electron's own "won't fix"), which silently killed the `async`
`finishBillboardChain()` (and 6 other call sites: boat/drone/buoy id placement, texture-picker
free text, Save as, Rename, Duplicate). This slipped through BW's own acceptance testing of SCN-05
because that was done in a plain Chromium browser tab, where `window.prompt()` works fine — only
Electron has this restriction.

Fix: shared promise-based DOM modal `src/ui/promptModal.ts` (`promptModal(message, defaultValue?)
→ Promise<string | null>`) replaced every `window.prompt(` call site. Split across
`DSP-SCN-20260811-07-electron-prompt-modal` (utility + SCN's 5 call sites) and
`DSP-PLT-20260811-03-electron-prompt-fixes` (PLT's 2 call sites, Save as / Rename / Duplicate).

BW verified this live in the real Electron shell before accepting — not a browser tab, and not
just trusting the worker reports — by launching `desktop/node_modules/electron/dist/electron.exe`
directly against the running Vite dev server and driving the renderer via
`webContents.executeJavaScript`:
- `window.prompt()` confirmed throwing in that exact renderer.
- Billboard chain: tool select → 2 canvas clicks → window `keydown Enter` → texture `promptModal`
  → submit → spacing `promptModal` → submit → no modal left open → feature count 13 → 14, new
  `Chain 3 · billboardChain` row in the Assets list.
- Save as: id `promptModal` → **Cancel** → clean abort; re-run: submit id → name `promptModal` →
  **Escape** → clean abort. No crashes either path.

Process lesson (logged in `BW_MEMO.md` / `SCN_MEMO.md`): any future change touching
`window.prompt`/`alert`/`confirm` or other native browser dialogs must be smoke-tested in the
actual Electron shell, not only a browser tab pointed at the Vite dev server.

