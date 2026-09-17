# Studio operator manual

Every control a human can use in the **broadcast-web Electron studio**. This is the picture, world, fleet, and air-path reference — not the agentic development process.

**Air picture today:** three local **SRT program-out** channels (AR / 3D / 2D) into OBS. NDI Send is kept in code but folded away as **Legacy NDI (hidden)**. In-browser NDI does not exist.

Related runbooks (how-to, not a full catalog):

- **Panel guides (one file per section):** [`studio/README.md`](./studio/README.md)
- Local OBS SRT: [`srt-local-obs.md`](./srt-local-obs.md)
- Human Pass (eye check): [`srt-human-pass.md`](./srt-human-pass.md)
- World authoring / packs: [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md)
- SRT cameras: [`../architecture/srt-program-cameras.md`](../architecture/srt-program-cameras.md)
- Cesium world: [`../architecture/3d-environment-buildings.md`](../architecture/3d-environment-buildings.md)
- Venue pack: [`venue-pack.md`](./venue-pack.md)
- Calibration overlay: [`ar-calibration-overlay.md`](./ar-calibration-overlay.md)

---

## 1. What you are looking at

The studio window is **1920×1080 WebGL** plus two overlay rails:

| Surface | Role |
| --- | --- |
| Centre canvas | Local **2D / 3D / AR** view (you switch this; it does **not** start or stop SRT/NDI) |
| Left rail **Race setup** | Project, Fleet & Live, Assets, Hero buildings, Library, Race ops |
| Right rail **Broadcast** | Output, Flow, Calibration, Environment, Cinematics, Wind |
| Header **World** | Opens the World Authoring workspace (map editor) |
| Bottom **SRT program bar** | Per-channel layer toggles + 3D/2D program cameras (follows local 2D/3D/AR) |
| Top **local view** | **2D** / **3D** / **AR** buttons |

There is **no** File / Edit application menu. The window menu bar is hidden.

---

## 2. Start the studio

```bash
npm run dev
npm run desktop:dev
```

Vite must be up first. Electron loads `http://127.0.0.1:5173` (or `BROADCAST_WEB_URL`).

**Tray (Windows):** tooltip `broadcast-web studio (NDI)`. **Show studio** restores the window. **Quit** exits the process. The window **Close** / **Minimize** buttons **park** the window off-screen so WebGL and SRT keep running — they do not quit.

Optional URL after `config.json` (console deep-link): `?mode=replay&originLat=…&originLon=…&race=<packId>&projectsRole=air`.

---

## 3. Rails, collapse, resize

| Control | What it does | Default |
| --- | --- | --- |
| Section title (accordion) | Expand / collapse that section | Project, Fleet & Live, Output, Cinematics **open**; Assets, Heroes, Library, Race ops, Flow, Calibration, Environment, Wind **closed** |
| **«** / **»** | Collapse that whole rail | Rails open |
| Expand tabs **Setup ›** / **‹ Broadcast** | Re-open a collapsed rail | — |
| Drag the rail edge | Width **280–560 px** | **340 px** |
| `` ` `` (backquote) | If any rail is open → collapse **both**; if both closed → open **both** | Ignored while the cursor is in an input / textarea |

Remembered in `sessionStorage`: `bw.opsSidebar.accordion`, `bw.opsSidebar.leftCollapsed`, `bw.opsSidebar.rightCollapsed`, `bw.opsSidebar.widthPx`, `bw.opsSidebar.rightWidthPx`.

Header **World** opens/closes World Authoring. Race ops **authoring** checkbox mirrors the same workspace.

---

## 4. Local view (2D / 3D / AR)

Walkthrough: [`studio/local-view.md`](./studio/local-view.md).

Top of the **Output** section (and the strip above the canvas):

| Button | What you see in the studio window | Does **not** |
| --- | --- | --- |
| **AR** (default) | WebGL AR plate: tags, optional SRT video underlay, AR clear mode | Stop SRT or NDI |
| **3D** | Opaque 3D world (sea, terrain, buildings, heroes) | Copy 3D layers onto AR |
| **2D** | Stream map filling the local 2D host; **Boat size** slider appears | Change OBS 2D until SRT 2D is on |

Hint in UI: NDI stays on (legacy wording). **Air path is SRT checkboxes**, not those buttons.

---

## 5. AR clear and AR background

Still in **Output**:

| Control | Values | Default | Meaning |
| --- | --- | --- | --- |
| **output** | `preview` · `chroma` · `transparent` | `preview` (from `config.json` `outputMode`) | How the **AR** canvas clears. Independent of local 2D/3D/AR. |
| **AR bg** | `alpha` · `video` | `alpha` (`arBackground`) | `alpha` = no ingest picture under tags. `video` = SRT ingest drawn in WebGL behind tags. |

| output | Clear | Typical use |
| --- | --- | --- |
| preview | Dark opaque `#1a1a1a` | Ops looking at AR |
| chroma | Green `#00ff00` (or `chromaKey` in config) | Key in vMix/OBS |
| transparent | Black, **alpha 0** | Legacy NDI alpha (not SRT program out) |

