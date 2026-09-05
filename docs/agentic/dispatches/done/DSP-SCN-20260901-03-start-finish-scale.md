# Dispatch DSP-SCN-20260901-03-start-finish-scale

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260901-03-start-finish-scale)
- Priority: P1
- Phase: **19.10** — Start / finish size
- Related: `docs/architecture/phase19-senexus-qol.md` §19.10
- Sequencing: **file-disjoint** from 19.2 / 19.6 / 19.9 — **run in parallel** with 19.2.

## Goal

Make **start and finish** water bands **uniformly ×2** (same ratio). Not a thicker underline stroke.

Locked numbers:

- `LINE_SIGN_BAND_DEPTH_M` **12 → 24**
- `DEFAULT_LINE_SIGN_WIDTH_M` **50 → 100** (single-point default span only)
- Authored **A–B GPS span unchanged**; depth + text scale with the band (ratio vs old 12:50 graphic)
- **Same treatment** for start and finish

## Background

- Mesh is `PlaneGeometry(sign.widthM, LINE_SIGN_BAND_DEPTH_M)` + canvas texture (`lineSignMesh.ts`). Scaling the plane depth ×2 with the same texture keeps the graphic ratio if the texture layout stays proportional.
- Two-point features: `widthM` comes from GPS A–B — do **not** stretch span. Only the **across-water depth** (and default one-point width) change.
- 2D map S/F overlays in `mapChrome.ts` are a different graphic (pills). Do **not** thicken 2D strokes as a fake “fix”. Leave 2D unless a one-line shared constant is already the source of truth.

## In scope

1. Update constants in `lineSignLayout.ts`.
2. Ensure start **and** finish both use them (no finish-only special case).
3. Tests: default single-point width is 100; two-point width still matches A–B hypot; assert `LINE_SIGN_BAND_DEPTH_M === 24`.
4. One-line note in `src/scene/lineSigns/` README or `docs/ops/unity-asset-port.md` if that table lists 12 m.

## Out of scope

- Authoring inspector / height field (19.7)
- Billboard height (19.11)
- Map chrome restyle (19.2b)
- PiP, World toggle, Save logs
- Cesium / ocean clip

## Likely files

- `src/scene/lineSigns/lineSignLayout.ts`
- `src/scene/lineSigns/lineSignMesh.ts` (only if texture bar/font must stay ratio-locked after depth change)
- `src/scene/lineSigns/lineSigns.test.ts`
- `docs/ops/unity-asset-port.md` (if it cites 12 m)

## Inputs provided

- Current: depth 12 m, default width 50 m
- Texture: italic label + underline bar ~14% of canvas height — keep that ratio

## Acceptance criteria

- [ ] Both start and finish bands are twice as deep (24 m) at the same A–B span.
- [ ] One-point default span is 100 m east–west.
- [ ] Two-point authored GPS span unchanged.
- [ ] Not a thicker 2D map stroke as the product change.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Constants + whether texture canvas changed
2. Files touched
3. Tests run
4. Follow-ups (2D pills?)
5. Suggested SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260901-03-start-finish-scale).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260901-03-start-finish-scale.md
2. docs/architecture/phase19-senexus-qol.md §19.10
3. src/scene/lineSigns/lineSignLayout.ts, lineSignMesh.ts, lineSigns.test.ts

Uniform ×2 start AND finish water bands: LINE_SIGN_BAND_DEPTH_M 12→24, DEFAULT_LINE_SIGN_WIDTH_M 50→100. Do not change authored A–B GPS span. Not a thicker stroke. Stay inside lineSigns. No PiP, no inspector, no Cesium.
Report back per dispatch.
```
