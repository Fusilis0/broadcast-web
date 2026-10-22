# Environment

Right rail **Broadcast → Environment**. The **3D dress**: sea, Cesium terrain, OSM buildings, hero master switch, ion token.

This is **not** AR. The SRT **AR** plate always forces: environment **simple**, terrain **off**, buildings **off**, heroes **off** so the drone video can show. Transparent/chroma AR also gates 3D dress off in the ops window.

Per-hero pose is [Hero buildings](./hero-buildings.md). Master **heroes** checkbox is here.

---

## Controls

| Control | Values | Default | What it does |
| --- | --- | --- | --- |
| **environment** | simple · realistic | **realistic** | **simple** = no photoreal sea/sky (AR-safe pad). **realistic** = Gerstner sea + sky + fog (needs opaque clear) |
| **sea** | high · low | **high** | Sea quality (`?sea=low` also works) |
| **terrain** | off · on | **on** | Cesium World Terrain. Needs an ion token |
| **map** | road · aerial | **aerial** | Drape: Bing Aerial (ion **2**) or Bing Road (ion **4**). Switching **remounts terrain only** (OSM buildings stay) |
| **lock tiles** | checkbox | **off** | Freeze terrain + OSM **LOD in this window’s GPU**. Does **not** copy into OBS — the 3D SRT plate keeps streaming (otherwise OBS would be sea with no land). Use after the shot is framed to stop hitching |
| **buildings** | checkbox | **on** | OSM Buildings tileset |
| **heroes** | checkbox | **on** | All landmark meshes |
| **nudge m** | number | **0** | Raise/lower the whole Cesium tileset if geoid residual is visible |
| **Cesium hide m** | −20…+5 | **0.5** | Discard Cesium **water** fragments (not the Gerstner sea) |
| **sea m** | −20…+20 | **0** | Gerstner rest height. Assets with Alt MSL stay put |
| **ion token** + **Apply** | password field | resolved token or empty | World auth — see below |

Status line examples: `Terrain: on · AR-gated · aerial · tiles N`, `Terrain: off — no ion token …`, `Buildings: on · tiles N`.

---

## Ion token (world auth)

First non-empty wins:

1. `public/config.json` → `cesiumIonToken` (leave empty in git; Electron **Apply** can write this locally; packaged builds use `userData/config.json`)
2. `sessionStorage` `bw.cesiumIonToken` (this session’s paste)
3. Env `VITE_CESIUM_ION_TOKEN`
4. Empty → no World Terrain, no OSM Buildings, no Bing drape. Sea / heroes-from-disk can still run. Cinematic warm: `tiles: skipped (no ion token)`

**Apply:**

- Trim whitespace
- Length **> 8192** → abort, `Terrain: ion token too long`, no remount
- Otherwise write session, remount **terrain + buildings**
- **Empty Apply** clears the session token and disposes tilesets

Never log the token. Do not put a filled token on a **public** Hetzner SPA.

Invalid/expired JWT: no dedicated toast; tiles fail to load (status may still say “on”). Check the ion account / asset access.

### Cesium asset IDs (not HUD)

| Asset | Ion id | Notes |
| --- | --- | --- |
| Cesium World Terrain | **1** | DEM under the aerial |
| Bing Aerial | **2** | Default **map** |
| Bing Road | **4** | **map** = road |
| OSM Buildings | **96188** | Separate tileset |
| Imagery **0** | config `cesiumIonImageryAssetId: 0` | Bare terrain, no Bing drape |

Architecture: [`../../architecture/3d-environment-buildings.md`](../../architecture/3d-environment-buildings.md).

Related: [all panels](./README.md) · [Hero buildings](./hero-buildings.md) · [Cinematics](./cinematics.md) · [catalog](../studio-operator-manual.md)