**SRT program plates are always opaque.** Ops `transparent` does **not** punch a hole in OBS AR/3D/2D.

**Connect SRT** also switches **AR bg → video** and local view → **AR** so you can see the drone underlay in studio.

Unknown `outputMode` → treated as preview. Unknown `arBackground` → alpha.

---

## 6. Project, packs, origin

Walkthrough: [`studio/project.md`](./studio/project.md).

**Left → Project**

| Control | What it does |
| --- | --- |
| Project meta | Active pack **name (id)** |
| Race select | List of packs. **Picking a row does not load** until **Load** |
| Custom **id…** | Type a pack id |
| **Load** | Load selected or typed pack |
| **Save** | Overwrite current pack (disabled for **air** role) |
| **Save as** | New id + name |
| **Export…** | Electron: download `project.json` only (not the full venue pack) |
| **Pack ↓** | Download offline venue pack (`*-venue-pack.json`) + cache |
| **Pack ↑** | Load a venue pack file (hidden file picker) |

Boot with no `?race=` → pack **`empty`**. `?race=<id>` loads that pack (miss → warn, keep `config.json`).

**air** role (`config.projectsRole` or `?projectsRole=air` / `?role=air`): Save / Save as / library upload disabled (load still works).

If `projectsApiBase` is set, **Project manager** extras: **Refresh**, **Show archived**, per-row **Dup** / **Rename** / **Archive** / **Unarchive**. Without API: use Load/Save only.

### Origin (ENU 0, 0, 0)

| Field | Default (Istanbul demo in config) |
| --- | --- |
| lat | 41.0082 |
| lon | 28.9784 |
| altMsl | 0 |

**Apply** (or Enter in a field) sets the geographic world anchor. Everything in 3D (terrain, buildings, boats) is relative to this point. Invalid numbers → hint `invalid`. After Apply, hint returns to `ENU 0,0,0`.

Also in config: `takeoffAltitudeMSL` (drone relative→HAE, default **0**). Not a separate HUD field.

**Save the pack** after origin / world / fleet / calibration edits if you want them next boot.

---

## 7. Fleet & Live (telemetry + SRT ingest)

Operator walkthrough (switch cam, add boat, Connect live / SRT): [`studio/fleet-live.md`](./studio/fleet-live.md).

**Left → Fleet & Live**

### Connection bar

| Control | Default / notes |
| --- | --- |
| **Drone base** / **Boat base** | Live WebSocket bases (no id in the path). Empty config falls back to the studio WS host used in the panel. Session: `broadcast-web.fleetLive.v1` |
| **SRT template** | Optional URL with `{srtId}`. **Empty** = catalog cameras **1–27** on ingest port **9000**. Session only (not written into the pack as a secret) |
| **Connect live** | Open sockets **only for Live-checked** boats/POVs. Greyed while connected |
| **Disconnect** | Close **all** live sockets; stay down until Connect/Reconnect |
| **Reconnect** | Stop then start live. Independent of SRT ingest |
| **Connect SRT** | Open ingest callers for **Vid-checked** POVs (cap **4**). Forces AR bg video + local AR |
| **Disconnect SRT** | Close ingest callers / ffmpeg. Independent of live WS |

Do **not** also listen to the same ingest URL in VLC/OBS while studio is the caller — that steals the catalog stream. Watching **program out** 9201–9203 is fine.

### Boats

| Control | Meaning |
| --- | --- |
| **Live** checkbox | Include this id in live WS (can toggle while connected) |
| id / name / category | Edit; **Save** commits |
| Colour | Auto / palette / Custom (category keywords feed Auto) |
| Visibility | **solid** / **ghost** / **3D off (tag on)** — see §8 |
| **Save** / **×** | Commit / remove from fleet |
| Add row + **Add** | New boat |
| **Frame boats** (ops preview) | Free-cam look-at **ops** hulls that exist (not the SRT 3D program rig) |

