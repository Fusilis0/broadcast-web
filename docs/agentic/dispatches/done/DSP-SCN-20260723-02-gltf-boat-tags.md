# Dispatch DSP-SCN-20260723-02-gltf-boat-tags

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260723-02-gltf-boat-tags)
- Priority: P0
- Phase: Phase 2.1 — glTF boat + tags
- Related handoffs: `HO-SCN-TEL-20260723-01` (FYI / plan for 2.2 multi-fleet — **do not implement 2.2 here**)
- BW ask: first Phase 2 DSP — glTF **(or better)** boat + tags; plan 2.2 with TEL; **no chroma**
- **Status: DONE** (worker report accepted by SCN 2026-07-24)

## Goal

Replace the Phase 1 box-boat with a race-readable boat visual (prefer **glTF**, else a clearly better procedural hull) and add a **boat tag** (billboard label: id + stub name). Still **one** boat (`21`) driven by existing `poseBus`. No multi-fleet spawn, no WS/geo changes, no chroma/output modes.

## Background

- Roadmap: `docs/roadmap/phases-roadmap.md` Phase 2.1
- Architecture: `src/scene/` + `src/assets/` (SCN); pipeline still `poseBus` → draw
- Today: `createBoatEntity()` = elongated boxes (`src/scene/boatEntity.ts`); `createScene` hard-wires a single boat id
- Unity reference (read-only): `../broadcast/Assets/Prefabs/Boat.prefab`, `BoatTag.prefab`; behavior notes in `../broadcast/docs/project-analysis.md` (BoatTagRotation billboard + distance scale; BoatNameAssigner → JSON names in **2.7**, not this DSP)
- Name/colour JSON is roadmap **2.7** — tags may use stub text `Boat {id}` / id only
- Full boat channel config / multi-fleet is **2.2** (TEL+SCN) — see handoff; out of scope here
- OUT chroma is Phase 3 — keep dark preview clear

## In scope

### 1. Boat visual (glTF or better)

1. **Preferred:** ship a compact `.glb` / `.gltf` under e.g. `public/models/boat.glb` (or `public/assets/…`) and load via Three `GLTFLoader`
   - Source options (pick first that works without blowing repo size):
     A. Export / convert from Unity `Boat` prefab (read-only sibling) to glTF
     B. A small open/licensed race-boat glTF suitable for broadcast scale
     C. If A/B blocked (size, license, export tooling): build an **improved procedural** hull (multi-mesh, clear bow/stern, distinct from the current 2-box stub) and document why glTF was deferred in report-back
2. **Loader module** under `src/assets/` (e.g. `loadBoatModel.ts`) — cache the loaded template; clone per entity
3. **Scale / orientation**
   - World pose still from `poseBus` on the boat **root** (ENU + existing `poseRotationToQuaternion`)
   - Mesh local forward should match object **+Z** (same as current box boat / scene README)
   - Apply a one-time local scale/rotation offset on the visual child if the asset’s authoring axes differ — document the offset in `src/assets/README.md` or `src/scene/README.md`
4. **Fallback:** if load fails at runtime, fall back to procedural hull so `npm run dev` never shows an empty fleet
5. **Lighting:** add minimal scene lights (e.g. ambient + directional) so non-`MeshBasic` glTF materials read; do not change clear color to chroma green

### 2. Boat tag

6. **Billboard label** attached to the boat (Unity `BoatTag` spirit):
   - Show at least boat `id` (e.g. `21`); stub display name OK (`Boat 21`)
   - Face the active drone camera each frame (or use CSS2D / Sprite billboard)
   - Optional: mild distance-based scale so tags stay readable (Unity `BoatTagRotation` idea) — keep simple
   - Optional: placeholder speed text only if pose/TEL already exposes it cheaply — **not required** (speed on tag can wait)
7. Tag must not require name/colour JSON (2.7) or CAL/OUT work

### 3. Wire into existing scene

8. Update `createBoatEntity` (or successor) to async-create or accept a preloaded visual; `startScene` / `main` boot must still start cleanly (await load before first frames or show fallback until ready)
9. Keep **single** boat id default `21` — no `Map` of fleet entities yet (that is 2.2)
10. Update `src/scene/README.md` + `src/assets/README.md`

## Out of scope

- Multi-boat registry / channels `22–52` (roadmap **2.2**)
- TEL mock/replay/live multi-channel changes (TEL — handoff only)
- Name/colour JSON catalogue (roadmap **2.7**)
- Course, buoys, sponsors, flags (2.3–2.6)
- Multi POV (2.4)
- Chroma / WebRTC / clear modes (OUT)
- `gpsToEnu`, pose pipeline, WS protocol
- Git LFS policy debates — if asset ≫ ~2–5 MB, stop and report; do not silently commit huge binaries (escalate BW/PLT)
- Modifying Unity project files (export copy-out only)
- Committing unless the human explicitly asks

## Likely files

- `public/models/boat.glb` (or `.gltf` + bins) — if shipping an asset
- `src/assets/loadBoatModel.ts` (name flexible), `src/assets/README.md`
- `src/scene/boatEntity.ts`, possibly `src/scene/boatTag.ts`
- `src/scene/createScene.ts`, `src/scene/index.ts`, `src/scene/README.md`
- `src/main.ts` — only if boot must `await` asset load
- Optional: small Vitest for scale/orientation helper (not required)

## Inputs provided

- `poseBus` / `PoseEvent` contract unchanged
- Default boat id `21`; drone cam unchanged
- Unity refs (read-only): `Assets/Prefabs/Boat.prefab`, `BoatTag.prefab`; analysis § boats/map
- Axis contract: ENU root; mesh forward +Z

## Acceptance criteria

- [x] On-air boat is clearly better than the Phase 1 two-box stub (glTF **or** documented procedural upgrade)
- [x] If glTF shipped: loads from `public/` (or agreed path); clone/instance used by the boat entity
- [x] Runtime load failure → procedural fallback (no blank boat forever)
- [x] Boat tag visible (id ± stub name), billboarded toward the drone camera
- [x] Still one boat (`21`); pose apply via existing `poseBus` path
- [x] Dark preview clear unchanged; no chroma
- [x] `npm run build` succeeds; `npm test` green (or only additive) — worker: 56/56 + tsc/vite build
- [x] `npm run dev`: boat mesh + tag readable while mock runs
- [x] Unity repo not modified; no secrets; no surprise multi‑MB binary without report (Unity FBX skipped; compact glb ~18.5 KB)

## Worker report (summary)

Authored compact `public/models/boat.glb` (~18.5 KB) from procedural hull; Unity `YatchModel.fbx` ~12.5 MB deferred (LFS gate, no editor). Procedural multi-mesh fallback; billboard tag `Boat {id}`; lights on dark preview; single boat `21` via `poseBus`. Ready for 2.2 registry cloning this template.

## Files delivered

- `public/models/boat.glb`
- `scripts/export-boat-glb.mjs`
- `src/assets/{loadBoatModel,createProceduralBoatVisual,boatVisualOffset}.ts` + README
- `src/scene/{boatEntity,boatTag,createScene,boatEntity.test,index,README}`

## Report back

When done, reply with:
1. Summary (glTF vs procedural choice + why)
2. Files touched + approximate asset size if any
3. Tests / `npm run build` / `npm run dev` notes
4. Follow-ups / blockers (esp. LFS or export)
5. Suggested memo bullets for SCN
