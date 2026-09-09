# cinematics

Owned by **SCN**. Reusable **sequence player** for Phase 21 authoring (Play / pause / scrub). vMix will play the MP4; this is **not** an air path and does **not** encode.

Design: [`docs/architecture/commercial-video.md`](../../../docs/architecture/commercial-video.md). Player: `DSP-SCN-20260908-01`. Sequence: `DSP-SCN-20260908-02`. Country pins + continuous globe: `DSP-SCN-20260908-06`. Tile warm: `DSP-SCN-20260908-07` (manifest in git, bytes on disk via PLT).

## JSON

`/cinematics/*.json` — `id`, `durationSec`, `width` 1920, `height` 1080, `fps` 30, optional `pins[]` `{ id, label, lat, lon, flag? }` (globe markers via GEO ECEF), optional `heroPins[]` (ENU labels), `shots[]` with `t0, t1, domain: globe|enu`, `fog`, `ocean`, `buildings`, `imagery: aerial|road`, `cloud01` (value at **t1**; player lerps from the previous shot), keyframes `{ lat, lon, altMsl, lookLat, lookLon, lookAltMsl, t01, ease?, lookId? }`. Optional `tileWarm.contentUrls` — stripped ion **tile IDs** so other computers know which tiles to prefetch (bytes stay in the local PLT cache, **not git**). `lookId` focuses the matching pin (scale pop). Adjacent shots **in the same domain** share the boundary pose. The globe→ENU remount stays under full cloud cover until ENU tiles are idle.

Shipped: `public/cinematics/_empty.json` (2 s fixture) and `public/cinematics/intro-bosphorus.json` (72 s, 1080p30). **Meshes TBD; GPS is the path.** Operator will scrub altitudes. Do not look at Rumeli Hisarı in `intro-bosphorus`.

### `intro-bosphorus` shot table (72 s)

| t (s) | Shot | Domain | GPS (start look) |
| --- | --- | --- | --- |
| 0–3.5 | World (country pins except İstanbul) | globe | Atlantic/Europe — **not** Moscow |
| 3.5–6 | Transit → USA | globe · easeInOut | |
| 6–7.4 | **USA** once | globe | look 39.83, −98.58 |
| 7.4–9.8 | Transit → Canada | globe | |
| 9.8–11.2 | **Canada** once | globe | look 56.13, −106.35 |
| 11.2–13.2 | Pull back, then UK | globe | |
| 13.2–14.6 | **UK** once | globe | look 54.0, −2.5 |
| 14.6–16.8 | Pull back, then Russia | globe | |
| 16.8–18.2 | **Russia** once | globe | look 55.8, 37.6 |
| 18.2–20.6 | Pull back, then Bulgaria | globe | |
| 20.6–22 | **Bulgaria** once | globe | look 42.73, 25.49 |
| 22–24.4 | Pull back, then Turkey | globe | |
| 24.4–25.8 | **Turkey** once (İstanbul pin appears) | globe | look 39.0, 35.2 |
| 25.8–28.2 | Fly Turkey → İstanbul | globe | İstanbul 41.0082, 28.9784 |
| 28.2–30 | Cloud in (lerp 0→1) | globe | |
| 30–33 | Cloud 1→0; 3rd bridge, then look south down the water | enu · fog | look **41.202, 29.118** |
| 33–44 | Over the water, look centered on FSM then the 1st | enu · fog | end look **41.045, 29.034** |
| 44–49 | Maiden’s closer, from the west | enu · fog | 41.0211, 29.0041 |
| 49–62 | South-side pass Sultan Ahmed → Hagia Sophia → Hagia Irene → Topkapı | enu · fog | |
| 62–66 | Galata from above | enu · fog | 41.0256, 28.9741 |
| 66–69 | Dolmabahçe | enu · fog | 41.03917, 29.0007 |
| 69–72 | Fly to Çırağan (still moving at 72) | enu · fog | look **41.04342388464562, 29.01532600006871** |

