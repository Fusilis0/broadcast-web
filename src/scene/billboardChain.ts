import { layoutFeatures } from './features/layoutFeatures.ts'
import type {
  GpsToEnuAmslFn,
  LayoutFeature,
  WorldFeature,
} from './features/types.ts'
import {
  createSponsorBillboard,
  type SponsorBillboardHandle,
} from './sponsors/sponsorBillboard.ts'
import type { SponsorEnuEndpoints } from './sponsors/types.ts'
import { DEFAULT_BILLBOARD_CHAIN_SPACING_M } from './features/editor/featureFactory.ts'
import { gpsToEnuAmsl } from '../geodesy/index.ts'
import * as THREE from 'three'

export type BillboardChainHandle = {
  root: THREE.Group
  dispose: () => void
}

export type EnuSample = { x: number; z: number; alongX: number; alongZ: number }

/**
 * Sample points along a polyline at approximately `spacingM` intervals.
 * Each sample includes a tangent (horizontal) for panel facing.
 * Always includes the start; may omit an exact end if remainder < half spacing.
 */
export function samplePolylineAtSpacing(
  points: readonly { x: number; z: number }[],
  spacingM: number,
): EnuSample[] {
  if (points.length < 2) return []
  const spacing =
    Number.isFinite(spacingM) && spacingM > 0
      ? spacingM
      : DEFAULT_BILLBOARD_CHAIN_SPACING_M

  const samples: EnuSample[] = []
  let carry = 0

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const segLen = Math.hypot(dx, dz)
    if (segLen < 1e-6) continue
    const ux = dx / segLen
    const uz = dz / segLen

    let dist = carry === 0 && samples.length === 0 ? 0 : spacing - carry
    if (samples.length === 0) {
      samples.push({ x: a.x, z: a.z, alongX: ux, alongZ: uz })
      dist = spacing
    }

    while (dist <= segLen + 1e-9) {
      samples.push({
        x: a.x + ux * dist,
        z: a.z + uz * dist,
        alongX: ux,
        alongZ: uz,
      })
      dist += spacing
    }
    carry = segLen - (dist - spacing)
    if (carry < 0) carry = 0
  }

  return samples
}

function panelEndpointsFromSample(
  sample: EnuSample,
  widthM: number,
  meta: {
    id: string
    label: string
    heightM: number
    textureUrl: string | null
    color: number
    panelColor?: number
    frameColor?: number
  },
): SponsorEnuEndpoints {
  const half = widthM / 2
  const ax = sample.x - sample.alongX * half
  const az = sample.z - sample.alongZ * half
  const bx = sample.x + sample.alongX * half
  const bz = sample.z + sample.alongZ * half
  const endpoints: SponsorEnuEndpoints = {
    id: meta.id,
    label: meta.label,
    heightM: meta.heightM,
    textureUrl: meta.textureUrl,
    color: meta.color,
    ax,
    az,
    bx,
    bz,
    midX: sample.x,
    midZ: sample.z,
    widthM,
  }
  if (meta.panelColor !== undefined) endpoints.panelColor = meta.panelColor
  if (meta.frameColor !== undefined) endpoints.frameColor = meta.frameColor
  return endpoints
}

/** Default instance panel width along-track (meters). */
export const CHAIN_INSTANCE_WIDTH_M = 6

/**
 * Mount repeated sponsor billboards along each `billboardChain` feature.
 */
export async function mountBillboardChains(
  scene: THREE.Scene,
  features: readonly WorldFeature[],
  gpsToEnu: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
): Promise<BillboardChainHandle | null> {
  const chains = features.filter((f) => f.type === 'billboardChain')
  if (chains.length === 0) return null

  const root = new THREE.Group()
  root.name = 'billboardChains'
  const disposers: Array<() => void> = []

  const layout = layoutFeatures(chains, gpsToEnu)

  for (const f of layout) {
    await mountOneChain(root, f, disposers)
  }

  scene.add(root)
  return {
    root,
    dispose(): void {
      for (const d of disposers) d()
      disposers.length = 0
      root.removeFromParent()
      root.clear()
    },
  }
}

async function mountOneChain(
  parent: THREE.Group,
  f: LayoutFeature,
  disposers: Array<() => void>,
): Promise<void> {
  if (f.points.length < 2) return
  const spacing =
    f.spacingM !== undefined && f.spacingM > 0
      ? f.spacingM
      : DEFAULT_BILLBOARD_CHAIN_SPACING_M
  const samples = samplePolylineAtSpacing(
    f.points.map((p) => ({ x: p.x, z: p.z })),
    spacing,
  )
  const heightM = f.heightM ?? 8
  const color = f.color ?? 0x2a6f7a
  const textureUrl = f.textureUrl ?? null
  const label = f.label ?? f.name

  let idx = 0
  for (const sample of samples) {
    const endpoints = panelEndpointsFromSample(sample, CHAIN_INSTANCE_WIDTH_M, {
      id: `${f.id}:${idx}`,
      label,
      heightM,
      textureUrl,
      color,
      panelColor: f.panelColor,
      frameColor: f.frameColor,
    })
    idx += 1
    try {
      const handle: SponsorBillboardHandle =
        await createSponsorBillboard(endpoints)
      parent.add(handle.root)
      disposers.push(handle.dispose)
    } catch (err) {
      console.warn(`[billboardChain] skip instance ${endpoints.id}`, err)
    }
  }
}
