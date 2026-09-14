# SCN_MEMO

**Last updated:** 2026-09-13  
**Status:** Intro Human Pass 2 in tree (hover cameras, tile lock, pins). Record still OUT.

## 2026-09-13 — SRT Human Pass B (no SCN worker)

Operator will eye-check OBS **3D** for sea + terrain vs studio free cam (`docs/ops/srt-human-pass.md` **B**). Plate look is OUT/SRT `srtOut:worldLook`. Do not start an SCN buildings worker from this note.

## 2026-09-09 — intro Human Pass 2 (camera + tiles + pins)

Operator: Cesium pops on video; countries too long; pins behind globe / thick type; no hero pins; cloud snap; wrong 3rd-bridge look; parked cameras; Galata short; Maiden’s three angles; no flags / focus pop.

- Play **locks** tiles after warm. Globe→ENU remount stays under cloud until idle.
- Countries **~1 s hover** (orbit), not parked. Time moved to ENU.
- Yavuz look **41.202, 29.118**. Equal **3 s** hover on three bridges.
- Cloud lerps 2 s in / 2.5 s out.
- Pins: `depthTest: false`, flags, thin type, focus scale, ENU hero labels.
- Galata **8 s** closer. Peninsula Süleymaniye→Topkapı. Maiden’s one left hover.

**Human next:** Play once (wait `tiles: warm`), then **Save tile list**. No MP4 until look Pass.

## 2026-09-09 — DSP-SCN-20260909-02 code-complete (studio boot)

Cold start (no query, missing session): race pack **`empty`**, Race ops view **Free cam**, World authoring **closed**, terrain map **aerial** (Bing ion **2**). `?race=` / `?editor=1|0` still win. Leftover `bw.terrain.overlay` / `bw.ndi.channelWanted` in this tab still wins until the operator changes them.

NDI AR/3D/2D Send default **off** shipped in the same change (`NDI_CHANNEL_WANTED_DEFAULTS`).

## 2026-09-09 — DSP-SCN-20260909-01 code-complete

Play/warm SSE globe **8** / ENU **3** (Bing ion **2**). Path: west **Canada → UK**, east **Russia → Turkey → İstanbul**. USA pin only (no hold). Label **Russia**, never Moscow. Pin İstanbul. Needle pins. Yavuz hold **2.5 s**. ENU seams share boundary poses. Çırağan look **41.04342388464562, 29.01532600006871**. Stay 60 s.

**Human Pass:** Play 60 s (sharp satellite, no ENU pop). Then **Save tile list** so finer tiles land in `tileWarm.contentUrls`. If VRAM holds, globe SSE can try **6**. No MP4 in this DSP.

## 2026-09-09 — OUT Record in tree (do not implement here)

`DSP-OUT-20260908-01` code-complete. `#ops-cinematic-record` enabled. SCN still owns play/seek/hide-race. Human Pass is Electron Record, not this chat.

## 2026-09-09 — operator notes (worker in flight — docs only)

While a Phase 21 worker was still running. **No `src/` / JSON edits from this chat.**

Cinematic (`DSP-SCN-20260909-01`):

1. Aerial still pixelated — Play SSE lower (globe ≤8, ENU 2–4). Bing ion 2 only. Save tile list again after.
2. Path: **Canada → UK** (west), then **Russia → Turkey → İstanbul** (east). Label **Russia**, never Moscow. Pin İstanbul.
3. Better map pins.
4. After Bosphorus zoom: **2–3 s hold on 3rd bridge** (Yavuz).
5. Camera **never teleports** — ENU shot boundaries must share poses (Maiden’s / peninsula / Galata / Çırağan).
6. Çırağan look-at **41.04342388464562, 29.01532600006871**. Stay 60 s.

Studio (`DSP-SCN-20260909-02`): boot race **empty**, ops view **free cam**, World authoring **closed**, terrain **aerial**.

NDI boxes off: `HO-SCN-OUT-20260909-01` (OUT `NDI_CHANNEL_WANTED_DEFAULTS`).

## 2026-09-09 — tile quality + sequence tile list

Operator: mushy Aerial, grey dither, dump button unclear.

- Globe play/warm `errorTarget` **16** (was 48–64). İstanbul ENU **6**.
- Cinematic remounts skip `TilesFadePlugin` (stipple veil) and `UnloadTilesPlugin` (evicting fine tiles). Play stays **unlocked** so LOD can refine.
- Warm merges sidecar cameras + sequence keyframes; longer timeout.
- Ops **Save tile list** writes `tileWarm.contentUrls` onto `intro-bosphorus.json` (stripped ion URLs, no binaries). Far PCs prefetch from that list + ion token. Bytes stay in PLT cache.

No MP4.

## 2026-09-08 — DSP-SCN-20260908-07 code-complete

Tile warm from git manifest `public/cinematics/warm/intro-bosphorus.json` (ion 1 / Aerial 2 / OSM 96188, camera regions, empty `contentUrls`). Bytes via PLT `.cache/cinematic-tiles` (Vite GET+POST) or Electron IPC userData (`--file`). SPA does **not** import `getCinematicTileCacheDir`. Globe countries `errorTarget` 48–64, no OSM. İstanbul ENU 16 + OSM. Project start (origin + token, opaque-safe) prefetches; Play waits (`tiles: warming N/M`); lock-tiles while cinematic active (restore operator lock on Off). Ops **Dump warm URLs** downloads collected content URLs for a later commit. Did not retouch `intro-bosphorus.json`. No MP4.

## 2026-09-08 — DSP-SCN-20260908-06 code-complete

Country pins (canvas sprites, GEO ECEF). Many globe shots, shared boundary poses. Holds: USA 4500 km, Canada 6800 km, UK 1400 km, Turkey 1500 km. Turkey → İstanbul fly then cloud. ENU 32–60 untouched. Human Pass: Play 60 s; scrub 7.9 vs 8.1 — move, not jump. Pins hide on ENU/Off.

## 2026-09-08 — Human Pass look (not Record)

Operator: mostly good. Need (1) country **pins**, (2) **no teleports** — transits, country-scale zoom not cities, (3) Turkey country then **fly** to İstanbul, (4) **P0 tile warm** — manifest in git, bytes local not git.

Workers: `DSP-SCN-20260908-06` **now**. `DSP-PLT-20260908-01` now. `DSP-SCN-20260908-07` after PLT helper. OUT still queued.

## 2026-09-08 — Sultan Ahmed SketchUp purple → stone

Material `153,0,255` on Sultan Ahmed *Yanlar* (minaret bands, no map). Recolored to wall stone in `sultan-ahmed.glb` and at load (`recolorSketchupPurple`). Meshes kept.

## 2026-09-08 — DSP-SCN-20260908-02 code-complete

`intro-bosphorus` in catalogue. Play 60 s, no throw. Globe 0–32, ENU after cloud. Moscow = 0–8 pin only. Rumeli not in JSON. Cloud = 0.5 s JSON steps, not player lerp. Human Pass: `docs/ops/cinematic-heroes-smoke.md` §C (alts, Maiden’s, strait speed). Not MP4.

## 2026-09-08 — DSP-SCN-20260908-05 Rumeli mesh code-accept

Operator dropped Desktop `hero models/hisar2.skp`. OpenSKP textures=True → `public/models/landmarks/rumeli-hisari.glb` (6 images). Catalogue `kind: 'gltf'`. Floor strip also matches `Google_Earth_Snapshot`. Proxy box gone. **Human Pass pending.**

## 2026-09-08 — hero scale + floor strip; Rumeli mesh blocked

Operator notes: Kız Kulesi too small; 2D floors under most heroes; Rumeli is a box.

- **Scale:** Hero buildings panel **scale** (uniform, default 1) on `RaceProject.landmarks.byId.scale`. Same auto-save as XYZ.
- **Floors:** runtime `stripLandmarkFloors` — SketchUp `Google_Earth_Terrain` + Sketchfab `ground` / `sea`. Does not rewrite glbs. Roof `tile_plane*` kept.
- **Rumeli:** no `.skp`/`.glb` in Desktop `hero models` or `public/models/landmarks/`. Issued **`DSP-SCN-20260908-05-rumeli-mesh`**. Proxy stays until the operator drops a file.

## 2026-09-08 — hero offsets baked as catalogue defaults

Operator lock from race **`empty`**. `DEFAULT_LANDMARK_OFFSETS` in `src/scene/landmarks/defaultOffsets.ts`. Pack `landmarks.byId` still overrides. Rumeli + Hagia Sophia stay GPS (no authored row). Not a geoid.

## 2026-09-08 — Operator: need the 60 s sequence, not `_empty`

`_empty` stays the 2 s fixture. **Start `DSP-SCN-20260908-02`** in a **new worker chat** (not the hero-pack chat). Catalogue `intro-bosphorus`. Cloud ease at Marmara, not a full-shot white plate.

## 2026-09-08 — Human smoke `_empty`: white at ~1 s

Operator: 2 s clip, **all-white** around the middle. That is shot 2 (`enu`, t=1–2) with **`cloud01: 1`** — full-screen pale quad (`#e8eef4`), not a renderer crash. First second should still show globe motion. Off should restore race cam. DSP-02 eases cloud only at the Marmara seam (not a 1 s white plate). Fixture retune (pulse / 0.2) only if we need to **see** ENU during Human Pass.

