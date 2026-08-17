# Dispatch DSP-GEO-20260817-01-enu-handedness-fix

## Meta
- From orchestrator: BW → GEO (lead) + SCN (consumer sweep)
- Worker role: WORKER(DSP-GEO-20260817-01-enu-handedness-fix)
- Priority: **P0**
- Phase: Phase 14.0 — prerequisite for Cesium terrain
- Related handoffs: `HO-BW-CAL-20260817-01` (yaw offsets may need re-derivation)
- Design: `docs/architecture/enu-frame-handedness.md` (**CONFIRMED** 2026-08-17)
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (`npm test` 480+23; `East × North ≈ +Y`; north.z≈−499)
- Parallel-safe with: none at issue time. Unblocks 14.1 / 14.2a / 14.3a.
- **BW domain note:** this dispatch is GEO-led. SCN consumer updates (any code that treats
  `Vector3.z` as geographic north) are **in scope** because a GEO-only merge is unshippable —
  the 2D map would flip north-south the moment packing changes. Do not split across chats.

## Goal

Make the Three.js scene a **right-handed** ENU frame: `x = East`, `y = Up`, `z = −North`
(standard Three / glTF). Today `gpsToEnu` packs `(east, up, north)` so `East × North = −Up`
in scene space — a mirror of the real world, confirmed against live `geoOrigin`/`gpsToEnu` at
the Bosphorus origin. Fix the packing, the inverses, every consumer that reads `.z` as north,
and the tests/docs that currently assert `north → +z`.

## Background

- Finding + numbers: `docs/architecture/enu-frame-handedness.md` §4.
  Probe at origin `41.08673822819249, 29.061803205100848`:
  - 500 m due east → `(x≈500.7, y≈0, z≈0)`
  - 500 m due north → `(x≈0, y≈0, z≈498.8)`
  - `East × North → (0, −1, 0)` — **mirrored**. After the fix this must be `(0, +1, 0)`
    and the north point must have **`z ≈ −499`**.
- Root cause: Unity is left-handed, so `x=East, y=Up, z=North` is correct **there**. The same
  assignment was copied into right-handed Three.js.
- 2D map (`enuToMapPx(east, north)`) already projects North-up / East-right correctly using
  **named scalars**. It disagrees with 3D only when it takes `p.z` from a `gpsToEnu` Vector3
  and treats that `.z` as north (`map2d.ts` `enuToMapPx(p.x, p.z, …)`).
- RaceProject features are stored as **lat/lon**. **No saved project JSON migrates.**
- CAL: saved `calibration.byPovId` yaw values may need re-derivation after this. **Do not
  write a migration.** Flag in the report. See `HO-BW-CAL-20260817-01`.
- Do **not** mirror terrain (`scale.z = -1`) — that option is rejected in the design doc.

## In scope

1. **Packing** in `src/geodesy/geoUtils.ts`: scene Vector3 is `(east, up, −north)`.
   Keep **named-scalar** APIs geographic (`enuToGps(east, up, north)` still means positive
   north = north). Add a tiny helper if useful, e.g. `sceneZFromNorth(north) => -north` /
   `northFromSceneZ(z) => -z`, so call sites do not scatter raw minuses.
2. **Inverses + batch:** `enuToGps` / `enuToGpsAmsl` stay scalar-north. Round-trip tests that
   currently pass `enuToGps(enu.x, enu.y, enu.z)` must pass geographic north
   (`enu.x, enu.y, -enu.z` or the helper). Update `gpsToEnuBatch` the same way as `gpsToEnu`.
3. **Handedness unit tests** (permanent — recreate the deleted probe):
   - Bosphorus origin, 500 m east / 500 m north: `east × north ≈ +Y`, north point `z < 0`.
   - Update the existing test `'small east offset → +x; small north offset → +z; up → +y'`
     — north must go **−z**. Rename it so the comment matches the new contract.
4. **Consumer sweep** — every site that treats `Vector3.z` / `p.z` / pose `z` as geographic
   north. Likely (audit with grep, do not treat this list as complete):
   - `src/scene/map2d.ts` (`enuToMapPx(p.x, p.z, …)` and kin)
   - `src/scene/map2dBasemap.ts`, `src/scene/features/layoutFeatures.ts`,
     `src/scene/course/courseLayout.ts`, `src/scene/calibrationOverlay.ts`,
     `src/scene/features/editor/segmentReadout.ts`
   - `src/pose/pipeline.ts` (position from `gpsToEnu`)
   - `src/scene/droneCamera.ts` (`UNITY_CAM_TO_THREE` is a 180° Y rotation — **measure**,
     do not blindly invert; it may already be correct once positions are)
   - Boat / POV heading application (`src/pose/convert.ts`, `src/pose/lerp.ts`, hull yaw)
   - `frameEnuPoint` / `frameFleet` / free-cam
   - Any map-chrome / editor bearing that reads `.z`
