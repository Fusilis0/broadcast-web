# ENU frame handedness — the scene is a mirror of the real world

**Status:** **LANDED** (2026-08-17, `DSP-GEO-20260817-01`) — packing is
`(east, up, −north)`; `East × North = +Y`. This doc remains the finding + option-A
lock. §1 snippets show the *pre-fix* packing; do not copy `out.set(east, up, north)`.
**Owner:** GEO (conversion) + SCN (scene-side sign audit).
**Why now:** everything placed in the 3D scene today comes through the *same* transform, so a
mirror is invisible — there is no photographic ground truth on screen. The moment we drop real
Istanbul terrain with baked aerial imagery into the scene
([`geospatial-terrain-cesium.md`](./geospatial-terrain-cesium.md)), the mirror becomes visible and
wrong: the Bosphorus would curve the wrong way and boats would sit on the wrong shore.

---

## 1. What the code does

`src/geodesy/geoOrigin.ts` builds a textbook right-handed ECEF→ENU rotation whose rows are
East / North / Up:

```53:61:src/geodesy/geoOrigin.ts
  m00 = -sinLon
  m01 = cosLon
  m02 = 0.0
  m10 = -sinLat * cosLon
  m11 = -sinLat * sinLon
  m12 = cosLat
  m20 = cosLat * cosLon
  m21 = cosLat * sinLon
  m22 = sinLat
```

`src/geodesy/geoUtils.ts` then packs that (east, north, up) triple into a Three.js vector as
**(east, up, north)**:

```41:49:src/geodesy/geoUtils.ts
function enuFromEcefDelta(dx: number, dy: number, dz: number, out: Vector3): Vector3 {
  const east =
    GeoOrigin.m00 * dx + GeoOrigin.m01 * dy + GeoOrigin.m02 * dz
  const north =
    GeoOrigin.m10 * dx + GeoOrigin.m11 * dy + GeoOrigin.m12 * dz
  const up =
    GeoOrigin.m20 * dx + GeoOrigin.m21 * dy + GeoOrigin.m22 * dz
  return out.set(east, up, north)
}
```

So the documented axis contract is `x = East, y = Up, z = North`.

## 2. Why that is a mirror in Three.js

In the real world the ENU basis is right-handed: **East × North = Up**.

Three.js world space is also right-handed, with `x̂ × ŷ = ẑ`, `ŷ × ẑ = x̂`, `ẑ × x̂ = ŷ`.

Map the axes as the code does — East→`x̂`, Up→`ŷ`, North→`ẑ` — and evaluate the same cross product
in scene space:

```
East × North  →  x̂ × ẑ  =  −ŷ  →  −Up
```

Real world says `+Up`, the scene says `−Up`. The two frames differ by a reflection, not a rotation.
No camera quaternion can undo it (`UNITY_CAM_TO_THREE` is a 180° Y rotation — rotations preserve
handedness).

**Root cause:** this is a literal port of the Unity convention. Unity is *left*-handed, so
`x = East, y = Up, z = North` is geographically correct **there**. Copying the same axis assignment
into right-handed Three.js silently mirrors the world east↔west. It is a classic Unity→Three port
trap and it has been latent since Phase 1 because nothing on screen could contradict it.

## 3. The 2D map already disagrees with the 3D scene

The ops/authoring 2D map projects the same ENU numbers the conventional, correct way — North up,
East right:

```158:174:src/scene/map2d.ts
/** ENU x=East, z=North → panel px (origin top-left). */
export function enuToMapPx(
  east: number,
  north: number,
  bounds: MapBounds,
  width: number,
  height: number,
  paddingPx = PADDING_PX,
): { x: number; y: number } {
  const innerW = Math.max(width - paddingPx * 2, 1)
  const innerH = Math.max(height - paddingPx * 2, 1)
  const spanE = Math.max(bounds.maxE - bounds.minE, 1e-6)
  const spanN = Math.max(bounds.maxN - bounds.minN, 1e-6)
  const x = paddingPx + ((east - bounds.minE) / spanE) * innerW
  const y = paddingPx + ((bounds.maxN - north) / spanN) * innerH
  return { x, y }
}
```

Now look at the 3D scene from directly overhead with North up. The camera looks along `−ŷ` with up
= `+ẑ` (North). Screen-right is `forward × up` = `(−ŷ) × ẑ` = `−x̂` = **West**.

So: **the 2D map puts East on the right; a north-up 3D bird's-eye view puts East on the left.** The
authoring map and the 3D world are mirror images of one another. Everything is internally
consistent inside each view, which is why this has never produced a bug report.