## 2026-09-08 — DSP-SCN-20260908-01 code-complete

Player + 30 Hz + hide-race + globe/ENU remount + cloud + ops. Fixture `_empty` only. GEO converters as-is. Record stub. Human Pass: `docs/ops/cinematic-heroes-smoke.md` §A. DSP-02 unblocked. OUT hooks: `playCinematic` / `pauseCinematic` / `seekCinematic` / `getCinematicTransport` / `renderer.domElement` / `CINEMATIC_FPS`.

## 2026-09-08 — Phase 21 is the other SCN chat. **This chat = Phase 20 heroes.**

## Issued 2026-09-08 — `DSP-SCN-20260908-03` (hero glTF pack)

Operator converted SKP + Sketchfab zips on Desktop `hero models/gltf-out`. Mount into `public/models/landmarks/`. Maiden’s = HQ `maidens-tower.glb` (CC-BY). Galata = small SKP, **not** 419 MB photogrammetry. Rumeli stays proxy. Raise `MAX_LANDMARKS`. GPS starting points in the DSP. `altMsl = 0` → bury/float is GEO.

Worker **code-accept 2026-09-08**. Pack mounted (13 ids). Maiden’s gitignored 98 MB. SKP mm→m. Credits on 3D DOM. Tests 20/20. **Human Pass pending** — street-scale smoke in this chat.

## Issued 2026-09-08 — `DSP-SCN-20260908-04` (Hero buildings panel)

Left rail **Hero buildings**: Focus + ENU XYZ / yaw-pitch-roll. Soft `RaceProject.landmarks.byId`. Auto-save only Electron/API (no Chrome download spam). Re-export SKP glbs with OpenSKP `textures=True` (current glbs have 0 images except Maiden’s). Rumeli stays proxy.

Worker **code-accept 2026-09-08**. SKP glbs now have images (Galata 15, Hagia Sophia 31, …). Tests 101. **Human Pass pending.**

## 2026-09-08 — Phase 21 cinematic (BW lock)

Silent 1080p30 MP4. Globe + ENU, cloud seam, Aerial, no race chrome, no credits. Rumeli Hisarı not in `intro-bosphorus`. Three bridges = human meshes later.

Workers: `DSP-SCN-20260908-01` **code-complete**. `02` JSON unblocked. Record is OUT. Brief: `docs/agentic/briefs/phase21/SCN_PHASE21.md`.

GEO camera: `geodeticToEcefMeters` + `ecefLookAt`; ENU `enuKeyframeToScene`. Degenerate look = nadir.

## 2026-09-07 — Phase 20 `DSP-SCN-20260907-02` **code-accept**

## Worker 2026-09-07 — `DSP-SCN-20260907-02` (hero proxies)

- Three **named procedural proxies**: Maiden’s Tower (terracotta), Rumeli Hisarı (stone-green), Galata Tower (cream). No honest CC glTF this slice. Drop `.glb` + `kind: 'gltf'` later.
- Placement: **`gpsToEnuAmsl` only**. Occupancy `{x,z,radiusM}` 45 / 170 / 45 m → buildings `setOccupancyHoles`. Heroes off / AR → `[]`.
- **`altMsl = 0` (unknown)** for all three. Worker did not live-smoke 3D. If they bury/float vs World Terrain → **HO-SCN-GEO**, do not invent HAE here.
- Ops **heroes** `#ops-heroes-enabled` default **on** (`bw.heroes.enabled`). Landmarks tests **13/13**. Full suite **1288 pass**, 1 fail `library.test.ts` pre-existing. SCN **code-accept 2026-09-07**. **Human Pass pending.**

## Operator Pass 2026-09-07 — 05 (road + aerial both stay)

Operator: keep **map road** and **map aerial**; pick a default later. Overlay lock stands: World Terrain **1** + Bing Road **4** (default) / Aerial **2** (compare). Grey Rec.709 stays dead. Issued worker **02** (heroes).

## Worker 2026-09-07 — `DSP-SCN-20260907-05` (Bing Road overlay)

- Default drape: Bing Maps Road ion **4** on World Terrain **1**. Ops **map** `road`|`aerial` (`#ops-terrain-overlay`). Aerial **2** is compare only.
- Overlay change remounts **terrain only** (`dispose` + `ensureTerrain`). OSM Buildings stay. Watermask / nudge / lock-tiles / AR gate unchanged.
- Rec.709 `uTerrainGrey` **removed**. Session `bw.terrain.overlay` default **road**; leftover `bw.terrain.imageryLook` ignored.
- ion **4** 401 / not IMAGERY → `console.warn` + status + fall back to aerial **2** (no throw).
- Terrain tests **36** + HUD layout **3**. Buildings **21** still no Bing overlay. SCN **code-accept 2026-09-07**. **Human Pass 2026-09-07** (keep both overlays). DSP-02 unblocked.

## Operator Fail 2026-09-07 — 04 (wrong look)

Operator: not a black-and-white satellite filter. Want **Cesium default map** (street/cartographic, like Google Maps) **+ heights**. 04 Rec.709 `uTerrainGrey` on Bing Aerial **2** is the wrong product. Issued `DSP-SCN-20260907-05-road-overlay`: overlay **Bing Maps Road ion 4**; aerial **2** remains a compare; remove the grey shader as the look. Do **not** use Google 2D / Photorealistic.

## Worker 2026-09-07 — `DSP-SCN-20260907-04` (grey Bing)

- Bing overlay **2** kept. Grey = Rec.709 luma in the watermask `onBeforeCompile` chain (`uTerrainGrey`, lift ×1.12+0.06). Toggle writes the uniform; no ion remount.
- Ops **aerial** `grey`|`color` (`#ops-terrain-aerial`), session `bw.terrain.imageryLook`, default **grey**. AR / chroma still gate terrain off.
- Terrain tests **35** + HUD layout **3**. SCN **code-accept 2026-09-07**. **Human Fail 2026-09-07** (wanted road map + heights). Follow-up **05**. DSP-02 still queued.

## Operator Pass 2026-09-07 — OSM boxes (03)

Local **3D**, realistic, terrain on, lock tiles **off**, buildings on: white OSM massing on Bing-draped hills + Gerstner. That is **03 Human Pass**. Operator then asked to try **grey satellite** so hills match the boxes — issued `DSP-SCN-20260907-04-grey-aerial` (desaturate Bing ion **2**, live `color`|`grey`, default grey). Do **not** drop the overlay.

## Operator 2026-09-07 — terrain on, no map (lock tiles)

- **Cause:** Environment **lock tiles** on (`sessionStorage` `bw.terrain.tilesLocked=1`). Tick skips `tiles.update()` while locked. Uncheck **lock tiles**. Stay on local **3D** (AR + alpha is a black plate).

Design: `docs/architecture/3d-environment-buildings.md` · Brief: `docs/agentic/briefs/phase20/SCN_PHASE20.md` · In: `HO-BW-SCN-20260907-01`

## Handoff 2026-09-07 (BW → SCN)

Received `HO-BW-SCN-20260907-01`: Phase 20 city layer only. SCN issues workers; no `src/` in this chat. After Human Pass send the operator to BW — not SRT, not commercial video.

## Phase 20 locks (SCN 2026-09-07)

- **Engine:** second `TilesRenderer` in Three.js (`3d-tiles-renderer`). Same ion token as World Terrain. **Not** CesiumJS / MapLibre / Mapbox GL.
- **20.1a data:** Cesium ion **OSM Buildings asset 96188**. Type is **3D Tiles batched models**, not quantized-mesh. Do **not** register `QuantizedMeshPlugin` or Bing drape on this tileset.
- **Gate:** same opaque-clear as terrain (`setEnvironmentOpaqueClearSafe`). **Never** on AR/chroma.
- **Ops:** Environment **buildings** checkbox. **Default ON** (session). Still needs ion token + opaque-safe. Independent of the terrain on/off select (operator can smoke massing with terrain off).
- **Lock-tiles:** reuse the existing terrain lock checkbox — freeze **both** tilesets. No second lock control in 01.
- **Nudge:** buildings group follows the **same** `terrainNudgeM` as World Terrain (one slider).
- **Credits:** merge OSM/ODbL + ion into the existing DOM overlay. Local **3D** (+ ops overlay). **Never** burned into the AR WebGL plate.
- **Occupancy:** 01 exposes `setOccupancyHoles({x,z,radiusM}[])` in ENU metres (empty default). 02 fills it. Do not z-fight heroes.
- **20.1b:** first slice is **three named proxies** (Maiden’s Tower, Rumeli Hisarı, Galata). Real CC/paid glTF later. Place with existing `gpsToEnuAmsl`. `altMsl = 0`. If they float/bury → **HO-SCN-GEO**, do not guess geoid.
- **Map overlay:** Ops **map** `road` \| `aerial`. Default **aerial** (Bing Aerial ion **2** on World Terrain **1**). Road **4** is compare. Grey Rec.709 is gone.
- **Parked:** IBB, DIY survey, Google Photorealistic, facade-shader polish until 01+02 smoke.

## Phase 20 domain roadmap (SCN)

