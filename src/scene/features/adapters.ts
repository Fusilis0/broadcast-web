import type { CourseData } from '../course/types.ts'
import type { CountdownFlagsData } from '../flags/types.ts'
import type { SponsorsData } from '../sponsors/types.ts'
import type { WorldFeature } from './types.ts'

/**
 * Adapt normalized course waypoints → shared WorldFeature list.
 * Gate left/right stay separate; map/3D pair by name prefix (Unity style).
 */
export function adaptCourseToFeatures(course: CourseData): WorldFeature[] {
  return course.waypoints.map((wp) => {
    const isGate = wp.type === 'gateLeft' || wp.type === 'gateRight'
    return {
      id: `course:${wp.name}`,
      name: wp.name,
      type: wp.type,
      points: [{ lat: wp.lat, lon: wp.lon, altMsl: wp.altMsl }],
      heightM: course.appearance.buoyHeightM,
      color: isGate
        ? course.appearance.gateColor
        : course.appearance.buoyColor,
    }
  })
}

/** Adapt normalized sponsors → A–B WorldFeature entries. */
export function adaptSponsorsToFeatures(data: SponsorsData): WorldFeature[] {
  return data.sponsors.map((sp) => ({
    id: `sponsor:${sp.id}`,
    name: sp.id,
    type: 'sponsor' as const,
    points: [
      { lat: sp.a.lat, lon: sp.a.lon, altMsl: sp.a.altMsl },
      { lat: sp.b.lat, lon: sp.b.lon, altMsl: sp.b.altMsl },
    ],
    heightM: sp.heightM,
    color: sp.color,
    label: sp.label,
    textureUrl: sp.textureUrl,
  }))
}

/** Adapt countdown-flags fixture → flagP1 + flagP2 features. */
export function adaptFlagsToFeatures(data: CountdownFlagsData): WorldFeature[] {
  const base = data.name || 'flags'
  return [
    {
      id: `flags:${base}:p1`,
      name: `${base}-P1`,
      type: 'flagP1',
      points: [
        {
          lat: data.point1.lat,
          lon: data.point1.lon,
          altMsl: data.point1.altMsl,
        },
      ],
      heightM: data.poleHeightM,
      label: 'P1',
    },
    {
      id: `flags:${base}:p2`,
      name: `${base}-P2`,
      type: 'flagP2',
      points: [
        {
          lat: data.point2.lat,
          lon: data.point2.lon,
          altMsl: data.point2.altMsl,
        },
      ],
      heightM: data.poleHeightM,
      label: 'P2',
    },
  ]
}
