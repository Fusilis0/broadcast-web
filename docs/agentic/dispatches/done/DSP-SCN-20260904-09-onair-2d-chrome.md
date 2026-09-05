# Dispatch DSP-SCN-20260904-09-onair-2d-chrome

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-09-onair-2d-chrome)
- Priority: **P1**
- Phase: **19.2b** — on-air / NDI 2D graphic (after 19.2 PiP removal)
- Related: `done/DSP-SCN-20260829-03-remove-pip-minimap.md` (19.2 **Pass** — restyle deferred here). Design: `docs/architecture/phase19-senexus-qol.md` §19.2b. 04-08 **Human Pass 2026-09-04**.
- Worker result: **code done 2026-09-04** — OSM on stream; ~2× chrome; canvas title; 960×540. Suite **1196 + 26**. SCN **code-accept**.
- **Human Fail 2026-09-04 20:31** — local 2D still a small 960 px card; colliding 22 px pills; Chain 4/5/6 on the graphic. Follow-up: `active/DSP-SCN-20260904-10-onair-2d-declutter.md`. Hold 19.17.

## Goal

Make **`broadcast-web-2d` / local 2D** look like a 16:9 on-air graphic, not a leftover square PiP widget.

1. **Real map on the stream canvas** (OSM underlay when `geoBridge` is set) — NDI samples the canvas, not the ops authoring map.
2. **Readable chrome** after 2× upscale to 1920×1080 (boats, labels, S/F, compass, wind).
3. **Race title on the canvas** so NDI sees it (today `setTitle` only updates a DOM strip).
4. **Widescreen layout** — drop PiP-era square crosshair; size compass from 16:9 height.

Keep the 960×540 source (not a 1080p backing store). Keep OSM attribution. Reuse the existing stream art language (dark wash fallback, title strip, compass, wind pill). Do **not** invent a new brand. Ops/authoring map stays utilitarian and pixel-stable.

## Background

19.2 removed the PiP card and made the source **16:9 960×540**. Phase 11 `-06` chrome (`mapChromeMetrics('stream')`) was sized for a **~520 px square PiP**: `boatLen` 15, **13 px** labels, `labelH` 16, compass `min(w,h)*0.055` (~30 px). NDI upscales 2× — still a small widget.

Stream redraw (`map2d.ts`) **never draws OSM** (`if (!isStream && basemapEnabled)`). `syncMapGeoBridge` already sets the stream bridge. In-app authoring OSM is fine; **on-air is still the radial wash + center crosshair**.

Race name is a DOM `.stream-map__title`. 2D NDI grabs `getCanvas()` only — title never hits air.

§19.2b: *fill 16:9, readable chrome, less PiP-era square layout. In-app map fit-to-screen and real map background are fine. Do not invent a new art language without a reference still.*

## In scope

1. **Stream OSM:** when `geoBridge` is set, draw the same tile path as ops (cache, parent tiles, soft darken, attribution). Default **on** for stream (no OSM checkbox on the stream card). Missing tiles → existing wash fallback. Flip `map2d.test.ts` “stream has no basemap chrome” to “no checkbox; tiles draw when bridge set”.
2. **Stream metrics** ~1.8–2× current (lock in tests; ops numbers **exact** unchanged: `boatLen` 9, `labelH` 12, etc.):

   | Knob | Now | Target |
   | --- | --- | --- |
   | `boatLen` | 15 | **28** |
   | `boatBeam` | 7.5 | **14** |
   | `droneR` | 8 | **14** |
   | label / S/F font | 13 px | **22 px** bold |
   | `labelH` | 16 | **28** |
   | `labelPadX` | 5 | **10** |
   | course / sponsor line | 4.5 | **7** |
   | `markR` | 6 | **10** |
   | `windArrowLen` | 16 | **28** |
   | compass radius | `min(w,h)*0.055` | **`max(36, height*0.09)`** |

3. **Canvas title strip** (top, full width): `setTitle` text on the bitmap. Hide/remove the DOM title on `variant: 'stream'` so local 2D and NDI match (no double title).
4. **Layout:** remove stream center crosshair. Compass top-right at the new radius; wind pill bottom-left; title does not overlap compass. 16:9 vignette (not square `min(w,h)` blob).
5. Local 2D host stay **CSS fit-to-screen** (`.local-2d-map-host`). Source stays **960×540**.
6. README one-liner. `npm test` + `npm run build`.

## Out of scope

- 1920×1080 stream backing store, NDI pumps, `letterboxRect`, `STUDIO_TICK_FPS`
- Ops/authoring map restyle (metrics must stay pinned)
- New brand, new sprites, Library re-seed
- Cesium / 3D sea / 19.17 remount
- Re-adding the PiP card

## Likely files

- `src/scene/mapChrome.ts` (+ `mapChrome.test.ts`)
- `src/scene/map2d.ts` (+ `map2d.test.ts`, `map2dBasemap` reuse)
- `src/scene/streamMap.ts` (comments only unless needed)
- `src/style.css` (hide stream DOM title)
- `src/scene/README.md`

## Inputs provided

- Stream already has `setGeoBridge` from `syncMapGeoBridge` in `main.ts`.
- NDI: `getSourceCanvas: () => hud.getStreamMap().getCanvas()`.
- Ops OSM checkbox stays on the authoring map only.

## Acceptance criteria

- [x] Stream canvas draws OSM when `geoBridge` is set; no stream OSM checkbox. Ops checkbox unchanged.
- [x] Stream chrome metrics match the table; ops metrics unchanged (existing exact expects).
- [x] Race title is pixels on the stream canvas; DOM stream title not shown.
- [x] No stream center crosshair. Compass/wind/title fit 16:9.
- [x] `STREAM_MAP_WIDTH_PX` 960 / height 540 unchanged.
- [x] `npm test` + `npm run build` green.
- [ ] Operator smoke: local **2D** + OBS `broadcast-web-2d` — 16:9 OSM, readable chrome, race name on the picture. *(**Fail 2026-09-04** — small card + colliding chain/boat pills. Follow-up 04-10)*

## Report back

1. OSM on stream (default on / fallback)
2. Metric table as shipped
3. Title: canvas vs DOM
4. Suite counts
5. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260904-09-onair-2d-chrome).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260904-09-onair-2d-chrome.md
2. docs/architecture/phase19-senexus-qol.md §19.2b
3. src/scene/mapChrome.ts (mapChromeMetrics stream vs ops)
4. src/scene/map2d.ts (isStream redraw — no OSM, DOM title, center crosshair)
5. src/scene/streamMap.ts
6. docs/agentic/memos/SCN_MEMO.md

19.2b: on-air 2D is still PiP-era. Put OSM on the stream canvas (NDI samples canvas). Scale stream chrome ~2× for 1080p. Burn race title on canvas; hide DOM title. Drop square crosshair. Keep 960×540. Do not restyle ops map. No NDI pumps, no STUDIO_TICK_FPS, no Cesium, no 3D sea.
Report back per dispatch.
```
