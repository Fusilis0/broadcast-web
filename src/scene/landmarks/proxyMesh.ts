import * as THREE from 'three'
import { LANDMARK_AUTHORED_UNIT_M } from './constants.ts'
import type { LandmarkEntry } from './types.ts'

function hexCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function createNameSprite(label: string, color: number): THREE.Sprite | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = 'rgba(12, 16, 22, 0.78)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = hexCss(color)
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  ctx.fillStyle = '#f4f1ea'
  ctx.font = 'bold 42px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 32)
  const map = new THREE.CanvasTexture(canvas)
  map.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map,
    depthTest: true,
    sizeAttenuation: true,
    fog: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = 'landmarkName'
  sprite.scale.set(28, 7, 1)
  return sprite
}

/**
 * Named proxy box in metres (1 unit = 1 m). Distinct colour per catalogue id.
 * Base sits at local origin so the group can be placed at GEO ENU.
 */
export function createLandmarkProxy(entry: LandmarkEntry): THREE.Group {
  const group = new THREE.Group()
  group.name = `landmarkProxy:${entry.id}`
  const sx = entry.proxySizeM.x * LANDMARK_AUTHORED_UNIT_M
  const sy = entry.proxySizeM.y * LANDMARK_AUTHORED_UNIT_M
  const sz = entry.proxySizeM.z * LANDMARK_AUTHORED_UNIT_M
  const geometry = new THREE.BoxGeometry(sx, sy, sz)
  const material = new THREE.MeshStandardMaterial({
    color: entry.proxyColor,
    roughness: 0.72,
    metalness: 0.04,
    emissive: new THREE.Color(entry.proxyColor),
    emissiveIntensity: 0.18,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = `landmarkBox:${entry.id}`
  mesh.position.y = sy / 2
  mesh.castShadow = false
  mesh.receiveShadow = false
  group.add(mesh)

  const sprite = createNameSprite(entry.displayName, entry.proxyColor)
  if (sprite) {
    sprite.position.y = sy + 8
    group.add(sprite)
  }
  return group
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) {
      mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        if (!mat) continue
        const map = (mat as THREE.MeshStandardMaterial).map
        if (map) map.dispose()
        mat.dispose()
      }
    }
    const sprite = obj as THREE.Sprite
    if (sprite.isSprite) {
      const mat = sprite.material
      mat.map?.dispose()
      mat.dispose()
    }
  })
}
