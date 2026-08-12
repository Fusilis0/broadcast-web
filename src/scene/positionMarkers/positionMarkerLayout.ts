import type {
  GpsToEnuAmslFn,
  PositionMarkerEnu,
  PositionMarkersData,
} from './types.ts'

/** Water-plane Y for distance labels (Unity Distances canvas). */
export const POSITION_MARKER_WATER_Y = 0
export const POSITION_MARKER_Y_OFFSET = 0.06

export function buildPositionMarkerLayout(
  data: PositionMarkersData,
  gpsToEnuAmsl: GpsToEnuAmslFn,
): PositionMarkerEnu[] {
  return data.markers.map((m) => {
    const p = gpsToEnuAmsl(m.point.lat, m.point.lon, m.point.altMsl)
    return {
      id: m.id,
      label: m.label,
      color: m.color,
      sizeM: m.sizeM,
      x: p.x,
      z: p.z,
    }
  })
}
