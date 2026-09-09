# Dispatch DSP-SCN-20260908-03-hero-gltf-pack

## Meta
- From orchestrator: SCN (Phase **20** hero follow-up — **not** cinematic Phase 21)
- Worker role: WORKER(DSP-SCN-20260908-03-hero-gltf-pack)
- Priority: **P0**
- Phase: **20.1b** — operator-provided landmark glTF into the existing `landmarks/` mount
- Worker result: **code done 2026-09-08**. Pack mounted; Rumeli proxy; Maiden’s local-only 98 MB gitignored; 419 MB Galata skipped; SKP mm→m (`LANDMARK_MM_TO_M`). Landmarks+HUD **20/20**. SCN **code-accept**. **Human Pass pending** (operator street-scale smoke).
- Placement: `gpsToEnuAmsl` only. `altMsl = 0`. Bury/float → stop, GEO — no HAE guess.
- No CesiumJS, Google Photorealistic, IBB, ocean rewrite, NDI, SRT, `STUDIO_TICK_FPS`.

## Goal

Replace the three colored proxy boxes with the converted landmark meshes, and add the rest of the operator pack so local **3D** shows named buildings (and bridges) at GPS — OSM punched under each.

## Background

Operator dropped SketchUp + two Sketchfab zips on `C:\Users\PC\Desktop\hero models`. SCN converted (no SketchUp app) into `C:\Users\PC\Desktop\hero models\gltf-out\`.

- **HQ (already glTF, CC-BY-4.0):** `maidens-tower.glb` (~98 MB). **Do not** copy `galata-tower-gltf/` (`scene.bin` ~419 MB) — hitch + no Git-LFS without BW/PLT. Galata in-world = small SKP `Galata_05.glb`.
- **SKP → GLB** (OpenSKP, metres): Hagia Sophia, Sultanahmet, Topkapı, Süleymaniye, Aya İrini, Dolmabahçe, Çırağan, Galata_05, three bridges.
- **Rumeli Hisarı:** no file — **keep the proxy**.
- DSP-02 `MAX_LANDMARKS = 3` must be **raised** to fit this pack (catalogue length).

## In scope

1. **Copy** into `public/models/landmarks/` (not the 419 MB Galata folder):

| Source (`gltf-out`) | Dest name |
| --- | --- |
| `maidens-tower.glb` | `maidens-tower.glb` |
| `Galata_05.glb` | `galata-tower.glb` |
| `hagia-sophia_13.glb` | `hagia-sophia.glb` |
| `Sultanahmet_10.glb` | `sultan-ahmed.glb` |
| `Topkapi_11.glb` | `topkapi.glb` |
| `suleymaniye_01.glb` | `suleymaniye.glb` |
| `Aya-Irini_04.glb` | `aya-irini.glb` |
| `dolmabahce7.glb` | `dolmabahce.glb` |
| `ciragan_03.glb` | `ciragan.glb` |
| `bogazici_bridge.glb` | `bogazici-bridge.glb` |
| `fsm_bridge.glb` | `fsm-bridge.glb` |
| `yavuz_sultan_selim_koprusu_ediyed.glb` | `yavuz-selim-bridge.glb` |

Do **not** `git add` `maidens-tower.glb` if the hook/LFS story is unclear — copy for local studio; note in report. Smaller SKP glbs (~0.2–3.5 MB) may be committed.

2. **Catalogue** — `kind: 'gltf'` + `gltfUrl` for the table below. Rumeli stays `proxy`. Raise `MAX_LANDMARKS`. GPS are **starting points**, not a survey. `altMsl: 0`. `yawDeg: 0`. Occupancy = footprint disk; **bridges stay small (~80 m)** so they do not erase Beşiktaş.

| id | Display | lat | lon | r m |
| --- | --- | --- | --- | --- |
| `maidens-tower` | Maiden’s Tower | 41.0211 | 29.0041 | 45 |
| `galata-tower` | Galata Tower | 41.0256 | 28.9741 | 45 |
| `rumeli-hisari` | Rumeli Hisarı | 41.0848 | 29.0567 | 170 |
| `hagia-sophia` | Hagia Sophia | 41.00858 | 28.98018 | 80 |
| `sultan-ahmed` | Sultan Ahmed | 41.00541 | 28.97681 | 80 |
| `topkapi` | Topkapı | 41.01152 | 28.98338 | 120 |
| `suleymaniye` | Süleymaniye | 41.01651 | 28.96400 | 90 |
| `aya-irini` | Hagia Irene | 41.01040 | 28.98120 | 40 |
| `dolmabahce` | Dolmabahçe | 41.03917 | 29.00070 | 120 |
| `ciragan` | Çırağan | 41.04360 | 29.01690 | 80 |
| `bogazici-bridge` | 15 July Martyrs Bridge | 41.04500 | 29.03400 | 80 |
| `fsm-bridge` | Fatih Sultan Mehmet Bridge | 41.09100 | 29.06100 | 80 |
| `yavuz-selim-bridge` | Yavuz Sultan Selim Bridge | 41.20200 | 29.11800 | 80 |

3. **Mount** — existing `createLandmarks` + `setOccupancyHoles`. Missing glTF → warn + skip (or proxy), no throw. After load, `console.info` each id’s world-space AABB size (metres) once. If a mesh is **tens of km** or **centimetres**, report — do **not** invent a scale factor unless OpenSKP clearly left inches (`×0.0254` only if AABB is ~39× real). Do not tweak geoid.

4. **Credits** — `public/models/landmarks/LICENSE.md`: Maiden’s Tower CC-BY-4.0 oblo.3d (Sketchfab). Galata in-world is the SKP conversion (operator-provided; source unverified) — **not** the 419 MB byrokestudios mesh. Other SKP: operator-provided, source unverified. CC-BY credit on the **3D DOM overlay** if you can append a short line; never AR plate.

5. Tests: catalogue length, Rumeli still proxy, glTF urls, occupancy still from `gpsToEnuAmsl`, `MAX_LANDMARKS` ≥ pack. `npm test` landmarks + HUD. Pre-existing `library.test.ts` / OUT `tsc` not yours.

## Out of scope

- Phase 21 cinematic / `intro-bosphorus`
- Compressing the 419 MB Galata photogrammetry
- GEO formulas, ocean, NDI, SRT
- Per-landmark inspector

## Likely files

- `public/models/landmarks/*` + `LICENSE.md`
- `src/scene/landmarks/catalogue.ts`, `constants.ts`, tests, README
- `createScene.ts` / `stubHud.ts` only if occupancy/credits need a hook

## Acceptance criteria

- [ ] Local 3D + heroes on: Maiden’s Tower is the **textured Sketchfab mesh**, not a terracotta box. Galata is the SKP tower, not a cream box. Rumeli still a proxy box.
- [ ] Historic Peninsula / Dolmabahçe / Çırağan / Süleymaniye sit near their GPS (street-scale orbit).
- [ ] OSM hole under each visible hero; heroes **off** → boxes/holes gone.
- [ ] AR: no heroes.
- [ ] Bridges do not delete half the European shore (occupancy disk not kilometres).
- [ ] 419 MB Galata folder **not** in `public/`.

## Report back

1. Files copied vs skipped (size / git). AABB sizes.
2. Catalogue ids. Rumeli proxy?
3. Credits line.
4. Tests. GEO needed?

## Worker paste

```
Role: WORKER(DSP-SCN-20260908-03-hero-gltf-pack)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260908-03-hero-gltf-pack.md
3. src/scene/landmarks/catalogue.ts
4. src/scene/landmarks/createLandmarks.ts

Copy converted glbs from C:\Users\PC\Desktop\hero models\gltf-out\ into public/models/landmarks\ (not the 419 MB galata-tower-gltf folder). Raise MAX_LANDMARKS. Wire catalogue GPS from the DSP. Rumeli stays proxy. gpsToEnuAmsl only. Do not guess geoid. Not Phase 21 cinematic.

Implement that dispatch only.
```
