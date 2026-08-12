# SCN_MEMO

**Last updated:** 2026-08-12  
**Status:** Idle — SCN-03 fleet-map pose sync **accepted**

## Phase 13 follow-up — SCN-03 accepted 2026-08-12
- `done/DSP-SCN-20260812-03-fleet-map-pose-sync` — `removePose` / `retainPoseIds` (buoys kept);
  fleet delete prunes ops+stream icons; place seeds click ENU without telem; HUD allow-list filter.
  Suite 476+23.

## Phase 13 — SCN-02 accepted 2026-08-12
- `done/DSP-SCN-20260812-02-ar-calib-coordinate-overlay` — ENU 50 m grid ±1 km; origin + force-shown
  marks; `setCalibrationOverlayEnabled` default off; Calib checkbox (SCN-mounted); ops
  `docs/ops/ar-calibration-overlay.md`. No offset writes. Suite 439+23 green.
- Soft note for later: OUT-02 reported water may look static on 3D NDI when AR is transparent
  (env unmounted outside 3D pass) — optional SCN follow-up if ops cares.

## Phase 13 — SCN-01 accepted 2026-08-12
- `done/DSP-SCN-20260812-01-sea-sky-environment` — `src/scene/environment/`; Water+Sky; default
  `simple`; realistic only when `opaqueClearSafe` (preview today). API for OUT 13.3:
  `setEnvironmentMode` / `getEnvironmentMode` / `setEnvironmentOpaqueClearSafe`.

## Phase 13 — wave 1 issued 2026-08-12 — historical
BW wrote two design docs covering future SCN scope (reference image: shaded, waved ocean —
"not real sea, a realistic model"). User later clarified: this is **not** a new rendering
pipeline — literally "just adding sea model to 3d environment basically." The "3D channel" is the
same scene/camera as AR, just an opaque clear + the sea/sky model; no second content pipeline.
- [`docs/architecture/realistic-3d-environment.md`](../../architecture/realistic-3d-environment.md)
  — today there is **no** ocean/sky render (`waterCue.ts` is a flat tinted plane; sky is just the
  clear color). Proposed `three/examples/jsm` `Water` + `Sky`, **hard-constrained to the opaque
  clear variant only** — must never render when a channel needs transparent/chroma clear
  (would break AR's alpha-key compositing).
- [`docs/architecture/ar-calibration-map-overlay.md`](../../architecture/ar-calibration-map-overlay.md)
  — SCN render piece: dense ENU-grid/marks overlay through the calibrated camera, for CAL's manual
  calibration-aid feature (read-only, no pose/offset math changes).

Both depend on [`docs/architecture/multi-output-streaming.md`](../../architecture/multi-output-streaming.md)
(OUT's new 3-channel/multi-sender-NDI model) for full context. Do not start until BW dispatches;
this is a read-only heads-up.

## Phase 11 follow-up #3 — accepted 2026-08-12 (P0)
User: billboard chain still won't finish via button **or** Enter after `-05`. BW root-caused it
live: **Electron unconditionally throws on `window.prompt()`** (own source, `window-setup.ts`,
"won't fix" upstream) — not a UI bug, an uncaught exception. This is why BW's own browser-tab
verification of `-05` didn't catch it (browser tabs don't have this restriction, only Electron).
7 call sites across 5 files affected; split by owner (SCN vs PLT), same root cause, coordinating
note in both dispatches.

| DSP | Goal | Status |
| --- | --- | --- |
| `done/DSP-SCN-20260811-07-electron-prompt-modal` | Shared `promptModal()` + fix editor/texture-picker (billboard chain, boat/drone/buoy id, texture free-text) | **Accepted** |
| Sibling `done/DSP-PLT-20260811-03-electron-prompt-fixes` | Save as / Rename / Duplicate (PLT files) | **Accepted** |

Neither worker had an automated way to click through the real Electron GUI in their own sessions.
BW did before accepting: launched `desktop/node_modules/electron/dist/electron.exe` for real
(against the running Vite dev server, not a browser tab) and drove the renderer via
`webContents.executeJavaScript` — confirmed `window.prompt()` throws in that exact process, then
ran the full billboard-chain flow (tool select → 2 clicks → `keydown Enter` → texture modal →
submit → spacing modal → submit) and watched the feature count go 13 → 14 with a new
`Chain 3 · billboardChain` row in Assets. Also drove Save as through both Cancel and Escape paths
cleanly. Full write-up: `docs/architecture/world-authoring-workspace.md` § "Follow-up #3".

**Important for the worker/BW smoke process going forward:** verify anything touching
`window.prompt` in the **actual Electron app**, not just a browser tab — that's how this slipped
through `-05`'s acceptance.

## Phase 11 follow-up #2 (accepted 2026-08-11)

## Phase 11 follow-up #2 (accepted 2026-08-11)
BW reproduced the Close bug live via `npm run dev` before dispatching (not just user report) —
found the root cause is a CSS `display` rule beating `[hidden]`. Also found: nothing resizable,
placement/editing is mouse-only, and the stream map has no distinct viewer-facing style.
Design addendum: `docs/architecture/world-authoring-workspace.md` § "Follow-up: workspace
usability bugs". BW independently re-verified both worker reports (live CDP smoke on −05,
code review on −06) before accepting — see each dispatch's "BW acceptance notes".

