# Dispatch DSP-SCN-20260904-10-onair-2d-declutter

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-10-onair-2d-declutter)
- Priority: **P0**
- Phase: **19.2b** follow-up — local 2D / NDI graphic still PiP-sized and cluttered
- Related: `done/DSP-SCN-20260904-09-onair-2d-chrome.md` **human Fail 2026-09-04 20:31**
- Worker result: **code done 2026-09-04** — local 2D CSS-scales 960×540 into the sidebar gap; stream allow-list drops chains/sponsors; smaller pills. Ops map unchanged. Suite **1202 + 26**, `npm run build` green. SCN **code-accept**.
- **Human Fail 2026-09-05 00:14** — boats still too big/thick and overlap; 960×540 too soft. Follow-up: `active/DSP-SCN-20260905-01-onair-2d-1080-boat-scale.md`. Hold 19.17.

## Goal

1. Local **2D** map uses the **workspace between the sidebars** (16:9, as large as that gap). Stop the 960 px leftover card sitting in a sea of black.
2. On-air / local 2D (`variant: 'stream'`) draws **only** boats, START/FINISH, and buoys/marks (gates OK). **No sponsors. No billboard chains.**
3. Stream tags/icons **smaller** so fleet numbers and mark names do not collide.

Ops/World Authoring map **unchanged** (still shows chains/sponsors for editing). Bitmap source stays **960×540** (not a 1080p store). OSM / canvas title / no crosshair from 04-09 stay. No NDI pumps, no `STUDIO_TICK_FPS`, no Cesium, no 3D sea.

## Background

Operator shot (local 2D, demo-istanbul): map is a **small 16:9 card** in the upper workspace with unused black around it. Cause: stream root **`style.width = '960px'`** (`map2d.ts`) plus host not stretching the **canvas** to the host. CSS `.local-2d-map-host` already computes a large 16:9 box; the child does not fill it.

Same shot: **22 px / labelH 28** pills from 04-09. **Chain 4 / 5 / 6** and boat **22 / 24** overlap. Operator lock: 2D graphic is race traffic + course, not TV boards.

`filterFeaturesFor2d` only honors `visible2d`. Stream must **also** allow-list types.

## In scope

1. **Local 2D fill:** `.local-focus-2d` host fills the gap between sidebars (keep 16:9 contain, maximize). `.stream-map` + canvas **width 100%** of host (override inline 960 px **on screen only**). Off-screen (not 2D focus) stays 960 px so NDI `getCanvas()` is still 960×540. Do not change `STREAM_MAP_WIDTH_PX` / height.
2. **Stream allow-list** (new helper, e.g. `isOnAirMapFeatureType` / `filterFeaturesForStreamMap`): `start`, `finish`, `mark`, `buoy`, `gateLeft`, `gateRight`. Drop `sponsor`, `billboardChain`, `flagP1`, `flagP2`, `arrow`, `rotation`. Still respect `visible2d`. Ops path keeps `filterFeaturesFor2d` only. Tests: stream omits chain/sponsor; ops still draws them.
3. **Smaller stream chrome** (ops metrics **exact** unchanged):

   | Knob | 04-09 (too big) | 04-10 |
   | --- | --- | --- |
   | `boatLen` | 28 | **16** |
   | `boatBeam` | 14 | **8** |
   | `droneR` | 14 | **6** |
   | label / S/F font | bold 22px | **bold 11px** / **bold 12px** S/F |
   | `labelH` | 28 | **14** |
   | `labelPadX` | 10 | **4** |
   | `markR` | 10 | **5** |
   | course / sponsor line | 7 | **4** (sponsor unused on stream) |
   | `windArrowLen` | 28 | **16** |
   | compass | `max(36, h*0.09)` | **`max(28, h*0.06)`** |

   Title strip may stay ~18–22 px (one line, not a colliding tag).
4. Stream may keep **small drone dots** without large name pills; do not add chain/sponsor back.
5. README one-liner. `npm test` + `npm run build`.

## Out of scope

- 1080p stream backing store, NDI pumps, `letterboxRect`
- Restyling the ops/authoring map
- 3D logos/chains, Library, Cesium, 19.17
- Collision-avoidance solver / label leader lines (smaller + fewer layers is enough)

## Likely files

- `src/style.css` (`.local-focus-2d` host + `.stream-map` fill)
- `src/scene/map2d.ts` (inline width; stream feature filter)
- `src/scene/features/featureVisibility.ts` (+ tests)
- `src/scene/mapChrome.ts` (+ `mapChrome.test.ts`)
- `src/scene/README.md`

## Inputs provided

- Fail shot: small card, colliding **Chain 4/5/6** + boat **22/24**, DEMO ISTANBUL title OK.
- 04-09: OSM on stream, canvas title, 960×540.

## Acceptance criteria

- [x] Local 2D: map **fills** the 16:9 box between sidebars (little unused black). NDI bitmap still 960×540. *(code; operator smoke pending)*
- [x] Stream/NDI: no sponsor lines, no “Chain …” labels. START/FINISH + buoys/marks + boats remain. *(code)*
- [x] Stream label/boat metrics match the 04-10 table; ops metrics unchanged. *(code)*
- [x] World Authoring ops map still shows chains/sponsors. *(code)*
- [x] `npm test` + `npm run build` green. *(1202 + 26; build green)*
- [ ] Operator smoke: local **2D** fills the gap; no Chain/sponsor; small boats + S/F + buoys; then OBS `broadcast-web-2d`. *(**Fail 2026-09-05** — boats still collide; 960×540 soft. Follow-up 05-01)*

## Report back

1. How local 2D fill works vs off-screen 960 px
2. Allow-list + test names
3. Metric table as shipped
4. Suite counts
5. SCN memo bullets