| Wave | Item | DSP | Status |
| --- | --- | --- | --- |
| **20.1a+c** | OSM Buildings tileset + ops checkbox + credits | `active/DSP-SCN-20260907-01-osm-buildings.md` | **Human Fail 2026-09-07** — no volumes (fixed by 03) |
| **20.1a** | Fail follow-up: volumes must draw | `active/DSP-SCN-20260907-03-osm-buildings-visible.md` | **Human Pass 2026-09-07** |
| **20 look** | Grey Bing aerial to match OSM | `active/DSP-SCN-20260907-04-grey-aerial.md` | **Human Fail 2026-09-07** — B&W filter, not road map |
| **20 look** | Bing Maps Road overlay + heights | `active/DSP-SCN-20260907-05-road-overlay.md` | **Human Pass 2026-09-07** — keep road + aerial |
| **20.1b** | Hero glTF + OSM clip | `active/DSP-SCN-20260907-02-hero-gltf.md` | **Code-accept** — proxies |
| **20.1b** | Operator SKP/glTF pack | `active/DSP-SCN-20260908-03-hero-gltf-pack.md` | **Code-accept 2026-09-08** — Human Pass pending |
| **20.1b** | Hero buildings panel + offsets + SKP textures | `active/DSP-SCN-20260908-04-hero-buildings-panel.md` | **Code-accept 2026-09-08** — Human Pass pending |

## Worker 2026-09-07 — `DSP-SCN-20260907-03` (OSM volumes must draw)

- DSP-01 Fail was an empty **3DTILES** path, not the checkbox. Same ion token as terrain: endpoint **200** `type: 3DTILES`; root **ADD** + **REGION** + b3dm.
- Buildings renderer: `GLTFExtensionsPlugin({ rtc: true, autoDispose: false })`; `loadSiblings = false`; `errorTarget = 16`. Still no quantized-mesh / Bing. Occupancy **skip** shader/hide when holes `[]`.
- Status: `Buildings: on · tiles N` / `ion load failed`. Logs: `[buildings] load-root`, first `visibleTiles` + `worldY`, periodic `visibleTiles 0`. Buried/ECEF Y → warn, do not guess geoid.
- Buildings tests **21/21**. Pre-existing `library.test.ts` + OUT `tsc` unchanged.
- SCN **code-accept 2026-09-07**. **Human Pass 2026-09-07** (white OSM boxes on Bing hills). Grey-aerial follow-up **04**; DSP-02 queued behind 04.

## Operator Fail 2026-09-07 — 01 (no boxes)

- Local **3D**, Environment **realistic**, **buildings** checked. Shot: Gerstner + Senexus ribbon + Bing-draped hills. **Zero extruded OSM volumes.** Terrain is working; the second tileset is not.
- Likely: 3DTILES path missing `GLTFExtensionsPlugin`; OSM globe **ADD** + `loadSiblings`; occupancy `onBeforeCompile` even when holes `[]` breaking fade shaders. Not a checkbox miss. Not GEO yet.
- Issued `DSP-SCN-20260907-03`. Do **not** start heroes.

## Worker 2026-09-07 — `DSP-SCN-20260907-01` (OSM Buildings)

- Second `TilesRenderer` `cesiumOsmBuildings`; ion **96188**. Plugins: `CesiumIonAuthPlugin` (accept `3DTILES`, warn on `TERRAIN`), fade 250 ms, unload **256 MiB**, `UpdateOnChange`, `ReorientationPlugin` (`amslToHae` + 180°). **No** quantized-mesh, Bing, watermask.
- Default **ON** (`bw.buildings.enabled`; missing/`'1'` → on). Hidden if no token or opaque-unsafe (`shouldShowTerrain`). Independent of terrain on/off. Shared nudge + lock-tiles. Token Apply remounts buildings; empty → off, no throw. 401 → status + `console.warn`.
- Credits merge into 3D DOM overlay; ODbL fallback **© OpenStreetMap contributors**. Never AR plate.
- `setOccupancyHoles({x,z,radiusM}[])` ENU; default `[]`; fragment discard + hide meshes fully inside a disk. On `SceneHandle` for 02. Does not clip terrain/ocean.
- Buildings tests **14/14**. Full suite **1258 pass**, 1 fail `library.test.ts` (seeded logos vs test allow-list) — **pre-existing**. `tsc` red on OUT `videoDecodePipeline.ts` — **pre-existing, not this DSP**.
- SCN **code-accept 2026-09-07**. **Human Fail 2026-09-07** (no boxes). Follow-up **03**.

## After each Phase 20 worker

Human: **test now** (clicks in the DSP). Good: 3D city **massing** (boxes), not a flat photo coast; AR plate still clean; lock-tiles still works; ops not bricked. **03 Pass** → new worker chat with 02. Heroes wrong height or boxes buried under hills → GEO (`GEO_PHASE20.md`). **03+02 Human Pass** → **BW** (`BOOTSTRAP_BW.md`). Do not issue SRT/OUT egress or commercial video from SCN.

---

Phase 19 design: `docs/architecture/phase19-senexus-qol.md` · Brief: `docs/agentic/briefs/phase19/SCN_PHASE19.md`

## Handoff 2026-09-02

Received `HO-CAL-SCN-20260902-01`: CAL 19.5.  
Issued `HO-SCN-PLT-20260902-01`: library seed.  
Received `HO-PLT-SCN-20260902-01`: **19.16 seeded** (Rolex / Senexus / Vodafone). Consume `listLibraryAssets`; do not re-seed.

## Handoff 2026-09-05

Issued `HO-SCN-PLT-20260905-01`: **19.17** investigation (Electron vs remount).  
Received `HO-PLT-SCN-20260905-01`: stall is **`remountWorldFromFeatures`** (579–755 ms), not `races.read`. `restartIngest` before `fleetPanel.setState`. Issued `DSP-SCN-20260905-03`. Load-button lock stays.  
Issued `HO-SCN-BW-20260905-01`: **19.2b + 19.17 Human Pass**. SCN Phase 19 parked.

## Phase 19 domain roadmap (SCN)

Parked: OUT idle · CAL 19.5 done · PLT 19.16 **done** · GEO 19.18 · NDI fps.

| Wave | Items | DSP | Status |
| --- | --- | --- | --- |
| **B1** | 19.2 / 19.6 / 19.9 / 19.10 + load UX + empty pack | `done/DSP-SCN-20260829-03` … `20260902-02` | **Accepted** |
| **B2** | **19.11** picker + ribbon | `done/DSP-SCN-20260902-03` + `20260903-02` | **Human Pass 2026-09-03** |
| **B2** | **19.8** hidden = hull off, tag on | `done/DSP-SCN-20260902-05` | **Human Pass 2026-09-03** |
| **B2** | **19.12** OSM zoom coverage | `done/DSP-SCN-20260902-06` | **Human Pass 2026-09-03** |
| **B2** | **19.7** inspector + coord Add | `done/DSP-SCN-20260902-04` | **Human Pass 2026-09-03** (follow-ups 04–06) |
| **P0** | Load hitch → AR/3D **white** | `done/DSP-SCN-20260903-01` | **Human Pass 2026-09-03** |
| **B3** | **19.13** boat foam wakes | `done/DSP-SCN-20260903-03` | **Human Pass 2026-09-03** (hulls under sea blocked smoke) |
| **P0** | Boat alt Y + water m negative | `done/DSP-SCN-20260903-04` | **Human Pass 2026-09-03** |
| **P1** | Sponsor logo / plate / alpha / A–B uniform | `done/DSP-SCN-20260903-05` | **Human Pass 2026-09-03** |
| **P1** | Buoy mesh / tag / full hide | `done/DSP-SCN-20260903-06` | **Human Pass 2026-09-03** |
| **B3** | **19.15** sea over assets | `done/DSP-SCN-20260903-07` | **Fail 2026-09-04** — holes/glitch; water m ≠ sea; Alt ignored |
| **P0** | Flat sea + sea m + GEO alt Y | `done/DSP-SCN-20260904-01` | **Human Pass 2026-09-04** (assets visible; knobs work) |
| **P0** | Flat sea 2D motion + glitter split | `done/DSP-SCN-20260904-02` | **Partial Pass 2026-09-04** — motion OK; look unify → 04-03 |
| **P1** | Unify sun-blob vs matte; Gerstner troughs | `done/DSP-SCN-20260904-03` | **Human Pass 2026-09-04** — notes → 04-04 |
| **P1** | Darker crests; no water plates; soft light | `done/DSP-SCN-20260904-04` | **Fail 2026-09-04** — PNG black backs still show as plates |
| **P0** | Logo knockout + teal sea | `done/DSP-SCN-20260904-05` | **Fail 2026-09-04** — white-RGB a=0 + mips; sea still grey under fog |
| **P0** | Logo alpha sanitize + sea reads teal | `done/DSP-SCN-20260904-06` | **Fail 2026-09-04** — fog plates; sea too bright cyan |
| **P0** | Fog off water boards + dark deep water | `done/DSP-SCN-20260904-07` | **Fail 2026-09-04** — fog-off not enough; heightM slab |
| **P0** | Glyph crop + A–B canvas + sea zoom | `done/DSP-SCN-20260904-08` | **Human Pass 2026-09-04** (1/9 sea; no flatten plates) |
| **B3** | **19.2b** on-air 2D chrome | `done/DSP-SCN-20260904-09` | **Fail 2026-09-04** — small card; colliding chain/boat pills |
| **B3** | 19.2b declutter + fill | `done/DSP-SCN-20260904-10` | **Fail 2026-09-05** — boats still collide; 960×540 soft |
| **B3** | 19.2b 1080p + boat slider | `done/DSP-SCN-20260905-01` | **Human Pass (local) 2026-09-05** — follow-up 05-02 |
| **B3** | 19.2b names / rounding / course scale | `done/DSP-SCN-20260905-02` | **Human Pass 2026-09-05** |
| **B3** | 19.17 instant project switch | `done/DSP-SCN-20260905-03` | **Human Pass 2026-09-05** |

