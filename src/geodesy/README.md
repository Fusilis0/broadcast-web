# geodesy

Owned by **GEO**. WGS84 origin, EGM96 undulation, GPS → ENU.

## Axis contract

Three.js / Unity-compatible ENU:

| Axis | Direction |
| --- | --- |
| `x` | East |
| `y` | Up |
| `z` | North |

Boats use **HAE** altitudes (provisional). Drones: `takeoffAMSL + relativeAlt + N` (EGM96).

## Public API

| Symbol | Role |
| --- | --- |
| `loadEgm96` / `ensureEgm96Loaded` / `loadEgm96FromBuffer` | Load `public/EGM96_1deg.bin` (fetch or buffer) |
| `getUndulation` / `amslToHae` / `relativeToHae` | Geoid N and altitude bridges |
| `setOriginHAE` / `setOriginAMSL` / `isOriginValid` | Explicit origin (no Cesium / scene lookup) |
| `onOriginChanged` | Optional change subscription |
| `gpsToEnu` / `gpsToEnuAmsl` / `gpsToEnuRelative` / `gpsToEnuBatch` | GPS → `THREE.Vector3` ENU |
| `applyConfigOrigin` | Apply `{ lat, lon, altMsl }` from config shape (AMSL) |

If origin is unset, `gpsToEnu*` returns `(0,0,0)` and warns (Unity parity). If EGM96 fails to load, undulation is `0`.

## Asset

Static copy: `public/EGM96_1deg.bin` (from Unity `StreamingAssets`, binary copy only).

## Tests

```bash
npm test
```

Vitest runs in Node and loads the bin via `fs` from `public/EGM96_1deg.bin` (no WebGL, no network). Browser runtime uses `fetch('/EGM96_1deg.bin')`.