Default registry boats if config omitted: **21–24**.

### POVs (drones / cameras)

| Control | Meaning |
| --- | --- |
| **Live** | Drone WS enable |
| **srt** id | Camera id for ingest (can differ from telemetry id) |
| **Vid** | Include this POV in **Connect SRT** |
| **Save** / **Cam** or **Switch** / **×** | Commit; set **active air POV**; remove (at least one POV remains) |
| Add + **Add** | New POV |

Default POVs: **1**, **2**. Digit keys **1–4** switch active POV if that id is in the list (not while typing in a field).

**Planned** lat/lon/alt (map / inspector) show a boat on the map **without** live GPS. Planned-only does **not** count as “active telemetry” for AR Follow, 2D program centroid, or **Frame boats** on the SRT bar.

---

## 8. Hide or close parts of an asset

There are **three independent layers**. Something is on-air in 3D/AR only if **all** of them allow it.

### A. Boat hull vs tag (Fleet + Assets)

| Mode | Hull | Tag | 2D map icon |
| --- | --- | --- | --- |
| **solid** (default) | Opaque | On | On unless **2D off** |
| **ghost** | Translucent (~32%) + ring | On | Same |
| **hidden** / **3D off (tag on)** | Off | **Stays on** | Unchanged |

Assets row also has **2D** / **2D off** (`mapVisible`) for the stream/ops map icon.

### B. Marks / buoys / gates (Assets **Details** or World inspector)

For buoy-like features:

| Checkbox | Field | Default if omitted |
| --- | --- | --- |
| **Full 3D** | `visible3d` | on |
| **Buoy mesh** | `visibleBuoyMesh` | on |
| **Tag** | `visibleTag` | on |

If **Full 3D** is off, mesh and tag checkboxes are ignored (nothing 3D for that mark).

**Rounding:** Off / **CW** (default) / CCW. Off hides rounding arrows even if the SRT bar has Rounding arrows on.

Generic features: row buttons **3D** / **3D off** and **2D** / **2D off**.

**Details → Close** hides the detail pane. Boat details can **Open Fleet**.

Edits apply **immediately**. **Project Save** writes them into the pack.

### C. SRT program bar (per output channel)

Bottom bar. **Local 3D shows the 3D preset; local AR shows the AR preset.** Toggling 3D **Boat model** does **not** change AR tags.

A layer is drawn only if the **preset is on AND** the authored flag is on (the bar cannot force on a hidden authored mesh).

| Layer | 3D SRT default | AR SRT default |
| --- | --- | --- |
| Boat model | on | **off** |
| Boat tag | on | on |
| Heading arrow | on | **off** |
| Buoy model | on | **off** |
| Buoy tag | on | on |
| Rounding arrows | on | **off** |
| Sponsors | on | on |
| Billboards | on | on |
| Start/Finish | on | on |

**2D** pane has no mesh checkboxes — stream-map sail icons only.

Presets are runtime (not session). Reload resets to the table above.

### Heroes

No per-building Hide in the Heroes panel. Uncheck Environment **heroes** to hide **all** landmark meshes (OSM occupancy holes under them restore). Per-hero you only **Focus** and nudge pose (see §10).

### Library

Walkthrough: [`studio/library.md`](./studio/library.md).

Library is **textures/meshes you attach** (Refresh, Upload…). It does not hide scene objects. Upload (`.png` `.jpg` `.webp` `.glb` `.gltf`) only if `projectsApiBase` is set and role is not air.

---

## 9. Assets panel (list)

Walkthrough: [`studio/assets.md`](./studio/assets.md).

**Left → Assets** — hint: Focus · 3D · 2D · Details.

Groups: Boats, POVs, Sponsors, Chains, Buoys, Marks, Gates, Start/Finish, Flags, Other.

| Action | Effect |
| --- | --- |
| Focus | Frame ops free cam on that object |
| 3D / 3D off | `visible3d` (POVs store the flag; no separate POV mesh yet) |
| 2D / 2D off | Map icon |
| Boat visibility select | solid / ghost / 3D off |
| **Details** | Inspector: id, lat/lon/alt, height, label, rounding, logos, plate colour/alpha, Full 3D / Buoy mesh / Tag, **Library…** |

