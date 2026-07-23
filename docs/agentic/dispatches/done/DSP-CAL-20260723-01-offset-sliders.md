# Dispatch DSP-CAL-20260723-01-offset-sliders

## Meta
- From orchestrator: CAL
- Worker role: WORKER(DSP-CAL-20260723-01-offset-sliders)
- Priority: P0
- Phase: Phase 1 — Spine (roadmap **1.8** human offset sliders)
- Related handoffs: none (BW: Milestone A done → draft/issue 1.8)

## Goal

Add a minimal human calibration control panel: sliders for **yaw / pitch / roll / FOV / alt** that read/write the existing per-device `CalibrationOffsets` store so live pose conversion (`applyCalibration` / `convert`) and the drone camera FOV pick up changes on the next pose tick. No new pose pipeline, no SCN meshes, no TEL live/replay wiring.

## Background

- Milestone A accepted (BW 2026-07-23): mock → ENU → boat/cam + stub HUD + 2D map
- Store + apply already landed (`DSP-CAL-20260722-01` → `done/`):
  - `src/calibration/types.ts` — `CalibrationOffsets`, `DEFAULT_HFOV_DEG = 66.8832`, `zeroOffsets()`
  - `src/calibration/offsetsStore.ts` — `getOffsets` / `setOffsets` / `resetOffsets` / `clearAllOffsets`
  - `src/pose/applyCalibration.ts` + `convert.ts` — already call store by device id; `PoseEvent.fovHDeg` already consumed by `src/scene/droneCamera.ts`
- Architecture §5.3; pipeline unchanged: `rawTelemetryPose → GEO → + CAL offsets → SCN camera`
- Mock drone id is **`"1"`** (`MOCK_DRONE_ID` / `DEFAULT_DRONE_ID`); target that device for V1 sliders
- SCN stub HUD (`src/scene/stubHud.ts`) is SCN-owned ops overlay — prefer a **CAL-owned** panel under `src/calibration/` mounted from `main.ts`, not a mesh/scene rewrite

## In scope

1. **Calib panel module** (`src/calibration/`, e.g. `offsetSliders.ts` / `calibHud.ts`):
   - Controls for all five knobs: `yawDeg`, `pitchDeg`, `rollDeg`, `fovHDeg`, `altMeters`
   - Each control: label + range input (and numeric readout or `input type="number"` — keep compact)
   - **Reset** button → `resetOffsets(deviceId)` and refresh UI to defaults (zeros + FOV 66.8832)
   - On input: `setOffsets(deviceId, { [field]: value })` only — do **not** reimplement apply math in the UI
   - Default `deviceId`: `"1"` (mock drone). Optional tiny device-id label (read-only) is fine; multi-device picker optional, not required
   - `start…` / `stop…` handle pattern consistent with scene/HUD (cleanup listeners + remove DOM)

2. **Suggested ranges** (tune if unusable; document finals in report-back):
   - yaw / pitch / roll: about **±45°** (step 0.1 or 0.5)
   - fovHDeg: about **20–120°** (step 0.1); default thumb at **66.8832**
   - altMeters: about **±50 m** (step 0.1)

3. **Mount**
   - Call from `src/main.ts` after (or beside) `startStubHud` — same `#app` container
   - Panel is ops UI: fixed corner, compact monospace-ish to match existing ops chrome; `pointer-events: auto` on controls only
   - Prefer **not** editing SCN entity/mesh/map code. Light CSS in `src/style.css` for the new panel classes is OK. Touching `stubHud.ts` only if unavoidable for layout — escalate in report-back if you needed SCN changes

4. **Live effect**
   - Rely on existing pose pipeline: next `convert` → `getOffsets` → `poseBus` → camera/boat. No second apply path
   - FOV slider must visibly change drone camera FOV once poses are flowing (mock already does)
   - Yaw/pitch/roll/alt must affect published pose (verify manually under `npm run dev`)

5. **Tests**
   - Unit-test the panel logic if extracted (e.g. parsing/clamping + that slider handlers call `setOffsets` / `resetOffsets`) — DOM-light or with minimal jsdom if the project already supports it
   - If pure DOM glue is awkward to test, at least keep store API tests green and document manual verify steps
   - Do not break existing calibration/pose/scene tests (`npm test`)

6. **Exports / README**
   - Export start/stop from `src/calibration/index.ts`
   - One-line update to `src/calibration/README.md`

## Out of scope

- SCN meshes, boat/drone entity changes, 2D map changes, scene graph work
- TEL live WebSocket, replay fixtures, or wiring the stub HUD mode select (TEL **1.4** / **1.9**)
- localStorage / config export persistence (follow-up unless trivial; do not block 1.8)
- East/north offsets, lens distortion, declination service
- CV / vision matching
- Multi-drone picker polish, presets library, “reset after reboot” workflow beyond the Reset button
- Changing `applyCalibration` math (already shipped) unless a clear bug blocks sliders — then minimal fix + note in report-back

## Likely files

- `src/calibration/offsetSliders.ts` (name flexible)
- `src/calibration/index.ts`
- `src/calibration/README.md`
- `src/calibration/offsetSliders.test.ts` (optional but preferred)
- `src/main.ts` (mount + stop on `beforeunload`)
- `src/style.css` (panel styles only)
- Do **not** expect edits under `src/scene/boatEntity.ts`, `droneCamera.ts`, `map2d.ts`, `createScene.ts` for this DSP

## Inputs provided

- Store API: `getOffsets` / `setOffsets` / `resetOffsets` in `src/calibration/offsetsStore.ts`
- Pose already applies store in `src/pose/convert.ts` via `applyCalibrationEuler`
- Mock drone id `"1"`; boat id `"21"` (sliders target drone only)
- Ops overlay styles exist in `src/style.css` (`.ops-hud`, `.ops-overlay`) — match visual density, do not redesign the product
- Roadmap: `docs/roadmap/phases-roadmap.md` item **1.8**

## Acceptance criteria

- [ ] Five sliders (yaw, pitch, roll, FOV, alt) visible in the running app (`npm run dev`)
- [ ] Moving a slider calls `setOffsets` for device `"1"` (or documented default); values match store via `getOffsets`
- [ ] Reset restores zero angles/alt + **fovHDeg 66.8832** and updates the controls
- [ ] With mock telemetry running, yaw/pitch/roll/alt/FOV changes affect the drone view / pose without a page reload
- [ ] No new pose pipeline; no SCN mesh work; no TEL live/replay implementation
- [ ] Existing test suite still green
- [ ] CAL README mentions the panel entrypoint

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (include manual FOV + yaw check under mock)
4. Follow-ups / blockers (persistence, multi-device, any SCN touch required)
5. Suggested memo bullets for CAL