5. **2D vs 3D agreement test:** a point due north of origin must sit toward the **top** of
   the 2D map (existing `enuToMapPx` scalar path) **and** at **−Z** in the scene. A point
   due east must sit toward the **right** of the 2D map **and** at **+X** in the scene.
6. **Docs:** `src/geodesy/README.md` axis table, `geoUtils.ts` header comment,
   `docs/architecture/system-architecture.md` §5.2 (`z=North` → `z=−North`),
   `docs/architecture/enu-frame-handedness.md` status → landed (short note, do not rewrite).
   Optional one-liner in `docs/agentic/ORCHESTRATORS.md` GEO blurb
   (“Unity-compatible ENU” is the trap — say “right-handed Three ENU, z=−North”).
7. `npm test` + `npm run build` green. Existing geodesy tests that assume `north → +z` are
   **bugs after this change**, not regressions to preserve.

## Out of scope

- Cesium / 3D Tiles / ocean / wind (14.1–14.3). Do not add `3d-tiles-renderer`.
- Migrating stored `calibration.byPovId` yaw numbers.
- Changing RaceProject schema.
- Electron / NDI / `desktop/`.
- Option B (`scale.z = -1`) or a second ENU frame for terrain.

## Likely files

- `src/geodesy/geoUtils.ts`, `src/geodesy/geodesy.test.ts`, `src/geodesy/README.md`
- `src/geodesy/index.ts` (if you export helpers)
- `src/scene/map2d.ts`, `src/scene/map2d.test.ts` (and any test that asserts `p.z` sign)
- `src/pose/*` (only if heading/position signs need a compensating change)
- `src/scene/droneCamera.ts` (only if measurement says so)
- Docs listed above
- Grep hits for `z = North`, `p.z`, `.z as north`

## Inputs provided

- `docs/architecture/enu-frame-handedness.md` (whole doc; §5 option A is the lock)
- Bosphorus origin: `41.08673822819249, 29.061803205100848`
- Existing failing-after-fix test: `src/geodesy/geodesy.test.ts`
  `'small east offset → +x; small north offset → +z; up → +y'`

## Acceptance criteria

- [ ] `East × North ≈ +Up` in scene coordinates (unit test, Bosphorus origin)
- [ ] 500 m due north of that origin has `z < 0`; 500 m due east has `x > 0`
- [ ] Named-scalar 2D map still North-up / East-right; scene Vector3 north is −Z;
      a test asserts they agree
- [ ] `enuToGps` / `gpsToEnu` still round-trip lat/lon (update the test to use geographic
      north, not raw `enu.z`)
- [ ] No `Mesh.scale.z = -1` (or equivalent) anywhere as the “fix”
- [ ] Axis comments/docs no longer say `z = North` without the minus
- [ ] `npm test` + `npm run build` green
- [ ] Report lists every consumer file changed and whether `UNITY_CAM_TO_THREE` / boat
      heading needed a sign change (and why)

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (quote the new handedness test output)
4. Follow-ups / blockers — especially: did boat/POV headings need a compensating sign?
   Did you leave CAL yaw values untouched (expected)?
5. Suggested memo bullets for GEO (+ SCN if you touched scene files)

## BW acceptance notes (2026-08-17)

**Accept.** Spot-checked: `gpsToEnu` packs via `sceneZFromNorth`; `droneCamera.ts` no longer
applies `UNITY_CAM_TO_THREE`; no `scale.z = -1` in `src/`. Worker reported `npm test` 480+23
and `[test] handedness east×north ≈ (0.000, 1.000, -0.000); north.z=-498.8`.

Headings: compensating change at 3D apply (negate yaw; boats + 180° Y for +Z hulls). Pose
`yawDeg` stays geographic. CAL yaw **not** migrated — `HO-BW-CAL-20260817-01` still stands.

Unblocks parallel wave: SCN-01 terrain, SCN-02 Gerstner, TEL-01 wind-bus.

