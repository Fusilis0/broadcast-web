# landmarks

Hero historic icons for Phase **20.1b** (`DSP-SCN-20260908-03`). Local **glTF or named proxy** at GEO ENU. **Not** CesiumJS, Google Photorealistic, IBB, or a second OSM tileset. **Not** Phase 21 cinematic.

Operator SKP + Sketchfab pack under `public/models/landmarks/`. Rumeli Hisarı is SKP `hisar2`. Maiden’s Tower is the CC-BY Sketchfab mesh (~98 MB, local studio; not git). Galata in-world is the small SKP `Galata_05`, **not** the 419 MB photogrammetry folder. See that folder’s `LICENSE.md`.

| id | Display | GPS (starting point) | altMsl | Occupancy r | Mesh | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| `maidens-tower` | Maiden’s Tower | 41.0211, 29.0041 | **0** (unknown) | 45 m | `maidens-tower.glb` | CC-BY-4.0 oblo.3d |
| `galata-tower` | Galata Tower | 41.0256, 28.9741 | **0** (unknown) | 45 m | `galata-tower.glb` (SKP) | operator-provided |
| `rumeli-hisari` | Rumeli Hisarı | 41.0848, 29.0567 | **0** (unknown) | 170 m | `rumeli-hisari.glb` (SKP `hisar2`) | operator-provided |
| `hagia-sophia` | Hagia Sophia | 41.00858, 28.98018 | **0** (unknown) | 80 m | `hagia-sophia.glb` | operator-provided SKP |
| `sultan-ahmed` | Sultan Ahmed | 41.00541, 28.97681 | **0** (unknown) | 80 m | `sultan-ahmed.glb` | operator-provided SKP |
| `topkapi` | Topkapı | 41.01152, 28.98338 | **0** (unknown) | 120 m | `topkapi.glb` | operator-provided SKP |
| `suleymaniye` | Süleymaniye | 41.01651, 28.96400 | **0** (unknown) | 90 m | `suleymaniye.glb` | operator-provided SKP |
| `aya-irini` | Hagia Irene | 41.01040, 28.98120 | **0** (unknown) | 40 m | `aya-irini.glb` | operator-provided SKP |
| `dolmabahce` | Dolmabahçe | 41.03917, 29.00070 | **0** (unknown) | 120 m | `dolmabahce.glb` | operator-provided SKP |
| `ciragan` | Çırağan | 41.04360, 29.01690 | **0** (unknown) | 80 m | `ciragan.glb` | operator-provided SKP |
| `bogazici-bridge` | 15 July Martyrs Bridge | 41.04500, 29.03400 | **0** (unknown) | **80 m** | `bogazici-bridge.glb` | operator-provided SKP |
| `fsm-bridge` | Fatih Sultan Mehmet Bridge | 41.09100, 29.06100 | **0** (unknown) | **80 m** | `fsm-bridge.glb` | operator-provided SKP |
| `yavuz-selim-bridge` | Yavuz Sultan Selim Bridge | 41.20200, 29.11800 | **0** (unknown) | **80 m** | `yavuz-selim-bridge.glb` | operator-provided SKP |

Bridge occupancy disks stay **~80 m** so they do not erase Beşiktaş. Mesh span may be longer.

**Units:** authored **1 unit = 1 metre** (`LANDMARK_AUTHORED_UNIT_M`). OpenSKP SKP leftovers: millimetres → `LANDMARK_MM_TO_M` when AABB is tens of km; inches → `LANDMARK_INCHES_TO_M` only if AABB is ~39× real. Do not rescale by eye. Do not tweak geoid.

**Textures:** SKP-derived glbs were re-exported with OpenSKP `glb.export(..., textures=True)` (DSP-04). Maiden’s Tower (`maidens-tower.glb`) is the Sketchfab mesh — do not re-export. Rumeli Hisarı is SKP `hisar2` (`rumeli-hisari.glb`). The Hero buildings panel chips `textured` / `no image` / `proxy`. SketchUp missing-texture magenta (`153,0,255`, Sultan Ahmed minaret bands) is recolored to wall stone at load (`recolorSketchupPurple`) — meshes stay.

**Authoring offsets:** left-rail **Hero buildings** edits ENU XYZ + yaw/pitch/roll + **uniform scale**. Every slider writes `localStorage` (`bw.landmarks.offsets.global`) + session immediately. Pack `landmarks.byId` still saves on Electron/API when that path exists (no Chrome download spam). Load/boot: pack → global → this tab. Built-in `DEFAULT_LANDMARK_OFFSETS` fill ids with no stored row.

**Floors:** runtime strip of SketchUp `Google_Earth_Terrain` / `Google_Earth_Snapshot` slabs and Sketchfab `ground` / `sea` planes (`stripLandmarkFloors`). Roof `tile_plane*` stays. Does not rewrite glb files.

**Placement:** `gpsToEnuAmsl(lat, lon, altMsl)` after `applyConfigOrigin` + EGM96 — same contract as course/sponsors. Re-layout on `GeoOrigin.onChanged`. Residual float/bury → **GEO**, not a local HAE tweak.

**Occupancy:** after layout, `setOccupancyHoles({ x, z, radiusM }[])` on OSM Buildings (scene ENU XZ, catalogue radius). Hidden / AR / empty catalogue → `[]` so OSM boxes return. Does **not** rewrite `src/scene/buildings/`.

**Gate:** same opaque-clear as buildings (`setEnvironmentOpaqueClearSafe`). Never on AR/chroma. Ops **heroes** checkbox default **on** (`bw.heroes.enabled`). Off → hide meshes and clear holes.

**Credits:** Maiden’s Tower CC-BY line on the **3D DOM overlay** (`LANDMARK_CCBY_CREDIT`). Never burned into the AR plate.
