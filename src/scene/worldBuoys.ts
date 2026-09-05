import * as THREE from 'three'
import { gpsToEnuAmsl } from '../geodesy/index.ts'
import {
  createBuoyMarkers,
  type BuoyMarkersHandle,
} from './course/buoyMarkers.ts'
import {
  DEFAULT_COURSE_APPEARANCE,
  type CourseAppearance,
  type CourseEnuPoint,
} from './course/index.ts'
import { layoutFeatures } from './features/layoutFeatures.ts'
import type { GpsToEnuAmslFn, WorldFeature } from './features/types.ts'

export type WorldBuoysHandle = {
  root: THREE.Group
  dispose: () => void
}

/**
 * Mount free-floating `type: 'buoy'` WorldFeatures (not course marks/gates).
 * Reuses the racing-mark buoy prop from world-3D polish.
 */
export function mountWorldBuoys(
  scene: THREE.Scene,
  features: readonly WorldFeature[],
  convert: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
  appearance: CourseAppearance = DEFAULT_COURSE_APPEARANCE,
): WorldBuoysHandle | null {
  const buoys = features.filter((f) => f.type === 'buoy' && f.points.length >= 1)
  if (buoys.length === 0) return null

  const layout = layoutFeatures(buoys, convert)
  const points: CourseEnuPoint[] = []
  for (const f of layout) {
    const p = f.points[0]
    if (!p) continue
    const point: CourseEnuPoint = {
      name: f.telemetryId ? `${f.name}·${f.telemetryId}` : f.name,
      type: 'mark',
      x: p.x,
      y: p.y,
      z: p.z,
    }
    if (f.rounding !== undefined) point.rounding = f.rounding
    if (f.visibleBuoyMesh !== undefined) point.visibleBuoyMesh = f.visibleBuoyMesh
    if (f.visibleTag !== undefined) point.visibleTag = f.visibleTag
    points.push(point)
  }

  if (points.length === 0) return null

  const handle: BuoyMarkersHandle = createBuoyMarkers(points, appearance)
  handle.root.name = 'worldBuoys'
  scene.add(handle.root)
  return {
    root: handle.root,
    dispose: () => handle.dispose(),
  }
}