## After each worker (Phase 19 archive)

Human: Phase 19 parked (19.2b + 19.17 Pass). GEO 19.18 still Q5. Do not reopen sea/2D look-dev unless the operator asks.

## Operator 2026-09-05 — 05-03 Pass

- Load `demo-istanbul` ↔ `30agustos`: lists + 2D before 3D. Dropdown still pick-only. No white on rapid Load. Issued `HO-SCN-BW-20260905-01`.

## Worker 2026-09-05 — `DSP-SCN-20260905-03` (lists + 2D before remount)

- Packed Load: `readPackedWorldFeatures` clone → `applyWorldFeatures` → chrome + `setFleetAllowLists` + **`fleetPanel.setState`** + Assets refresh → **`void restartIngest`** → double-rAF `yieldPaintFrames` (`uiPaint`) → **`startPackedWorldRemount`** (no await). Packed remounts that list once (not `[]` first).
- `switchingRace` released after UI schedule (~2 frames), not after 579–755 ms remount. `remountGen` kept (stale abort). Load button-only unchanged. Origin Apply still awaits remount. Boot still `await loadWorldForProject`.
- URL packs: lists first, then `void loadWorldForProject` → `applyWorldFeatures` (loaders still mount). Acceptance packs embed `features`.
- `?debug1917=1` stages: `readWorldFeatures`, `fleetPanel.setState`, `uiPaint`, `remountStarted`, then `remountWorldFromFeatures`.
- Suite **1223 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-05**. **Human Pass 2026-09-05.** Next: BW.

## Operator 2026-09-05 — 05-02 Pass

- Local 2D names, no marks/drones, S/F on the line, buoy names + rounding, Boat size scales course, no hull box. Issued `HO-SCN-PLT-20260905-01`.

## Worker 2026-09-05 — `DSP-SCN-20260905-02` (names / rounding / course scale)

- **Names:** `boatNamesFromCatalogue` → `streamMap.setBoatNames`. Stream pills `resolveStreamFleetLabel` (trimmed name, else id). Ops still `${id}`. 21 → Bora, 22 → Aksu.
- **Allow-list:** `isOnAirMapFeatureType('mark')` **false**. Stream keep start/finish/buoy/gates. Skip `kind === 'drone'`. No legacy `courseMarks` on stream. Ops filter unchanged.
- **S/F:** `drawLabelPill` `center` anchor on segment midpoint. No `+5` / `-3`. Sponsor/chain stay offset.
- **Buoys:** stream pills use `name` (Cıragan), not type-echo `label: "buoy"`. Rounding on stream buoys/gates only (`effectiveRounding`; `roundingCanvasYawRad = −roundingYawRad` so CW is clockwise on Y-down map). **10 Hz** `setInterval` while mounted; cleared on dispose. No rings on hulls.
- **Boat size:** `scaleStreamBoatChrome` now also `markR` / `gateEndR` / `courseLine` / `gateLine` / `sfFont` / `sfEndR`. Stream layout gets **scaled** `fleetChrome`. Compass / title / OSM / wind unscaled. Ops `boatLen` 9.
- **Hull box:** `drawTintedSprite` AABB `strokeRect` removed. Procedural outline + canvas hairline stay.
- No NDI pumps / `STUDIO_TICK_FPS` / Cesium / 3D sea.
- Suite **1217 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-05**. **Human Pass 2026-09-05.** Next: PLT 19.17.

## Operator 2026-09-05 — 05-01 Pass (local) → 05-02

- **Pass on 05-01 scope:** 1920×1080 + Boat size slider. OBS not smoked; operator moved on.
- **Follow-up (05-02):** stream pills = catalogue **names** (Bora not 21); drop `mark` + drones; S/F pill on segment midpoint; buoy **name** (not `label: "buoy"`); rounding arrows on **buoys** (omit=CW, none=hide, ccw) matching Assets Details — **not** on hulls; slider also scales S/F + buoys + glyphs (not compass/title/OSM); remove `drawTintedSprite` AABB `strokeRect`.
- Hold 19.17. No NDI pump rewrite.

## Worker 2026-09-05 — `DSP-SCN-20260905-01` (1080 stream + boat slider)

- **Canvas:** `STREAM_MAP_WIDTH_PX` **1920** / height **1080** (studio lock). Off-screen host **1920 px**. Dropped the 520–960 band cap. Local 2D still CSS-fills the sidebar gap (`width: 100% !important`). `letterboxRect(1920, 1080, 1920, 1080)` identity — NDI pumps not rewritten.
- **Boat size:** slider under `.local-2d-map-host` (visible in `html.local-focus-2d` only). Range **0.25–2.0**, step **0.05**, default **0.5**, `sessionStorage` `bw.streamMap.boatScale` (invalid → 0.5). `Map2dHandle.setBoatIconScale` scales stream `boatLen`/`boatBeam` + fleet pill (`labelH` / font / pad) only. Base remains 16/8; default 0.5 → **8/4**. START/FINISH / compass / title / OSM unscaled. Ops `boatLen` still **9**; ops `setBoatIconScale` is a no-op.
- No NDI pumps / `STUDIO_TICK_FPS` / Cesium / 3D sea.
- Suite **1207 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-05**. **Human Pass (local) 2026-09-05.** OBS not smoked. Follow-up **05-02**.

## Operator 2026-09-05 — 04-10 Fail (boats + resolution)

- **Boats:** still too big/thick, stacked. Issued 05-01: **Boat size** slider under local 2D (0.25–2, default **0.5**, sessionStorage). Scale len/beam + fleet pills only.
- **Resolution:** 960×540 CSS-upscale looks soft. Operator overrides 19.2 band: stream canvas **1920×1080** (same as AR/3D). NDI pumps not rewritten. Hold 19.17.

## Worker 2026-09-04 — `DSP-SCN-20260904-10` (on-air 2D declutter)

- **Fill:** local-focus-2d host keeps 16:9 contain between sidebars + `aspect-ratio: 16/9`. `.stream-map` inline 960 px is overridden **on screen only** (`width: 100% !important` + canvas 100%). Off-screen host stays 960 px; bitmap still **960×540** (`STREAM_MAP_WIDTH_PX` unchanged).
- **Allow-list:** `isOnAirMapFeatureType` / `filterFeaturesForStreamMap` — start, finish, mark, buoy, gateLeft, gateRight; still `visible2d`. Drops sponsor, billboardChain, flags, arrow, rotation. Ops keeps `filterFeaturesFor2d` only (chains/sponsors stay on World Authoring). Stream drones = small dots, no name pills.
- **Metrics (stream / ops unchanged):** `boatLen` 16 / 9, `boatBeam` 8 / 4.5, `droneR` 6 / 5, label **bold 11px** / 10px, S/F **bold 12px** / 10px, `labelH` 14 / 12, `labelPadX` 4 / 3, course/sponsor line 4 / 3, `markR` 5 / 3.5, `windArrowLen` 16 / 10. Compass `max(28, height*0.06)` (540 → 32.4). Title strip still ~22 px.
- Tests: `isOnAirMapFeatureType` / `filterFeaturesForStreamMap`; `ops still draws Chain/sponsor labels; stream allow-list omits them`; `stream redraw uses filterFeaturesForStreamMap`; chrome 04-10 table; CSS fill `100% !important`.
- No NDI pumps / `STUDIO_TICK_FPS` / Cesium / 3D sea.
- Suite **1202 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-04**. **Do not Pass until operator smoke.**

## Operator 2026-09-04 — 04-09 Fail (small card + clutter)

- **Space:** local 2D is still a ~960 px card with unused black. Stream root inline `width: 960px` does not fill `.local-2d-map-host`. Issued 04-10: CSS-scale to the sidebar gap; keep 960×540 bitmap.
- **Clutter:** 22 px / `labelH` 28 pills collide; **Chain 4/5/6** on air. Operator: 2D = boats + start/finish + buoys only; no sponsors/chains; smaller tags. Ops authoring map still shows boards.
- Hold 19.17.

## Worker 2026-09-04 — `DSP-SCN-20260904-09` (19.2b on-air 2D chrome)

- **OSM:** stream canvas uses the same tile path as ops when `geoBridge` is set (cache, parents, soft darken, attribution). Default **on**; **no** stream OSM checkbox. Missing tiles keep the wash. Ops checkbox + metrics unchanged.
- **Metrics (stream / ops unchanged):** `boatLen` 28 / 9, `boatBeam` 14 / 4.5, `droneR` 14 / 5, label+S/F **bold 22px** / 10px, `labelH` 28 / 12, `labelPadX` 10 / 3, course/sponsor line 7 / 3, `markR` 10 / 3.5, `windArrowLen` 28 / 10. Compass `max(36, height*0.09)` (540 → 48.6). Source still **960×540**.
- **Title:** `setTitle` burns uppercase text on the canvas strip; DOM `.stream-map__title` not mounted (CSS `display: none` backup). No stream center crosshair. 16:9 elliptical vignette. Compass top-right; wind bottom-left.
- Files: `mapChrome.ts`, `map2d.ts`, `map2dBasemap.ts` comment, `streamMap.ts` comment, `style.css`, tests + `src/scene/README.md`. No NDI pumps / `STUDIO_TICK_FPS` / Cesium / 3D sea.
- Suite **1196 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-04**. **Do not Pass until operator smoke** (OBS still required).
- Human: local **2D** + OBS `broadcast-web-2d` — 16:9 OSM (or wash), readable chrome, race name on the picture.

