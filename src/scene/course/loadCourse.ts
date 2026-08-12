import * as THREE from 'three'
import { gpsToEnuAmsl } from '../../geodesy/index.ts'
import { adaptCourseToFeatures } from '../features/adapters.ts'
import type { WorldFeature } from '../features/types.ts'
import { createBuoyMarkers, type BuoyMarkersHandle } from './buoyMarkers.ts'
import { buildCourseLayout } from './courseLayout.ts'
import { createCourseLines, type CourseLinesHandle } from './courseLines.ts'
import { normalizeCourse } from './normalizeCourse.ts'
import {
  createWaterShoreCue,
  type WaterShoreCueHandle,
} from './waterCue.ts'
import type {
  CourseAppearance,
  CourseData,
  CourseEnuPoint,
  GpsToEnuAmslFn,
} from './types.ts'

export const DEFAULT_COURSE_URL = '/fixtures/course/demo-istanbul.json'

export type CourseHandle = {
  root: THREE.Group
  /** Marks + gate ends at water Y (for 2D map overlay). */
  mapPoints: readonly CourseEnuPoint[]
  /** GPS-space features for shared layout (pre-GEO). */
  worldFeatures: readonly WorldFeature[]
  /** Normalized appearance (editor remount). */
  appearance: CourseAppearance
  dispose: () => void
}

export type LoadCourseOptions = {
  scene: THREE.Scene
  url?: string
  /** Override GEO convert (tests). Default: `gpsToEnuAmsl`. */
  gpsToEnuAmsl?: GpsToEnuAmslFn
}

/**
 * Fetch course JSON, convert via GEO, add boundary/gates/buoys to the scene.
 * Call only after `applyConfigOrigin` + EGM96 are ready.
 */
export async function loadCourse(
  options: LoadCourseOptions,
): Promise<CourseHandle | null> {
  const url = options.url?.trim() || DEFAULT_COURSE_URL
  let raw: unknown
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[course] failed to load ${url}: HTTP ${res.status}`)
      return null
    }
    raw = await res.json()
  } catch (err) {
    console.warn(`[course] failed to load ${url}`, err)
    return null
  }

  const course = normalizeCourse(raw)
  if (course.waypoints.length === 0) {
    console.warn(`[course] no valid waypoints in ${url}`)
    return null
  }

  return mountCourse(options.scene, course, options.gpsToEnuAmsl)
}

/** Build course meshes from already-normalized data (tests / sync path). */
export function mountCourse(
  scene: THREE.Scene,
  course: CourseData,
  convert: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
): CourseHandle {
  const layout = buildCourseLayout(course, convert)
  const root = new THREE.Group()
  root.name = 'course'

  // Water/shore pad first (renderOrder low) so buoys/gates sit on top.
  const cuePoints = layout.points.map((p) => ({ x: p.x, z: p.z }))
  let waterCue: WaterShoreCueHandle | null = createWaterShoreCue(cuePoints)
  if (waterCue) root.add(waterCue.root)

  let lines: CourseLinesHandle | null = createCourseLines(
    layout,
    course.appearance,
  )
  root.add(lines.root)

  // Buoys at marks and gate ends.
  const buoyPoints = [
    ...layout.marks,
    ...layout.gates.flatMap((g) => [g.left, g.right]),
  ]
  let buoys: BuoyMarkersHandle | null = createBuoyMarkers(
    buoyPoints,
    course.appearance,
  )
  root.add(buoys.root)

  scene.add(root)

  return {
    root,
    mapPoints: buoyPoints,
    worldFeatures: adaptCourseToFeatures(course),
    appearance: { ...course.appearance },
    dispose(): void {
      scene.remove(root)
      waterCue?.dispose()
      waterCue = null
      lines?.dispose()
      lines = null
      buoys?.dispose()
      buoys = null
      root.clear()
    },
  }
}
