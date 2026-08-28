# SCN_MEMO

**Last updated:** 2026-08-27  
**Status:** Idle — Phase 17.4 Flow panel accepted

## Phase 17.4 accepted 2026-08-27 (BW)

- `done/DSP-SCN-20260826-10` — right rail **Flow** (`id: flow`, order 15), default collapsed; **Live JSON** ≤4 Hz, sessionStorage.
- Cards: `kind` + `id` + `telem`/`srt`/`anchor`; collapse + pop-out; boats without Vid → telemetry + `"no stream"`.
- `main` pushes redacted SRT into `flowTap`; tokens never rendered. DOM-only; sync-debug kept.

## PRF FYI 2026-08-26
Do not raise `STUDIO_TICK_FPS`. Preview ~60 is rAF; NDI 3D stays ~10. Cost-only ocean/tile work may arrive as `HO-PRF-SCN-*`.

## Phase 17.3 accepted 2026-08-26 (BW)

- TEL-08: `SceneOptions.onActivePovChange` after a real `setActivePovId` / allow-list clamp. `main` uses it to swap the warm video texture and `posePipeline.tick(0)` so camera and video move together. `PoseEvent` shape unchanged.

## Phase 16 wave 2 accepted 2026-08-18 pm (BW)

## Phase 16 wave 2 accepted 2026-08-18 pm (BW)

- `done/DSP-SCN-20260818-09` — two overlay rails via `src/scene/sidebar/railLayout.ts` + `createSidebar`. Left: Project · Fleet & Live (`live`) · Assets · World (`world-map`) · Library · Race ops (`ops`). Right: Output (`ndi`) · Calibration (`calib`) · Environment · Wind. `data-ops-section` ids unchanged. Independent widths, per-rail collapse, accordion state — all sessionStorage. Backtick collapses both. New Environment **water m** row (0–5, step 0.1, default 0.5) → `setTerrainWaterDiscardYM`. Panel internals untouched; canvas lock/letterbox unaffected. Suite **654+23**, build green.

## Phase 16 wave 1 accepted 2026-08-18 pm (BW)

- `done/DSP-SCN-20260818-04` — 256² mip noise + `fwidth` + 80–900 m distance/grazing fade; all masks world-XZ; `liftY` **0.08 m**. Terrain water discarded via quantized-mesh **watermask** (stored on `material.roughnessMap`, chained `onBeforeCompile`; ion/plugin order unchanged); fallback world Y < **+0.5 m** AMSL; gated on realistic ocean mounted. Shore-foam prepass now sees land only. API `setTerrainWaterDiscardYM`.
- `done/DSP-SCN-20260818-05` — `windStrings.ts`: 180 merged additive ribbons, 800 m disc, 4–10 m AGL, 6 pts each; follows ramped `uDirectionRad` (from-000° → +Z); fade below 0.5 m/s; ~0.075 ms/tick; mounted in `createRealisticEnvironment` (AR-safe). Vane kept.
- `done/DSP-SCN-20260818-06` — procedural sailboat (tapered hull/deck/keel/mast ~1.2× LOA/boom/main+jib; named `hull`/`sail`/`mastTop`); sails tint to a lighter desaturated boat colour; `applyBoatSailTexture` slot; 10-swatch palette on fleet rows; tag leader from `mastTop`, tag ~4.2 m above mast; additive `fleet.boats[].color`. Legacy `boat.glb` lacks `sail`/`mastTop` → procedural wins until re-export.
- `done/DSP-SCN-20260818-07` — sponsor/chain panels composed as boards (`#f4f4f2` fill, `#2c3338` frame, contain-fit logo or label, opaque); additive `panelColor`/`frameColor`; chain tiling untouched.
- `done/DSP-SCN-20260818-08` — `effectiveRounding(undefined) === 'cw'`; explicit `none` hides; `persistRoundingSelection` keeps CW-on-omit omitted; ring ~8–9 m white torus + red heads, unlit; demo Mark-SE keeps `ccw`.

Merged tree: `npm test` **640 + 23**, build green. Open: glTF sailboat re-export, sponsor colour pickers, human look-dev.

## Phase 16 issued 2026-08-18 pm (BW)

