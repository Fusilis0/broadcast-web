# assets

Owned by **SCN**. Boat glTF loading + procedural sailboat fallback.

## Boat model

| Path | Role |
| --- | --- |
| `public/models/boat.glb` | Optional sailboat glTF (forward **+Z**, up **+Y**, metres). Must expose `sail` and/or `mastTop` or the loader keeps the procedural mesh. |
| `loadBoatModel.ts` | `GLTFLoader` + template cache; `cloneBoatVisual()` for entities |
| `createProceduralBoatVisual.ts` | Hull + deck + keel + mast + boom + mainsail + jib (primitives) |
| `tintBoatVisual.ts` | Catalogue colour → hull materials + lighter sail fabric |
| `boatVisualOffset.ts` | One-time local pos/rot/scale on the visual child |

## Universal asset library (Phase 11.3)

Cross-project images/models under `public/assets/library/` — upload/browse via
[`library/`](./library/README.md) (`listLibraryAssets`, `uploadLibraryAsset`,
`resolveLibraryAssetUrl`, `startLibraryPanel`). SCN pickers consume the URL helper;
do not hard-code library paths.

**Axis:** pose still applied on the boat **root** from `poseBus`. Mesh local forward matches object **+Z** (same as Phase 1 box boat). Shipped `boat.glb` uses **identity** `BOAT_VISUAL_LOCAL_OFFSET`; change that constant if a future asset differs (do not rotate the pose root).

**Why not Unity `YatchModel.fbx`:** sibling FBX is ~12.5 MB (over the ~2–5 MB commit budget / LFS gate). Procedural sailboat is the Phase 16.3 visual; a future glTF can replace it if it names `sail` / `mastTop`. Re-export with `node scripts/export-boat-glb.mjs` after hull edits.

**Runtime:** load failure, or a glTF without `sail`/`mastTop`, → procedural template cached so the fleet never stays blank / motor-hull.

**Category tint (Phase 8.3 + 16.3):** `applyBoatHullTint(visual, '#rrggbb')` from the boat-names catalogue / fleet palette. Sails use `applyBoatSailTint` (folded into hull tint): lighter, desaturated fabric so tags still read. Optional `applyBoatSailTexture(visual, url)` replaces sail tint with an albedo map (no picker UI this phase).

| Visual | Strategy |
| --- | --- |
| Procedural | Hull materials marked `userData.categoryTint`. Sail materials marked `userData.sailTint` (mainsail + jib share one material). Deck / coachroof / mast stay neutral. Named nodes: `hull`, `sail`, `jib`, `mastTop`. |
| glTF | Name-mark `hull` / `sail` / `jib` after load. No names → all MeshStandard/Physical except sails: `material.color` = category CSS + `emissive`. Leader line uses `mastTop` or bounding-box top. |

Live Fleet / `setTagIdentity` re-applies tint after glTF swap-in.

## Public API

| Symbol | Role |
| --- | --- |
| `loadBoatModelTemplate()` | Cache glTF (or procedural) template |
| `cloneBoatVisual()` | Per-entity clone (2.2 will Map these) |
| `createProceduralBoatVisual()` | Fallback / export source |
| `applyBoatHullTint()` | Category colour → hull + sail materials |
| `applyBoatSailTint()` | Lighter fabric tint only |
| `applyBoatSailTexture()` | Optional sail albedo URL |
| `parseCssHexToThreeColor()` | `#rrggbb` → `THREE.Color` |
| `applyBoatVisualOffset()` | Local authoring offset |
