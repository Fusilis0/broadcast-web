/**
 * Punch disks in OSM Buildings so hero glTF (DSP-02) will not z-fight.
 * Scene ENU: x = East, z = −North. Does not clip World Terrain or ocean.
 */

import * as THREE from 'three'
import {
  BUILDINGS_SESSION_ENABLED_KEY,
  MAX_OCCUPANCY_HOLES,
  OSM_BUILDINGS_CREDIT_FALLBACK,
} from './constants.ts'

const PATCHED = Symbol('bwBuildingsOccupancyPatch')
const HIDDEN_FLAG = 'bwOccupancyHidden'

export type OccupancyHole = {
  x: number
  z: number
  radiusM: number
}

export type OccupancyUniforms = {
  uOccupancyCount: { value: number }
  uOccupancyHoles: { value: THREE.Vector4[] }
}

export function normalizeOccupancyHole(
  hole: OccupancyHole | null | undefined,
): OccupancyHole | null {
  if (!hole) return null
  const x = hole.x
  const z = hole.z
  const radiusM = hole.radiusM
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radiusM)) {
    return null
  }
  if (radiusM <= 0) return null
  return { x, z, radiusM }
}

export function normalizeOccupancyHoles(
  holes: readonly OccupancyHole[],
): OccupancyHole[] {
  const out: OccupancyHole[] = []
  for (const hole of holes) {
    const n = normalizeOccupancyHole(hole)
    if (!n) continue
    out.push(n)
    if (out.length >= MAX_OCCUPANCY_HOLES) break
  }
  return out
}

/** True when scene-ENU XZ sits inside any occupancy disk. */
export function isEnuXzInOccupancyHole(
  x: number,
  z: number,
  holes: readonly OccupancyHole[],
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false
  for (const hole of normalizeOccupancyHoles(holes)) {
    const dx = x - hole.x
    const dz = z - hole.z
    if (dx * dx + dz * dz <= hole.radiusM * hole.radiusM) return true
  }
  return false
}

export function createOccupancyUniforms(
  holes: readonly OccupancyHole[] = [],
): OccupancyUniforms {
  const slots = Array.from(
    { length: MAX_OCCUPANCY_HOLES },
    () => new THREE.Vector4(0, 0, 0, 0),
  )
  const uniforms: OccupancyUniforms = {
    uOccupancyCount: { value: 0 },
    uOccupancyHoles: { value: slots },
  }
  writeOccupancyUniforms(uniforms, holes)
  return uniforms
}

export function writeOccupancyUniforms(
  uniforms: OccupancyUniforms,
  holes: readonly OccupancyHole[],
): void {
  const normalized = normalizeOccupancyHoles(holes)
  uniforms.uOccupancyCount.value = normalized.length
  const slots = uniforms.uOccupancyHoles.value
  for (let i = 0; i < MAX_OCCUPANCY_HOLES; i++) {
    const slot = slots[i]
    const hole = normalized[i]
    if (!slot) continue
    if (!hole) {
      slot.set(0, 0, 0, 0)
      continue
    }
    slot.set(hole.x, hole.z, hole.radiusM, 0)
  }
}

function isPatched(
  material: THREE.Material,
): material is THREE.Material & { [PATCHED]: true } {
  return (material as { [PATCHED]?: boolean })[PATCHED] === true
}

/**
 * Discard fragments whose world XZ falls inside an occupancy disk.
 * Chains any existing `onBeforeCompile` (fade wraps first).
 * No-op when hole count is 0 — empty uniforms must not wrap fade shaders.
 */
export function patchOccupancyMaterial(
  material: THREE.Material,
  uniforms: OccupancyUniforms,
): void {
  if (uniforms.uOccupancyCount.value < 0.5) return
  if (isPatched(material)) return
  ;(material as THREE.Material & { [PATCHED]: true })[PATCHED] = true

  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer)
    shader.uniforms['uOccupancyCount'] = uniforms.uOccupancyCount
    shader.uniforms['uOccupancyHoles'] = uniforms.uOccupancyHoles

    shader.vertexShader =
      'varying vec2 vOccupancyXz;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vOccupancyXz = (modelMatrix * vec4(transformed, 1.0)).xz;`,
      )

    shader.fragmentShader =
      'varying vec2 vOccupancyXz;\n' +
      'uniform float uOccupancyCount;\n' +
      `uniform vec4 uOccupancyHoles[${MAX_OCCUPANCY_HOLES}];\n` +
      shader.fragmentShader.replace(
        /void\s+main\s*\(\s*\)\s*\{/,
        (match) => `${match}
          if (uOccupancyCount > 0.5) {
            for (int i = 0; i < ${MAX_OCCUPANCY_HOLES}; i++) {
              float active = step(float(i) + 0.5, uOccupancyCount);
              vec2 d = vOccupancyXz - uOccupancyHoles[i].xy;
              float r = uOccupancyHoles[i].z;
              if (active > 0.5 && dot(d, d) <= r * r) discard;
            }
          }`,
      )
  }
  material.needsUpdate = true
}

