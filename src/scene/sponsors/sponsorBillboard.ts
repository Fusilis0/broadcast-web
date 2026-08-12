import * as THREE from 'three'
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

function hexToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * Procedural branded panel — Unity LogoOnSea-style: brand fill, inner plate,
 * label. Used when `textureUrl` is missing or fails to load.
 */
export function createProceduralSponsorTexture(
  label: string,
  color: number,
): THREE.CanvasTexture {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const css = hexToCss(color)
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, css)
    grad.addColorStop(1, '#0c1218')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Inner plate (logo slot)
    ctx.fillStyle = 'rgba(12, 16, 22, 0.45)'
    ctx.fillRect(48, 56, w - 96, h - 112)
    ctx.strokeStyle = 'rgba(245, 242, 234, 0.4)'
    ctx.lineWidth = 10
    ctx.strokeRect(48, 56, w - 96, h - 112)

    // Outer frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.lineWidth = 14
    ctx.strokeRect(20, 20, w - 40, h - 40)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f5f2ea'
    const fontSize = Math.min(
      88,
      Math.floor(w / Math.max(label.length * 0.55, 6)),
    )
    ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`
    ctx.fillText(label, w / 2, h / 2)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function loadImageTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

/**
 * Vertical world panel between A–B at water baseline. Fixed orientation (not camera-billboard).
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

  let map: THREE.Texture = createProceduralSponsorTexture(
    endpoints.label,
    endpoints.color,
  )
  let ownedMap = true
  let useAlpha = false

  if (endpoints.textureUrl) {
    try {
      const loaded = await loadImageTexture(endpoints.textureUrl)
      map.dispose()
      map = loaded
      ownedMap = true
      useAlpha = true
    } catch (err) {
      console.warn(
        `[sponsors] texture failed for ${endpoints.id} (${endpoints.textureUrl}); using label`,
        err,
      )
    }
  }

  const geo = new THREE.PlaneGeometry(endpoints.widthM, endpoints.heightM)
  const mat = new THREE.MeshBasicMaterial({
    map,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: useAlpha,
    depthWrite: !useAlpha,
  })
  // Brand fill behind logo PNGs so transparent sprites still read on air.
  if (useAlpha) {
    mat.color.setHex(endpoints.color)
  }
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
      if (ownedMap) map.dispose()
    },
  }
}
