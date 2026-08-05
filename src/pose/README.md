# pose

Owned by **GEO** (+ CAL apply). Telemetry → ENU + CAL offsets + midpoint lerp → **pose bus** for SCN.

No Three meshes / scene graph in this module.

## Axis contract

| Axis | Direction |
| --- | --- |
| `x` | East |
| `y` | Up |
| `z` | North |

## Altitude rules (Unity parity)

| Kind | Function | Altitude |
| --- | --- | --- |
| Drone | `gpsToEnuRelative(lat, lon, pos.alt, takeoffAltitudeMSL)` | Relative + takeoff AMSL + EGM96 |
| Boat | `gpsToEnu(lat, lon, alt)` | **HAE** (not AMSL) |
| `stream_anchor` | ignored | no ENU |

**No GPS (`lat`/`lon` ≈ 0):** still apply gimbal/rot attitude; hold last ENU (or park at origin + `pos.alt` on first packet). Do not project `0,0` through GEO (would fling the camera).

Declination default `0`. CAL yaw/pitch/roll/alt/FOV come from `src/calibration` store (defaults: angles/alt `0`, FOV `66.8832`) via `applyCalibration` / `applyCalibrationEuler`.

## Config origin

Boot order (see `main.ts`):

1. `loadConfig()` → `public/config.json`
2. `ensureEgm96Loaded()`
3. `applyConfigOrigin(config.origin)`
4. `startTelemetryIngest` + `startPosePipeline({ takeoffAltitudeMSL })`

Mock-centered origin in `public/config.json`:

```json
{ "lat": 41.0082, "lon": 28.9784, "altMsl": 0 }
```

Near TEL mock tracks so ENU stays local meters (not ~10⁶). Optional `takeoffAltitudeMSL` (default `0`).

## Public API

| Symbol | Role |
| --- | --- |
| `startPosePipeline(options?)` / `stopPosePipeline()` | Subscribe TEL bus, RAF lerp, emit poses |
| `poseBus` | Typed pub-sub |
| `MidpointLerp` | Unity-style start→mid→target (testable) |
| `droneRawPose` / `boatRawPose` | ENU + rotation (+ CAL) before lerp |
| `applyCalibration` / `applyCalibrationForDevice` | CAL offsets on ENU pose |

### `poseBus` event

```ts
poseBus.on('pose', (p: PoseEvent) => { /* SCN draw */ })

type PoseEvent = {
  id: string              // mock drone "1", boat "21"
  kind: 'drone' | 'boat'
  position: { x, y, z }   // ENU meters
  rotation: { yawDeg, pitchDeg, rollDeg }
  fovHDeg: number         // from CAL offsets (default 66.8832)
  ts: number              // drone ts / boat time
}
```

Drone rotation: gimbal Euler with Unity DJI pitch/roll negation; yaw = gimbal yaw (absolute); then CAL. Boat: yaw = `brg` (+ declination 0); then CAL.

## Lerp

Per-entity state keyed by telemetry `id`. First packet **snaps**. Later packets: measured interval (smoothed), midpoint at 0.5, animate start→mid→target over the interval on `requestAnimationFrame` (or `handle.tick(dt)` when `manualTick: true`).

## Out of scope here

SCN meshes, CAL UI / CV writers, TEL live/replay.
