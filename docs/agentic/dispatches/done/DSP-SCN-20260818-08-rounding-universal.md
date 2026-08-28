# Dispatch DSP-SCN-20260818-08-rounding-universal

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260818-08-rounding-universal)
- Priority: P0 (small)
- Phase: Phase 16.5 — buoy rounding arrows on by default
- Design: `docs/architecture/phase16-visual-upgrade.md` §4
- Related: user 2026-08-18 — sees no arrows in **their own saved pack**. 15.3 shipped rounding as opt-in (omit = `none`); only demo-istanbul got CW defaults. User lock: **universal** — every mark/buoy/gate end shows the ring by default; Details sets direction or Off.
- Parallel-safe with: SCN-04/05/06/07. **You own** `src/scene/features/rounding.ts`, `src/scene/course/*` glyph files, related inspector default only.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (merged tree `npm test` 640+23, `npm run build` green). Omit = CW; ring ~8–9 m white/red.

## Goal

Rounding rings appear on all marks/buoys/gate ends **without any data edits** (old packs, user’s saved packs, newly placed features). Explicit `'none'` hides; direction still per-feature CW/CCW in Assets Details. Ring readable from typical drone distance.

## Background

- `src/scene/features/rounding.ts`: `effectiveRounding(undefined) === 'none'` — that is the whole reason the user’s pack shows nothing.
- Glyph: `src/scene/course/roundingArrows.ts` (torus + two heads, 5 s/rev, CW = negative `rotation.y` from above). Wired via `buoyMarkers.ts` / `worldBuoys.ts` / `courseLayout` types.
- Inspector: `assetInspector.ts` Details dropdown Off/CW/CCW.

## In scope

1. **Default flip:** `effectiveRounding(undefined /* omitted */)` → **`'cw'`** for the applicable types (mark/buoy/gateLeft/gateRight). Explicit `'none'` still hides. Keep `parseRounding` for explicit values.
2. Inspector default selection shows CW when the field is omitted; choosing CW on an omitted field may keep it omitted (default) — only `ccw`/`none` must persist. Save/Load round-trip of all three still works.
3. **Visibility polish:** ring reads from ~150–400 m drone views — increase radius relative to the buoy and/or use high-contrast color (white/red family); slight size attenuation acceptable. Keep it subtle enough not to dominate the frame (broadcast overlay, not a target reticle).
4. Update tests that assumed omit = none; add omit = cw. Update `docs/contracts/race-project.md` note + `src/scene/README.md`.
5. Remove/keep demo-istanbul’s explicit `"rounding": "cw"` entries — now redundant; keep one `ccw` example somewhere in fixtures for regression coverage if convenient.

## Out of scope

- 2D map arrows / Unity PNG port.
- New feature types; `arrow`/`rotation` water icons.
- Boats/sponsors/environment/sidebar (other dispatches).

## Likely files

- `src/scene/features/rounding.ts` (+ test)
- `src/scene/course/roundingArrows.ts` (+ test), `buoyMarkers.ts` if sizing lives there
- `src/scene/sidebar/assetInspector.ts` (default display only)
- `public/fixtures/course/demo-istanbul.json` (optional cleanup)
- Docs above

## Inputs provided

- User confirmation: their pack, no arrows → default semantics, not a render bug.
- Existing CW yaw-sign convention (do not change).

## Acceptance criteria

- [ ] Loading the user’s saved pack (no `rounding` fields) shows spinning CW rings on all marks/buoys/gate ends.
- [ ] Details can set CCW or Off per feature; persists through Save/Load.
- [ ] Ring visibly readable at typical drone framing.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (default semantics, sizing change)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