Country pins (globe): HUD chrome from `public/cinematics/pins/country.png` (flag in the empty circle, 3-letter code in Allumi Std Extended Bold). İstanbul uses `place.png` (no flag) and stays hidden until Turkey is focused. Hero pins: `public/cinematics/pins/name.png` on the mesh AABB (XZ centre, roof Y); only the focused hero is shown. Camera **moves** on every beat. No frozen holds. No Rumeli.

Cloud overlay lerps `cloud01` from the previous shot to this shot. 2 s in, 2.5 s out. Globe Play does **not** freeze Cesium LOD (so the world can refine). Globe→ENU remount stays covered until a real ENU mesh is idle, then Play may lock ENU.

## Clock

Locked **30 Hz**. Spline is sampled in **sequence time** (wall clock while playing), not rAF `dt`. Same `t` → same pose. Globe: GEO `geodeticToEcefMeters` + `ecefLookAt`. ENU: `enuKeyframeToScene` after origin is set. Do not invent ECEF in this folder.

## Look flags

| Domain | Terrain | OSM / heroes | Fog | Ocean |
| --- | --- | --- | --- | --- |
| `globe` | World Terrain + Aerial **without** `ReorientationPlugin` (ECEF) | off | off | Gerstner off; **do not** discard Cesium water |
| `enu` | today’s reoriented tiles | OSM + heroes when shot says so | shot `fog` | `ocean: true` → land-only discard + Gerstner |

Cloud overlay is a screen quad (`cloud01`), not `scene.fog`. Remount globe ↔ ENU while covered; never two full globes.

Hide-race while active: boats, course, sponsors, flags, 2D map, HUD overlay, calibration, terrain credit DOM. Restore on **Off** / stop. Follow/free cam unchanged when stopped. AR/chroma still gate terrain/buildings (opaque-only).

## Tile warm

`/cinematics/warm/intro-bosphorus.json` — ion asset ids (World Terrain **1**, Bing Aerial **2**, OSM Buildings **96188**) plus camera regions. Globe `errorTarget` **8**, İstanbul ENU **warm 3 / play 8** (not Google Photorealistic / MapTiler / CesiumJS). Sequence JSON also holds `tileWarm.contentUrls` (empty until **Save tile list**). Warm merges sidecar regions + sequence keyframes + both URL lists. **No tile binaries in git.**

On project start (origin + ion token, opaque-clear / not AR): pose each region, `tiles.update` until the download queue is idle (timeout, no throw). Globe does not pull OSM. Hits skip via `GET /cinematic-tiles/<sha256>`; misses fetch ion then `POST` (Vite `.cache`) or Electron IPC (`userData`). Play seeks **before** warm `restoreLook` so race remount does not dump GPU tiles. Globe and İstanbul ENU tilesets stay **parked** across the domain cut — Play does not dispose the warmed Bosphorus mesh. Overlay change still remounts that frame. Cinematic remounts skip `TilesFadePlugin` (grey dither veil) and `UnloadTilesPlugin` (evicting fine tiles). Cinematic VRAM budget constant is **768 MiB** if unload is re-enabled.

Ops **Save tile list** downloads the **sequence JSON** with `tileWarm.contentUrls` filled from tiles this machine already fetched (token stripped). Commit that file. Other PCs: same JSON → skip-if-present for cached hashes, then camera warm downloads misses with their ion token. Bytes never leave the local cache directory.

## Ops

Right-rail **Cinematics**: sequence select (default Off = race view), Play, Pause, scrub, time. **Record** (OUT) writes a silent 1080p30 MP4 in Electron. **Save tile list** writes `tileWarm.contentUrls` onto the sequence JSON for other computers. Status `tiles: warming N/M` while the prefetch runs; Play waits.

## OUT Record hook

- `scene.getCinematicTransport()` / `playCinematic` / `pauseCinematic` / `seekCinematic`
- Canvas: `scene.renderer.domElement` (opaque 1920×1080 when studio-locked)
- Clock: `CINEMATIC_FPS` (30). Do not drive the spline from 60 rAF
- Hide-race is already on while `isCinematicActive()`
- Silent MP4 — OUT MediaRecorder on the canvas; no audio mux in SCN
