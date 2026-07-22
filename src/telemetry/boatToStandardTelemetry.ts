import type { BoatTelemetry, TelemetryData } from './types.ts'

/**
 * Maps boat GPS JSON into a `TelemetryData`-shaped object.
 * Mirrors Unity `BoatTelemetry.ToStandardTelemetry` — pure field copy, no ENU.
 */
export function boatToStandardTelemetry(boat: BoatTelemetry): TelemetryData {
  return {
    ts: boat.time,
    seq: 0,
    id: boat.id,
    ntp_synced: boat.t_sync,
    ntp_err_ms: boat.t_err,
    pos: {
      lat: boat.lat,
      lon: boat.lon,
      alt: boat.alt,
    },
    rot: { x: 0, y: 0, z: 0, w: 1, yaw: 0, pitch: 0, roll: 0 },
    gimbal: { x: 0, y: 0, z: 0, w: 1, yaw: 0, pitch: 0, roll: 0 },
    vel: { x: 0, y: 0, z: 0 },
    cam: { fov: 0 },
    meta: { bat: 0, sat: 0, sig: 0 },
  }
}
