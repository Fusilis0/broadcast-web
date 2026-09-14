# 3D environment — buildings and Istanbul look

**Status:** Locked 2026-09-07. OSM Buildings + heroes on air. Phase 22 SRT open. **IBB mail 2026-09-12** — no-reply plan §3.2. DIY Bosphorus survey **closed**. Google Photorealistic **off air**.
**Owner:** SCN (mount / look) + GEO (ENU placement) + PLT (token / hosting). BW gates.
**Does not replace:** [`geospatial-terrain-cesium.md`](./geospatial-terrain-cesium.md) — that contract stays.
**Engine lock (unchanged):** consume **3D Tiles** in Three.js via `3d-tiles-renderer`. Do **not** run CesiumJS, MapLibre, or Mapbox GL as a second WebGL globe.

---

## 1. What the operator asked

Service-based city if possible. Pre-baked İstanbul only if quality is clearly better (3D buildings, historical places look good). Check whether Cesium already has buildings.

## 2. Honest quality model

There are three different products people call “3D buildings”:

| Layer | Look | Historic mosques / palaces | Cost to our frame |
| --- | --- | --- | --- |
| **A. Terrain + aerial** (today) | Hills and a photo on the ground | Flat textures | Already paying this |
| **B. Extruded OSM** | City massing, simple roofs | Simplified volumes, not tourist-postcard | Cheap geometry |
| **C. Photogrammetry / LOD2–3 mesh** | Real façades | Can look like the place | Heavy; legal/licence is the gate |
| **D. Hero glTF** | Artist models of named icons | Best where the camera aims | Few meshes, we own them |

From a Bosphorus drone, **B** is the skyline. Close-up Sultanahmet is **D** or licensed **C**. No globe vendor turns B into D.

## 3. Lock (operator 2026-09-06)

**Now (free, on-air):** Cesium World Terrain + **Cesium OSM Buildings** + **hero historic glTF**. OSM Buildings **is** the 3D buildings layer — not a third Cesium product besides OSM.

**Later:** IBB mesh if a partnership/licence appears. **Closed:** own drone photogrammetry of the Bosphorus. **Never on air:** Google Photorealistic 3D Tiles.

### 3.2 IBB mail sent (2026-09-12) — if they do not reply

Mail to **cografibilgi@ibb.gov.tr** (Senesux, Bosphorus Cup 19 Eylül TRT, ask for 3B API / enterprise terms). **19 Eylül 2026 does not wait on that mail.** Race-day 3D is the **free stack already in the app**: World Terrain + Bing + OSM Buildings + hero glTF + Gerstner sea.

If IBB is silent or says no (operator **will pay**):

| Priority | Plan | When |
| --- | --- | --- |
| **0** | Stay on OSM + heroes + sea | **19 Eylül air** |
| **1** | Follow-up: same mailbox + CBS phone (`+90 212 455 00 00` on their API site). Ask for the **published GIS tariff** desk (block mesh / LOD2 CityGML), not the 2B Şehir Haritası key. | 1–2 weeks |
| **2** | **Buy** one IBB 3B **block** that covers both Boğaz shores (~35 km² land; §4.4). City-wide mesh only if they refuse a clip. Convert to 3D Tiles; hole the water for Gerstner. | After a quote — not this race |
| **3** | Pay for **more / better hero glTF** (named palaces, yalı, remaining bridges) georeferenced through GEO | Anytime; helps 19 Eylül without IBB |
| **4** | Commission a **licensed mapping firm** (SHGM permit, not our drone) for a shore corridor | Post-race only; weeks; duplicates IBB |

**Still reject:** scrape `3bistanbul.ibb.gov.tr`; Google Photorealistic on air (paying does not waive logo / no-reshare — §4.5); DIY Boğaz photogrammetry; a second WebGL engine (MapTiler/Mapbox 3D).

Paying does **not** unlock Google for TRT. Paying **does** unlock IBB’s published tariff if sales will sell a block without an “API.” If they never sell to a private studio, **2+3** is the scale-up, **0** is race day.

### 3.1 What else fits as “free”?

Almost nothing that is a *different look*. Other free city streams are the **same OpenStreetMap extrusion** in another wrapper (MapTiler / Mapbox / F4Map / Overpass bake). Those only fit if we stay on `3d-tiles-renderer` and do **not** stand up a second GL engine.

| Free option | Fit? | Why |
| --- | --- | --- |
| Cesium ion OSM Buildings (96188) | **Yes — pick** | Same token/renderer, global, ODbL + ion credit on 3D |
| Self-hosted OSM → 3D Tiles (Overpass / blender-osm, Bosphorus clip) | Fallback | Same look; more work; useful if ion quota/commercial is the problem |
| Procedural facade/window shader on OSM | Optional polish | Still boxes; less toy from far away |
| CC hero glTF (Sketchfab / Wikimedia) then paid if needed | **Yes — pick** | Only free way named mosques/palaces look like themselves |
| MapTiler / Mapbox / MapLibre 3D buildings | **No** | Same OSM, wrong engine (second WebGL) |
| Google Photorealistic | **No** | Not free on air (logo + reshare) |
| IBB 3B | **Parked** | Not free; future agreement |
| DIY drone city mesh | **Closed** | Duplicates IBB; SHGM red zone |