---

## 10. Hero buildings

Walkthrough: [`studio/hero-buildings.md`](./studio/hero-buildings.md).

**Left → Hero buildings** (3D dress; gated off with transparent/chroma AR)

Per catalogue landmark:

| Control | Default | Persistence |
| --- | --- | --- |
| **Focus** | — | Frames free cam |
| Texture chip | read-only | — |
| **X Y Z** | 0 | East / up / −North metres |
| **yaw pitch roll** | 0 | degrees |
| **scale** | 1 | uniform |

Auto-saves locally (`bw.landmarks.offsets` / `.global`). Pack **Save** embeds offsets when Electron/API can write.

Master switch: Environment **heroes**.

---

## 11. World Authoring

Walkthrough: [`studio/world-authoring.md`](./studio/world-authoring.md). Tools (Start, Finish, Buoy, Sponsor, chain, Arrow, Anchor, Place boat/drone): [`studio/world-authoring-tools.md`](./studio/world-authoring-tools.md).

Open **World** in the header (or Race ops **authoring**).

| Control | Notes |
| --- | --- |
| **Maximize** / **Restore** | Full-window layout |
| Map height drag | Remembered `bw.worldAuthoring.mapSizePx` |
| **vertex snap (14px)** | Default **on** |
| **grid 5m** | Default **off** |
| **Finish chain** | Billboard polyline (≥2 points) |
| **Delete** | Selected feature (also **Delete** / **Backspace**) |
| **Esc** | Cancel placement |
| **Enter** | Confirm some placements |
| **Export JSON** / **Export GeoJSON** | Download |
| **Import GeoJSON** | Replace or merge (confirm) |

### Tool groups

| Group | Tools |
| --- | --- |
| Select | Select |
| Course | Start, Finish, Mark, Gate L, Gate R, Gate pair, Buoy, Flag P1, Flag P2 |
| Graphics | Sponsor, Billboard chain, Arrow |
| Fleet | Place boat, Place drone |
| Anchor | Set anchor |

Two-click tools: Gate pair, Sponsor, Start, Finish, Arrow (A then B). Billboard chain is a polyline. Place boat/drone register into the fleet (session until Project Save). Set anchor updates origin.

Inspector while placing/editing: type, name, label, telemetry id, lat/lon/alt MSL (and B-side for two-click), height, boat visibility, sponsor Library / plate colour / plate alpha, chain spacing and logos, buoy Full 3D / mesh / tag, rounding.

---

## 12. Race ops

Walkthrough: [`studio/race-ops.md`](./studio/race-ops.md).

**Left → Race ops**

| Control | Values / default | Notes |
| --- | --- | --- |
| **telemetry** | mock (default) · replay · live | Restarts TEL ingest. Live needs WS. |
| **pov** | First of `povIds` | Digit keys 1–4; Fleet Cam |
| **view** | **Free cam** (default) · Follow active POV | Free is **ops look only**. It does not move AR SRT or (until takeover) 3D SRT. |
| **preview** / **GPU** / **hitch** | Readouts | fps; WebGL renderer; count of frames with dt > 50 ms |
| **countdown** | start / pause / reset / restart | Flag sequence |
| **authoring** | checkbox off | Same as header World |
| Status `<pre>` | mode, WS, POV, ENU | — |
| SRT situation line | ingest decode / caller | Updates with Connect SRT |

---

## 13. Environment and Cesium world auth

Walkthrough: [`studio/environment.md`](./studio/environment.md).

**Right → Environment.** This is the **3D dress**. It is forced **off** when AR output is transparent/chroma, and the **SRT AR plate** always forces: environment **simple**, terrain **off**, buildings **off**, heroes **off** (so the drone video can show).

| Control | Values | Default | Persistence |
| --- | --- | --- | --- |
| **environment** | simple · realistic | **realistic** | none |
| **sea** | high · low | **high** | none (`?sea=low` query) |
| **terrain** | off · on | **on** | none |
| **map** | road · aerial | **aerial** | session `bw.terrain.overlay` |
| **lock tiles** | checkbox | **off** | session `bw.terrain.tilesLocked` (`1` = on) |
| **buildings** | checkbox | **on** | session `bw.buildings.enabled` (`0` = off) |
| **heroes** | checkbox | **on** | session `bw.heroes.enabled` |
| **nudge m** | number | **0** | session `bw.terrain.altitudeNudgeM` |
| **Cesium hide m** | −20 … +5 | **0.5** | none — discards Cesium **water** fragments (not Gerstner) |
| **sea m** | −20 … +20 | **0** | none — Gerstner rest height; assets with Alt MSL stay |
| **ion token** + **Apply** | password field | resolved token or empty | see below |

