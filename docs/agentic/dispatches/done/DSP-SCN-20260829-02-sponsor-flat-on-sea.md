# Dispatch DSP-SCN-20260829-02-sponsor-flat-on-sea

## Meta
- From orchestrator: BW (route to SCN)
- Worker role: WORKER(DSP-SCN-20260829-02-sponsor-flat-on-sea)
- Priority: P1
- Phase: 18.7
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active**

## Goal

Sponsor graphics should lie **flat on the water**, the way the start and finish line signs do, instead of standing upright like walls. Operator note: "sponsor placements should be parallel to sea, similar to start finish, not similar to billboards."

Scope is **`type: 'sponsor'` only**. `billboardChain` stays upright — the operator confirmed that explicitly.

## Background

The two placements already exist side by side in the codebase; sponsors simply use the wrong one.

Sponsor today — basis `(along, up, normal)`, centred half its height above the water, i.e. a vertical panel facing sideways:

```104:161:src/scene/sponsors/sponsorBillboard.ts
/**
 * Vertical world panel between A–B at water baseline. Fixed orientation (not camera-billboard).
 */
  const geo = new THREE.PlaneGeometry(endpoints.widthM, endpoints.heightM)
  const up = new THREE.Vector3(0, 1, 0)
  const m = new THREE.Matrix4().makeBasis(basis.along, up, basis.normal)
  mesh.quaternion.setFromRotationMatrix(m)
  mesh.position.set(
    endpoints.midX,
    SPONSOR_WATER_Y + endpoints.heightM / 2,
    endpoints.midZ,
  )
```

Start/finish today — basis `(along, across, up)`, plane normal pointing at the sky, lifted just enough to avoid z-fighting:

```53:86:src/scene/lineSigns/lineSignMesh.ts
/**
 * Horizontal water-plane sign spanning A–B (Unity Start/Finish spirit).
 * Plane faces +Y (readable from drone / free cam above).
 */
  const across = new THREE.Vector3().crossVectors(up, along).normalize()
  const geo = new THREE.PlaneGeometry(sign.widthM, LINE_SIGN_BAND_DEPTH_M)
  const m = new THREE.Matrix4().makeBasis(along, across, up)
  mesh.quaternion.setFromRotationMatrix(m)
  mesh.position.set(sign.midX, LINE_SIGN_WATER_Y + LINE_SIGN_Y_OFFSET, sign.midZ)
```

`LINE_SIGN_Y_OFFSET` is `0.08`, matching the Gerstner ocean `liftY`. Neither placement follows wave displacement; both sit on the flat water plane at `y = 0`. That stays true here.

This also brings the web closer to the Unity reference, where `*LogoOnSea.prefab` is a canvas laid on the sea (`docs/ops/unity-asset-port.md` L24). Phase 16.4 gave sponsors a composed board texture but left the mesh upright.

There is no schema field for flat versus upright, and none is being added — flat becomes the sponsor placement.

## BW decision on `heightM`

`heightM` currently means the vertical height of the wall (default 8). Once flat there is no vertical extent, so **`heightM` becomes the depth of the board across the water**, perpendicular to the A→B span — the same role `LINE_SIGN_BAND_DEPTH_M` plays for line signs. The default stays 8. Existing packs keep their number and get a sensibly sized flat board rather than an error.

Do not rename the field and do not add a migration. If this reads badly on screen at 8 m, say so in the report with a suggested default; do not change the schema on your own.

## In scope

1. Lay `sponsor` boards flat: basis `(along, across, up)`, positioned at the water plane plus the same small lift the line signs use. Extract the shared placement into one helper used by both `lineSignMesh` and `sponsorBillboard` rather than copying the matrix maths — the two must not drift.
2. Geometry becomes `PlaneGeometry(widthM, heightM)` where `widthM` is still the A→B span and `heightM` is now the across-water depth.
3. Match the line-sign **material** treatment so a flat board does not z-fight the ocean: line signs use transparent with `depthWrite: false`. Sponsors are currently opaque with `depthWrite: true`. Adopt whatever the line signs do, and if you still see fighting against the Gerstner surface, add polygon offset rather than lifting the board higher.
4. Keep the composed board texture exactly as it is (panel fill, frame, contain-fit logo from `boardCompose.ts`). The logo should read along the A→B direction, so authoring A→B still controls which way the text runs — confirm this and say which way it reads.
5. `billboardChain` is untouched and must remain upright. It calls `createSponsorBillboard` today, so make sure the change does not leak into it — that shared call site is the main risk in this dispatch.
6. Update `public/fixtures/sponsors/README.md` and the asset-inspector help text: sponsors are flat on the sea, `heightM` is depth across the water.

## Out of scope

- `billboardChain` orientation, spacing, or geometry.
- Making boards follow Gerstner wave displacement. Both sponsors and line signs stay on the flat water plane; changing that is a separate ocean-coupling item.
- Adding a per-feature flat/upright toggle, a heading field, or panel/frame colour pickers.
- Start/finish appearance.

## Likely files

- `src/scene/sponsors/sponsorBillboard.ts` — the placement change
- `src/scene/lineSigns/lineSignMesh.ts` — extract the shared placement helper
- `src/scene/billboardChain.ts` — verify it keeps the upright path
- `src/scene/sponsors/sponsorLayout.ts`, `loadSponsors.ts` — only if the layout data shape needs the new meaning
- tests alongside; `public/fixtures/sponsors/README.md`; `src/scene/features/editor` inspector help text

## Inputs provided

- Flat reference implementation: `src/scene/lineSigns/lineSignMesh.ts` (`LINE_SIGN_WATER_Y = 0`, `LINE_SIGN_Y_OFFSET = 0.08`, `LINE_SIGN_BAND_DEPTH_M = 12`).
- `SPONSOR_WATER_Y = 0` in `sponsorLayout.ts` L7–11 — AMSL is deliberately ignored for these graphics; keep it that way.
- Mount pipeline: `createScene.ts` `remountWorldFromFeatures` L951–995 runs sponsors, line signs, and chains through three separate paths.
- Sponsor factory default `heightM: 8` in `featureFactory.ts`.

## Acceptance criteria

- [ ] A sponsor feature renders as a flat board on the water, normal pointing up, readable from a drone or free camera above.
- [ ] A unit test asserts the sponsor mesh orientation and Y placement match the line-sign pattern (quaternion basis and position), not the old upright one.
- [ ] A unit test asserts a `billboardChain` instance is still upright.
- [ ] No z-fighting against the realistic Gerstner ocean or the simple water cue at typical AR and orbit distances.
- [ ] Existing packs with `heightM: 8` load without error and produce a reasonably proportioned flat board.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** load a pack with sponsors, view from an AR POV and from the free camera. Boards should look painted on the sea like the start/finish band. A problem would look like boards still standing up, boards flickering against the water, or logos reading backwards.

## Report back

1. What the placement now is and which way the logo reads
2. Files touched, and confirmation the chain path is untouched
3. Tests run / how verified, plus a screenshot or description from the smoke
4. Whether `heightM: 8` as a depth looks right, with a suggested default if not
5. Suggested memo bullets for SCN