## Operator 2026-09-04 — 04-08 Pass

- Glyphs on water, no teal rectangles; flatten-off + crop held. Sea **1/9** (not ×3 blobs). Operator: “too few iterations” but **Pass / go next**. Do not issue another sea DSP unless they reopen. 19.2b issued.

## Operator 2026-09-04 — 04-08 Fail (3× too coarse + plates remain)

- **Sea:** first 04-08 used `OCEAN_LOOK_XZ_SCALE` **3** (wavelengths ×3). Operator shot: huge soft patches. They wanted **1/3**, so after ×3: **1/9**. Follow-up: wavelengths 48→5.33 … 7→0.78; streak UV ×9.
- **Rectangles:** still teal/grey quads under Rolex / Senexus / START / FINISH / marks. Causes: (1) fragment Gerstner **flattened shading** under board footprints (`max(suppress.x, 1-shadeAmp)`) even with disp=0 — painted rectangular matte water; (2) pixel crop often no-op → full board mesh. Follow-up: **no fragment flatten**; crop via pixel AABB **or** `glyphCropFromPlan` / UV offset+repeat.

## Worker 2026-09-04 — `DSP-SCN-20260904-08` (glyph crop + A–B canvas + sea zoom)

- **Crop:** plate-off water-plane compose still draws on the full board canvas, then pixel AABB **or** `glyphCropFromPlan` (logoDest / letters) shrinks mesh + UV. Physical canvas crop when getImageData works; UV offset/repeat fallback when it does not. START/FINISH uses pixel AABB or `measureText`. Plate-on skips crop. Fragment ocean **no longer flattens** shading under board OBBs (that was painting teal rectangles behind marks). Keep `fog: false`. Did not flatten the chain. Library PNGs not replaced.
- **heightM:** `sponsorPlaneSize` is always A–B × (`A–B / DEFAULT_SPONSOR_BOARD_ASPECT` 2). Packed `heightM` 36/100/120 and rewritten `boardAspect` are ignored for the OBB. `heightM` is glyph scale inside that canvas (`glyphScaleInsideCanvas`, clamp ≤ 1). A–B stretch still scales glyph metres uniformly. Flat world Y stays `WATER_PLANE_Y + 0.08`, never `heightM/2`. Inspector caption: `heightM (glyph in A–B canvas)`.
- **Sea:** `OCEAN_LOOK_XZ_SCALE` **1/9** — wavelengths 48→**5.33** … 7→**0.78**; streak along/across/noise `0.016×9`, `0.22×9`, `0.07×9`. (First 04-08 used ×3 — too coarse.) Clipmap extent unchanged. Fragment **does not flatten** shading under board footprints (that painted rectangular matte plates). Dark hexes `0x0c2f3a` / `0x164a55` / `0x2a4a52` unchanged. `displacementScale` still **0**. No Cesium vendor / NDI pumps / `STUDIO_TICK_FPS`.
- Files: `boardCompose.ts`, `sponsorLayout.ts`, `sponsorBillboard.ts`, `lineSignMesh.ts`, `positionMarkerMesh.ts`, `gerstnerOcean.ts`, inspectors + tests + READMEs. Suite **1193 + 26**, `npm run build` green (Fail follow-up).
- SCN orchestrator **code-accept 2026-09-04** (Fail follow-up). **Human Pass 2026-09-04 20:02.**
- Human: **hard-refresh**. Load pack → Environment **realistic** → Rolex/Vodafone/Senexus **glyph only** on water (wave texture around the mark, **no teal/grey rectangle**). START/FINISH letters hug the ink. Raising inspector heightM does **not** shoot a slab off the GPS A–B canvas. Sea ripples look **finer / denser** (1/9), still dark navy. Inspector plate alpha restores a full plate. AR: no ocean.

## Operator 2026-09-04 — 04-07 Fail (rectangles + heightM slab)

- **Rectangles:** still a teal/grey quad under Rolex / Vodafone / Senexus / START / FINISH. Fog-off left the **full transparent board mesh**. Issued 04-08: **crop canvas + mesh to opaque glyph AABB** when plate is off.
- **heightM:** operator shot elongates “to upside” as they raise `heightM`. Pack has flat sponsors at **36 / 100 / 120** m; `applySponsorScaleOnEdit` treats that as **across-track metres**. Caption already says uniform scale. They used this so marks would not sit under waves. **Sea is flat now — drop that hack.** A–B = canvas region; across = A–B / aspect; do not grow the OBB with heightM. World Y stays water + 0.08, never `heightM/2` on flat.
- **Sea texture:** ripples too large / too close. Issued same DSP: fragment look **~3× zoom-out** (wavelengths ×3, noise/streak ÷3). Keep 04-07 dark hexes. Vertex disp **0**.
- Chain stays upright. Do not re-seed. Hold 19.2b.

## Worker 2026-09-04 — `DSP-SCN-20260904-07` (fog off + dark deep water)

- **Rectangles:** Three.js default `fog: true` on transparent `MeshBasicMaterial` mixed scene fog into the whole water-plane quad. **`fog: false`** on flat sponsor boards (`createSponsorBillboard` placement `flat`) and START/FINISH (`createLineSignMesh`). Upright chain still `fog: true`. Keep `transparent` + `depthWrite: false` + no mips + `alphaTest` 0.05. Did not fill plates. Did not strip boat tags. Library PNGs not replaced.
- **Sea:** `deepColor` **`0x0c2f3a`**, `shallowColor` **`0x164a55`**, horizon+fog **`0x2a4a52`** (was 04-06 `0x15606c` / `0x2e8a86` / `0x5a8a8c`). Trough `OCEAN_TROUGH_DEFAULTS` 0.82 / 0.48 unchanged (no charcoal crush). `displacementScale` still **0**. Glitter sharpness unchanged. No Cesium vendor / NDI pumps / `STUDIO_TICK_FPS`.
- Files: `sponsorBillboard.ts`, `lineSignMesh.ts`, `gerstnerOcean.ts` (+ `realisticEnvironment` fog via horizon alias) + tests + READMEs. Suite **1189 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-04** (this report). Do **not** Pass until operator smoke.
- Human: Load pack → Environment **realistic** → Rolex/Vodafone/Senexus marks on water (wave texture around the glyph, **no teal/grey rectangle**). START/FINISH letters only, no fog band. Near-field sea **dark** (navy / dark slate, not bright cyan). Inspector plate alpha restores a plate. AR: no ocean.

## Operator 2026-09-04 — 04-06 Fail (still rectangles + too bright)

- **Rectangles:** still a darker-teal quad the size of each board. Cause: Three.js **fog on transparent `MeshBasicMaterial`** (default `fog: true`) tints the whole plane with fog `0x5a8a8c`. Issued 04-07: **`fog: false`** on water-plane sponsors + START/FINISH.
- **Sea:** 04-06 `0x2e8a86` is bright cyan. Operator wants **darker, deep water**. Issued 04-07: `0x0c2f3a` / `0x164a55` + darker fog/horizon.
- Boat tags keep their chip. Do not re-seed. Hold 19.2b.

## Worker 2026-09-04 — `DSP-SCN-20260904-06` (logo alpha sanitize + sea reads)

- **White-RGB holes:** library PNGs are `(255,255,255,0)`. `knockOutNearBlackRgba` still skips luma on `a===0`, then **`zeroRgbWhereAlphaZero`**. Dest canvas sanitized after any logo blit / label. Plate-on inspector path: no key, fill stays.
- **Mips:** water-plane sponsor + START/FINISH `CanvasTexture` `generateMipmaps = false`, `minFilter = LinearFilter`. Flat board `alphaTest` **0.05**. Upright chain unchanged. Library PNGs **not** replaced.
- **Sea:** `deepColor` **`0x15606c`**, `shallowColor` **`0x2e8a86`**, horizon+fog **`0x5a8a8c`** (was `0x8a9aaa`). Nadir fresnel floor **0.10 → 0.0**. `displacementScale` still **0**. Glitter sharpness unchanged. No Cesium vendor / NDI pumps / `STUDIO_TICK_FPS`.
- Files: `boardCompose.ts`, `sponsorBillboard.ts`, `lineSignMesh.ts`, `gerstnerOcean.ts`, `realisticEnvironment.ts` + tests + READMEs. Suite **1189 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-04** (this report). Do **not** Pass until operator smoke.
- Human: Load pack → Environment **realistic** → Rolex/Vodafone/Senexus marks on water (wave texture around the glyph, no grey rectangle). Near-field sea **visibly teal**. Inspector plate alpha restores a plate. AR: no ocean.

## Operator 2026-09-04 — 04-05 Fail (still grey box + same sea)