**simple** = no photoreal sea/sky (AR-safe pad). **realistic** = Gerstner sea + sky + fog (needs opaque clear).

**map aerial** = Bing Maps Aerial (ion **2**) draped on World Terrain. **map road** = Bing Road (ion **4**). Switching **remounts terrain only** (OSM buildings stay).

**lock tiles** freezes terrain + OSM **LOD in this window’s GPU**. It does **not** copy a frozen mesh into OBS — the 3D SRT plate always keeps streaming (otherwise OBS would show sea with no land). Use lock in studio after the shot is framed to stop hitching.

**nudge m** raises/lowers the whole Cesium tileset if geoid/ion residual is visible.

Status line examples: `Terrain: on · AR-gated · aerial · tiles N`, `Terrain: off — no ion token …`, `Buildings: on · tiles N`.

### Ion token (world auth)

**Resolve order** (first non-empty wins):

1. `public/config.json` → `cesiumIonToken` (Electron **Apply** can write this file; packaged builds use `userData/config.json`)
2. `sessionStorage` `bw.cesiumIonToken` (this session’s paste)
3. Env `VITE_CESIUM_ION_TOKEN`
4. Empty → no World Terrain, no OSM Buildings, no Bing drape. Sea/heroes-from-disk can still run. Cinematic warm: `tiles: skipped (no ion token)`.

**Apply:**

- Trim whitespace.
- Length **> 8192** → abort, status `Terrain: ion token too long`, no remount.
- Otherwise write session, remount **terrain + buildings**.
- **Empty Apply** clears the session token and disposes tilesets.

Never log the token. Do not put a filled token on a **public** Hetzner SPA.

Invalid/expired JWT: no dedicated toast; tiles fail to load (status may still say “on”). Check the ion account / asset access.

### Cesium asset IDs (not HUD; in config)

| Asset | Ion id | Config key | Notes |
| --- | --- | --- | --- |
| Cesium World Terrain | **1** | `cesiumIonAssetId` | DEM under the aerial |
| Bing Aerial | **2** | `cesiumIonImageryAssetId` | Default overlay |
| Bing Road | **4** | (via **map** = road) | Street overlay |
| OSM Buildings | **96188** | (code constant) | Separate tileset from terrain |
| Imagery **0** | — | `cesiumIonImageryAssetId: 0` | Bare terrain, no Bing drape |

---

## 14. Wind

Walkthrough: [`studio/wind.md`](./studio/wind.md).

**Right → Wind**

