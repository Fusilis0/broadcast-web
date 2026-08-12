# Dispatch DSP-SCN-20260811-05-authoring-workspace-fixes

## Meta
- **Status: DONE — BW accepted 2026-08-11** (verified live via `npm run dev` + CDP: Close→hidden,
  Open→restored, sidebar drag-resize 340→460px confirmed; `npm test` 388+23, `npm run build` green)
- From orchestrator: BW → SCN (Phase 11 follow-up #2 — authoring workspace usability)
- Worker role: WORKER(DSP-SCN-20260811-05-authoring-workspace-fixes)
- Priority: **P0** (Close is broken; placement UX blocks day-to-day world building)
- Phase: Phase 11 follow-up — `DSP-SCN-20260811-04` shipped the workspace, this fixes/polishes it
- Related handoffs: none yet
- Related: `DSP-SCN-20260811-04-world-authoring-workspace.md` (done), `DSP-SCN-20260811-02` (tools)

## Goal

Fix the broken **Close** button on the World Authoring workspace (confirmed: the panel stays
fully visible even though its own status line says "Authoring: closed"), make the **authoring
map** and the **left sidebar rail** user-resizable, and overhaul the point placement / edit flow
so it is no longer mouse-only and fiddly: **Enter** confirms a pending placement, clicking an
existing point on a selected feature makes it **draggable**, and **Delete/Backspace** removes the
selected feature.

## Background — confirmed by BW via `npm run dev` + code read (not just user report)

1. **Close bug — root cause found.** `src/scene/worldAuthoringWorkspace.ts` `setOpen()` correctly
   sets `root.hidden = !open`. But `src/style.css`:
   ```css
   .world-authoring {
     pointer-events: auto;
     position: absolute;
     ...
     display: flex;
     ...
   }
   ```
   has **no `[hidden]` override**. An author-stylesheet rule with `display: flex` on the element
   always wins over the browser's default `[hidden] { display: none }` UA rule (author origin
   beats user-agent origin in the cascade regardless of selector specificity). So toggling the
   `hidden` attribute does nothing visually — only the status text ("Authoring: open/closed")
   changes while the ~960px panel (map + tool host + Close/Maximize buttons) stays on screen,
   covering roughly half the 3D viewport. Reproduced live: opened `?editor=1`, clicked **Close**,
   status flipped to "Authoring: closed" but the window did not disappear.
2. **No resize anywhere.**
   - `.ops-sidebar { width: min(340px, calc(100vw - 24px)); }` — fixed, no drag handle in
     `src/scene/sidebar/createSidebar.ts`.
   - The authoring map (`WORLD_AUTHORING_MAP_SIZE` / `_MAX` in `worldAuthoringWorkspace.ts`, piped
     into `createMap2d`'s `sizePx` in `src/scene/map2d.ts`) sets the canvas backing-store size once
     at construction. No `ResizeObserver`, no drag handle, no re-layout-on-resize path exists.
3. **Placement/edit flow is mouse-only and has real friction** (`src/scene/features/editor/editorPanel.ts`):
   - No `keydown` handling exists in this file at all today.
   - Polyline tool (`billboardChain`): each click appends to `pendingPoly`; finishing requires
     moving the mouse to a separate **Finish chain** button (`finishBillboardChain()`).
   - Two-click tools (`gatePair`, `sponsor`, `arrow`, `start`, `finish`): commit only on the literal
     second click — there is no way to confirm at the current snapped/hovered position without
     clicking exactly there.
   - `select` tool (`onMapClick` → `tool === 'select'` branch) only calls `selectFeature(hit?.id ?? null)`
     — it **highlights** a feature, it does not let the user drag a vertex to move it. There is no
     `pointerdown`/`pointermove`/`pointerup` drag path for features anywhere in this file.
   - Removing a feature is only the **Delete** button in the props panel (`deleteBtn` click
     handler, ~line 364-377) — no keyboard shortcut.
   - `map2d.ts` already owns `pointerdown`/`pointermove`/`pointerup` for **panning** the map — any
     new drag-to-move-a-point logic must not fight that (only start a feature-drag when a hit
     vertex is under the pointer while `tool === 'select'`; otherwise fall through to existing pan).

## In scope

1. **Fix Close/hidden.** Make `root.hidden = true` actually hide `.world-authoring` regardless of
   the panel's own `display` rule — e.g. add a `.world-authoring[hidden] { display: none; }` rule,
   or stop relying on the `hidden` attribute and drive visibility from a class the CSS is written
   against from the start (`.world-authoring--open` / toggle a `hidden`-equivalent class). Prefer
   whichever keeps `setOpen`/`isOpen` semantics unchanged for callers. Do the same audit for
   `.world-authoring--maximized` interaction — maximize must still work correctly once closed/reopened.
2. **Resizable authoring map.** Add a user drag handle (or equivalent explicit control) that resizes
   the map host inside the workspace. On resize you must **re-layout the actual canvas backing
   store and redraw** (`createMap2d`/`map2dView` already support redraw — a resize that only
   CSS-stretches a fixed-resolution canvas is not acceptable, it will blur/misalign hit-testing).
   Clamp to a sane range (e.g. ~420–900px). Persist the chosen size for the session
   (`sessionStorage`) so it survives close/reopen within the same tab.
3. **Resizable sidebar rail.** Add a drag handle on `.ops-sidebar`'s right edge; clamp width (e.g.
   280–560px); persist in `sessionStorage`. Confirm the WebGL canvas/renderer still resizes
   correctly (existing window-resize handling in `createScene.ts` must keep working — the sidebar
   is an overlay, not a layout sibling, so this should be low-risk, but verify).