MapTiler Terrain-RGB stays a **terrain** fallback if ion dies (Q5), not a buildings path.

## 4. Candidate sheet

### 4.1 Keep Cesium ion terrain (current)

- **Pros:** Already integrated; ENU + geoid contract exists; land-only watermask; lock-tiles; service; next venue is a project origin, not a new pipeline.
- **Cons:** No building volumes; ion commercial / fetch still a Q5 risk; Bing attribution; ion logo on software that streams ion content. Operator look (DSP-05 code-accept): **Bing Maps Road** ion **4** on World Terrain **1**; Aerial **2** is Ops compare. 04 Rec.709 grey **Fail**.
- **Verdict:** Keep.

### 4.2 Cesium OSM Buildings (service)

**OSM = OpenStreetMap** (volunteer world map). Cesium extrudes OSM footprints into untextured meshes (optional simple roofs from `roof:shape`). Coverage is **all mapped buildings**, not a landmark subset. Look is city massing, not IBB 3B.

- **Pros:** Same renderer and token; global; metadata (name, height, type); cheap vs photogrammetry; Cesium allows video/renderings of ion global content (unlike Google).
- **Cons:** No photo façades; mosques are simplified volumes; additive refinement can keep large buildings in view; buildings snap to **full-res** terrain height so low terrain LOD can bury small boxes; extra tileset = hitch risk on 3D NDI (~10–20 fps today). Procedural window shaders can soften the toy look; they do not become photogrammetry.
- **Verdict:** First building layer **if** massing is acceptable. Not a substitute for IBB if every building must look real.

### 4.2b Cheaper than IBB mesh 350 TL / km²

IBB mesh blocks average **~60 km²** → one block is on the order of **~21,000 TL / year**, not a 2 km² shopping trip.

| Path | vs IBB 3B look | Cost shape | On-air |
| --- | --- | --- | --- |
| Google Photorealistic 3D Tiles | Closest service look-alike | ion / Maps Platform | **No** (logo + promo ≤30 s) |
| IBB Harita LOD2 CityGML+OBJ | Textured LOD2, not full mesh | 14–40 TL per building | If licensed |
| Own drone photogrammetry of the race shore | Can match in a corridor we own | One-time shoot + 3D Tiles | Yes if we own it |
| CGTrader / Sketchfab city packs | Rarely georeferenced IBB quality | Cheap files | Often not broadcast |

No other vendor streams İstanbul at 3B quality for less. **Budget is open** (operator 2026-09-13); the gate is **licence + time**, not TRY. Do not scrape the viewer. If IBB will not sell: §3.2.

### 4.3 Hero glTF landmarks

- **Pros:** Only path that makes named historic places look designed; we own licence and look; tiny draw vs a city mesh; works on any venue if we repeat the pattern.
- **Cons:** Art / buy / commission; georeference and vertical datum (HAE vs AMSL) must go through GEO; must punch a hole in OSM so two mosques do not z-fight.
- **Verdict:** Quality layer. Do this; do not wait for a magic tileset.

### 4.4 IBB / BIMTAŞ İstanbul model (pre-baked)

