# Dispatch DSP-SCN-20260907-02-hero-gltf

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260907-02-hero-gltf)
- Priority: **P1** (after 01)
- Phase: **20.1b** — hero historic glTF + OSM occupancy clip
- Related: `docs/agentic/handoffs/HO-BW-SCN-20260907-01.md`. Design: `docs/architecture/3d-environment-buildings.md`. GEO brief (only if blocked): `docs/agentic/briefs/phase20/GEO_PHASE20.md`.
- **Do not start this chat until `DSP-SCN-20260907-05-road-overlay` has Human Pass** — **Pass 2026-09-07** (keep road + aerial; decide later). Occupancy API exists from 01.
- Worker result: **code done 2026-09-07**. Three **named proxies** (Maiden’s Tower, Rumeli Hisarı, Galata); no CC glTF. Occupancy via `gpsToEnuAmsl` XZ + catalogue radius → `setOccupancyHoles`. Ops **heroes** default on. `altMsl = 0`. Landmarks tests **13/13**. SCN **code-accept**. **Do not Pass until operator smoke (boxes at GPS, OSM punched, AR clean).** Residual bury/float → GEO, not an SCN HAE tweak.
- Hold ocean rewrite. No CesiumJS. No Google Photorealistic. No IBB. No MapTiler engine. No NDI/SRT. No `STUDIO_TICK_FPS`. No commercial video. Do not guess geoid math.

## Goal

Load a **short** CC-licensed (or clearly licensed) historic landmark pack — **2 or 3** is enough — at GEO ENU from lat/lon/alt MSL, and **clip OSM Buildings** under each hero so two mosques do not z-fight. Named icons should read as themselves from a Bosphorus drone, not as OSM boxes.

## Background

01 mounts ion **96188** and exposes `setOccupancyHoles({ x, z, radiusM }[])` in scene ENU. This DSP **owns** `src/scene/landmarks/` and **calls** that API. Do not reimplement the tileset.

Placement contract (existing): `gpsToEnuAmsl(lat, lon, altMsl)` after `applyConfigOrigin` + EGM96. Same as course/sponsors. **Do not** invent a second geoid. Residual bury/float after that → **stop** and tell the human to open GEO (`GEO_PHASE20.md`); do not tweak HAE by eye in SCN.

Heroes are **opaque/3D only** — same `setEnvironmentOpaqueClearSafe` gate as buildings. Never on AR/chroma.

## In scope

1. **Catalogue** (JSON or TS const) with id, display name, `lat`, `lon`, `altMsl`, yaw deg (optional), glTF URL, occupancy `radiusM`, licence string. First slice, in this order if files exist:
   1. Maiden’s Tower (Kız Kulesi)
   2. Rumeli Hisarı
   3. Galata Tower (optional third)
   Historic Peninsula (Hagia Sophia / Sultan Ahmed / Topkapı) may replace a missing CC file — still cap at **3**.
2. **Assets:** CC0 / CC-BY / CC-BY-SA glTF (+ textures) under `public/models/landmarks/` with a `LICENSE.md` naming author, licence, URL. Keep each mesh small (prefer **&lt; 2 MB** uncompressed per landmark). **Do not** Git-LFS without BW/PLT. If no honest CC file fits:
   - Ship **named proxy boxes** (distinct colour per id) at the GPS so occupancy clip can be smoked.
   - Report which proxies vs real glTF. Do not scrape paid Sketchfab or unlicensed dumps.
3. **Mount** `src/scene/landmarks/`:
   - `GLTFLoader` (same family as boats). Scale to roughly real-world metres; document the authored unit assumption (1 unit = 1 m preferred).
   - Position from `gpsToEnuAmsl`. Re-layout on `GeoOrigin.onChanged`.
   - Same opaque gate as buildings. Dispose on scene dispose / token-off not required (heroes are local files).
   - After layout, call buildings `setOccupancyHoles` with one disk per **visible** hero (XZ from ENU, radius from catalogue). Empty catalogue → `[]`.