Design: `docs/architecture/phase16-visual-upgrade.md`. Wave 1 parallel: `DSP-SCN-20260818-04` (ocean shimmer AA + terrain water mask/height-discard), `-05` (wind strings, ops+3D only), `-06` (procedural sailboat + category color palette + tag leader; additive `fleet.boats[].color`), `-07` (billboard board/frame), `-08` (rounding default **CW when omitted**). Wave 2: `-09` (two-rail ops layout) after `-06` merges. Ownership: 04 = gerstnerOcean/shoreFoam/terrain; 05 = realisticEnvironment + windStrings; 06 = assets/boatEntity/boatTag/fleetLivePanel rows/boatNames + schema; 07 = sponsors; 08 = rounding/course; 09 = sidebar/stubHud.

## Phase 15 accepted 2026-08-18 (BW)

- `done/DSP-SCN-20260818-01` — clipmap 1-cell ring overlap; glitter 0.16/78 single Blinn; default inner 32 / 7 rings; `seaQuality` high\|low (`?sea=low` / Ops). 14.3f lite: cranked streaks + 3D vane at (16,12) m; yaw = travel; min length 6 m. Stay on `uClipmapCenter`.
- `done/DSP-SCN-20260818-02` — per-feature `rounding` (`cw`/`ccw`/`none`; omit = off) on marks, buoys, gate ends. Procedural two-arrow ring; from above CW = clock = negative `rotation.y`; 5 s/rev via `onBeforeRender`. Assets Details Off/CW/CCW. Demo Istanbul corners default CW.
- `done/DSP-SCN-20260818-03` — allow-listed boats spawn static hulls (`syncFleetHulls` / `upsertStaticBoat`); live telem holds last pose; ghost/hidden apply; Frame fleet works with zero packets. `fleet.boats[]` on RaceProject; Load rebuilds from pack rows, not the names-URL catalogue.

Suite 600+23, build green. Human look-dev still needed (seams, vane, rounding, static hulls).

## Ion token studio field 2026-08-17
- Ops **ion token** password + Apply. `SceneHandle.setCesiumIonToken` remounts
  tiles (auth plugin is baked at create). Empty → off, no throw. Never log.

## Phase 14.3e accepted 2026-08-17
- `done/DSP-SCN-20260817-06-wind-streaks` — Gerstner fragment `windStreak`: anisotropic
  value-noise scrolled along `uDirectionRad`; from-000° **+Z**. `setWindSpeed` drives
  intensity + scroll; fade to 0 below ~0.4 m/s. Two noise taps; no extra FBO / particles /
  `readPixels`. Shore foam + 3 s wind ramp unchanged. Suite 549+23, build green.

## Phase 14.2c + 14.3d accepted 2026-08-17
- `done/DSP-SCN-20260817-04-shore-foam` — half-res terrain-only depth FBO in Gerstner
  `onBeforeRender`; foam/shallow from reconstructed land Y; gated on terrain + realistic +
  opaque-safe. No tileset clip; no extra `readPixels`. Extra cost: one terrain draw at ¼
  pixels per ocean-visible pass. Nudge too far from y=0 can false-flag the whole sea as land.
- `done/DSP-SCN-20260817-05-map-wind-readout` — ops + stream maps subscribe to `windBus`
  only. Travel arrow via `windTravelSceneXZ`; label `from NNN° · XX kt`. From-000°
  screen-down, from-090° screen-left. Ops top-left dense; stream bottom-left broadcast pill.

## Phase 14.2b accepted 2026-08-17
- `done/DSP-SCN-20260817-03-wind-coupled-ocean` — env handle subscribes to `windBus`;
  `windTravelSceneXZ` → `atan2`; from-000° **+Z**; 3 s shortest-arc ramp; foam = `speedMs`;
  mild amplitude 0.65–1.25. No SceneHandle wind API. No `createScene.ts` / terrain edits.

## Phase 14.1 + 14.2a accepted 2026-08-17
- `done/DSP-SCN-20260817-01-cesium-ion-terrain` — `src/scene/terrain/`; default off; ion 1+Bing 2;
  HAE + azimuth π; DOM credits on local 3D only; token never in git. Suite 512+23, build green.
- `done/DSP-SCN-20260817-02-gerstner-ocean` — Gerstner clipmap (5 waves, 7 rings, lift 0.25 m,
  default −Z); `waterCue` hidden when realistic; shared-clock `onBeforeRender` (3D NDI freeze
  closed). `setDirectionRad` / `setWindSpeed` ready for 14.2b.
Coexisted in `createScene.ts` (hooks only).

## Phase 14.0 accepted 2026-08-17 (GEO worker, SCN files)
GEO-led 14.0: 2D map / chrome / snap convert scene `.z` → north. POV: no `UNITY_CAM_TO_THREE`;
negate yaw+pitch. Boats: negate yaw + 180° Y. Pose `yawDeg` still geographic for map icons.

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
