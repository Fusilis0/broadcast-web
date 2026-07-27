# assets

Owned by **SCN**. Boat glTF loading + procedural fallback.

## Boat model

| Path | Role |
| --- | --- |
| `public/models/boat.glb` | Compact race hull (forward **+Z**, up **+Y**, meters) |
| `loadBoatModel.ts` | `GLTFLoader` + template cache; `cloneBoatVisual()` for entities |
| `createProceduralBoatVisual.ts` | Multi-mesh hull if glTF missing/fails |
| `boatVisualOffset.ts` | One-time local pos/rot/scale on the visual child |

**Axis:** pose still applied on the boat **root** from `poseBus`. Mesh local forward matches object **+Z** (same as Phase 1 box boat). Shipped `boat.glb` uses **identity** `BOAT_VISUAL_LOCAL_OFFSET`; change that constant if a future asset differs (do not rotate the pose root).

**Why not Unity `YatchModel.fbx`:** sibling FBX is ~12.5 MB (over the ~2–5 MB commit budget / LFS gate). No Unity editor session for a slim export this DSP. Authored compact glb from the procedural hull instead; re-export with `node scripts/export-boat-glb.mjs` after hull edits.

**Runtime:** load failure → procedural template cached so the fleet never stays blank.

## Public API

| Symbol | Role |
| --- | --- |
| `loadBoatModelTemplate()` | Cache glTF (or procedural) template |
| `cloneBoatVisual()` | Per-entity clone (2.2 will Map these) |
| `createProceduralBoatVisual()` | Fallback / export source |
| `applyBoatVisualOffset()` | Local authoring offset |