4. **Ops (minimal):** Environment **heroes** checkbox, default **ON**. Off → hide meshes and clear occupancy holes (OSM boxes return). No per-landmark inspector in this DSP.
5. **Tests:** ENU placement uses `gpsToEnuAmsl` (mock GEO); occupancy disks match catalogue XZ; opaque-unsafe hides heroes; proxy or glTF load path does not throw on missing file (warn + skip that id). `npm test` + `npm run build`.
6. **Docs:** `src/scene/landmarks/README.md` + one-liner in `src/scene/README.md` (licence + which three).

## Out of scope

- OSM Buildings mount / ion plugins (01)
- Geodesy formulas, new `amslToHae` (GEO)
- More than 3 landmarks, facade shaders, IBB, Google tiles
- Rewriting Gerstner / terrain watermask
- NDI, SRT, commercial video, library re-seed, `STUDIO_TICK_FPS`
- Burning credits into AR

## Likely files

- New: `src/scene/landmarks/*` (+ tests), `public/models/landmarks/*` + `LICENSE.md`
- Edit: `src/scene/createScene.ts` (mount, opaque gate, call `setOccupancyHoles`)
- Edit: `src/scene/stubHud.ts` (heroes checkbox)
- Edit: `src/scene/README.md`
- Do **not** rewrite `src/scene/buildings/` except calling the public occupancy setter

## Inputs provided

- 01 occupancy API (ENU metres, not a second geoid).
- Known public GPS (verify before hard-coding; values are starting points, not a survey):
  - Maiden’s Tower ≈ 41.0211, 29.0041
  - Rumeli Hisarı ≈ 41.0848, 29.0567
  - Galata Tower ≈ 41.0256, 28.9741
- `altMsl`: ground / rock top in **metres AMSL**. If unknown, **0** and report it — GEO owns a later nudge if they bury.

## Acceptance criteria

- [ ] Local **3D**, buildings on, heroes on: 2–3 named landmarks sit on the Bosphorus / Golden Horn and are **not** double-drawn as OSM boxes (hole works).
- [ ] Heroes checkbox off: glTF gone, OSM massing fills the hole.
- [ ] Local **AR**: no heroes.
- [ ] Placement goes through `gpsToEnuAmsl`. If they float metres off terrain, worker **stops** and asks for GEO — does not invent HAE.
- [ ] Licence file present for any committed glTF. Proxies documented if used.
- [ ] `npm test` + `npm run build` green.

## Report back

When done, reply with:

1. Which landmarks shipped (glTF vs proxy) and licences.
2. How occupancy disks are computed and pushed to buildings.
3. Whether ENU/altitude looked right in 3D, or GEO is needed.
4. Files touched; suite counts; `npm run build`.
5. Suggested SCN memo bullets.

## Human smoke (after code-accept)

Same pack as 01. Local **3D**, buildings **on**, heroes **on**. Frame Maiden’s Tower and/or Rumeli Hisarı from the water. Expect a **distinct** mesh (or labelled proxy), not two overlapping boxes. Uncheck heroes: OSM box returns. Local **AR**: neither.

**Good:** named icon reads, OSM punched out, AR clean.  
**Fail:** two mosques stacked; hero under the sea / in the sky by many metres (→ GEO); AR shows the mesh.

## Worker paste

```
Role: WORKER(DSP-SCN-20260907-02-hero-gltf)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260907-02-hero-gltf.md
3. docs/architecture/3d-environment-buildings.md
4. docs/agentic/briefs/phase20/GEO_PHASE20.md (do not implement GEO; hand off if ENU is wrong)
5. src/scene/buildings/ (occupancy API from 01 — call it, do not rewrite the tileset)

Implement that dispatch only. No CesiumJS. No Google Photorealistic. No IBB. No ocean rewrite. No NDI/SRT. If landmarks float or bury after gpsToEnuAmsl, stop and report GEO — do not guess the geoid.
```
