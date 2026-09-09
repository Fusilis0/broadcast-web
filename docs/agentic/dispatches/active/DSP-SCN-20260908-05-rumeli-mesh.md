# Dispatch DSP-SCN-20260908-05-rumeli-mesh

## Meta
- From orchestrator: SCN (Phase **20** heroes — not cinematic Phase 21)
- Worker role: WORKER(DSP-SCN-20260908-05-rumeli-mesh)
- Priority: **P1**
- Worker result: **code done 2026-09-08**. OpenSKP `hisar2.skp` → `public/models/landmarks/rumeli-hisari.glb` (6 images, ~1.2 MB). Catalogue `kind: 'gltf'`. Floor strip also drops `Google_Earth_Snapshot`. Proxy box gone. **Human Pass pending.**
- No CesiumJS, Google Photorealistic, IBB, ocean rewrite, NDI, SRT, `STUDIO_TICK_FPS`.

## Goal

Replace the Rumeli Hisarı **named proxy box** with a real local glTF, same mount path as the other 12 heroes.

## Background

Operator Human Pass: Rumeli is “just a box”. Catalogue id `rumeli-hisari` is `kind: 'proxy'`, `gltfUrl: null` — there is **no mesh** in `public/models/landmarks/` or on Desktop `hero models/` (no `.skp` / `.glb` for Rumeli). Worker must not invent geometry.

Scale slider + Google-Earth floor strip already landed in the Phase 20 hero chat (not this DSP).

## In scope

1. **Asset** — operator drops one of:
   - `C:\Users\PC\Desktop\hero models\*.skp` (Rumeli) → OpenSKP `glb.export(..., textures=True)` → `public/models/landmarks/rumeli-hisari.glb`
   - or a ready `.glb` copied to that path
2. **Catalogue** — `rumeli-hisari`: `kind: 'gltf'`, `gltfUrl: '/models/landmarks/rumeli-hisari.glb'`, keep GPS / occupancy 170 m / `altMsl: 0`. Licence line: operator-provided (or CC if the file says so). `LICENSE.md` one row.
3. **Mount** — existing `createLandmarks` path (unit scale, floor strip, authoring offsets). No second geoid.
4. **Tests** — Rumeli is glTF with a local url; proxy-only chip gone; landmarks tests still pass. Do not copy 419 MB Galata.

## Out of scope

- Phase 21 cinematic
- GEO / `altMsl` survey
- Buying Sketchfab / IBB
- Changing other landmark files
- If **no file appears** on Desktop or `public/models/landmarks/rumeli-hisari.glb`: **stop**, keep the proxy, report blocked. Do not procedurally “look like a fortress”.

## Likely files

- `public/models/landmarks/rumeli-hisari.glb` (new)
- `public/models/landmarks/LICENSE.md`
- `src/scene/landmarks/catalogue.ts`
- `src/scene/landmarks/landmarks.test.ts`
- `src/scene/landmarks/README.md`

## Inputs provided

- Catalogue GPS: 41.0848, 29.0567, `altMsl` 0, occupancy 170 m
- Operator source folder: `C:\Users\PC\Desktop\hero models`
- Dest: `public/models/landmarks/rumeli-hisari.glb`

## Acceptance criteria

- [x] Local **3D**, heroes on: Rumeli is a **building mesh**, not a labelled box. *(code; Human Pass pending)*
- [x] AR still hides heroes. OSM hole still ~170 m.
- [x] Licence credited in `LICENSE.md`. No 419 MB Galata copy.

## Worker paste

```
Role: WORKER(DSP-SCN-20260908-05-rumeli-mesh)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260908-05-rumeli-mesh.md
3. src/scene/landmarks/catalogue.ts
4. public/models/landmarks/LICENSE.md

Mount operator Rumeli glTF at rumeli-hisari. If no file exists, stop and keep the proxy — do not invent a fortress.

Implement that dispatch only. Not Phase 21. No geoid guess.
```
