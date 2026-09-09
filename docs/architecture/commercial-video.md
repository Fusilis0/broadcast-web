# Cinematic sequences — intro video (Phase 21)

**Status:** **Locked 2026-09-08**; **Human Pass look 2026-09-09** (west/east path, HD Aerial, ENU seams). Workers from issued DSPs.
**Owner:** BW gates. **SCN** player / look. **GEO** globe vs ENU. **OUT** MP4 file. **PLT** tile warm if needed. Not SRT (Phase 22). Not NDI.
**First content:** `intro-bosphorus` ~60 s. The **system** is reusable sequence JSON + play/record; that file is the first sequence.
**Environment (until IBB):** Cesium World Terrain + **Bing Aerial** + OSM Buildings + human hero glTF (including **three Bosphorus bridges**). IBB parked. Google Photorealistic off air.

Does not replace [`geospatial-terrain-cesium.md`](./geospatial-terrain-cesium.md) or [`3d-environment-buildings.md`](./3d-environment-buildings.md).

---

## 1. Operator lock (2026-09-08)

- **Deliverable:** pre-recorded **MP4**. vMix plays it. This app **waits** — it does **not** play the sequence then “connect live.”
- **Audio:** silence (no bed, no mux).
- **Raster:** **1920×1080 · 30 fps**.
- **World tour (order):** west **Canada → UK**, then east **Russia → Turkey → İstanbul**. USA pin stays on the globe; **no USA hold**. Label **Russia**, never Moscow. Pins with labels. Not Chicago / Winnipeg / London street zooms.
- **Istanbul path:** 3rd bridge (Yavuz Sultan Selim) **hover 3 s overhead** at catalogue **41.202, 29.118**, then equal 3 s on FSM and 15 July → Maiden’s (one left hover, not three angles) → Historic Peninsula west→east heroes → Galata closer (~8 s) → Çırağan hover / end. Camera never parks.
- **Heroes:** operator will send **all** meshes. **All three bridges** are models, not OSM boxes. **Rumeli Hisarı is not in this video** (catalogue may keep it; this sequence does not look at it).
- **Timing:** strawman in §4 is accepted.
- **Credits:** **none** on the MP4 (no ion/OSM/Bing end card). Terrain credit DOM hidden during play/record. Residual ion ToS is an operator choice, not a worker task.
- Ops play/scrub exists **only to author and record**. It is not an air path.

No race setup in the take (no boats, course, sponsors, flags, 2D map, HUD).

---

## 2. System (not a one-off clip)

| Piece | What | Who edits later |
| --- | --- | --- |
| **Sequence JSON** | Duration, 1080p30, shots, geodetic keyframes | Operator / SCN |
| **Player** | Play / pause / scrub on a **locked 30 Hz** clock; hide race chrome | SCN |
| **Recorder** | Chrome-free 1080 canvas → silent MP4 | OUT |
| **Tile warm** | Prefetch along path (manifest regions + sequence keyframes). `tileWarm.contentUrls` on the sequence JSON for other PCs. Bytes local, not git. | SCN (+ PLT disk cache) |

Next video = new JSON (+ meshes), same player.

---

## 3. Two camera domains

Race ENU is an Istanbul tangent plane. World flyover is **not** that plane.

| Domain | When | How |
| --- | --- | --- |
| **`globe`** | World, city teases, Turkey, Marmara | `3d-tiles-renderer` **without** `ReorientationPlugin` (ECEF). World Terrain + Aerial at SSE **8**. Fog **off**. Gerstner **off**. OSM **off**. City pins as markers. |
| **`enu`** | Strait + heroes | İstanbul origin. Aerial + OSM + heroes. Ocean **on** after the cloud. |

**Seam:** cinematic cloud overlay (not `scene.fog`). While covered: switch domain, warm ENU tiles, turn ocean on. Ease out over the strait.

No CesiumJS. Same Three.js renderer.

**Country frame:** globe altitude high enough that the **entire country** stays in frame at the tightest zoom of that hover. Pins (flag + thin label) at country centroids while `domain=globe`; focused pin scales up. ENU uses **hero** pins. Pins draw on top of the globe (`depthTest: false`).

**No teleports:** spline must be continuous in geodetic space. Adjacent shots **in the same domain** (globe **and** ENU) share the boundary pose. Steal hold time for **transits** (Canada→UK then Russia→Turkey→İstanbul). Istanbul after Turkey is a **fly**, not a cut. Cloud seam still covers globe→ENU remount only.

---

## 4. `intro-bosphorus` — 60 s (times)

Still **60 s** total. Globe **0–22** (countries 1 s hover each, 2026-09-09 Human Pass 2). ENU: equal **3 s** hover on each Bosphorus bridge, then peninsula + longer Galata.

