import type {
  CourseAppearance,
  CourseData,
  CourseWaypoint,
  CourseWaypointType,
} from './types.ts'

/** Unity-style defaults: orange boundary, green gate, yellow buoy. */
export const DEFAULT_COURSE_APPEARANCE: CourseAppearance = {
  boundaryColor: 0xffb200,
  gateColor: 0x00ff80,
  buoyColor: 0xffdd33,
  buoyHeightM: 5,
}

const WAYPOINT_TYPES = new Set<CourseWaypointType>([
  'mark',
  'gateLeft',
  'gateRight',
])

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseHexColor(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const s = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return Number.parseInt(s.slice(1), 16)
  if (/^0x[0-9a-fA-F]{6}$/i.test(s)) return Number.parseInt(s.slice(2), 16)
  return fallback
}

function parseWaypoint(raw: unknown): CourseWaypoint | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const type = o.type
  if (
    name === '' ||
    typeof type !== 'string' ||
    !WAYPOINT_TYPES.has(type as CourseWaypointType)
  ) {
    return null
  }
  if (!isFiniteNumber(o.lat) || !isFiniteNumber(o.lon)) return null
  return {
    name,
    type: type as CourseWaypointType,
    lat: o.lat,
    lon: o.lon,
    altMsl: isFiniteNumber(o.altMsl) ? o.altMsl : 0,
  }
}

function parseAppearance(raw: unknown): CourseAppearance {
  if (raw === null || typeof raw !== 'object') {
    return { ...DEFAULT_COURSE_APPEARANCE }
  }
  const o = raw as Record<string, unknown>
  return {
    boundaryColor: parseHexColor(
      o.boundaryColor,
      DEFAULT_COURSE_APPEARANCE.boundaryColor,
    ),
    gateColor: parseHexColor(o.gateColor, DEFAULT_COURSE_APPEARANCE.gateColor),
    buoyColor: parseHexColor(o.buoyColor, DEFAULT_COURSE_APPEARANCE.buoyColor),
    buoyHeightM: isFiniteNumber(o.buoyHeightM)
      ? Math.max(o.buoyHeightM, 0.5)
      : DEFAULT_COURSE_APPEARANCE.buoyHeightM,
  }
}

/**
 * Normalize parsed course JSON. Invalid waypoints dropped; empty waypoints → empty course.
 */
export function normalizeCourse(raw: unknown): CourseData {
  if (raw === null || typeof raw !== 'object') {
    return {
      name: '',
      waypoints: [],
      appearance: { ...DEFAULT_COURSE_APPEARANCE },
    }
  }
  const o = raw as Record<string, unknown>
  const waypoints: CourseWaypoint[] = []
  if (Array.isArray(o.waypoints)) {
    for (const item of o.waypoints) {
      const wp = parseWaypoint(item)
      if (wp) waypoints.push(wp)
    }
  }
  return {
    name: typeof o.name === 'string' ? o.name.trim() : '',
    waypoints,
    appearance: parseAppearance(o.appearance),
  }
}
