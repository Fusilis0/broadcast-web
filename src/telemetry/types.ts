/** Wire DTOs matching Unity `TelemetryData` / `BoatTelemetry` / `StreamAnchorMessage`. */

export type TelemetryPosition = {
  lat: number
  lon: number
  alt: number
}

/** Quaternion `x/y/z/w` plus Euler `yaw/pitch/roll` (Android / Unity sender shape). */
export type TelemetryQuaternion = {
  x: number
  y: number
  z: number
  w: number
  yaw: number
  pitch: number
  roll: number
}

export type TelemetryVelocity = {
  x: number
  y: number
  z: number
}

export type TelemetryCamera = {
  fov: number
}

export type TelemetryMetadata = {
  bat: number
  sat: number
  sig: number
}

/** Drone / camera pose packet (Unity `TelemetryData` wire fields). */
export type TelemetryData = {
  ts: number
  seq: number
  id: string
  ntp_synced: boolean
  ntp_err_ms: number
  pos: TelemetryPosition
  rot: TelemetryQuaternion
  gimbal: TelemetryQuaternion
  vel: TelemetryVelocity
  cam: TelemetryCamera
  meta: TelemetryMetadata
}

/** Boat GPS packet (Unity `BoatTelemetry`). */
export type BoatTelemetry = {
  lat: number
  lon: number
  alt: number
  acc: number
  spd: number
  brg: number
  time: number
  id: string
  t_sync: boolean
  t_err: number
}

/** Unity `StreamAnchorMessage` — classify via `type === "stream_anchor"`. */
export type StreamAnchorMessage = {
  type: string
  stream_id: string
  kind: string
  fps: number
  pts_basis_90khz?: number | null
  pts_90khz?: number | null
  ntp_capture_ms: number
  ntp_synced: boolean
  ntp_err_ms: number
}

export type TelemetryMode = 'mock' | 'replay' | 'live'