- **Box:** sampled Vodafone PNG corners **`(255,255,255,0)`**, not black. Luma-18 key skips `a===0`, leaves white RGB. CanvasTexture **mips** + grey fog → solid grey-blue quad. Issued 04-06: zero RGB on a=0; **disable mips** on water-plane boards.
- **Sea:** `0x2c4d5b` vs old `0x1e3a4c` is invisible under horizon/fog `0x8a9aaa`. Issued 04-06: greener albedo + teal-biased fog/horizon so the operator can **see** a change.
- Do not re-seed. Hold 19.2b. No Cesium vendor.

## Worker 2026-09-04 — `DSP-SCN-20260904-05` (logo knockout + teal sea)

- **Knockout:** Rec. 601 luma key at compose. Hard **18** / soft **16** (opaque at 34). Runs when water-plane **plate is off** (`shouldKnockOutLogo`); chain ribbon logos also keyed (blue wall `fillRect` stays). Does **not** key white (Vodafone sphere) or Rolex green/gold / Vodafone red / Senexus cyan. Library PNGs **not** replaced.
- **Sea:** `deepColor` `0x1e3a4c` → **`0x2c4d5b`**; `shallowColor` `0x3d6a78` → **`0x3d6678`**. Trough `deep * 0.58` × mix **0.82** → **`OCEAN_TROUGH_DEFAULTS` 0.82 / 0.48**. `displacementScale` still **0**. No Cesium vendor / NDI pumps / `STUDIO_TICK_FPS`.
- Files: `boardCompose.ts` + tests, `billboardLogos.ts`, `gerstnerOcean.ts` + tests, `src/scene/README.md`. Suite **1186 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-04** (this report). Do **not** Pass until operator smoke.
- Human: Load pack → Environment **realistic** → Rolex/Vodafone/Senexus marks on water (no grey slab). Sea teal/slate troughs, still flat; foam travels. START/FINISH letters only. Inspector plate alpha restores a plate. AR: no ocean.

## Operator 2026-09-04 — 04-04 Fail (plates + palette)

- **Plates:** skipping `fillRect` was not enough. Library logos are **opaque black PNGs**; `drawImage` copies the rectangle. Fog makes it a grey slab. Do **not** re-seed. Issued 04-05: luminance key near-black → alpha 0 on water-plane compose.
- **Palette:** operator teal ref (~`#2c4d5b` deep, `#3d6678` bands). Current trough `deep * 0.58` reads charcoal. Issued same DSP: retint + gentler trough.
- Hold 19.2b. No Cesium vendor. No HO-SCN-PLT for re-seed.

## Worker 2026-09-04 — `DSP-SCN-20260904-04` (sea plates + soft light)

- **Vertex lock:** `displacementScale` still **0**. Did not bury boards. No Cesium vendor / NDI pumps / `STUDIO_TICK_FPS`.
- **Foam/crests:** `foamColor` `0xe8eef2` → **`0x9ab0bc`**. Crest weight **0.62 → 0.38**; fold **0.85 → 0.55**; mix cap **0.90 → 0.55**. Still travels.
- **No water plates:** flat sponsors `resolveWaterPlanePanelAlpha` omit → **0**; skip `fillRect`/`strokeRect` when alpha ≈ 0; logo/label remain. Chain upright still omit → **1**. START/FINISH: dropped full-width underline bar — letters only. Inspector plate alpha still restores a plate.
- **Soft light:** sheen **7 / 0.2 → 3.5 / 0.1** + fwidth soften; glitter intensity **0.16 → 0.1** (sharpness 78 kept); detail fade **80–900 → 40–1600**; softer graze + ndl `smoothstep`.
- Files: `gerstnerOcean.ts` + tests, `boardCompose.ts`, `sponsorBillboard.ts`, inspectors, `lineSignMesh.ts`, READMEs. Suite **1183 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-04** (this report). Do **not** Pass until operator smoke.
- Human: Load pack → Environment **realistic** → crests quieter; sponsors/START/FINISH = logo/text on water (no grey/white slab). Orbit sun: lighting ramps. AR: no ocean.

## Operator 2026-09-04 — 04-03 Pass + notes

- **Pass:** better overall; troughs with foam; motion OK; boards on flat sea.
- **Notes:** (1) bright wave bands **too white** — darken foam. (2) solid plates on start/finish/sponsors not needed on 2D water — logo/text only. (3) lighting texture **cuts off** — weaker light, smoother falloff.
- Issued `DSP-SCN-20260904-04`. Hold 19.2b. No Cesium vendor.

## Worker 2026-09-04 — `DSP-SCN-20260904-03` (sea look unify)

- **Vertex lock:** `displacementScale` still **0**; `uWaves` amps stay 0. Did not bury boards. No Cesium vendor / NDI pumps / `STUDIO_TICK_FPS`.
- **Gust curtains:** albedo darkening **retired**. Removed `color *= 1.0 - gust * uStreakContrast * 0.70` and gust shallow add. `WIND_STREAK_DEFAULTS.contrast = 0`; `uStreakContrast` uniform gone. `windStreak` still scrolls; chops glitter only (`* 0.35`), not foam.
- **Troughs = foam train:** fragment `waveHeight` from `uShadingWaves` Gerstner. Trough darkens albedo (`smoothstep` −0.20…0.06). Crest foam window **−0.02…0.18 × 0.62** (was 0.10…0.36 × 0.4) so traveling white persists. Jacobian fold kept.
- **Sheen vs blob:** glitter stays **78 / 0.16**. Added sky-tinted `wetSheen` (`OCEAN_SHEEN_DEFAULTS` 7 / 0.2), stronger fresnel (0.10 / exp 4), `slopeWet` (N.y → sky). Sheen uses `skyCol`, not `uSunColor` (no new quadrant blowout).
- Files: `gerstnerOcean.ts` + tests, `src/scene/README.md`. Suite **1181 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-04** (this report). Do **not** Pass until operator orbits sun-on vs matte.
- Human: Load pack → Environment **realistic** → park cam: foam travels and lasts; dark bands **with** foam (no N–S curtains). Orbit into/out of sun: water texture similar (wet both ways); blob may still brighten. START/FINISH still above flat sea. AR: no ocean.

## Operator 2026-09-04 — 04-02 look (not full Pass)

- **Keep:** white traveling foam; assets above flat sea; hard half-plane gone.
- **Fail A:** sun-blob frame looks high-quality; matte frame looks cheap. Operator wants **similar texture** both ways — **keep** glitter, **lift** the rest (wide sheen), do not delete the blob.
- **Fail B:** darker fields are `windStreak` albedo darkening (along-wind curtains, default −Z = vertical in top-down). Foam crests are Gerstner **across** travel. Third crop: horizontal pale vs vertical dark. Issued 04-03: troughs from `waveHeight`.
- **Fail C:** white foam “just for a while” — crest window too tight. Persist traveling foam.
- Hold 19.2b. No Cesium vendor.

## Worker 2026-09-04 — `DSP-SCN-20260904-02` (flat sea 2D motion)

- **Vertex lock:** `displacementScale` stays **0**; `uWaves` amps stay 0 (mesh Y rest). Wind `setAmplitudeScale` still × 0 on verts.
- **Fragment shading:** new `uShadingWaves` = authored × wind (**not** × disp). Same Gerstner train in frag → N / jacobian / crest foam. Spec/glitter on **perturbed N** (no constant-up Blinn half-plane). `OCEAN_DETAIL_FADE` band-limits shading amp on outer rings.
- Files: `gerstnerOcean.ts` + tests, `src/scene/README.md`. No Cesium / NDI / `STUDIO_TICK_FPS` / boards.
- Suite **1179 + 26**, `npm run build` green.
- SCN orchestrator **code-accept 2026-09-04** (this report). Do **not** Pass until operator smoke.
- Human: Load pack → Environment **realistic** → park cam: foam/streaks/glints travel. Orbit: no smooth/grainy half-screen that slides with the camera. START/FINISH still above flat sea. Sea m / Alt / AR-no-ocean unchanged.

## Operator 2026-09-04 pm — 04-01 Pass + look-dev Fail

- **Pass:** start/finish, buoys, logos **visible**; sea m / Alt path accepted.
- **Fail:** sea **static** (disp×0 zeros vertex N / jacobian / foam). Operator wants **2D-style motion**, not 3D mesh bounce.
- **Fail:** camera-locked **half-sea** (smooth vs grainy). Fragment glitter is Blinn-Phong on a **constant up normal** (`pow(N·H, 78)`) — a view-space terminator, not a world texture. Issued `DSP-SCN-20260904-02`.
- Hold 19.2b / 19.17. No Cesium vendor.

## Worker 2026-09-04 — `DSP-SCN-20260904-01` (flat sea + sea m + GEO alt)

- **Displacement:** `GERSTNER_OCEAN_DEFAULTS.displacementScale = 0` (keep wave train + fragment foam/streak/glitter; verts stay flat). Wind `setAmplitudeScale` still runs × 0.
- **Discard:** fragment ocean hole `discard` removed (`oceanSuppress` punch forced 0). Flatten uniforms optional leftover.
- **Sea m vs Cesium hide:** new Environment **sea m** (−20…+20) → `setSeaHeightYM` / Gerstner `mesh.position.y` + `WATER_PLANE_Y` (wakes). Former **water m** relabelled **Cesium hide m** (tile discard only).
- **Layout Y:** `layoutFeatures` + `buildCourseLayout` use GEO `enu.y`. Line signs / sponsors / chains pass `midY` into placement. Alt MSL lifts; sea m lowers ocean under assets.
- Suite **1179 + 26**, `npm run build` green.
- SCN **code-accept 2026-09-04**. Do **not** treat 19.15 as Pass until operator smoke.
- Human: Load pack → Environment **realistic** → START/FINISH/sponsors visible (no holes). Sea flat but shaded. **sea m = −2** lowers ocean; boards stay. Mark Alt MSL lifts. Cesium hide still tiles only. AR: no ocean.