| Control | Default | Notes |
| --- | --- | --- |
| **from°** | 0 | Meteorological FROM direction |
| **kt** | 6 | Speed |
| **hold** / **API** | follow API | **hold** = your numbers win; **API** = Open-Meteo at origin (~10 min). Open-Meteo [CC BY 4.0](https://open-meteo.com/) |

---

## 15. Output — SRT program out (air)

Walkthrough: [`studio/output.md`](./studio/output.md).

**Right → Output → SRT program out**

Checkboxes **SRT AR** / **SRT 3D** / **SRT 2D**. Each starts an ffmpeg **caller** to a URL (editable). Uncheck kills **that** channel only.

| Channel | Default studio URL (caller) | OBS Media Source **Input** (listener) |
| --- | --- | --- |
| AR | `srt://127.0.0.1:9201?mode=caller&latency=60000` | `srt://0.0.0.0:9201?mode=listener&latency=60000` |
| 3D | `…9202…` | port **9202** |
| 2D | `…9203…` | port **9203** |

**OBS:** Local File **off**, Input Format **`mpegts`**, latency **60000** (microseconds = 60 ms). Do **not** use `latency=60`. Do **not** paste `0.0.0.0` into studio. Listeners **first**, then studio checkboxes.

URLs remembered: `bw.srt.out.urls`. Status: idle / connecting / live, fps, encoder (want **`h264_amf`**). Error line = ffmpeg (often “no listener”).

| Channel | Picture |
| --- | --- |
| **AR** | Active POV, tags, **video underlay** when ingest is live. No terrain/sea/OSM/heroes. Opaque. 1920×1080. |
| **3D** | **Program camera** (not ops WASD unless you take over). Sea + terrain + buildings + heroes. No ops HUD. |
| **2D** | Stream map 1920×1080. |

Until you tick **Control 3D program** or **Frame boats**, the program camera **mirrors the studio 3D look** so OBS land matches what you framed. After takeover, ops WASD does **not** move OBS; last program pose holds.

If OBS AR is a small picture in a striped box: right-click source → Transform → **Reset**, then **Ctrl+F**, Bounding Box **Stretch to bounds**. Canvas **1920×1080**.

Ingest catalog is port **9000**. Program out is **9201–9203**. Do not collide them.

---

## 16. Bottom SRT program bar (cameras)

Walkthrough: [`studio/srt-program-bar.md`](./studio/srt-program-bar.md).

Follows **local view**.

### Local 3D

| Control | Default | Meaning |
| --- | --- | --- |
| **Control 3D program** | off | Off: mouse/WASD = **ops** camera (studio). On: drive the **damped program** rig; studio 3D **shows program** so aiming is not blind. |
| **Frame boats** | — | Snap program rig to boats with **live** GPS (not planned-only). |
| Layer checkboxes | §8 table | 3D preset |

### Local AR

| Control | Notes |
| --- | --- |
| **Follow** / **Free** | Disabled stubs. Freeze-until-GPS then follow is **automatic** (usable GPS ≤ 2 s on the selected POV). |
| Layer checkboxes | AR preset |

### Local 2D

| Control | Default | Meaning |
| --- | --- | --- |
| **Follow centroid** | — | Top-down follow centroid of boats with live GPS |
| Per-boat buttons | dynamic | Follow that live boat |
| **E (m)** / **N (m)** | 0 / 0 | Offset from the follow target |
| **Across (m)** | **250** (40–20000) | Metres across the 16:9 frame (zoom). Matches OBS 2D |

Empty live set: view **freezes** (does not wander). Mini-map in ops stays a utility map; program 2D is the stream map.

Local 2D also shows **Boat size** (0.25–2, default **0.5**, session `bw.streamMap.boatScale`) for map hulls/pills/buoys.

---

## 17. Legacy NDI (hidden)

**Output → Legacy NDI (hidden)** — `<details>` **closed** by default. Air is SRT.

| Control | Default |
| --- | --- |
| **Send on NDI** per AR/3D/2D | **all off** (`bw.ndi.channelWanted`) |
| **Delay** (ms) | 0 (0–30000; >3000 warns memory) |
| **Copy 10 s dump** | Stage timing to clipboard |

Session only — never saved into `project.json`. Enabling an SRT box must not start NDI.

---

## 18. Flow

Walkthrough: [`studio/flow.md`](./studio/flow.md).

**Right → Flow**

| Control | Default |
| --- | --- |
| **Live JSON** | off (`bw.flow.liveJson`) — poll per-id telemetry + SRT JSON |
| Card chevron | collapsed |
| **Pop out** / **Dock** | float a card on the overlay |

---

## 19. Calibration

Walkthrough: [`studio/calibration.md`](./studio/calibration.md).

**Right → Calibration**

| Knob | Default | Range | Step |
| --- | --- | --- | --- |
| **device** | Active / first POV | picker | — |
| **yaw°** / **pitch°** / **roll°** | 0 | −200…200 | 0.1 |
| **fov°** | **66.8832** | 20…120 | 0.1 |
| **alt m** | 0 | −50…50 | 0.1 |
| **sync ms** | 0 | −500…500 | 5 |
| **Reset** | zeros + default FOV for that device | — | — |
| **Calibration overlay** | off | ENU grid through active POV | — |

**sync ms:** `t_ntp = toNtp(pts) + syncTrimMs`. **Positive = AR leads video.** Saved in the pack as `calibration.byPovId`.

---

## 20. Cinematics

Walkthrough: [`studio/cinematics.md`](./studio/cinematics.md).

**Right → Cinematics**

| Control | Notes |
| --- | --- |
| **sequence** | **Off (race view)** · intro-bosphorus (~72 s) · `_empty` fixture |
| **Play** | GPU-uploads tiles for the sequence camera (disk cache ≠ skip GPU). Status `tiles: warming` → `tiles: warm`. Then plays. |
| **Pause** | — |
| **Record** | Electron silent **1080p30 MP4** (not SRT/NDI). vMix can play the file. |
| **Save tile list** | Download sequence JSON with `tileWarm.contentUrls` (IDs, not binaries) |
| Scrub + time | Seek |

Selecting **Off** returns to race view and restores Environment **lock tiles** if cinematic had forced a lock.

No ion token → warm skipped. Boot does **not** auto-warm (that hitch is gone); **Play** still warms.

While cinematic is active, race chrome (boats/course) can hide.

---

## 21. Mouse and keys (3D ops)

When **view = Free cam** and **Control 3D program** is off:

| Input | Action |
| --- | --- |
| **W A S D** | Move camera + pivot on the ground; speed grows with height |
| Left-drag | Pan |
| Right-drag | Orbit |
| Wheel | Zoom toward cursor |
| **1–4** | Active POV |
| `` ` `` | Both rails |

With **Control 3D program** on, the same mapping drives the **program** rig (smoother damping) and studio 3D shows that view.

---

## 22. Config keys you can edit (`public/config.json`)

Boot values. Many HUD changes do **not** write here unless noted (ion **Apply** in Electron does).

| Key | Typical default | HUD / notes |
| --- | --- | --- |
| `telemetryMode` | `mock` | Race ops |
| `replayUrl` | spine-demo fixture | replay mode |
| `courseUrl` / `sponsorsUrl` / `flagsUrl` / `boatNamesUrl` | Istanbul fixtures | usually pack-driven |
| `wsUrl` / `wsBoatUrl` | `""` | prefer Fleet panel |
| `boatIds` | 21–24 | Fleet |
| `povIds` | 1, 2 | Fleet |
| `buoyIds` | `[]` | buoy telem ids |
| `origin` | Istanbul demo | Project origin |
| `takeoffAltitudeMSL` | 0 | GEO |
| `outputMode` | `preview` | Output |
| `arBackground` | `alpha` | AR bg |
| `chromaKey` | `""` → `#00ff00` | chroma mode |
| `timecodeEnabled` | false | no HUD; pack/config |
| `timecodeCorner` | `bottom-right` | |
| `timecodeSizePx` | 96 | |
| `whepUrl` | `""` | WHEP underlay idle |
| `projectsApiBase` | `""` | Library/PM |
| `projectsRole` | `editor` | `air` = read-only |
| `projectsApiToken` | `""` | Bearer; never git |
| `cesiumIonToken` | see Environment | **Apply** can persist |
| `cesiumIonAssetId` | 1 | World Terrain |
| `cesiumIonImageryAssetId` | 2 (0 = no drape) | Bing |

Reload the studio after hand-editing `config.json` (except ion Apply, which remounts live).

---

## 23. Persistence cheat-sheet

| Storage | What |
| --- | --- |
| `sessionStorage` `bw.opsSidebar.*` | Rails |
| `bw.terrain.overlay` / `altitudeNudgeM` / `tilesLocked` | Map, nudge, lock |
| `bw.buildings.enabled` / `bw.heroes.enabled` | Buildings, heroes |
| `bw.cesiumIonToken` | Token this session |
| `bw.streamMap.boatScale` | 2D boat size |
| `bw.srt.out.urls` | SRT out URLs |
| `bw.ndi.channelWanted` | Legacy NDI |
| `bw.worldAuthoring.mapSizePx` | Authoring map |
| `bw.landmarks.offsets` | Hero poses |
| `broadcast-web.fleetLive.v1` | Fleet/Live panel |
| Race `project.json` / venue pack | World features, fleet, calib, origin |
| `public/config.json` | Boot + Electron ion Apply |

---

## 24. Cold-start snapshot

| Area | Default |
| --- | --- |
| Pack | `empty` |
| Telemetry | mock |
| Origin | 41.0082, 28.9784, 0 |
| Boats / POVs | 21–24 / 1–2 |
| Ops view | free cam |
| Local view | AR |
| Environment | realistic, terrain on, aerial, buildings on, heroes on, lock tiles off |
| Output / AR bg | preview / alpha |
| SRT out boxes | off; URLs 9201–9203 |
| NDI Send | all off, panel hidden |
| Layer presets | 3D all on; AR meshes off, tags/sponsors/boards/SF on |
| Calib | FOV 66.8832°, sync 0 |
| Cinematic | Off |
| Control 3D program | off |
