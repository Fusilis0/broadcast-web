# Dispatch DSP-SCN-20260818-06-sailboat-category-colors

## Meta
- From orchestrator: BW → SCN (small additive PLT schema field in-scope — no separate PLT worker)
- Worker role: WORKER(DSP-SCN-20260818-06-sailboat-category-colors)
- Priority: P0
- Phase: Phase 16.3 — sailboat visual, category color palette, tag leader line
- Design: `docs/architecture/phase16-visual-upgrade.md` §6
- Related: user 2026-08-18 — reference images: cruising sailboat render (goal look, procedural OK), SailGP frame (nametag connected to mast top). Locks: **procedural** build; sail tintable; category gets a **preset color palette**.
- Parallel-safe with: SCN-04/05 (environment/terrain — stay out), SCN-07 (sponsors — stay out), SCN-08 (course — stay out). **You own** `src/assets/*`, `boatEntity.ts`, `boatTag.ts`, `fleetLivePanel.ts` row internals, `boatNames/*`, `fleet.boats` schema addition.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (merged tree `npm test` 640+23, `npm run build` green). glTF re-export deferred; loader stays procedural until a model with `sail`/`mastTop` exists.

## Goal

1. Boats look like **sailboats**: hull + deck + keel + mast + boom + **mainsail + jib**, built from primitives. The sail is tinted by the boat’s color.
2. Fleet **category color palette**: pick one of ~10 preset colors per boat row instead of relying on category keyword parsing. Color drives hull/sail tint, map dot, tag accent.
3. Nametag connects to the **mast top with a leader line** (SailGP mast-flag look).

## Background

- Current visual: `src/assets/createProceduralBoatVisual.ts` (blocky hull + bare mast) or `public/models/boat.glb`. Tint via `applyBoatHullTint` (`tintBoatVisual.ts`), applied from `boatEntity.setTagIdentity`.
- Colors today: `boatNames/categoryColor.ts` parses Turkish category keywords → hex; `mergeBoatName` accepts an optional explicit `color`. The explicit path exists — the palette just needs to feed it.
- Tag: `createBoatTag` — `THREE.Sprite` at fixed height 10, distance-scaled in `update()`.
- Fleet rows persist in `RaceProject.fleet.boats[]` since 15.4 (`src/projects/types.ts` / `fleetBoats.ts` / parse / build).

## In scope

1. **Procedural sailboat** (`createProceduralBoatVisual` rewrite):
   - Hull with bow taper (e.g. scaled/lathed shape), deck, keel fin, mast (~1.2× hull length tall), boom, **mainsail** (curved triangle behind mast) + **jib** (foretriangle), double-sided sail material.
   - Named nodes/materials: `hull`, `sail` (both sails share the material), `mastTop` empty/anchor at the mast head.
   - A few hundred tris; same overall footprint/scale as today so poses/camera framing don’t break; `applyBoatVisualOffset` still applies.
   - Sail tint: extend `tintBoatVisual.ts` (e.g. `applyBoatSailTint` or fold into `applyBoatHullTint`) — sails take the boat color (slightly desaturated/lighter so white text/tags still read); hull keeps existing tint behavior.
   - Optional additive `sailTextureUrl` handled if trivially cheap (texture replaces tint on the sail material); **no picker UI** this phase.
2. **Category color palette:**
   - ~10 presets (red, blue, green, orange, pink, purple, yellow, cyan, white, slate) as named constants with hex values.
   - Fleet row edit UI: color select next to category (swatch dropdown). Chosen color → `upsertBoatName({ id, name, category, color })` explicit-color path; map dots + tag + hull/sail update live (existing `setTagIdentity` re-apply path).
   - Persist: additive `color?: string` (`#rrggbb`) on `RaceProjectFleetBoat`; parse/build round-trip; old packs without it fall back to category keyword parsing exactly as today.
3. **Tag leader line:**
   - Thin line from `mastTop` anchor to the tag sprite; tag sits above the mast (raise default height relative to new mast). Line color = boat color, `transparent`, `depthWrite: false`; hidden when tag hidden (ghost/hidden modes unchanged).
4. Tests: sailboat has named `sail`/`mastTop` nodes; sail tint applies; palette → mergeBoatName color; `fleet.boats[].color` round-trip; leader line follows tag visibility.
5. Docs: `src/assets/README.md`, `src/scene/boatNames/README.md`, `src/scene/README.md`, `docs/contracts/race-project.md` (additive `color`).

## Out of scope

- glTF sailboat sourcing (user may provide later; keep the glb path working — if the glb loads, leader line attaches to its bounding-box top as fallback).
- Sail flag/texture picker UI.
- Ocean/wind/terrain (SCN-04/05), sponsors (SCN-07), rounding (SCN-08), sidebar re-homing (SCN-09 — you may edit fleet row internals, not section placement).
- Boat physics/heel animation.

## Likely files

- `src/assets/createProceduralBoatVisual.ts`, `tintBoatVisual.ts`, `loadBoatModel.ts` (+ tests)
- `src/scene/boatEntity.ts`, `boatTag.ts` (+ tests)
- `src/scene/fleetLivePanel.ts` (row color select)
- `src/scene/boatNames/*` (palette constants; merge path already supports color)
- `src/projects/types.ts`, `fleetBoats.ts`, `parseRaceProject.ts`, `buildRaceProject.ts` (+ tests)
- `src/main.ts` only if the row→upsert wiring needs the color forwarded
- Docs above

## Inputs provided

- Reference: user’s sailboat render (hull + main + jib, white sails) and SailGP frame (mast-top flag tags).
- Existing explicit-color path: `mergeBoatName({ color })`.
- 15.4 `fleet.boats` round-trip as the schema pattern to copy.

## Acceptance criteria

- [ ] Boats render as sailboats (hull/mast/boom/two sails) in 3D, procedural path and static hulls included.
- [ ] Picking a palette color on a fleet row recolors sail + hull tint + map dot + tag accent immediately; Save→Load keeps it.
- [ ] Nametag connected to mast top by a visible leader line; ghost/hidden modes still correct.
- [ ] Old packs without `color` behave exactly as today.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (mesh construction, palette, schema field)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN (+ PLT if schema) memo bullets
