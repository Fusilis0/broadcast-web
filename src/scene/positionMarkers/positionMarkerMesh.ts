import * as THREE from 'three'
import {
  cropCanvasToOpaqueGlyph,
  glyphCropIsFullBoard,
  meshSizeFromGlyphCrop,
  type GlyphCrop,
} from '../sponsors/boardCompose.ts'
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
  let metricsCrop: GlyphCrop | null = null
  if (ctx) {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = hexToRgba(color, 0.48)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const fontSize = Math.min(96, Math.floor(220 / Math.max(label.length * 0.45, 1)))
    ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`
    ctx.fillText(label, w / 2, h / 2)
    const m = ctx.measureText(label)
    const tw = Math.ceil(
      Math.abs(m.actualBoundingBoxLeft ?? 0) +
        Math.abs(m.actualBoundingBoxRight ?? 0),
    )
    const th = Math.ceil(
      Math.abs(m.actualBoundingBoxAscent ?? 0) +
        Math.abs(m.actualBoundingBoxDescent ?? 0),
    )
    if (tw > 4 && th > 4 && tw < w - 2 && th < h - 2) {
      metricsCrop = {
        x: Math.max(0, Math.round(w / 2 - tw / 2) - 4),
        y: Math.max(0, Math.round(h / 2 - th / 2) - 4),
        w: Math.min(w, tw + 8),
        h: Math.min(h, th + 8),
        srcW: w,
        srcH: h,
      }
    }
  }
  const pixel = cropCanvasToOpaqueGlyph(canvas)
  const crop =
    pixel && !glyphCropIsFullBoard(pixel) ? pixel : metricsCrop
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  if (crop && canvas.width === crop.srcW && canvas.height === crop.srcH) {
    tex.offset.set(crop.x / crop.srcW, 1 - (crop.y + crop.h) / crop.srcH)
    tex.repeat.set(crop.w / crop.srcW, crop.h / crop.srcH)
  }
  if (crop) tex.userData.glyphCrop = crop
  tex.needsUpdate = true
  return tex
}

export function createPositionMarkerMesh(
  marker: PositionMarkerEnu,
): PositionMarkerHandle {
  const map = createPositionMarkerTexture(marker.label, marker.color)
  let meshW = marker.sizeM
  let meshH = marker.sizeM
  const crop = map.userData.glyphCrop as GlyphCrop | undefined
  if (crop) {
    const sized = meshSizeFromGlyphCrop(meshW, meshH, crop)
    meshW = sized.widthM
    meshH = sized.heightM
  }
  const geo = new THREE.PlaneGeometry(meshW, meshH)
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.05,
    toneMapped: false,
    fog: false,
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
