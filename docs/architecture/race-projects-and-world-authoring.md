# Race projects & world authoring — design

**Status:** Design extended (2026-07-29) — BW  
**Owners:** SCN (map/scene features), PLT (pack I/O + API), CON (load-by-race), OUT (air/NDI), BW (roadmap)  
**Related:** [`system-architecture.md`](./system-architecture.md), [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md)

---

## 1. Vision

Ops create a **race project** (like a Unity scene pack): boats, categories/colours, course, start/finish, rotation arrows, sponsor billboards, flags, origin, telemetry bindings. Data is saved as **JSON** (and later a **database**), then opened on **any studio PC** via URL / console deep link so 3D AR and 2D map share the **same feature source**.

Unity workflow today: geojson.io → hand convert → billboards.  
Web target: **in-app map editor** (and optional GeoJSON import) → one pack → 3D + 2D + remote load.

---

## 2. What we already have (skills)

| Skill | Today | Notes |
| --- | --- | --- |
| Geo ENU spine | Yes | EGM96 + origin; shared by course/sponsors/flags |
| Course marks / gates / buoys | Yes | Custom JSON fixtures |
| Sponsor billboards (A–B panels) | Yes | 3D only |
| Countdown flags | Yes | Two poles + phases |
| Boat ids / names / categories / colours | Yes | Tags; hull/map colour deferred |
| Ops 2D map | Yes | Fleet + course dots; not stream graphic, not editor |
| Single `config.json` pack pointers | Yes | Many `*Url` fields, one race at a time |
| Deeplink `?race=` | Parsed only | Does **not** load a pack yet |
| GeoJSON import / map editor | No | Phase 4.2+ |
| Project DB / multi-machine sync | No | Phase 6 |
| NDI out of WebGL camera | No | Phase 5.5+ (optimum air path) |

---

## 3. Race project model

### 3.1 Project document (logical)

```text
RaceProject
  id, name, updatedAt, revision
  origin { lat, lon, altMsl }, takeoffAltitudeMSL?
  fleet { boatIds[], categories / boatNames catalogue }
  povIds[], telemetry hints { replayUrl?, ws*? }
  features[]          ← single geo layer list (see §4)
  appearance / theme?
  output defaults { outputMode?, whepUrl?, timecode*? }
```

On disk (V1): folder or zip / single JSON under `public/races/<id>/` or API blob.  
In DB (V2): same JSON document + metadata; SPA fetches by `id`.

### 3.2 Load paths

| Path | Behaviour |
| --- | --- |
| Local fixtures | Today’s `*Url` files (compat) |
| `?race=<id>` | CON resolves pack URL / API → apply origin + features + fleet |
| Console button | Opens overlay with `race` (+ token) |
| Far PC | Same HTTPS SPA + DB/API; no USB copy required |

**Rule:** 3D scene and 2D map both subscribe to the **same normalized feature list** after GEO (one layout pass).

---

## 4. Shared feature layers (3D + 2D)

| `type` | Purpose | 3D | 2D (ops + later stream) |
| --- | --- | --- | --- |
| `mark` | Buoy / turn mark | pole + label | dot + label |
| `gateLeft` / `gateRight` | Gate ends | segment | line |
| `boundary` / course polyline | Course outline | line loop | polyline |
| `sponsor` | Billboard A–B (or chain) | panel | footprint / icon |
| `start` / `finish` | Start/finish line or points | mesh / poles | icons + line |
| `arrow` / `rotation` | Direction / rotation spot | arrow mesh | arrow glyph |
| `flagP1` / `flagP2` | Countdown poles | flag system | icons |
| `zone` (QoL) | Keep-out / camera zone | optional | hatch |

Optional **GeoJSON** import: `FeatureCollection` → map properties → these types (Unity geojson.io path preserved).

---

## 5. Authoring UX (map editor)

Target (Phase 4.2+):