| # | DSP | Owner | Goal | Status |
| --- | --- | --- | --- | --- |
| — | `done/DSP-SCN-20260811-05-authoring-workspace-fixes` | SCN | Close bug, resizable map + sidebar, Enter/Delete/drag editing | **Accepted** |
| — | `done/DSP-SCN-20260811-06-stream-map-broadcast-graphic` | SCN | Distinct, bigger, stylish viewer-facing 2D map | **Accepted** |

### −05 bullets
- `.world-authoring[hidden]` / `.ops-sidebar[hidden]` → `display: none` (author `display: flex`
  was beating the UA `[hidden]` rule — Close did nothing visually before this).
- Resizable authoring map (corner handle, 420–900px, `sessionStorage`) + resizable sidebar rail
  (right-edge handle, 280–560px, `--ops-sidebar-width` CSS var).
- Map editor: Enter confirms chain/two-click B; Delete/Backspace removes; Escape cancels pending;
  select-tool vertex drag (claims pointer, doesn't fight map pan).
- BW re-verified live: Close→`display:none`+zero rect, Open round-trip, simulated sidebar drag
  340→460px — all confirmed via CDP (screenshots were unreliable/stale on this canvas-heavy page
  in-session, so CDP `getComputedStyle`/`getBoundingClientRect` was used as ground truth instead).

### −06 bullets
- Stream PiP default **520px**; framed CSS card + branding strip; compass ring; larger chrome metrics.
- Race name → stream title via `Map2dHandle.setTitle` (boot + `applyLoadedRaceProject`).
- Ops metrics pinned (regression): `boatLen: 9`, `labelH: 12`, etc. Ops redraw path untouched.
- NDI second-source still out of scope / stubbed.

## Phase 11 (accepted)
Design: `docs/architecture/unified-ops-sidebar.md` · authoring: `docs/architecture/world-authoring-workspace.md`

| # | DSP | Result |
| --- | --- | --- |
| 11.1 | `done/DSP-SCN-20260811-01` | Sidebar shell |
| 11.6 | `done/DSP-SCN-20260811-02` | Map pan/zoom, buoy/billboardChain |
| 11.7 | `done/DSP-SCN-20260811-03` | Assets inspector |
| — | `done/DSP-SCN-20260811-04` | **World Authoring workspace** — large map + grouped tools; World Map Open/Close; editor defaults open |

### Soft follow-ups (optional)
- Library catalogue content for texture picker
- Save→Load smoke after visibility / placement
- POV 3D toggle has no hull mesh effect yet
- Multi-select / undo-redo / marquee-select on the 2D editor (noted in -05, not required there)

## Prior
Phase 8 complete (8.1–8.8).