## 4. Confirmed empirically (2026-08-17)

BW did not accept the math as sufficient evidence. A throwaway probe ran the **real** `geoOrigin` +
`gpsToEnu` code against the Bosphorus anchor (`41.08673822819249, 29.061803205100848`), taking
points 500 m due east and 500 m due north and evaluating the cross product in scene space:

```
  500 m due EAST  -> (x=500.7, y=-0.0, z=0.0)
  500 m due NORTH -> (x=0.0,   y=-0.0, z=498.8)
  East x North    -> (x=-0.0,  y=-1.0, z=-0.0)
  => East x North points -Y (DOWN) = MIRRORED
  North-up top-down view: screen-right = (x=-1.0, y=0.0, z=0.0) = WEST (mirrored vs 2D map)
```

Real-world ENU requires `East × North = +Up`. The scene produces `−Up`. **The frame is mirrored.**

Additionally grepped the whole of `src/` for a compensating negative scale
(`scale.x/y/z = -…`, `scale.set(-…)`, `scale.multiplyScalar(-…)`) on any scene root — **no matches**,
so nothing downstream un-mirrors it.

The probe was deleted after reading; its assertions should be re-created as permanent tests by the
worker who implements the fix (§5).

A further confirmation once terrain exists: load the tileset unmodified and check whether the
coastline matches reality or is flipped.

## 5. Fix options

| # | Option | Verdict |
| --- | --- | --- |
| **A** | Change the packing to `out.set(east, up, -north)` — i.e. **North = −Z**, the standard Three.js / glTF convention. Restores `East × North = Up`. | **Recommended** |
| B | Mirror the terrain to match the scene (`tilesGroup.scale.z = -1`) | **Reject** — mirrored aerial imagery (mirrored buildings, mirrored text, wrong coastline) is unacceptable for a broadcast product over a real, recognisable city, and negative scale inverts triangle winding and breaks lighting/backface culling. |
| C | Leave it; place terrain in a corrected sub-frame | **Reject** — two contradictory frames in one scene is a permanent bug factory; every future geospatial feature pays the tax. |

### What option A touches

Feature coordinates are stored as **lat/lon** in `RaceProject` and converted at runtime, so **no
saved project data migrates** — every existing pack keeps working. The audit surface is
sign conventions in scene-side code:

- `src/geodesy/geoUtils.ts` — the packing itself, plus `enuToGps` / `enuToGpsAmsl` inverses, and
  `gpsToEnuBatch`.
- Heading / yaw application for boats and POV cameras (`src/pose/pipeline.ts`,
  `src/scene/droneCamera.ts`, `UNITY_CAM_TO_THREE`) — a mirrored world needed a compensating sign
  somewhere for headings to look right; that compensation must come back out.
- Anything reading `.z` as north: `map2d.ts` call sites (`f.points[0].x` / `.z`),
  `layoutFeatures.ts`, `courseLayout.ts`, `calibrationOverlay.ts` grid labels,
  `segmentReadout.ts` bearings, `frameEnuPoint` / `frameFleet`.
- CAL offsets (yaw sign) — a mirrored yaw means existing per-POV calibration values may need
  re-derivation. **Flag to CAL before the fix lands**; saved `calibration.byPovId` values are a
  migration risk even though geometry is not.

### Guardrails for whoever implements it

- Add a geodesy unit test asserting handedness directly: for the Bosphorus origin, a point due east
  and a point due north must satisfy `east × north ≈ +up` in scene coordinates.
- Add a test asserting the 2D map and a north-up 3D projection agree in sign.
- Keep the axis contract comment in `geoUtils.ts` and `system-architecture.md` §5.2 in sync — both
  currently document `z = North` and both must change together.

## 6. Sequencing

This is a **prerequisite for Phase 14.1 terrain**, not a nice-to-have, and it is *far* cheaper to
do before terrain than after — afterwards every terrain-alignment bug is ambiguous between "mirror"
and "tileset offset". Ocean and wind work (14.2 / 14.3) are handedness-neutral in isolation but the
wind *direction* mapping (§`wind-data-and-vfx.md` §3) depends on a settled convention, so land this
first.

## Open questions

| # | Question |
| --- | --- |
| 1 | ~~Does the empirical check show the flip?~~ **Answered 2026-08-17: yes, confirmed (§4).** |
| 2 | Do existing saved `calibration.byPovId` yaw values need a migration, or are they re-derived per show anyway? (CAL) |
| 3 | Is the Unity reference project (`../broadcast`) also the source of the heading sign convention we would be changing — i.e. does anything still need to round-trip with Unity during the Phase 10.1 parallel-air period? |
