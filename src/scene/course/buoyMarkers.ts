import * as THREE from 'three'
import type { CourseAppearance, CourseEnuPoint } from './types.ts'
import { COURSE_WATER_Y } from './courseLayout.ts'

export type BuoyMarkersHandle = {
  root: THREE.Group
  dispose: () => void
}

const LABEL_CANVAS_W = 256
const LABEL_CANVAS_H = 64
const LABEL_ASPECT = LABEL_CANVAS_W / LABEL_CANVAS_H

function drawBuoyLabel(canvas: HTMLCanvasElement, name: string): void {
  canvas.width = LABEL_CANVAS_W
  canvas.height = LABEL_CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, LABEL_CANVAS_W, LABEL_CANVAS_H)
  ctx.fillStyle = 'rgba(12, 16, 22, 0.7)'
  ctx.fillRect(4, 8, LABEL_CANVAS_W - 8, LABEL_CANVAS_H - 16)
  ctx.fillStyle = '#f5f2ea'
  ctx.font = '600 28px "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, LABEL_CANVAS_W / 2, LABEL_CANVAS_H / 2, LABEL_CANVAS_W - 24)
}

function createBuoyPole(
  point: CourseEnuPoint,
  appearance: CourseAppearance,
): {
  root: THREE.Group
  dispose: () => void
} {
  const height = appearance.buoyHeightM
  const radius = height * 0.12
  const group = new THREE.Group()
  group.name = `buoy_${point.name}`
  group.position.set(point.x, COURSE_WATER_Y, point.z)

  const geom = new THREE.CylinderGeometry(radius, radius * 1.15, height, 10)
  const mat = new THREE.MeshStandardMaterial({
    color: appearance.buoyColor,
    roughness: 0.55,
    metalness: 0.05,
  })
  const pole = new THREE.Mesh(geom, mat)
  pole.name = 'buoyPole'
  // Cylinder centered on origin → lift so base sits on water.
  pole.position.y = height / 2
  group.add(pole)

  const canvas = document.createElement('canvas')
  drawBuoyLabel(canvas, point.name)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.needsUpdate = true
  const spriteMat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(spriteMat)
  sprite.name = 'buoyLabel'
  sprite.position.set(0, height + 1.5, 0)
  const labelH = 2.2
  sprite.scale.set(labelH * LABEL_ASPECT, labelH, 1)
  group.add(sprite)

  return {
    root: group,
    dispose(): void {
      geom.dispose()
      mat.dispose()
      map.dispose()
      spriteMat.dispose()
    },
  }
}

/**
 * Yellow poles + stub name sprites at marks and gate ends (visible for web ops).
 */
export function createBuoyMarkers(
  points: readonly CourseEnuPoint[],
  appearance: CourseAppearance,
): BuoyMarkersHandle {
  const root = new THREE.Group()
  root.name = 'buoyMarkers'
  const disposers: Array<() => void> = []

  // Dedupe by rounded ENU so gate ends that coincide with marks get one pole.
  const seen = new Set<string>()
  for (const p of points) {
    const key = `${p.x.toFixed(2)},${p.z.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    const buoy = createBuoyPole(p, appearance)
    root.add(buoy.root)
    disposers.push(buoy.dispose)
  }

  return {
    root,
    dispose(): void {
      for (const d of disposers) d()
      disposers.length = 0
      root.clear()
    },
  }
}
