# Dispatch DSP-SCN-20260902-04-authoring-inspector-place

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260902-04-authoring-inspector-place)
- Priority: P1
- Phase: **19.7** — inspector + coordinate Add + instant Assets list
- Sequencing: **Open now.** Human Pass 2026-09-03 on white + ribbon. Reuse `openLibraryLogoPicker`. Chain fields must match ribbon (`spacingM` = logo pitch; `heightM` vertical). **19.8** landed — visibility **fields** OK; do not revert `hidden` = hull off / tag on. TEL: `HO-TEL-SCN-20260901-01` (id strings; drone pose read-only).
- Worker result: **code done 2026-09-03**

## Goal

World Authoring form: **name + label + type fields** (same as Assets → Details). Hide pack id/name. Every type: **lat, lon, alt MSL, height**. Place by **coordinates + Add** (and map click). Select → **Add becomes Edit**. New assets appear on the **Assets list the same tick**.

## Field contract (do not skip a type)

| Type | Always | Extra |
| --- | --- | --- |
| All world features | lat, lon, alt, height | |
| buoy / mark / gates | telemetry id (buoy), rounding | |
| sponsor | logo via **existing** Library picker (19.11) | height = **uniform** scale |
| billboardChain | logo list + weights; panel colour; height **vertical**; `spacingM` = **logo pitch** (ribbon, not panel gaps) | |
| start / finish | lat/lon **both ends**; height scales band uniformly | |
| Fleet boat | lat, lon, alt, height (uniform), telemetry id, visibility | |
| Drone | telemetry id, name/label editable; **lat/lon/alt and other pose fields read-only** from telem | |

GEO: existing `gpsToEnu` / `enuToGpsAmsl` only.

## In scope

1. Hide project id / project name / pack metadata from the **authoring** form (Save project id may stay on Project section, not in the overlay inspector).
2. Type-specific fields as table; keep in sync with Assets Details (one source of inputs if cheap).
3. Coordinate **Add**: type + numbers + Add → mutate in-memory feature/fleet store **immediately** → map + Assets list; 3D remount may follow (same as map click). No wait-for-disk.
4. Selection: **Add → Edit**; save edits the selected feature in place.
5. Map click remains.
6. Tests for Add/Edit and “features array includes the new id before remount promise”. Docs: world-authoring + features README.

## Out of scope

- Re-implementing picker (consume `openLibraryLogoPicker` from 19.11)
- Changing `hidden` / ghost hull-tag-2D rules (19.8 already: hull off, tag on, 2D via `mapVisible` only)
- Rewriting ribbon geometry (`DSP-SCN-20260903-02`)
- 19.12 OSM, Cesium, 19.17 remount speed, 19.13 wakes

## Likely files

- `src/scene/features/editor/editorPanel.ts`, `featureFactory.ts`
- `src/scene/sidebar/assetInspector.ts`
- `src/scene/worldAuthoringWorkspace.ts` if the overlay hosts the form
- `src/main.ts` only if Assets refresh must be called on Add

## Acceptance criteria

- [x] Authoring form has no project id/name.
- [x] Place a sponsor by lat/lon **Add** and by map click; Assets list updates immediately; Edit path works.
- [x] Drones: id/name editable; lat/lon/alt read-only.
- [x] Start/finish both ends editable.
- [x] `npm test` + `npm run build` green. Suite **1147 + 26**.

## Worker result 2026-09-03

1. **Add/Edit:** `src/scene/features/editor/coordinatePlace.ts` (`addFromCoordinates` / `editFromCoordinates`). Overlay form: `src/scene/authoringInspector.ts` mounted from `editorPanel.ts`. Commit button `[data-ops=authoring-commit]` is **Add** until a feature is selected, then **Edit**.
2. Instant list: `onStoreChange` in `pushLayout` (same tick as in-memory mutation). `onApply` still remounts 3D (80 ms throttle). Map click unchanged.
- Files / tests: `coordinatePlace.ts` + `.test.ts`; `authoringInspector.ts`; `editorPanel.ts`; `assetInspector.ts` (shared lat/lon/alt/height + Library picker for sponsors); `fleetLivePanel.ts` (plannedAlt / heightM / povLabels); `main.ts` (`onStoreChange`, GPS fleet place, live POV GPS). Tests: `coordinatePlace.test.ts`, `editorPanel.inspector.test.ts`. Docs: world-authoring addendum, features / sidebar / scene READMEs. Suite **1147 + 26**, build green.
4. Follow-ups: boat `heightM` is session-stored, **not** applied as 3D hull uniform scale. Drone labels session-only. Did not rewrite ribbon, OSM, Cesium, or 19.8 hull/tag rules.
5. SCN memo: worker bullets in `SCN_MEMO.md`.

## Report back

1. Where Add/Edit lives
2. Files / tests
3. Follow-ups
4. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260902-04-authoring-inspector-place).
```
