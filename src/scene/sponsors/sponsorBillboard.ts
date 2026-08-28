import * as THREE from 'three'
import {
  drawSponsorBoard,
  planSponsorBoard,
  DEFAULT_FRAME_COLOR,
  DEFAULT_PANEL_COLOR,
} from './boardCompose.ts'
import { SPONSOR_WATER_Y } from './sponsorLayout.ts'
import type { SponsorEnuEndpoints } from './types.ts'

export type SponsorBillboardHandle = {
  root: THREE.Mesh
  dispose: () => void
}

/**
 * Facing: local +X along A→B (flattened), +Y up, +Z = along × up (left of A→B).
 * Matches Unity `BillboardBetweenTwoPoints` “perpendicular to span” intent.
 */
export function facingBasisFromSpan(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { along: THREE.Vector3; normal: THREE.Vector3 } | null {
  const along = new THREE.Vector3(bx - ax, 0, bz - az)
  if (along.lengthSq() < 1e-8) return null
  along.normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const normal = new THREE.Vector3().crossVectors(along, up)
  if (normal.lengthSq() < 1e-8) return null
  normal.normalize()
  return { along, normal }
}

/**
 * Procedural branded panel — SailGP-style opaque board + label.
 * Used when `textureUrl` is missing or fails to load.
 */
export function createProceduralSponsorTexture(
  label: string,
  options?: { panelColor?: number; frameColor?: number },
): THREE.CanvasTexture {
  return createSponsorBoardTexture({
    label,
    panelColor: options?.panelColor,
    frameColor: options?.frameColor,
  })
}

function sourceSize(src: CanvasImageSource): { width: number; height: number } {
  if (
    typeof HTMLImageElement !== 'undefined' &&
    src instanceof HTMLImageElement &&
    src.naturalWidth > 0
  ) {
    return { width: src.naturalWidth, height: src.naturalHeight }
  }
  if ('width' in src && 'height' in src) {
    const w = Number(src.width)
    const h = Number(src.height)
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { width: w, height: h }
    }
  }
  return { width: 1, height: 1 }
}

/** Canvas texture: opaque board + optional contain-fit logo (else label). */
export function createSponsorBoardTexture(input: {
  label: string
  panelColor?: number
  frameColor?: number
  logo?: CanvasImageSource | null
}): THREE.CanvasTexture {
  const logoSize = input.logo ? sourceSize(input.logo) : null
  const plan = planSponsorBoard({
    label: input.label,
    panelColor: input.panelColor,
    frameColor: input.frameColor,
    logo: logoSize,
  })
  const canvas = document.createElement('canvas')
  canvas.width = plan.canvasW
  canvas.height = plan.canvasH
  const ctx = canvas.getContext('2d')
  if (ctx) drawSponsorBoard(ctx, plan, input.logo)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`[sponsors] image load failed: ${url}`))
    img.src = url
  })
}

/**
 * Vertical world panel between A–B at water baseline. Fixed orientation (not camera-billboard).
 * Texture is always a composed board (opaque background + frame + logo or label).
 */
export async function createSponsorBillboard(
  endpoints: SponsorEnuEndpoints,
): Promise<SponsorBillboardHandle> {
  const basis = facingBasisFromSpan(
    endpoints.ax,
    endpoints.az,
    endpoints.bx,
    endpoints.bz,
  )
  if (!basis) {
    throw new Error(`[sponsors] degenerate span for ${endpoints.id}`)
  }

  const panelColor = endpoints.panelColor ?? DEFAULT_PANEL_COLOR
  const frameColor = endpoints.frameColor ?? DEFAULT_FRAME_COLOR

  let logo: HTMLImageElement | undefined
  if (endpoints.textureUrl) {
    try {
      logo = await loadHtmlImage(endpoints.textureUrl)
    } catch (err) {
      console.warn(
        `[sponsors] texture failed for ${endpoints.id} (${endpoints.textureUrl}); using label`,
        err,
      )
    }
  }

  const map = createSponsorBoardTexture({
    label: endpoints.label,
    panelColor,
    frameColor,
    logo,
  })

  const geo = new THREE.PlaneGeometry(endpoints.widthM, endpoints.heightM)
  const mat = new THREE.MeshBasicMaterial({
    map,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: false,
    depthWrite: true,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = `sponsor:${endpoints.id}`

  const up = new THREE.Vector3(0, 1, 0)
  const m = new THREE.Matrix4().makeBasis(basis.along, up, basis.normal)
  mesh.quaternion.setFromRotationMatrix(m)
  mesh.position.set(
    endpoints.midX,
    SPONSOR_WATER_Y + endpoints.heightM / 2,
    endpoints.midZ,
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
