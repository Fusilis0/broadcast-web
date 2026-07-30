import * as THREE from 'three'
import { gpsToEnuAmsl } from '../../geodesy/index.ts'
import { adaptFlagsToFeatures } from '../features/adapters.ts'
import type { WorldFeature } from '../features/types.ts'
import { createCountdownFlagsController } from './countdownController.ts'
import { normalizeCountdownFlags } from './normalizeCountdownFlags.ts'
import type {
  CountdownFlagsData,
  CountdownFlagsLayout,
  GpsToEnuAmslFn,
} from './types.ts'
import type { CountdownFlagsHandle } from './countdownController.ts'

export const DEFAULT_FLAGS_URL = '/fixtures/flags/demo-istanbul-countdown.json'

export type FlagsHandle = CountdownFlagsHandle & {
  /** GPS-space features for shared layout (pre-GEO). */
  worldFeatures: readonly WorldFeature[]
  /** Normalized fixture (editor remount preserves timing knobs). */
  flagsData: CountdownFlagsData
}

export type { CountdownFlagsHandle }

export type LoadCountdownFlagsOptions = {
  scene: THREE.Scene
  url?: string
  /** Override GEO convert (tests). Default: `gpsToEnuAmsl`. */
  gpsToEnuAmsl?: GpsToEnuAmslFn
}

/**
 * Build ENU layout from normalized data. Pole baselines at water Y = 0.
 */
export function buildCountdownFlagsLayout(
  data: CountdownFlagsData,
  convert: GpsToEnuAmslFn,
): CountdownFlagsLayout {
  const p1 = convert(data.point1.lat, data.point1.lon, data.point1.altMsl)
  const p2 = convert(data.point2.lat, data.point2.lon, data.point2.altMsl)
  return {
    p1x: p1.x,
    p1z: p1.z,
    p2x: p2.x,
    p2z: p2.z,
    data,
  }
}

/**
 * Fetch countdown-flags JSON, convert via GEO, mount poles + timer.
 * Call only after `applyConfigOrigin` + EGM96 are ready.
 */
export async function loadCountdownFlags(
  options: LoadCountdownFlagsOptions,
): Promise<FlagsHandle | null> {
  const url = options.url?.trim() || DEFAULT_FLAGS_URL
  let raw: unknown
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[flags] failed to load ${url}: HTTP ${res.status}`)
      return null
    }
    raw = await res.json()
  } catch (err) {
    console.warn(`[flags] failed to load ${url}`, err)
    return null
  }

  const data = normalizeCountdownFlags(raw)
  if (!data) {
    console.warn(`[flags] invalid fixture ${url}`)
    return null
  }

  return mountCountdownFlags(options.scene, data, options.gpsToEnuAmsl)
}

/** Build meshes from already-normalized data. */
export function mountCountdownFlags(
  scene: THREE.Scene,
  data: CountdownFlagsData,
  convert: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
): FlagsHandle {
  const layout = buildCountdownFlagsLayout(data, convert)
  const handle = createCountdownFlagsController(layout)
  scene.add(handle.root)
  if (data.autoStart) handle.start()

  const innerDispose = handle.dispose.bind(handle)
  return {
    ...handle,
    worldFeatures: adaptFlagsToFeatures(data),
    flagsData: data,
    dispose(): void {
      scene.remove(handle.root)
      innerDispose()
    },
  }
}
