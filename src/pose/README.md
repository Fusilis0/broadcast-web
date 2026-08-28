# pose

Owned by **GEO** (+ CAL apply). Telemetry → ENU + CAL offsets → **pose bus** for SCN.

Two clocks, isolated:

| Mode | When | Path |
| --- | --- | --- |
| **Push / lerp** | `arBackground: 'alpha'` (default), or video **connecting** (no presented PTS **and** no picture), **or** video on with **no usable `toNtp`** | Packet → `droneRawPose` / `boatRawPose` → `MidpointLerp` → poseBus. Shipped air plate. LUT-miss free-run (TEL-03). |
| **Matched** | `arBackground: 'video'` **and** a healthy LUT for the active stream | Presented PTS → `getPtsNtpMap(srtId \|\| povId).toNtp` → `+ syncTrimMs` → `sampleAt` → same converters → poseBus. **No lerp.** |
| **Matched hold** | Video NTP within extrapolate + `DEFAULT_HOLD_MS` of the pose buffer | `sampleAt` `held` / `extrapolated`. Mesh stays. **No** lerp toward a newer packet that is still in the future of `t_ntp`. |
| **Degraded newest** | `sampleAt` `unavailable` past the history hold window | Emit the **newest** history sample (do not pin `lastMatched` forever). Mesh stays (TEL-02 no-vanish). Sync HUD `freeRun`. |

`matchClock.enabled` is the gate. Alpha never enters matched sampling, even if anchors are flowing. While telemetry and SRT are flowing, **never freeze the world** on LUT miss (TEL-03; TEL-10 hold-on-miss is void). Match when LUT + `sampleAt` work; otherwise free-run. Unsynced motion is better than a stuck shot.

**“Null telemetry” is not a missing WebSocket.** Packets are ~10 Hz; many video frames have no new pose. `sampleAt` interpolates, then holds (~150 ms extrapolate, then hold), then marks `unavailable` when presented NTP is past the buffer. Matched `emitMatched` **re-emits the last mesh** for short gaps instead of dropping it. After the hold window it emits the **newest** history sample rather than pinning `lastMatched` forever. Flow’s 4 Hz card can still show `telem: null` when no event landed in the last taps; that is not a pose-bus omit. Sync debug `poseMinusVideoMs` (newest − `t_ntp`) is negative when video is ahead of pose; `pacingCount === 0` with a picture means free-run (LUT miss), not a frozen hold and not a dead socket.

LUT lookup tries **SRT id first**, then telemetry `povId`. `onAnchor` aliases `stream_id` into both maps when Fleet has mapped that POV (`getSrtIdForTelemId` / `getTelemIdForSrtId`). Producer `dji-N` / `djiN` (`/^dji-?(\d+)$/i`) also copies the same anchor into the digit LUT (`dji-1` → `"1"`) so Fleet telem/SRT id `"1"` is not an empty map. Matched mode can engage on a **frame-only** LUT: if pacing has fewer than two `dji`/`periodic`/`gopro` samples, `kind:frame` is the OLS series (same 2 s extra); two periodic samples restore today’s split (frame = residual only).

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
| Buoy | same as boat (`boatRawPose`) | **HAE** (boat-shaped telemetry) |
| `stream_anchor` | no ENU; feeds `getPtsNtpMap(stream_id)` | LUT key is **SRT id**, not `povId` |

**No GPS (`lat`/`lon` ≈ 0):** still apply gimbal/rot attitude; hold last ENU (or park at origin + `pos.alt` on first packet). Do not project `0,0` through GEO (would fling the camera).

Declination default `0`. CAL yaw/pitch/roll/alt/FOV come from `src/calibration` store (defaults: angles/alt `0`, FOV `66.8832`) via `applyCalibration` / `applyCalibrationEuler`.

## Config origin

Boot order (see `main.ts`):

1. `loadConfig()` → `public/config.json`
2. `ensureEgm96Loaded()`
3. `applyConfigOrigin(config.origin)`
4. `startTelemetryIngest` + `startPosePipeline({ takeoffAltitudeMSL, history, matchClock })`

Mock-centered origin in `public/config.json`:

```json
{ "lat": 41.0082, "lon": 28.9784, "altMsl": 0 }
```

Near TEL mock tracks so ENU stays local meters (not ~10⁶). Optional `takeoffAltitudeMSL` (default `0`).

## Public API

| Symbol | Role |
| --- | --- |
| `startPosePipeline(options?)` / `stopPosePipeline()` | Subscribe TEL bus, fill history + LUT, RAF lerp **or** matched sample, emit poses |
| `poseBus` | Typed pub-sub |
| `MidpointLerp` | Unity-style start→mid→target (alpha / free-run only) |
| `droneRawPose` / `boatRawPose` | ENU + rotation (+ CAL) before lerp **or** after `sampleAt` |
| `applyCalibration` / `applyCalibrationForDevice` | CAL offsets on ENU pose |

Matched sampling reuses the converters. `boatRawPose` still ignores `spd`; dead reckoning is applied in `telemetryHistory.sampleBoatAt` (DTO lat/lon already projected) so DR reaches ENU without forking GEO.

### Matched clock (`matchClock`)

`t_ntp = toNtp(pts) + syncTrimMs`. Positive trim samples a later world state (overlay leads the video). LUT lookup uses `getLutStreamId(povId)` = SRT id, then falls back to telemetry `povId`. Anchors keyed by producer id still match when the operator mapped that POV to a different SRT id. `newestDroneNtp` on the handle is the matched buffer’s newest drone NTP for OUT’s adaptive presentation policy.

`getSyncPoseDebug` reports `matched` / `held` / `freeRun` plus `tNtpMs`, `newestPoseNtpMs`, `poseMinusVideoMs` (newest − `t_ntp`; negative = video ahead of buffer), and `pacingCount` of the LUT used for that POV. `held` is no longer a LUT-miss freeze (TEL-03). `pacingCount === 0` while video mode is on is **FREE-RUN**. `poseMode: 'held'` is a short `sampleAt` gap, not a frozen world.

POV switch: SCN `setActivePovId` fires `onActivePovChange` so OUT swaps the warm texture and this pipeline `tick(0)` resamples at the new presented PTS + LUT in the same turn.

### `poseBus` event

```ts
poseBus.on('pose', (p: PoseEvent) => { /* SCN draw */ })

type PoseEvent = {
  id: string              // mock drone "1", boat "21", buoy "91"
  kind: 'drone' | 'boat' | 'buoy'
  position: { x, y, z }   // ENU meters
  rotation: { yawDeg, pitchDeg, rollDeg }
  fovHDeg: number         // from CAL offsets (default 66.8832)
  ts: number              // drone ts / boat|buoy time
}
```

Drone rotation: gimbal Euler with Unity DJI pitch/roll negation; yaw = gimbal yaw (absolute); then CAL. Boat / buoy: yaw = `brg` (+ declination 0); then CAL. Buoy uses the same convert path as boat (identical wire shape; no separate drag physics).

## Lerp

Per-entity state keyed by telemetry `id`. Used only on the push path. First packet **snaps**. Later packets: measured interval (smoothed), midpoint at 0.5, animate start→mid→target over the interval on `requestAnimationFrame` (or `handle.tick(dt)` when `manualTick: true`). Matched mode bypasses this — sampling at an explicit NTP and then smoothing toward it would reintroduce the lag the video path removes.

## Out of scope here

SCN meshes, CAL UI / CV writers, TEL live/replay. FOV / distortion alignment (C6) is CAL.
