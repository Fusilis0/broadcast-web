# geodesy

Owned by **GEO**. WGS84 origin, EGM96 undulation, GPS → ENU, cinematic ECEF.

**Cinematic domains (Phase 21):** Globe keyframes are WGS84 **ECEF metres** plus **ellipsoid up** (`geodeticToEcefMeters`, `ellipsoidUpEcef`, `ecefLookAt`). Keyframe altitude is AMSL; globe conversion uses the same `amslToHae` (EGM96) as the race path — no second geoid. Strait / hero shots stay on the Istanbul tangent plane via `enuKeyframeToScene` → `gpsToEnuAmsl`. SCN owns tiles (`TilesRenderer` without `ReorientationPlugin` in the globe domain). This package does not mount CesiumJS or a tileset.

## Axis contract

Right-handed Three.js / glTF ENU:

| Axis | Direction |
| --- | --- |
| `x` | East |
| `y` | Up |
| `z` | **−North** |

Named-scalar APIs (`enuToGps(east, up, north)`) stay geographic. Convert with `sceneZFromNorth` / `northFromSceneZ` when reading a scene `Vector3`. Unity’s `x=East, y=Up, z=North` is left-handed and must not be copied into Three.

Boats use **HAE** altitudes (provisional). Drones: `takeoffAMSL + relativeAlt + N` (EGM96).

## Public API

| Symbol | Role |
| --- | --- |
| `loadEgm96` / `ensureEgm96Loaded` / `loadEgm96FromBuffer` | Load `public/EGM96_1deg.bin` (fetch or buffer) |
| `getUndulation` / `amslToHae` / `relativeToHae` | Geoid N and altitude bridges |
| `setOriginHAE` / `setOriginAMSL` / `isOriginValid` | Explicit origin (no Cesium / scene lookup) |
| `onOriginChanged` | Optional change subscription |
| `gpsToEnu` / `gpsToEnuAmsl` / `gpsToEnuRelative` / `gpsToEnuBatch` | GPS → `THREE.Vector3` ENU (`x=East`, `y=Up`, `z=−North`) |
| `enuToGps` / `enuToGpsAmsl` | Named-scalar inverse (positive `north` = north) |
| `sceneZFromNorth` / `northFromSceneZ` / `eastNorthFromScene` | Scene Z ↔ geographic north |
| `applyConfigOrigin` | Apply `{ lat, lon, altMsl }` from config shape (AMSL) |
| `parseConfigOriginFields` | Parse HUD/form lat/lon/altMsl strings → `ConfigOrigin` or `null` |
| `geodeticToEcefMeters` | Cinematic globe: AMSL geodetic → ECEF metres (`amslToHae` then WGS84) |
| `ellipsoidUpEcef` | Unit geodetic normal at lat/lon |
| `ecefLookAt` | Eye + RH orthonormal basis (forward at target; up = ellipsoid up at eye). Degenerate look → nadir |
| `enuKeyframeToScene` | Cinematic ENU: wrapper on `gpsToEnuAmsl` |

**World anchor:** `origin` is the Unity-style GeoOrigin — that WGS84 point is ENU `(0,0,0)`. Ops edit it in the stub HUD (**origin** lat/lon/altMsl + Apply); `main` updates runtime config, calls `applyConfigOrigin`, then remounts course/sponsors/features so ENU shifts consistently. Deeplink origin params still win at boot.

If origin is unset, `gpsToEnu*` returns `(0,0,0)` and warns (Unity parity). If EGM96 fails to load, undulation is `0`.

## Asset

Static copy: `public/EGM96_1deg.bin` (from Unity `StreamingAssets`, binary copy only).

## Tests

```bash
npm test
```

Vitest runs in Node and loads the bin via `fs` from `public/EGM96_1deg.bin` (no WebGL, no network). Browser runtime uses `fetch('/EGM96_1deg.bin')`.
