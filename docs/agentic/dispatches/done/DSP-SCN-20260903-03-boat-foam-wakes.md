# Dispatch DSP-SCN-20260903-03-boat-foam-wakes

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260903-03-boat-foam-wakes)
- Priority: P1
- Phase: **19.13** — boat foam wakes
- Sequencing: **parallel OK** with 19.7 (stay out of `editorPanel` / `assetInspector` / authoring overlay). Not 19.15 sea-over-assets (same water plane — 19.15 after this).
- Worker result: **code done 2026-09-03** — one additive triangle strip per hull (`y = 0.05`, 8–12 m, ~2.5 s tail fade). Hidden = no wake; ghost fainter. Not Gerstner. Suite **1144 + 26**. `tsc` of this DSP is clean; full `npm run build` currently blocked by parallel 19.7 `authoringInspector.ts` (wrong `../` imports + implicit `any`) — not touched.

## Goal

Each **moving** boat gets a short **foam ribbon / decal** on the water (`y ≈ 0.05`), ~**8–12 m** long, opacity fade toward the tail over ~**2–3 s**. Not Gerstner displacement, not a physics wake. Cheap (one strip or few quads). **3D + AR** (same scene). Skip or hide when hull is `hidden`.

## Background

Design: `docs/architecture/phase19-senexus-qol.md` §19.13. No wake module in `src/scene/` today. Ocean is Gerstner clipmap — **do not** couple the wake to Gerstner verts. Stay AR-safe (no extra `readPixels` / full-res FBO). Do not raise `STUDIO_TICK_FPS`. Ghost boats: faint wake OK; hidden (hull off): **no** wake.

## In scope

1. Per-boat strip/decal in hull travel direction; length 8–12 m; fade 2–3 s along the tail.
2. Tick from existing boat pose (live or static last pose). Static hull with zero speed → no/idle wake.
3. `hidden` → no wake. Ghost may keep a weaker wake.
4. Tests for length/fade/skip-hidden. Scene README one-liner.
5. `npm test` + `npm run build`.

## Out of scope

- 19.7 inspector, 19.15 sea clip, 19.17 remount, Cesium vendor, NDI pumps
- Gerstner amplitude / clipmap rewrite
- 2D map wake traces

## Likely files

- New small module under `src/scene/` (e.g. `boatWake.ts`) + test
- `src/scene/boatEntity.ts` or `createScene.ts` tick hook only as needed
- `src/scene/README.md`

## Acceptance criteria

- [x] Moving boats in 3D/AR show a short fading foam tail (~8–12 m). *(worker tests; human Pass still required)*
- [x] Hidden hulls have no wake.
- [x] Not a Gerstner mesh deform. No extra full-frame GPU pass.
- [x] `npm test` **1144 + 26** green. `npm run build` blocked by parallel 19.7 `src/scene/authoringInspector.ts` (out of scope).

## Report back

1. Approach (quads vs strip)
2. Files / tests
3. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260903-03-boat-foam-wakes).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260903-03-boat-foam-wakes.md
2. docs/architecture/phase19-senexus-qol.md §19.13
3. src/scene/boatEntity.ts, createScene.ts tick (do not raise STUDIO_TICK_FPS)

Per moving boat: short foam ribbon on water y≈0.05, 8–12 m, fade 2–3 s. Not Gerstner. 3D+AR. No wake if hidden. No inspector, no 19.15 sea clip, no Cesium vendor, no NDI pumps.
Report back per dispatch.
```
