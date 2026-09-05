# Dispatch DSP-SCN-20260905-01-onair-2d-1080-boat-scale

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260905-01-onair-2d-1080-boat-scale)
- Priority: **P0**
- Phase: **19.2b** — operator overrides 960×540 source; boats still collide
- Related: `done/DSP-SCN-20260904-10-onair-2d-declutter.md` **human Fail 2026-09-05 00:14**
- Worker result: **code done 2026-09-05** — stream canvas **1920×1080**; Boat size slider default **0.5** (`bw.streamMap.boatScale`); ops `boatLen` 9. Suite **1207 + 26**, `npm run build` green. NDI pumps not rewritten. SCN **code-accept**.
- **Human Pass (local) 2026-09-05** — 1080 + slider accepted. OBS not smoked. Follow-up: `active/DSP-SCN-20260905-02-onair-2d-names-rounding.md`. Hold 19.17.

## Goal

1. Stream / on-air 2D canvas is **1920×1080** (same as AR/3D / NDI lock). Stop upscaling a 960×540 bitmap.
2. Local **2D** gets a **Boat size** slider **under the map**. It scales stream boat icons (length + beam) and their number pills so the operator can stop overlaps. Same scale hits NDI (same canvas).

Ops/authoring map unchanged. Stream allow-list (no chains/sponsors) unchanged. No NDI pump rewrite. No `STUDIO_TICK_FPS`. No Cesium. No 3D sea.

## Background

**04-10 Fail:** boats still too **big and thick**, stacked on each other. Operator wants a **slider under the 2D scene**, not another hard-coded `boatLen`.

**Resolution:** 19.2 / 04-10 locked the source in the 520–960 band and CSS-scaled it. Operator: *“resolution of 2D map is too bad. it should be 1920×1080, like the rest.”* That **overrides** the old “not a 1080p backing store” lock. `STUDIO_OUTPUT_WIDTH/HEIGHT` are already 1920×1080; `letterboxRect` is a no-op when source matches.

2D NDI grab becomes 4× pixels vs 960×540. **Do not** change the pump architecture, skip-forever, or tick fps. Update tests/comments that hard-code 960×540.

## In scope

1. **`STREAM_MAP_WIDTH_PX = 1920`, `STREAM_MAP_HEIGHT_PX = 1080`.** Off-screen host width 1920. Flip `streamMap.test.ts` (drop the 520–960 band cap). `map2d` / stubHud / CSS comments that say 960×540. `letterboxRect(1920, 1080, 1920, 1080)` identity still OK. Local 2D still CSS-fills the sidebar gap.

2. **Boat size slider** (stream / local 2D only):
   - Strip **under** the map in `.local-2d-map-host` (visible in `html.local-focus-2d` only). Label e.g. `Boat size`.
   - Scale **0.25–2.0**, step **0.05**. **Default 0.5** (04-10 `boatLen` 16 / `boatBeam` 8 × 0.5 → **8 / 4**).
   - Scale `boatLen`, `boatBeam`, and fleet **label** pill (`labelH` / font / pad) together. Do **not** scale START/FINISH band, compass, title, or OSM.
   - `sessionStorage` key e.g. `bw.streamMap.boatScale`. Invalid → 0.5.
   - `Map2dHandle.setBoatIconScale(scale)` (stream no-op-safe on ops). Redraw immediately.
   - Tests: clamp; default 0.5; ops `boatLen` still 9.

3. README one-liner. `npm test` + `npm run build`.

## Out of scope

- Rewriting `streamMapNdiPump` / worker grab / `letterboxRect` math (comments + 960 expects only)
- Ops map restyle, 3D boats, 19.17, Cesium
- Label collision solver / leader lines
- Persisting scale into race `project.json`

## Likely files

- `src/scene/streamMap.ts` (+ `streamMap.test.ts`)
- `src/scene/map2d.ts`, `mapChrome.ts` (+ tests)
- `src/scene/stubHud.ts` or host in `main.ts` / `.local-2d-map-host`
- `src/style.css`
- Tests that pin 960×540 (`map2d.test.ts`, `stubHud.layout.test.ts`, `streamMapNdiPump.test.ts` comments)
- `src/scene/README.md`

## Inputs provided

- Operator 2026-09-05: boats too big/thick, overlap; slider under 2D map; source **1920×1080**.
- Current stream base: `boatLen` 16, `boatBeam` 8 (`mapChromeMetrics('stream')`).
- Studio lock: `src/output/studioOutput.ts` 1920×1080.

## Acceptance criteria

- [x] Stream canvas **1920×1080**; tests updated; ops map size unchanged. *(code)*
- [x] Local 2D: **Boat size** slider under the map; 0.25–2.0; default **0.5**; sessionStorage; redraw + NDI same bitmap. *(code)*
- [x] Fleet pills scale with the slider; S/F title/compass do not. *(code)*
- [x] `npm test` + `npm run build` green. *(1207 + 26; build green)*
- [x] Operator smoke: 2D looks sharp at 1080; slider thins boats so 22/24 do not sit on top of each other. *(**Human Pass local 2026-09-05** — OBS not smoked; chrome follow-up 05-02)*

## Report back

1. New width/height constants + which 960 tests flipped
2. Slider default / storage key / what it scales
3. Suite counts
4. SCN memo bullets