IBB public viewer: [3bistanbul.ibb.gov.tr](https://3bistanbul.ibb.gov.tr/). Production notes: LOD2 CityGML (~1.4M buildings), some landmarks LOD3, photogrammetric mesh. **Not a public tiles API.**

Published GIS tariff (through **2026-12-31**): city-wide 3D mesh **1,725,000 TRY / year**; block mesh **350 TRY / km² / year**, blocks averaging **~60 km²** → one block on the order of **~21,000 TRY / year**. Unlicensed commercial use: 50× tariff + legal. Academic thesis carve-out is not us. Public-to-public share under 7221 is free — a sports/culture partnership with IBB GIS is the realistic “special agreement,” not the thesis rate. Monthly = yearly/12 if they sell that.

**Is 60 km² enough?** For `30agustos` / `19eylul-bosphorus-cup` (origin ~Beşiktaş–Üsküdar, course ~5 km along the strait): **yes**, if the block covers both shores. We do **not** need sea in the mesh (Gerstner fills water). Land budget: ~5 km course + 2 km past each end, both shores × ~2 km inland ≈ **~35 km²**, plus ~**6 km²** if Historic Peninsula must be in the same mesh. Ask IBB for the block index map; a second block only if Sultanahmet sits outside the first square.

**Do not DIY a Bosphorus photogrammetry survey** at this scale. IBB already flew helicopter oblique + lidar. Recreating 20–40 km² in SHGM red airspace (Boğaz, palaces, bridges) is weeks of permits + a mapping-class RTK/oblique campaign + GPU tiling — typically a five-figure USD job — to duplicate a 21k TL/year licence. DIY is only for a tiny unlicensed shore (one club / one mosque). Process if ever needed: land-only AOI → SHGM+valilik permit → nadir+45° stills (not boat video) → RealityCapture/Metashape → clip water → 3D Tiles → ENU + ocean hole.

- **Pros:** Best chance of “İstanbul actually looks like İstanbul” at city scale; Historic Peninsula was the original 3B scope; we can tile to 3D Tiles and own the stream.
- **Cons:** Procurement, 1-year contract, format conversion (CityGML / mesh → 3D Tiles), water surface will fight our ocean (same problem as Cesium baked sea), VRAM, one-venue. Scraping the viewer is not a plan. Block boundaries may not match the racecourse.
- **Verdict:** One correctly placed block is the right IBB buy. Cheaper than ion Commercial **for this mesh**; ion $149/mo is a different product (SaaS globe). Skip DIY city survey.

### 4.5 Google Photorealistic 3D Tiles

Paying Google **does not** buy a broadcast/video waiver. Public list price (USD, [Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing), SKU Photorealistic 3D Tiles): **1,000 root sessions/month free**, then **$6 / 1,000** (volume down to $2.40). One root session = up to **3 hours** of tile traffic; child tiles are not billed. Cesium ion already includes Google tiles: Community 1,000 / Commercial **$149/mo** individual (5,000 roots) / Premium $499 (10,000). A single studio PC on a show day is a handful of roots — **money is not the gate**.

**Look:** same photogrammetry family as Google Earth 3D (textured mesh of the whole city, trees included). Google’s own team: not survey-grade; cars/awnings melt into façades; trees can float. Hide Cesium World Terrain if you use it (datum mismatch). Water is in the mesh → fights our Gerstner ocean.

**30 seconds:** that cap is **promotional videos you publish of the app**, not “the 3D view dies after 30 s.” The live renderer may run for hours. There is **no paid SKU for longer TV/NDI**. Logo + per-tile credits stay mandatory even if you pay. ToS also forbids caching/offline and “reshare/rehost outside the Services” — an NDI plate into vMix is that reshape. Written Google/Maps sales permission would be required before treating this as on-air; paying the API is not that permission.

- **Verdict:** Cheap and looks far closer to IBB than OSM. Still **reject for on-air** unless Google grants a broadcast exception in writing. Fine as an **ops look-dev** experiment with credits on.

### 4.6 MapTiler / Mapbox / MapLibre

- **Pros:** Terrain-RGB is a clean DEM; easy sea cut (`height ≤ 0`); good if ion dies.
- **Cons:** 3D buildings in those products are still OSM extrusion **or** their own GL engine (second camera/context — same reject as CesiumJS). MapTiler GeoSplats is a different renderer, not our NDI path.
- **Verdict:** Terrain fallback only. No second engine.

### 4.7 Self-hosted OSM → 3D Tiles

- **Pros:** No ion quota; ODbL only; we clip to the venue.
- **Cons:** Pipeline work; **same look as 4.2**; we become the CDN.
- **Verdict:** If commercial ion is gone and we still want massing.

### 4.8 Local DEM / venue GeoTIFF

- **Pros:** Offline, no logo, one racecourse.
- **Cons:** No buildings; art per venue; LFS.
- **Verdict:** Backup for terrain, not the city.

### 4.9 Reject as engines / pipelines

| Idea | Why not |
| --- | --- |
| CesiumJS / Mapbox GL / MapLibre as the scene | Second WebGL + they own the camera |
| Unity / Cesium for Unity city | Unity retired as primary air |
| Gaussian splats | Wrong composite with ocean, boats, NDI |
| Sketchfab “Istanbul city” dumps | Rarely georeferenced; licence often non-broadcast |
| Mixing Google mesh + OSM | Double buildings |

## 5. Integration notes (when a worker is issued)

- Second `TilesRenderer` group, same `ReorientationPlugin` origin (`amslToHae`).
- Same opaque-env gate as terrain: **never** on AR/chroma.
- Attribution overlay: ion + OSM (+ Bing if still on aerial) on **3D + Ops**; never burned into AR.
- Clip OSM under heroes. Do not rely on z-fighting.
- Perf: `UnloadTilesPlugin` budget, `TilesFadePlugin`, **lock tiles** on air. Measure 3D NDI hitch with buildings on before any photogrammetry experiment.
- Ocean: buildings are land. Do not let a licensed mesh’s water surface draw; reuse land-only / height discard thinking.

## 6. Open before implementation

| # | Question | Default if unanswered |
| --- | --- | --- |
| 1 | Commercial ion account healthy? (Q5) | Fix ion before OSM Buildings |
| 2 | Accept OSM massing + heroes, or insist on photogrammetry? | OSM + heroes |
| 3 | Call IBB for a Bosphorus clip quote? | **Mail sent 2026-09-12.** No-reply plan §3.2. 19 Eylül = OSM+heroes. |
| 4 | Who pays / owns hero mesh licences? | Operator |
| 5 | Permanent 3D-channel Cesium + OSM credit OK? | Yes (same as today’s 3D credits) |
