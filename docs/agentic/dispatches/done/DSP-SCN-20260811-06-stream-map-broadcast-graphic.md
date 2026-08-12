# Dispatch DSP-SCN-20260811-06-stream-map-broadcast-graphic

## Meta
- **Status: DONE — BW accepted 2026-08-11** (verified via code review of `mapChrome.ts`
  variant-aware metrics/draw helpers + `streamMap.ts`; `npm test` 388+23, `npm run build` green)
- From orchestrator: BW → SCN (Phase 11 follow-up #2 — two distinct 2D maps)
- Worker role: WORKER(DSP-SCN-20260811-06-stream-map-broadcast-graphic)
- Priority: **P1** (visual polish, not blocking core authoring workflow)
- Phase: Phase 11 follow-up
- Related: `DSP-SCN-20260804-04-stream-2d-map.md` (done, original PiP), `DSP-SCN-20260811-05-authoring-workspace-fixes.md` (sibling — **run after or carefully in parallel**, see Sequencing)

## Goal

Today there are effectively **two jobs** for the 2D map but only **one visual style**: the ops/
authoring map (`createMap2d` used inside the World Authoring workspace) and the on-air "stream"
map (`createStreamMap2d` in `src/scene/streamMap.ts`) share the exact same plain/utilitarian
draw path — same grid, same small icons, same bare `"Race map · N↑"` title. Give the **stream**
map its own bigger, more polished, broadcast-graphic identity intended for viewers, while leaving
the ops/authoring map exactly as-is (utilitarian, dense, for the operator building the course).

## Background

- `src/scene/streamMap.ts`: `createStreamMap2d(options)` = `createMap2d({ ...resolveStreamMapOptions(options) })`.
  `resolveStreamMapOptions` defaults: `sizePx: STREAM_MAP_SIZE_PX = 400`, `title: 'Race map · N↑'`,
  `visible: false`, `variant: 'stream'`.
- `src/scene/map2d.ts` + `src/scene/mapChrome.ts` already draw category-tinted sail icons, S/F
  pills, gate lines (Phase 8.1/8.7) — this drawing path is shared by both the ops map and the
  stream map today; `variant` currently does not change the visual output meaningfully.
- Ops sidebar already has a **"stream map"** visibility checkbox (Ops section) and the NDI sidebar
  section has a disabled/stubbed **"2D stream-map NDI source"** checkbox reserved for a future
  multi-sender NDI bridge (`DSP-OUT-20260811-01` follow-up) — that NDI wiring is out of scope here;
  this dispatch is DOM/visual only, same as the original Phase 8.1 PiP.

## In scope

1. **Bigger default size.** Increase `STREAM_MAP_SIZE_PX` to a size that reads well on-air (worker's
   call, propose ~480–560px) while still fitting comfortably as a corner/PiP element over the 3D
   scene at typical viewport sizes — confirm no overflow/clipping at common resolutions.
2. **Distinct "broadcast" visual treatment for `variant: 'stream'` only** — additive to
   `mapChrome.ts`'s drawing (keep the ops variant pixel-for-pixel unchanged). Suggested elements
   (worker may adjust for cost/benefit, but the intent is "give viewers something they enjoy
   looking at", not just a bigger version of the ops debug map):
   - A styled frame/card background (subtle border/vignette/gradient instead of the flat ops panel look).
   - A cleaner title/branding strip — race name if available from the loaded project, otherwise
     keep a tasteful default.
   - Bigger, more legible boat/drone markers + labels for at-a-glance viewer reading (the ops map
     favors density; the stream map should favor clarity at a glance).
   - A nicer compass/heading indicator (upgrade over the current plain "N↑" text/arrow) — e.g. a
     small ring or styled glyph.
   - Reuse existing sponsor/S-F/gate chrome if it's already legible at the new size; only invest in
     new asset work if trivial (no new asset pipeline work — out of scope).
3. Keep it **DOM-only** (CSS overlay canvas 2D, same as today) — do not attempt NDI burn-in; the
   "2D stream-map NDI source" checkbox stays disabled/stubbed as-is.
4. Update the Ops sidebar "stream map" toggle hint/label only if the on-screen behavior changed
   enough to warrant it (e.g. new default size).
5. Docs: `src/scene/README.md` (or wherever the stream map is documented), `streamMap.ts` module
   doc-comment (currently says "Phase 8.1 + 8.7 chrome" only — note the broadcast-graphic pass).

## Out of scope

- NDI second source / multi-sender bridge (`STREAM_MAP_NDI_BRIDGE_SUPPORTED`) — separate OUT follow-up.
- Any change to the ops/authoring map's visual style — it must look identical before/after this
  dispatch (regression check).
- New telemetry/data sources — use only data already available (boats/drones/features/course/project name).
- New asset pipeline / uploaded graphics work.
- Everything in `DSP-SCN-20260811-05-authoring-workspace-fixes.md` (resize, Close bug, Enter/Delete
  editing) — that dispatch owns the authoring map and editor; this one owns only the stream map.

## Likely files

- `src/scene/streamMap.ts` (+ test)
- `src/scene/mapChrome.ts` (+ test) — variant-aware draw additions
- `src/scene/map2d.ts` — only if a variant-aware hook is needed to call the new chrome
- `src/style.css` — stream-map-specific frame/card styling
- `src/main.ts` — only if size/wiring needs a touch
- Docs as noted above

## Sequencing (read before starting)

This is a **sibling** of `DSP-SCN-20260811-05-authoring-workspace-fixes`, same owner (SCN), with
light file overlap risk in `map2d.ts` / `style.css`. **Prefer running -05 first and landing it**,
then start this one, to avoid merge conflicts. If both must run in parallel, coordinate scope
tightly: -05 must not touch `streamMap.ts`; this dispatch must not touch `editorPanel.ts`,
`createSidebar.ts`, or `worldAuthoringWorkspace.ts`, and should keep `map2d.ts`/`style.css` edits
additive and far from -05's resize-handle code.

## Acceptance criteria

- [x] Toggling "stream map" in Ops shows a map that is visibly bigger and has a distinct, more
      polished look than the ops/authoring map (include a screenshot or clear before/after
      description in the report)
- [x] Ops/authoring map visual style is unchanged (regression check — screenshot or explicit
      confirmation)
- [x] Boats/drones/course/features still render correctly and update live on the stream variant
- [x] `npm test` + `npm run build` green
- [x] Report includes a screenshot or clear before/after description

## Worker completion note (2026-08-11)

**Before:** stream PiP = 400px, same flat `#0e141c` panel + monospace "Race map · N↑" as a slightly
larger ops map; boat icons barely larger than ops.
**After:** stream PiP = **520px** framed card (gradient border/shadow, uppercase branding strip),
race-name title via `setTitle`, water vignette + compass ring, larger sail/drone icons + label
pills. Ops metrics locked (`boatLen: 9`, `labelH: 12`, …) — ops redraw path unchanged.

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for SCN

## Worker paste block

```
You are WORKER(DSP-SCN-20260811-06-stream-map-broadcast-graphic).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260811-06-stream-map-broadcast-graphic.md
2. src/scene/streamMap.ts
3. src/scene/mapChrome.ts
4. src/scene/map2d.ts

Give the viewer-facing stream map (createStreamMap2d) its own bigger, more polished broadcast
look, distinct from the ops/authoring map, which must stay pixel-identical. DOM-only, no NDI
change. Do not touch editorPanel.ts / createSidebar.ts / worldAuthoringWorkspace.ts (sibling
dispatch -05 owns those). Report back per dispatch.
```
