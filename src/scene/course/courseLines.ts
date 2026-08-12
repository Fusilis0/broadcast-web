import * as THREE from 'three'
import { COURSE_WATER_Y, type CourseLayout } from './courseLayout.ts'
import type { CourseAppearance } from './types.ts'

export type CourseLinesHandle = {
  root: THREE.Group
  dispose: () => void
}

/** Gate tube radius (meters) — readable from free cam / drone without looking like a wall. */
const GATE_TUBE_RADIUS_M = 0.55
/** Slight lift so tubes do not z-fight the water cue. */
const GATE_TUBE_Y = COURSE_WATER_Y + 0.08

function makeBoundaryLine(
  name: string,
  positions: THREE.Vector3[],
  color: number,
): THREE.LineLoop {
  const geom = new THREE.BufferGeometry().setFromPoints(positions)
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthTest: true,
  })
  const line = new THREE.LineLoop(geom, mat)
  line.name = name
  return line
}

/**
 * Horizontal cylinder spanning gate Left→Right on the water plane.
 */
function makeGateTube(
  name: string,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  color: number,
): {
  mesh: THREE.Mesh
  dispose: () => void
} | null {
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz)
  if (len < 1e-3) return null

  const geom = new THREE.CylinderGeometry(
    GATE_TUBE_RADIUS_M,
    GATE_TUBE_RADIUS_M,
    len,
    12,
    1,
    false,
  )
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.08,
    emissive: color,
    emissiveIntensity: 0.12,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.name = name

  // Cylinder default axis = +Y; rotate onto horizontal gate span.
  const midX = (ax + bx) / 2
  const midZ = (az + bz) / 2
  mesh.position.set(midX, GATE_TUBE_Y, midZ)
  const along = new THREE.Vector3(dx, 0, dz).normalize()
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    along,
  )
  mesh.setRotationFromQuaternion(quat)

  return {
    mesh,
    dispose(): void {
      geom.dispose()
      mat.dispose()
    },
  }
}

/**
 * Boundary LineLoop through marks + gate tubes (Unity CourseRenderer spirit, air-readable).
 */
export function createCourseLines(
  layout: CourseLayout,
  appearance: CourseAppearance,
): CourseLinesHandle {
  const root = new THREE.Group()
  root.name = 'courseLines'
  const disposables: Array<() => void> = []

  if (layout.marks.length >= 2) {
    const pts = layout.marks.map(
      (m) => new THREE.Vector3(m.x, COURSE_WATER_Y + 0.05, m.z),
    )
    const boundary = makeBoundaryLine(
      'courseBoundary',
      pts,
      appearance.boundaryColor,
    )
    root.add(boundary)
    const geom = boundary.geometry
    const mat = boundary.material as THREE.Material
    disposables.push(() => {
      geom.dispose()
      mat.dispose()
    })
  }

  for (const gate of layout.gates) {
    const tube = makeGateTube(
      `courseGate_${gate.baseName}`,
      gate.left.x,
      gate.left.z,
      gate.right.x,
      gate.right.z,
      appearance.gateColor,
    )
    if (!tube) continue
    root.add(tube.mesh)
    disposables.push(tube.dispose)
  }

  return {
    root,
    dispose(): void {
      for (const d of disposables) d()
      disposables.length = 0
      root.clear()
    },
  }
}