| t (s) | Shot | Domain |
| --- | --- | --- |
| 0–4 | World + **all pins** (flags), Atlantic/Europe drift | globe |
| 4–6.5 | Transit to Canada | globe |
| 6.5–7.5 | **Canada** hover | globe |
| 7.5–9.5 | Transit Canada → UK | globe |
| 9.5–10.5 | **UK** hover | globe |
| 10.5–12.5 | Transit UK → Russia | globe |
| 12.5–14 | **Russia** hover | globe |
| 14–16 | Transit Russia → Turkey | globe |
| 16–17 | **Turkey** hover | globe |
| 17–20 | Fly Turkey → İstanbul | globe |
| 20–22 | Cloud in (lerp) | globe |
| 22–24.5 | Yavuz reveal (cloud out) | enu |
| 24.5–27.5 | **Hover** Yavuz 3 s · 41.202, 29.118 | enu |
| 27.5–30.5 | **Hover** FSM 3 s | enu |
| 30.5–33.5 | **Hover** 15 July 3 s | enu |
| 33.5–35.5 | Maiden’s: hover left from 1st bridge | enu |
| 35.5–44 | Peninsula L→R heroes | enu |
| 44–52 | Galata closer | enu |
| 52–60 | Çırağan hover | enu |

**Pins:** globe = country + flag, focused pin pops. ENU = hero building pins. Hide Rumeli. Needle + thin label (`depthTest: false` so they stay on top of the globe).

**Imagery for this sequence:** Bing **Aerial** (ion **2**). OSM on in `enu` only. Play/warm SSE globe **8** / ENU **3**. Play **locks** tiles after warm.

---

## 5. Camera path

Geodetic keyframes (not Three.js clicks):

`lat, lon, altMsl, lookLat, lookLon, lookAltMsl, t01, ease`

GEO converts: `gpsToEnuAmsl` for `enu`; ECEF + ellipsoid up for `globe`. Spline in **time**.

Ops: Play / pause / scrub / jump shot / **Record** (OUT). v1 = JSON in repo; “insert keyframe from free cam” is a later DSP.

---

## 6. Ocean / land

| Camera | Cesium water | Gerstner |
| --- | --- | --- |
| Globe / land / high Marmara | Show (do **not** discard water) | **Off** |
| After cloud, over the strait | Discard (today’s land-only path) | **On** |

World shots: `fog: false`.

---

## 7. Capture

Opaque **3D** canvas 1920×1080. OUT writes a **silent** MP4. **Not** NDI. **Not** in-app live cut.

Clock: **30 Hz locked** for play+record so 60 rAF does not speed the spline.

**Tile warm (operator 2026-09-08, P0; quality 2026-09-09):** live ion LOD while the camera flies looks unprofessional. Prefetch **before Play**. Sequence JSON carries `tileWarm.contentUrls` (tile IDs for other PCs). Bytes stay local.

| | Countries (globe) | İstanbul (ENU) |
| --- | --- | --- |
| Detail | World Terrain + Aerial, SSE **8** | SSE **3** + OSM + Aerial |
| Disk | Local studio cache — **not git** | Same folder, more tiles |
| Repo | Sequence `tileWarm.contentUrls` + sidecar regions / ion asset ids | Same |

On **project start**: read the manifest + sequence URL list, **check** each tile, **download missing**, skip present. Electron `userData` (or repo-adjacent `.cache/cinematic-tiles/` for `npm run dev`). `.gitignore` the binaries. Play stays unlocked so Aerial can refine (lock for Record later).

---

## 8. Orchestrators — no CIN ID

| ID | Owns |
| --- | --- |
| **BW** | Lock, briefs, DSP order |
| **GEO** | ECEF keyframes, ellipsoid up, origin switch during cloud (math only) |
| **SCN** | Player, spline, hide-race, cloud, fog/ocean flags, Aerial for the take, ops transport |
| **OUT** | Silent MP4 from canvas |
| **PLT** | Disk cache dir, gitignore, Electron `userData` / Vite `.cache` (no Three.js) |

Hero **files** are human. SCN mounts `public/models/landmarks/` when they appear.

---

## 9. Issued workers (2026-09-08)

| Order | DSP | Start when |
| --- | --- | --- |
| 1 | `DSP-GEO-20260908-01-cinematic-globe` | **Code-accept 2026-09-08** |
| 2 | `DSP-SCN-20260908-01-cinematic-player` | **Code-complete 2026-09-08** |
| 3 | `DSP-SCN-20260908-02-intro-bosphorus` | **Code-complete 2026-09-08** |
| 4 | `DSP-SCN-20260908-06-country-pins-spline` | **Code-complete 2026-09-08** |
| 5 | `DSP-PLT-20260908-01-cinematic-tile-disk` | **Code-complete 2026-09-08** |
| 6 | `DSP-SCN-20260908-07-cinematic-tile-warm` | **Code-complete 2026-09-09** |
| 7 | `DSP-OUT-20260908-01-cinematic-mp4` | **Code-complete 2026-09-09** — Human Pass = Electron Record |
| 8 | `DSP-SCN-20260909-01-intro-human-pass` | **Code-complete 2026-09-09** — Human Pass = Play + Save tile list |

Meshes can land in a later SCN catalogue DSP; sequence look-ats GPS either way.

---

## 10. Out of scope

SRT, NDI, IBB, Google Photorealistic, CesiumJS, race graphics in the take, audio mux, in-app “then go live”, DIY photogrammetry, After Effects, Rumeli Hisarı in this sequence.
