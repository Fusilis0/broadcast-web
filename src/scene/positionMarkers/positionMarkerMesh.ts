import * as THREE from 'three'
import {
  POSITION_MARKER_WATER_Y,
  POSITION_MARKER_Y_OFFSET,
} from './positionMarkerLayout.ts'
import type { PositionMarkerEnu } from './types.ts'

export type PositionMarkerHandle = {
  root: THREE.Mesh
  dispose: () => void
}

function hexToRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}

/** Semi-transparent water number — Unity Distances TMP spirit. */
export function createPositionMarkerTexture(
  label: string,
  color: number,
): THREE.CanvasTexture {
  const w = 256
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = hexToRgba(color, 0.48)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const fontSize = Math.min(96, Math.floor(220 / Math.max(label.length * 0.45, 1)))
    ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`
    ctx.fillText(label, w / 2, h / 2)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export function createPositionMarkerMesh(
  marker: PositionMarkerEnu,
): PositionMarkerHandle {
  const map = createPositionMarkerTexture(marker.label, marker.color)
  const geo = new THREE.PlaneGeometry(marker.sizeM, marker.sizeM)
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = `positionMarker:${marker.id}`
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(
    marker.x,
    POSITION_MARKER_WATER_Y + POSITION_MARKER_Y_OFFSET,
    marker.z,
  )

  return {
    root: mesh,
    dispose(): void {
      geo.dispose()
      mat.dispose()
      map.dispose()
    },
  }
}
