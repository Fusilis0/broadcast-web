# Dispatch DSP-SCN-20260818-09-ops-layout

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260818-09-ops-layout)
- Priority: P1 — **wave 2. Wave 1 (SCN-04…08) is merged and accepted 2026-08-18** (`npm test` 640+23, `npm run build` green). Start from that HEAD.
- Phase: Phase 16.6 — ops UI re-homing (two rails)
- Design: `docs/architecture/phase16-visual-upgrade.md` §7 (BW-locked grouping)
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (`npm test` 654+23, `npm run build` green). Deviations approved: `library` + leftover `ops` stay left; backtick collapses both rails; preview fps / boot status remain in Race ops.
- Related: user 2026-08-18 — “left ops menu really crowded; categorize better; split elements to different sides of the screen by relatedness.”

## Goal

Split the single crowded left sidebar into **two rails grouped by task**: left = race setup, right = broadcast/output. Collapsible accordion sections with persisted open state. This is a **re-homing** of existing DOM modules, not a rewrite of any panel’s internals.

## Background

- Everything lives in one left rail today (`src/scene/sidebar/createSidebar.ts` + `stubHud.ts` sections + `fleetLivePanel`, `assetInspector`, calib, output/NDI, environment rows).
- Left-rail resize drag + width persistence already exist (`createSidebar.ts`) — reuse for the right rail.
- Top strip (local channel switcher + preview fps + boot status) stays.

## BW-locked grouping

| Zone | Sections |
| --- | --- |
| **Left rail — Race setup** | Project (picker/Save/Load/rename) · Fleet & Live · Assets inspector · World-authoring open button |
| **Right rail — Broadcast** | Output (mode/NDI/delay/switcher strip anchor) · Calibration · Environment (simple/realistic, sea quality, ion token, **terrain water threshold** — see §8) · Wind (source/from-deg/hold) |
| **Top strip** | unchanged |

## In scope

1. Second (right) rail container: same collapse/resize/width-persistence pattern as the left; independent widths; both can be fully collapsed to maximize the 3D view.
2. Move the Broadcast sections into it — move mount containers, do not rewrite section internals. All existing `data-ops` hooks / test selectors keep working (update selectors only where a container id must change; keep changes minimal and documented).
3. Accordion state (open/closed per section) persisted in sessionStorage; sensible defaults (Project + Fleet open on the left; Output open on the right).
4. WebGL canvas/letterboxing must stay correct with 0/1/2 rails open (studio 1920×1080 lock and CSS 1:1 rule in `createScene.resize` untouched — rails overlay or flex around the canvas the same way the single rail does today).
5. Authoring map overlay + stream map behavior unchanged.
6. Tests: rail assembly/grouping helper unit tests; persisted accordion state; existing sidebar tests updated.
7. Docs: `docs/architecture/unified-ops-sidebar.md` update (or supersede note → `phase16-visual-upgrade.md` §7), `src/scene/README.md`.
8. **Handoff from SCN-04 (approved addition):** one small numeric row in the Environment section for the terrain water-discard threshold — API already exists as `SceneHandle.setTerrainWaterDiscardYM` (default `0.5` m AMSL). Sensible range ~0–5 m, step 0.1, next to the existing terrain altitude nudge. This is the **only** new control allowed in this dispatch.

## Out of scope

- Redesigning any panel’s internal controls (Fleet rows, NDI panel, calib sliders stay as-is).
- Floating/dockable windows.
- New settings beyond accordion/rail persistence **and the §8 water-threshold row**.
- Inspector color pickers for sponsor `panelColor` / `frameColor` (SCN-07 follow-up; not this slice).
- Everything owned by SCN-04/05/06/07/08.

## Likely files

- `src/scene/sidebar/createSidebar.ts` (+ tests), possibly a new `railLayout.ts`
- `src/scene/stubHud.ts` (section mounting)
- `src/main.ts` (mount wiring)
- CSS (`src/style.css` or equivalent)
- Docs above

## Inputs provided

- BW grouping table above is locked — do not re-litigate; small pragmatic deviations (e.g. a status row that must stay near the switcher) are fine if documented in the report.
- Wave 1 is merged: fleet rows now carry a color-palette select (SCN-06), and the Environment section already has sea quality + ion token.

## Acceptance criteria

- [ ] Two rails with the locked grouping; both resizable/collapsible; state persists across reload (same session).
- [ ] No functional regressions: Save/Load, Fleet connect, NDI panel, calib, env/wind rows all work where they moved to.
- [ ] Studio canvas lock/letterbox unaffected with any rail combination.
- [ ] Environment section exposes the terrain water-discard threshold (§8) and it reaches `setTerrainWaterDiscardYM`.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (what moved where, any deviations)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
