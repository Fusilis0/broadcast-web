import * as THREE from 'three'
import {
  LINE_SIGN_BAND_DEPTH_M,
  LINE_SIGN_WATER_Y,
  LINE_SIGN_Y_OFFSET,
} from './lineSignLayout.ts'
import type { LineSignEnu } from './types.ts'

export type LineSignHandle = {
  root: THREE.Mesh
  dispose: () => void
}

function hexToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * Flat water-band texture matching Unity Start/Finish canvases
 * (red italic label + thin underline bar).
 */
export function createLineSignTexture(
  label: string,
  color: number,
): THREE.CanvasTexture {
  const w = 1024
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, w, h)

    const css = hexToCss(color)
    // Underline bar (Unity Background ~6px on 30-tall canvas)
    const barH = Math.round(h * 0.14)
    ctx.fillStyle = css
    ctx.fillRect(0, h - barH - 8, w, barH)

    ctx.fillStyle = css
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic 900 140px "Segoe UI", system-ui, sans-serif'
    ctx.fillText(label, w / 2, h * 0.42)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * Horizontal water-plane sign spanning A–B (Unity Start/Finish spirit).
 * Plane faces +Y (readable from drone / free cam above).
 */
export function createLineSignMesh(sign: LineSignEnu): LineSignHandle {
  const along = new THREE.Vector3(sign.bx - sign.ax, 0, sign.bz - sign.az)
  if (along.lengthSq() < 1e-8) {
    throw new Error(`[lineSigns] degenerate span for ${sign.id}`)
  }
  along.normalize()
  const up = new THREE.Vector3(0, 1, 0)
  // Across on water = up × along so local Y of PlaneGeometry lies on water.
  const across = new THREE.Vector3().crossVectors(up, along).normalize()

  const map = createLineSignTexture(sign.label, sign.color)
  const geo = new THREE.PlaneGeometry(sign.widthM, LINE_SIGN_BAND_DEPTH_M)
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = `lineSign:${sign.kind}:${sign.id}`

  // PlaneGeometry in XY, normal +Z → map X=along, Y=across, Z=up (face sky).
  const m = new THREE.Matrix4().makeBasis(along, across, up)
  mesh.quaternion.setFromRotationMatrix(m)
  mesh.position.set(
    sign.midX,
    LINE_SIGN_WATER_Y + LINE_SIGN_Y_OFFSET,
    sign.midZ,
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
