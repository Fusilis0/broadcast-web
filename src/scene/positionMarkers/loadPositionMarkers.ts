import * as THREE from 'three'
import { gpsToEnuAmsl } from '../../geodesy/index.ts'
import { normalizePositionMarkers } from './normalizePositionMarkers.ts'
import { buildPositionMarkerLayout } from './positionMarkerLayout.ts'
import {
  createPositionMarkerMesh,
  type PositionMarkerHandle,
} from './positionMarkerMesh.ts'
import type { GpsToEnuAmslFn, PositionMarkersData } from './types.ts'

export const DEFAULT_POSITION_MARKERS_URL =
  '/fixtures/markers/demo-istanbul.json'

export type PositionMarkersHandle = {
  root: THREE.Group
  data: PositionMarkersData
  dispose: () => void
}

export type LoadPositionMarkersOptions = {
  scene: THREE.Scene
  url?: string
  gpsToEnuAmsl?: GpsToEnuAmslFn
}

/**
 * Fetch Distances-style markers and mount flat water labels.
 * Missing/empty fixture → null (no error throw).
 */
export async function loadPositionMarkers(
  options: LoadPositionMarkersOptions,
): Promise<PositionMarkersHandle | null> {
  const url = options.url?.trim() || DEFAULT_POSITION_MARKERS_URL
  let raw: unknown
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[positionMarkers] failed to load ${url}: HTTP ${res.status}`)
      return null
    }
    raw = await res.json()
  } catch (err) {
    console.warn(`[positionMarkers] failed to load ${url}`, err)
    return null
  }

  const data = normalizePositionMarkers(raw)
  if (data.markers.length === 0) {
    console.warn(`[positionMarkers] no valid entries in ${url}`)
    return null
  }

  return mountPositionMarkers(options.scene, data, options.gpsToEnuAmsl)
}

export function mountPositionMarkers(
  scene: THREE.Scene,
  data: PositionMarkersData,
  convert: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
): PositionMarkersHandle {
  const layout = buildPositionMarkerLayout(data, convert)
  const root = new THREE.Group()
  root.name = 'positionMarkers'

  const parts: PositionMarkerHandle[] = []
  for (const m of layout) {
    const mesh = createPositionMarkerMesh(m)
    parts.push(mesh)
    root.add(mesh.root)
  }

  scene.add(root)

  return {
    root,
    data,
    dispose(): void {
      scene.remove(root)
      for (const p of parts) p.dispose()
      parts.length = 0
      root.clear()
    },
  }
}