## Operator Fail 2026-09-04 — 19.15 + water/alt knobs

- **19.15 Fail:** cannot see start/finish or other assets; glitchy. Fragment `discard` holes + `depthWrite: false` boards → sky/flicker. Peak Gerstner ~0.66 m vs 0.08 m lift. Operator lock: sea **like 2D** (no vertex bounce) that **looks 3D** via texture/effects, **or** sea height that actually lowers so assets sit above it.
- **Water m does nothing to the sea.** `stubHud` water m is Cesium **tile discard AMSL** only. Gerstner rest Y is hardcoded. Issued **sea m** in DSP-04-01 to move ocean + water plane.
- **Alt MSL does nothing on world features.** `layoutFeatures` forces `FEATURE_WATER_Y = 0` (drops GEO `enu.y`). `applyFlatOnWaterPlacement` pins Y to plane + 0.08. Boats were a separate `y: 0` bug (fixed DSP-04).
- Hold 19.2b / 19.17. No HO-SCN-BW. No Cesium vendor.

## Worker 2026-09-03 — `DSP-SCN-20260903-07` (sea over assets)

- **Diagnose:** Gerstner peak amplitude ~0.66 m vs board `y = 0.08` — displacement, not z-fight. Did not raise `liftY` or change water m.
- **Approach:** same clipmap mesh; rest-pose XZ OBB **flatten** (2.5 m) + fragment **discard** (0.4 m). No extra FBO / `readPixels` / stencil. Boards stay planar. Wakes still draw outside holes. AR/chroma ocean still forced off.
- **Cap / types:** `OCEAN_SUPPRESS_CAP` **16**. **start / finish first**, then **sponsor** (only `applyFlatOnWaterPlacement` types). Remount + URL boot (`loadSponsorsFromUrl` / `syncLineSignsFromFeatures`) feed footprints.
- Files: `oceanSuppress.ts` + tests, `gerstnerOcean.ts` / `realisticEnvironment.ts`, `createScene.ts`, `src/scene/README.md`. Suite **1177 + 26**, build green.
- Human: Load pack → Environment **realistic** → 3D: boards/START/FINISH not buried; open water waves. AR: no ocean. Water m still Cesium discard only.

## Human Pass 2026-09-03 (04 / 05 / 06)

Operator **Pass**. Issued **19.15** `DSP-SCN-20260903-07`.

## Worker 2026-09-03 — `DSP-SCN-20260903-06` (buoy mesh / tag / full hide)

- **Flags:** additive `visibleBuoyMesh` / `visibleTag` (omit = on) on `buoy` / `mark` / `gateLeft` / `gateRight`. `visible3d: false` still omits the whole 3D prop (mesh + tag + arrows). Rounding stays Off / CW / CCW. 2D dots only follow `visible2d`.
- **Inspector:** Assets Details + World Authoring extras: Full 3D / Buoy mesh / Tag checkboxes + existing rounding. List-row 3D/2D toggles unchanged. Did not revert 19.8 boat hidden = hull off, tag on.
- Files: `buoyMarkers.ts`, `worldBuoys.ts`, types/parse/layout/adapters/geojson/coordinatePlace, `assetInspector.ts`, `authoringInspector.ts`, READMEs + race-project contract. No NDI / Cesium / sponsors / boat alt.
- Suite **1171 + 26**, `npm run build` green.
- Human: Load a pack with marks → Details: uncheck Buoy mesh (tag remains), uncheck Tag (float remains), uncheck Full 3D (nothing in 3D, 2D dot stays). Rounding Off independent. Then hold 19.15.

## Worker 2026-09-03 — `DSP-SCN-20260903-05` (sponsor logo / plate / alpha)

- **Label vs logo:** chosen `textureUrl` contain-fits the Library logo on the plate. Name/label stay in Assets / inspector only — never burned on the 3D mesh when a logo URL is set (`suppressLabel`). Failed image load → coloured plate, not “xxx”. Label text only when no logo URL was chosen.
- **Plate colour + alpha:** Assets Details and World Authoring extras now have Plate colour for **sponsors** (same as chains) plus an alpha **0–1** slider. Persist additive `panelColor` + `panelAlpha` (omit alpha = 1). Same slider on chain ribbon plate. Canvas fill is `rgba`; mesh `transparent` when alpha < 1. No NDI pumps / Cesium / ribbon rewrite.
- **A–B uniform scale:** additive `boardAspect` (along metres / short-side metres). Stretching GPS A–B keeps the ratio and rewrites `heightM` to the new short side. `heightM` still edits the short side (updates the stored ratio). Compose canvas matches plane aspect so the logo is not UV-stretched. Contain-fit unchanged.
- Files: `boardCompose.ts`, `sponsorLayout.ts`, `sponsorBillboard.ts`, `billboardLogos.ts` / `billboardChain.ts`, `assetInspector.ts`, `authoringInspector.ts`, `coordinatePlace.ts`, parse/geojson/types, READMEs. Suite **1163 + 26**, build green.
- Human: Load a pack with a Library-logo sponsor → 3D/AR shows the logo, not the name. Plate colour + alpha < 1 see-through. Stretch A–B → board grows in both axes. Chain Details also has alpha. Then **06** (buoy mesh/tag).

## Operator 2026-09-03 pm (19.7/13 Pass + look-dev)

- **19.7 / 19.13** accepted. Wakes not fully smoked: demo-istanbul hulls **under the sea**; Alt MSL in Details did nothing; Environment water m **cannot go below 0**.
- **Root (boats):** `main.ts` seeds static hulls with **`y: 0`**, dropping `gpsToEnu` **y**. Issued `DSP-SCN-20260903-04`.
- **Sponsors:** name/label drawn on the plate instead of Library logo; need plate colour + **alpha** (also chain); A–B stretch must **uniform-scale** the board; logo aspect locked. Issued `DSP-SCN-20260903-05`.
- **Buoys:** independent 3D **mesh** / **tag** / full hide. Issued `DSP-SCN-20260903-06` (after 05).
- Domain: **all SCN**. No HO-SCN-BW. OUT not asked to change pumps (alpha is preview/AR materials). Hold 19.15.

## Worker 2026-09-03 — `DSP-SCN-20260903-04` (boat alt Y + water m)

- **y: 0 was in `main.ts` callers**, not `resolveStaticHullPosition`. `syncFleetHullsFromPanel`, map place, GPS place/edit, Assets Alt MSL all discarded GEO `y` (and panel sync also passed alt `0` instead of `plannedAlt`).
- Fix: `hullEnuFromPlannedGps` → GEO `gpsToEnuAmsl` including y. Map click keeps click XZ; y from GEO at alt 0. Live TEL still blocks snap-back.
- Environment **water m**: clamp **−20…+5** (was 0–5), default 0.5. HUD `min="-20"`. Terrain discard AMSL only — no new ocean slider, no Gerstner clip, no Cesium vendor.
- Boat **`heightM`**: uniform hull scale (omit → 1). Alt = ENU y; heightM = mesh scale. `scene.setBoatHeightM`. Tag/wake unscaled.
- Files: `main.ts`, `boatEntity.ts`, `createScene.ts`, `stubHud.ts` + tests, `staticFleetHulls.test.ts`, `src/scene/README.md`. Suite **1149 + 26**, build green.
- Human: demo-istanbul (mock, no live packet) → Assets Details **Alt MSL** → hull rises/falls in 3D/AR; Environment **water m** −2 accepted; **Height m** scales the hull uniformly. Then smoke **05**.

## Worker 2026-09-03 — `DSP-SCN-20260902-04` (19.7 authoring inspector)

- Overlay inspector: name / label / type + lat/lon/alt MSL / height for every world type. Pack id/name **hidden** (`[data-ops=authoring-project-meta]`). Select → **Add becomes Edit**.
- Coordinate **Add** (`addFromCoordinates`) mutates in-memory features **before** `onApply` remount. `onStoreChange` refreshes Assets the same tick. Map click kept.
- Start/finish both GPS ends. Sponsor + chain logos reuse `openLibraryLogoPicker`. Chain: `spacingM` = ribbon logo pitch; `heightM` vertical.
- Drones: id/name/label editable; lat/lon/alt read-only when live TEL pose exists (`HO-TEL-SCN-20260901-01`). Boat visibility fields kept; **did not** revert 19.8 (hidden = hull off, tag on).
- Follow-ups: boat `heightM` hull scale **done in DSP-04**; drone labels session-only (`povLabels`).
- Human: World Authoring → type Sponsor → lat/lon → **Add**; Assets list must show it immediately; select → **Edit**. Map-click sponsor still works. Drone Details: pose GPS greyed. Suite **1147 + 26**, build green.

## Human Pass 2026-09-03 (operator: all good)