1. Top-down map (ENU; optional tiles later).  
2. Draw/edit points, lines, A–B sponsors, arrows, S/F.  
3. Property panel: type, name, height, texture, colour, boat category.  
4. Live preview: edits update 3D immediately (or on Apply).  
5. Save → project JSON (download / API).  
6. Import GeoJSON / export GeoJSON for external tools.

Ops 2D map today stays; editor may be a mode (`?editor=1` or console “World editor”) so air overlay stays clean.

---

## 6. Database & multi-machine

| Stage | Storage | Who |
| --- | --- | --- |
| Now | Static JSON in repo / `public/` | SCN/PLT |
| Next | Project API on Hetzner/VPS (CRUD + auth later) | PLT (+ CON token) |
| Far PC | Load `https://…/overlay?race=<id>` | Browser only for preview/chroma |

DB does **not** render Three.js. It only stores packs + revisions. Render stays on studio GPU.

---

## 7. Output ladder (optimum = NDI)

| Priority | Path | Role |
| --- | --- | --- |
| 1 | **Chroma + window/window capture** | First air proof (Phase 3.5) |
| 2 | WHEP underlay | Preview + CV |
| 3 | SRT / WebRTC egress | Remote / cleaner ingest |
| 4 | **NDI out of camera view (optimum)** | Drop-in Unity-like vMix source |

### NDI options (evaluate in Phase 5.5 / Phase 7)

| Option | Idea | Pros | Cons |
| --- | --- | --- | --- |
| **A. Electron + our NDI sender** | Shell around SPA; native addon grabs WebGL / shared frame → NDI SDK | One studio app; full control | Packaging, GPU capture complexity |
| **B. Native NDI helper** | Tiny sidecar reads frames/stream from SPA | Keeps SPA browser-only | Two processes |
| **C. Third-party NDI** | e.g. screen/window → NDI tool, or OBS NDI, or vMix NDI from capture | Fast to trial | Less integrated; quality depends on tool |

**BW preference order for optimum:** prove chroma → trial **C** for speed → invest in **A or B** if ops requires first-class NDI named source like Unity.

Browser SPA alone still **cannot** speak NDI; Electron or a native helper is required for owned NDI out.

---

## 8. QoL improvements (planned backlog)

- Project list UI: create / duplicate / rename / archive  
- Revision history + “what changed” on pack  
- Validate features (orphan gate side, missing boat id in catalogue)  
- Presets: “copy last race course, new boat names”  
- Snap-to-grid / bearing readout while drawing arrows  
- Hide ops HUD in air / editor-only chrome  
- Stream 2D map graphic (PiP or full) from same features  
- Hull + map-dot colours from category  
- Calib profiles per project / per POV saved with pack  
- Offline pack download for venues with bad uplink  
- Role split: editor users vs air-only operators  

---

## 9. Module ownership (additions)

| Concern | Owner |
| --- | --- |
| Feature schema + 3D/2D consumers | SCN |
| Map editor UI | SCN (+ PLT scaffold) |
| Project JSON I/O, zip, API | PLT |
| `?race=` → fetch pack | CON + PLT |
| GeoJSON adapter | SCN (+ GEO validate) |
| NDI Electron/helper | OUT (+ PLT packaging) |
| Project auth / multi-tenant | PLT + CON (with console team) |

---

## 10. Non-goals (for this design doc)

- Replacing the web console’s full ops product  
- Server-side Three render  
- Perfect offline multiplayer editing in V1  

---

## 11. Success picture (“what we will have”)

1. Operator creates **Project “Bosphorus Cup Heat 2”**.  
2. Sets origin, boat list, categories/colours, draws course, S/F, arrows, sponsors on the **map**.  
3. Saves → JSON in DB.  
4. Any studio opens console → **Open overlay** → same project loads.  
5. **3D AR** and **2D map** (ops + optional on-air) match.  
6. Air: chroma first; later **NDI camera view** into vMix (Electron or helper / third-party).  
7. Unity remains backup until NDI/chroma cutover criteria met.
