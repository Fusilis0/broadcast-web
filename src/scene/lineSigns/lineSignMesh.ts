import * as THREE from 'three'
import { applyFlatOnWaterPlacement } from '../waterPlanePlacement.ts'
import { LINE_SIGN_BAND_DEPTH_M } from './lineSignLayout.ts'
import type { LineSignEnu } from './types.ts'

export type LineSignHandle = {
  root: THREE.Mesh
  dispose: () => void
}

function hexToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Canvas stroke for the A–B start/finish LINE (above the letters). */
export const LINE_SIGN_STROKE_PX = 22

/**
 * Flat water-band texture: full-width start/finish LINE with italic letters
 * below it. Do not glyph-crop — A–B span is the line, not the letter box.
 * Water still shows through (no solid plate).
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
    const lineY = h * 0.34
    ctx.strokeStyle = css
    ctx.lineWidth = LINE_SIGN_STROKE_PX
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(0, lineY)
    ctx.lineTo(w, lineY)
    ctx.stroke()

    ctx.fillStyle = css
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic 900 140px "Segoe UI", system-ui, sans-serif'
    ctx.fillText(label, w / 2, h * 0.68)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

/**
 * Horizontal water-plane sign spanning A–B (Unity Start/Finish spirit).
 * Plane faces +Y (readable from drone / free cam above).
 */
export function createLineSignMesh(sign: LineSignEnu): LineSignHandle {
  const map = createLineSignTexture(sign.label, sign.color)
  const meshW = sign.widthM
  const meshH = LINE_SIGN_BAND_DEPTH_M
  const geo = new THREE.PlaneGeometry(meshW, meshH)
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.05,
    toneMapped: false,
    // Scene fog tints the whole transparent band (04-06 Fail). Line + letters.
    fog: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = `lineSign:${sign.kind}:${sign.id}`

  if (!applyFlatOnWaterPlacement(mesh, sign)) {
    geo.dispose()
    mat.dispose()
    map.dispose()
    throw new Error(`[lineSigns] degenerate span for ${sign.id}`)
  }

  return {
    root: mesh,
    dispose(): void {
      geo.dispose()
      mat.dispose()
      map.dispose()
    },
  }
}