- **P0 white** `DSP-SCN-20260903-01`: Load/switch keeps AR/3D live.
- **Ribbon** `DSP-SCN-20260903-02`: continuous bluish band, logos on plate, no square gaps.
- **19.8** `DSP-SCN-20260902-05`: operator all-good with the ghost/hidden checklist.
- **19.12 OSM** already Pass.

Issued **19.7** (`DSP-SCN-20260902-04`) and **19.13** wakes (`DSP-SCN-20260903-03`). Hold **19.15** until 19.13 **human Pass** (same water).

## Worker 2026-09-03 — `DSP-SCN-20260903-03` (19.13 boat foam wakes)

- Geometry: **one additive triangle strip** per hull (8 segments, taper + vertex fade), not Gerstner verts, no extra FBO/`readPixels`. Water `y = 0.05` (same lift as ghost ring). Length = clamp(`speed × 2.5 s`, 8–12 m). Idle / static → none. Hidden zeros the wake; ghost uses a weaker peak.
- Tick: `createScene.tick` → `boat.tickWake(dt)` on the existing preview/studio clock. **Did not** raise `STUDIO_TICK_FPS`. Same scene → 3D + AR. No 2D map traces.
- Files: `src/scene/boatWake.ts` + `boatWake.test.ts`; `boatEntity.ts`; `createScene.ts` tick only; `src/scene/README.md` one-liner. Stayed out of inspector / 19.15 / NDI / Cesium.
- Suite **1144 + 26**. Full `npm run build` currently blocked by parallel 19.7 `src/scene/authoringInspector.ts` (`../boatVisibility` / `../billboardLogos` + implicit `any`) — not this DSP.
- Human: mock/live moving hull in 3D (and AR) should show a short white foam tail; hide the hull → tail gone; parked static hulls stay clean.

## Worker 2026-09-03 — `DSP-SCN-20260903-01` (AR/3D white after Load)

- **Root cause:** remount peak VRAM from legacy discrete chain boards. `30agustos` chain ~18.5 km @ `spacingM` 12 → **~1550** samples × ~1024×1365 RGBA ≈ **~8.6 GB** unshared; Load dispose+recreate doubles peak → `webglcontextlost` → permanent white (AR+3D). Not AR-transparent-only; not NDI pumps; `remountGen` race not primary.
- **Evidence:** `planBillboardChainMount` logs `legacyInstances` / `approxMbIfLegacyUnshared` vs ribbon `segments` / `approxMbShared`. Console: `[billboardChain] mount plan`, `[scene] remount start|complete`, `[scene] webglcontextlost|restored`.
- **Fix:** continuous ribbon mount (few meshes + one period texture; solid colour when no logos) + detach-before-dispose + context-lost gate (do not set `stopped` forever) + remount gen logs. Overlaps DSP-02 geometry (required to exit OOM); DSP-01 did not change NDI / `STUDIO_TICK_FPS`.
- Files: `billboardChain.ts`, `createScene.ts`, `sponsorBillboard.ts` (`sharedMap` optional), READMEs. Suite **1125 + 26**, build green.
- Human: boot → Load A → wait 3D/AR → Load B (or A again). Expect live viewport, no permanent white; console may show remount plan with low `approxMbShared`.

## Worker 2026-09-03 — `DSP-SCN-20260903-02` (billboard chain ribbon)

- Geometry: **one upright plane per polyline segment**, abutting at shared vertices (no air gaps). Shared repeating period texture along U when logos present; solid `#2A6FA6` material when empty.
- `spacingM` = **logo pitch** on the continuous strip (not panel gaps). Removed discrete `CHAIN_INSTANCE_WIDTH_M=6` mount path.
- Frameless compose: `planChainRibbon` / `recordChainRibbonDraws` / `drawChainRibbon` in `billboardLogos.ts` — plate + contain-fit logos + optional hairline top/bottom; **no** vertical frame bars. Sponsors still use `planSponsorBoard`.
- Interleave unchanged (`[3,2]` → AABAB). Picker / weights / `#2A6FA6` / vertical `heightM` kept.
- **Overlap:** DSP-01 and DSP-02 share the ribbon mount. DSP-01 originally said “log counts, don’t invent ribbon”; OOM **required** the ribbon to exit white. SCN accepts the overlap. No PRF/OUT.

## Operator 2026-09-03

- **19.12 OSM:** Pass (World Authoring pan/zoom covered).
- **19.8 ghost:** not tested.
- **White screen P0:** Load / change project → hitch a few seconds → **AR and 3D** full white; chrome stays. Same session **without** pack switch can keep 3D. Output was transparent; NDI Idle. Issued `DSP-SCN-20260903-01`.
- **Billboards:** current mesh is discrete **6 m** framed boards at **`spacingM` 12** → gaps + square look. Operator lock: SailGP **continuous ribbon**, logos on the plate, no seams. 19.11 picker/weights stay. Issued `DSP-SCN-20260903-02`. Not 19.17.

## SCN code-accept 2026-09-02 (Wave B2, pending human Pass)

- **19.11** `DSP-SCN-20260902-03`: `openLibraryLogoPicker`; additive `logos[]`; empty `[]` = solid framed plate; omit → `textureUrl` weight 1. Chain omit `panelColor` → `#2A6FA6` (sponsors stay `#f4f4f2`). `weightedFairInterleave([3,2])` → `[0,0,1,0,1]` **AABAB**. `heightM` vertical only. Suite **1119 + 26**.
- **19.8** `DSP-SCN-20260902-05`: `hidden` = hull/ring off, **tag on**; `updateTag` keeps tracking. Ghost/hidden do not change 2D (`mapVisible` only). `cloneSharedMaterials` after glTF `clone(true)` so ghost boat 2 cannot tint boat 1 after save/reload. Suite **1094 + 26**.
- **19.12** `DSP-SCN-20260902-06`: `maxTiles=24` truncated SE of large authoring canvases; no pad; zoom changed integer `z` so only the new key drew → blank + water wash. Fix: 1-tile pad, coarsen `z` instead of truncating, previous-z + parent underlay until new z loads. Same ops/authoring map instance. Stream still no OSM. Suite **1105 + 26**.

## Worker 2026-09-02 — `DSP-SCN-20260902-03` (19.11 billboard picker)

- Picker: `src/scene/sidebar/libraryLogoPicker.ts` (`openLibraryLogoPicker`). Thumbs from `listLibraryAssets`. Electron: never `window.prompt`.
- Schema: additive `WorldFeature.logos?: { url, weight }[]`. Empty `[]` = solid framed plate. Omit → `textureUrl` as weight 1.
- Default chain `panelColor` `#2A6FA6` when omitted (sponsors stay `#f4f4f2`).
- `weightedFairInterleave([3,2])` → `[0,0,1,0,1]` (AABAB). `heightM` vertical only; canvas aspect matches plane so logos contain-fit.
- Human: Assets → chain Details → **Add logo…** → Rolex / Senexus / Vodafone. Plate colour `#2a6fa6`. Suite **1119 + 26**, build green. No 19.7 / OSM / Cesium / re-seed.

## Worker 2026-09-02 — `DSP-SCN-20260902-06` (19.12 OSM zoom)

- **Root cause:** (1) `maxTiles=24` early-return truncated the SE of large authoring canvases (~36 tiles at 900 px). (2) No 1-tile pad. (3) Zoom changed integer `z` so `drawOsmBasemap` only painted the new key; cache still had the old z but it was not drawn → full blank + water wash.
- **Fix:** pad 1; coarsen `z` instead of truncating; draw previous z + cached parents until the new z loads. Same ops map instance (World Authoring). Stream still no OSM. Attribution kept.
- **Files:** `src/scene/map2dBasemap.ts`, `src/scene/map2d.ts`, `src/scene/map2dBasemap.test.ts`. Suite **1105 + 26**, build green.
- **Human test:** World Authoring → OSM on → pan/zoom; map stays covered (no hole at center). Ops map same. Stream/NDI 2D unchanged (no OSM).

## Accepted 2026-09-02 (Wave B1)

- **19.10** `DSP-SCN-20260901-03`: `LINE_SIGN_BAND_DEPTH_M` 24, `DEFAULT_LINE_SIGN_WIDTH_M` 100; two-point GPS hypot unchanged; texture canvas unchanged (ratio via plane depth).
- **19.2** `DSP-SCN-20260829-03`: PiP + `#ops-stream-map` removed. Canvas in `.local-2d-map-host`. Source **960×540**.
- **19.6** `DSP-SCN-20260901-01`: `world-map` accordion removed; compact **World** chip on Race setup header; overlay Close gone.
- **19.9** `DSP-SCN-20260901-02`: Save/Load row `loading`→`loaded`, `saving`→`saved` (+ persist suffix); Export `downloaded`; short error with pack id. Folder hint unchanged. No modal. Boot does not write `loaded` (click Load only).
- **`DSP-SCN-20260902-01`:** dropdown pick copies id only; **Load** / Enter runs one `switchRace`. Electron `folderMode` no longer loads on `<select> change`. Not 19.17. `main.ts` unchanged.
- **`DSP-SCN-20260902-02` accepted:** `Array.isArray(project.features)` (incl. `[]`) remounts that world only; fixture URLs only when `features` omitted (remount `[]` first). Empty remount always disposes chains/flags/course/sponsors/signs/buoys/markers. `hydrateFeaturesUrl` does not overlay `features: []`.

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