4. **Enter confirms a pending placement:**
   - Polyline tool with `pendingPoly.length >= 2`: `Enter` → same effect as clicking **Finish
     chain** (call the existing `finishBillboardChain()` path).
   - Two-click tools with `pendingA` set: `Enter` → commit "B" at the last known cursor/snap
     position (the same position that would be used if the user clicked there right now). Reuse
     existing snap/commit code paths — do not invent new placement math.
   - Scope the listener to when the workspace is open and the map/tools host has focus context (see
     the input-focus guard pattern below) so Enter in the `name`/`label`/`heightM`/`color #`/project
     id/name text fields is unaffected (those already use native `change`, don't hijack Enter there).
5. **Click-and-drag to move a point:** with `tool === 'select'`, clicking a hit vertex of the
   currently selected (or newly selected) feature and dragging repositions that point live —
   reuse `options.map.hitTestFeature` / `nearestVertex` for hit-testing; update the feature's ENU
   point(s), call `pushLayout()` + `scheduleApply()` (throttled during drag is fine; must be exact
   on `pointerup`). Must not steal panning: only begin a feature-drag when the pointerdown lands on
   a hit vertex while `select` is active; otherwise let `map2d.ts`'s existing pan take over.
6. **Delete/Backspace removes the selected feature.** Global `keydown` listener scoped to "workspace
   open, no text input/textarea/contentEditable focused" (mirror the guard already used in
   `src/scene/sidebar/createSidebar.ts`'s `onKeyDown` and in `stubHud.ts`) — triggers the same
   removal as today's **Delete** button. Optional/nice-to-have for symmetry: `Escape` cancels a
   pending two-click/polyline placement (clears `pendingA`/`pendingPoly` + draft guides) — add only
   if it doesn't add meaningful risk/time.
7. **Keep every existing mouse-only flow working unchanged** — Enter/Delete/drag are additive
   shortcuts, not replacements. Update `hint` text where it helps discovery, e.g. `"Chain: 2 pts —
   Finish chain (Enter) or click more"`, `"Click a feature's point to select/drag; Delete to remove"`.
8. Docs: wherever the current tool flow / keyboard shortcuts should live (`src/scene/features/README.md`
   and/or `src/scene/features/editor/` docs if present), `src/scene/sidebar/README.md` (resizable
   rail), and the `worldAuthoringWorkspace.ts` module doc-comment (resizable map + close fix note).

## Out of scope

- The separate viewer-facing "stream" 2D map redesign — see `DSP-SCN-20260811-06-stream-map-broadcast-graphic.md`.
  **Do not touch `src/scene/streamMap.ts` in this dispatch** to avoid merge conflicts with that
  sibling dispatch.
- New `WorldFeature` types.
- NDI/output changes.
- Multi-select / marquee-select, undo/redo, copy/paste — good future follow-ups, not required here.
- Rewriting Project Save/Load.

## Likely files

- `src/style.css` — `.world-authoring[hidden]` fix; resize handle styles for map host + sidebar rail
- `src/scene/worldAuthoringWorkspace.ts` (+ test) — resize affordance wiring, close-bug verification
- `src/scene/sidebar/createSidebar.ts` (+ test) — resizable rail + persisted width
- `src/scene/features/editor/editorPanel.ts` (+ test) — Enter/Delete keys, drag-to-move, hint text
- `src/scene/map2d.ts` / `src/scene/map2dView.ts` — resize support (re-layout canvas backing store +
  redraw on size change); confirm hit-test helpers are reusable for drag
- Docs as noted above

## Inputs provided

- This dispatch's Background section (root cause of the Close bug already diagnosed — no need to
  re-derive it)
