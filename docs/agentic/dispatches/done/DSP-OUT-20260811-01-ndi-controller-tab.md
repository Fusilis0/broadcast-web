# Dispatch DSP-OUT-20260811-01-ndi-controller-tab

## Meta
- From orchestrator: BW → OUT (Phase 11.5)
- Worker role: WORKER(DSP-OUT-20260811-01-ndi-controller-tab)
- Priority: P1
- Phase: Phase 11 — Unified ops sidebar & universal asset pipeline
- Prerequisite: `DSP-SCN-20260811-01-ops-sidebar-shell` (mounts the NDI section)
- Related handoff: resolves the deferred question in `docs/agentic/handoffs/HO-SCN-OUT-20260804-01.md` (stream map DOM-only vs NDI burn-in)
- Design doc: `docs/architecture/unified-ops-sidebar.md` §2, §8
- **Status: DONE** — worker complete + BW accepted 2026-08-11

## Goal

Give ops a dedicated **NDI** sidebar tab showing the status of the air/3D NDI source (already
implemented, never surfaced in any panel today), and — as a gated stretch goal — a second,
independently toggleable NDI source carrying only the 2D stream map, finally resolving the
"DOM-only vs burn-in" question left open since Phase 8.

## Background

- `src/output/ndiFramePump.ts` — `startNdiFramePump` returns `NdiFramePumpHandle` with
  `getSourceName()`, `getSdkVersion()`, `getError()` — none of this is currently shown anywhere in
  the UI; ops only infers NDI health from vMix/the studio monitor.
- `src/output/airCameraLock.ts` — `planNdiCapture`/`isAirCameraLocked` policy: air always follows
  the active POV, independent of screen/free-cam. This is the invariant the controller tab should
  *display*, not change.
- Stream map (`src/scene/streamMap.ts`) is currently DOM/CSS-only (`docs/agentic/handoffs/HO-SCN-OUT-20260804-01.md`)
  — never rendered into the WebGL scene, so it cannot go over the existing NDI pipe (which reads the
  WebGL framebuffer). A second source needs either (a) a second `<canvas>`/offscreen render of the
  map content that mirrors `streamMap`'s draw calls, or (b) rendering the stream map as a WebGL
  overlay instead of DOM (bigger change). Prefer (a) if the Electron main-process NDI wrapper
  supports multiple named senders — check `desktop/` main process source for the NDI bridge
  capabilities before committing to scope.
- **Design doc §2 invariant**: nothing in this dispatch may make NDI capture depend on sidebar DOM
  state. The controller tab reads NDI handles; it must not become a dependency the render loop needs
  to function.

## In scope

1. **NDI controller sidebar section** (mounts into the shell from `DSP-SCN-20260811-01`): shows for
   the existing air source — source name, SDK version, last error (if any), active POV id (from
   existing air-camera-lock state), a simple "live/stopped/error" indicator. Read-only for v1 (no
   start/stop control needed if NDI is already tied to app lifecycle — confirm and document).
2. **Regression note/check**: add or extend a test/comment in `ndiFramePump.ts` or its test
   confirming NDI capture reads only the WebGL framebuffer/air camera, never sidebar DOM — satisfies
   design doc §2 for OUT's side of the invariant.
3. **Stretch (gated on bridge capability):** investigate whether the Electron main-process NDI
   wrapper (`desktop/` — check `studioBridge.ts` and the main process module it talks to) supports a
   second independently-named NDI sender. If yes: add a second frame pump for the stream-map canvas
   content (mirror `streamMap`'s 2D draw calls onto an offscreen canvas, or reuse its existing canvas
   directly if one exists) with its own enable/disable toggle in the controller tab. If no
   (would require a bridge refactor): ship the tab with this toggle visibly present but disabled,
   labeled "not supported by current NDI bridge", and file the refactor as a named follow-up — do
   **not** block the rest of this dispatch or Phase 11 on it.
4. Docs: `src/output/README.md`, `docs/ops/air-runbook.md` (note the new controller tab + how to
   read it during a smoke check).

## Out of scope

- Changing air-camera-lock policy itself (`airCameraLock.ts` logic) — display only.
- Any change to the primary 3D/air NDI pipeline's correctness — it already works; this dispatch only
  adds visibility + optionally a second source.
- Sidebar shell itself (`DSP-SCN-20260811-01`).
- Console/WHEP/chroma output modes — unrelated to this tab.

## Likely files

- New: `src/output/ndiControllerPanel.ts` (or under `src/scene/sidebar/` if that's cleaner given the
  shell contract), test file, README section
- Edit: `src/output/ndiFramePump.ts` (expose any additional read-only state needed, e.g. active POV
  id passthrough if not already available), `src/output/index.ts`, `src/main.ts` (wiring),
  `docs/ops/air-runbook.md`
- Investigate (read-only unless stretch scope proceeds): `desktop/` Electron main process NDI bridge
  source, `src/output/studioBridge.ts`

## Inputs provided

- `docs/architecture/unified-ops-sidebar.md` §2 (NDI invariant), §8 (controller tab + stretch gate).
- `docs/agentic/handoffs/HO-SCN-OUT-20260804-01.md` — original stream-map-vs-NDI open question this
  dispatch is allowed to finally resolve (as an opt-in toggle, not a default-on burn-in).
- `docs/ops/air-runbook.md` — existing NDI smoke checklist to extend.

## Acceptance criteria

- [ ] NDI controller tab shows air source name/SDK version/error/active POV id, sourced from
      existing `NdiFramePumpHandle` (+ minor additive exposure if needed)
- [ ] Tab renders correctly whether NDI is available (Electron) or not (Chrome dev — show a clear
      "NDI unavailable in this shell" state, no crash)
- [ ] Regression check confirms NDI capture never depends on sidebar DOM/visibility state
- [ ] Second 2D-map NDI source either shipped (with its own toggle) or clearly stubbed-disabled with
      a documented follow-up — decision recorded in the report-back either way
- [ ] `npm test` + `npm run build` green
- [ ] `docs/ops/air-runbook.md` updated with how to read the new tab during a studio smoke check

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (especially: did the second NDI source ship or get stubbed, and why)
5. Suggested memo bullets for OUT

## Worker paste block

```
You are WORKER(DSP-OUT-20260811-01-ndi-controller-tab).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260811-01-ndi-controller-tab.md
2. docs/architecture/unified-ops-sidebar.md (§2, §8)
3. docs/agentic/handoffs/HO-SCN-OUT-20260804-01.md
4. src/output/ndiFramePump.ts, airCameraLock.ts, studioBridge.ts
5. src/scene/streamMap.ts

Build the NDI controller sidebar tab (read-only status for the existing air source).
Investigate whether a second NDI source for the 2D map is feasible with the current
Electron bridge; ship it gated, or stub it disabled with a follow-up note — do not block
on this. Report back per dispatch.
```
