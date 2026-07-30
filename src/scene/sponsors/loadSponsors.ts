import * as THREE from 'three'
import { gpsToEnuAmsl } from '../../geodesy/index.ts'
import { adaptSponsorsToFeatures } from '../features/adapters.ts'
import type { WorldFeature } from '../features/types.ts'
import {
  createSponsorBillboard,
  type SponsorBillboardHandle,
} from './sponsorBillboard.ts'
import { buildSponsorLayout } from './sponsorLayout.ts'
import { normalizeSponsors } from './normalizeSponsors.ts'
import type { GpsToEnuAmslFn, SponsorsData } from './types.ts'

export const DEFAULT_SPONSORS_URL = '/fixtures/sponsors/demo-istanbul.json'

export type SponsorsHandle = {
  root: THREE.Group
  /** Midpoints at water Y (optional 2D map ticks). */
  mapPoints: readonly { x: number; y: number; z: number; id: string }[]
  /** GPS-space features for shared layout (pre-GEO). */
  worldFeatures: readonly WorldFeature[]
  dispose: () => void
}

export type LoadSponsorsOptions = {
  scene: THREE.Scene
  url?: string
  /** Override GEO convert (tests). Default: `gpsToEnuAmsl`. */
  gpsToEnuAmsl?: GpsToEnuAmslFn
}

/**
 * Fetch sponsors JSON, convert via GEO, add fixed world panels to the scene.
 * Call only after `applyConfigOrigin` + EGM96 are ready.
 */
export async function loadSponsors(
  options: LoadSponsorsOptions,
): Promise<SponsorsHandle | null> {
  const url = options.url?.trim() || DEFAULT_SPONSORS_URL
  let raw: unknown
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[sponsors] failed to load ${url}: HTTP ${res.status}`)
      return null
    }
    raw = await res.json()
  } catch (err) {
    console.warn(`[sponsors] failed to load ${url}`, err)
    return null
  }

  const data = normalizeSponsors(raw)
  if (data.sponsors.length === 0) {
    console.warn(`[sponsors] no valid entries in ${url}`)
    return null
  }

  return mountSponsors(options.scene, data, options.gpsToEnuAmsl)
}

/** Build sponsor meshes from already-normalized data. */
export async function mountSponsors(
  scene: THREE.Scene,
  data: SponsorsData,
  convert: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
): Promise<SponsorsHandle> {
  const layout = buildSponsorLayout(data, convert)
  const root = new THREE.Group()
  root.name = 'sponsors'

  const panels: SponsorBillboardHandle[] = []
  for (const endpoints of layout) {
    try {
      const panel = await createSponsorBillboard(endpoints)
      panels.push(panel)
      root.add(panel.root)
    } catch (err) {
      console.warn(`[sponsors] skip ${endpoints.id}`, err)
    }
  }

  scene.add(root)

  const mapPoints = layout.map((e) => ({
    x: e.midX,
    y: 0,
    z: e.midZ,
    id: e.id,
  }))

  return {
    root,
    mapPoints,
    worldFeatures: adaptSponsorsToFeatures(data),
    dispose(): void {
      scene.remove(root)
      for (const p of panels) p.dispose()
      panels.length = 0
      root.clear()
    },
  }
}