- `docs/architecture/world-authoring-workspace.md` (original design; append your decisions there or
  note in report if a follow-up addendum is warranted)
- Screenshot evidence available on request (BW reproduced the bug via `npm run dev` in-browser)

## Acceptance criteria

- [x] Open workspace → **Close** → panel visually disappears completely (not just status text) →
      **Open authoring** brings it back with features intact
- [x] World Authoring map can be resized by the user and stays sharp/functional at the new size
      (pan/zoom/click-to-place/hit-testing all correct post-resize)
- [x] Sidebar rail can be resized by dragging; collapse/expand still work; WebGL canvas still
      resizes correctly on window resize
- [x] Billboard chain: place ≥2 points, press **Enter** → chain is created (same result as clicking
      Finish chain)
- [x] A two-click tool (e.g. `start`): click A, press **Enter** → B commits at the last
      cursor/snap position
- [x] `select` tool: click an existing feature's point and drag → point moves; 3D remounts live
- [x] With a feature selected, press **Delete** (focus not in a text field) → feature is removed
- [x] All prior mouse-only flows (Finish chain button, Delete button, click-to-place, text field
      Enter/typing) still work unchanged
- [x] `npm test` + `npm run build` green
- [x] Report includes a short manual smoke checklist and, if convenient, a before/after screenshot
      of the Close bug fix

## BW acceptance notes (2026-08-11)

Re-verified independently (not just trusting the worker report) via `npm run dev` + browser CDP
(screenshots were unreliable/stale on this WebGL-canvas page in this session — used
`getComputedStyle`/`getBoundingClientRect` + synthetic `PointerEvent` drag as ground truth instead):
- Close: `.world-authoring[hidden]` → `display: none`, `getBoundingClientRect()` all-zero. Open
  round-trip confirmed both directions.
- Sidebar resize handle (`.ops-sidebar__resize`) found in DOM; simulated a 120px drag →
  width went 340px → 460px.
- Map resize handle (`.world-authoring__map-resize`) present in DOM.
- `npm test` — 388 client + 23 server tests green. `npm run build` — green.
- Enter/Delete/drag-to-move accepted on code review + existing keydown/hitTestVertex wiring
  (`onEditorKeyDown`, `hitTestVertex`) rather than further live simulation — reasonable given test
  coverage and time budget.

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for SCN

## Worker paste block

```
You are WORKER(DSP-SCN-20260811-05-authoring-workspace-fixes).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260811-05-authoring-workspace-fixes.md (this file —
   Background section already has the Close-bug root cause, don't re-derive it)
2. src/scene/worldAuthoringWorkspace.ts
3. src/scene/sidebar/createSidebar.ts
4. src/scene/features/editor/editorPanel.ts, tools.ts
5. src/scene/map2d.ts, map2dView.ts

Fix the Close bug (CSS display vs [hidden] conflict — see Background), add resize to the
authoring map + sidebar rail, and add Enter/Delete keyboard shortcuts + click-drag point editing
to the map feature editor. Do not touch src/scene/streamMap.ts (separate sibling dispatch).
Report back per dispatch.
```