export function patchOccupancyMaterials(
  root: THREE.Object3D,
  uniforms: OccupancyUniforms,
): void {
  if (uniforms.uOccupancyCount.value < 0.5) return
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (mat) patchOccupancyMaterial(mat, uniforms)
    }
  })
}

const _worldCenter = new THREE.Vector3()
const _worldScale = new THREE.Vector3()

/** True when the mesh bounding-sphere XZ is fully inside a hole disk. */
export function meshFullyInsideOccupancyHole(
  mesh: THREE.Mesh,
  holes: readonly OccupancyHole[],
): boolean {
  const normalized = normalizeOccupancyHoles(holes)
  if (normalized.length === 0) return false
  const geom = mesh.geometry
  if (!geom) return false
  if (!geom.boundingSphere) geom.computeBoundingSphere()
  const sphere = geom.boundingSphere
  if (!sphere) {
    mesh.getWorldPosition(_worldCenter)
    return isEnuXzInOccupancyHole(_worldCenter.x, _worldCenter.z, normalized)
  }
  _worldCenter.copy(sphere.center)
  mesh.localToWorld(_worldCenter)
  mesh.getWorldScale(_worldScale)
  const radius =
    sphere.radius * Math.max(_worldScale.x, _worldScale.y, _worldScale.z)
  for (const hole of normalized) {
    const dx = _worldCenter.x - hole.x
    const dz = _worldCenter.z - hole.z
    const dist = Math.hypot(dx, dz)
    if (dist + radius <= hole.radiusM) return true
  }
  return false
}

function restoreOccupancyHidden(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const data = mesh.userData as Record<string, unknown>
    if (data[HIDDEN_FLAG] === undefined) return
    mesh.visible = data[HIDDEN_FLAG] === true
    delete data[HIDDEN_FLAG]
  })
}

/**
 * Hide meshes whose XZ extent sits fully inside a hole; restore when holes
 * no longer contain them. Fragment discard still clips partial overlap.
 * Empty holes: restore only — do not hide the city.
 */
export function applyOccupancyMeshHide(
  root: THREE.Object3D,
  holes: readonly OccupancyHole[],
): void {
  const normalized = normalizeOccupancyHoles(holes)
  if (normalized.length === 0) {
    restoreOccupancyHidden(root)
    return
  }
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const hide = meshFullyInsideOccupancyHole(mesh, normalized)
    const data = mesh.userData as Record<string, unknown>
    if (hide) {
      if (data[HIDDEN_FLAG] === undefined) {
        data[HIDDEN_FLAG] = mesh.visible
      }
      mesh.visible = false
      return
    }
    if (data[HIDDEN_FLAG] !== undefined) {
      mesh.visible = data[HIDDEN_FLAG] === true
      delete data[HIDDEN_FLAG]
    }
  })
}

export function sceneFromLoadModelEvent(event: unknown): THREE.Object3D | null {
  if (!event || typeof event !== 'object' || !('scene' in event)) return null
  const scene = (event as { scene?: unknown }).scene
  return scene instanceof THREE.Object3D ? scene : null
}

export function withOsmCreditFallback(lines: readonly string[]): string[] {
  const hasOsm = lines.some(
    (line) =>
      /openstreetmap/i.test(line) || /\bosm\b/i.test(line) || /©\s*osm/i.test(line),
  )
  if (hasOsm) return [...lines]
  return [...lines, OSM_BUILDINGS_CREDIT_FALLBACK]
}

export function readSessionBuildingsEnabled(
  fallback = true,
): boolean {
  try {
    const raw = sessionStorage.getItem(BUILDINGS_SESSION_ENABLED_KEY)
    if (raw === null || raw === '') return fallback
    return raw !== '0'
  } catch {
    return fallback
  }
}

export function writeSessionBuildingsEnabled(enabled: boolean): void {
  try {
    sessionStorage.setItem(
      BUILDINGS_SESSION_ENABLED_KEY,
      enabled ? '1' : '0',
    )
  } catch {
    // sessionStorage may be blocked
  }
}
