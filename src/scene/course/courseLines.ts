import * as THREE from 'three'
import { COURSE_WATER_Y, type CourseLayout } from './courseLayout.ts'
import type { CourseAppearance } from './types.ts'

export type CourseLinesHandle = {
  root: THREE.Group
  dispose: () => void
}

function makeLine(
  name: string,
  positions: THREE.Vector3[],
  color: number,
  closed: boolean,
): THREE.Line {
  const geom = new THREE.BufferGeometry().setFromPoints(positions)
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
  })
  const line = closed
    ? new THREE.LineLoop(geom, mat)
    : new THREE.Line(geom, mat)
  line.name = name
  return line
}

/**
 * Boundary LineLoop through marks + gate segments (Unity CourseRenderer spirit).
 */
export function createCourseLines(
  layout: CourseLayout,
  appearance: CourseAppearance,
): CourseLinesHandle {
  const root = new THREE.Group()
  root.name = 'courseLines'
  const disposables: Array<{ geom: THREE.BufferGeometry; mat: THREE.Material }> =
    []

  if (layout.marks.length >= 2) {
    const pts = layout.marks.map(
      (m) => new THREE.Vector3(m.x, COURSE_WATER_Y, m.z),
    )
    const boundary = makeLine(
      'courseBoundary',
      pts,
      appearance.boundaryColor,
      true,
    )
    root.add(boundary)
    disposables.push({
      geom: boundary.geometry,
      mat: boundary.material as THREE.Material,
    })
  }

  for (const gate of layout.gates) {
    const pts = [
      new THREE.Vector3(gate.left.x, COURSE_WATER_Y, gate.left.z),
      new THREE.Vector3(gate.right.x, COURSE_WATER_Y, gate.right.z),
    ]
    const gateLine = makeLine(
      `courseGate_${gate.baseName}`,
      pts,
      appearance.gateColor,
      false,
    )
    root.add(gateLine)
    disposables.push({
      geom: gateLine.geometry,
      mat: gateLine.material as THREE.Material,
    })
  }

  return {
    root,
    dispose(): void {
      for (const d of disposables) {
        d.geom.dispose()
        d.mat.dispose()
      }
      disposables.length = 0
      root.clear()
    },
  }
}
