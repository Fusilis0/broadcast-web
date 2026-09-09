import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { windBus, type WindBus } from '../../telemetry/windBus.ts'
import {
  GERSTNER_OCEAN_DEFAULTS,
  createGerstnerOcean,
  type GerstnerOceanHandle,
  type GerstnerOceanOptions,
} from './gerstnerOcean.ts'
import type { OceanSuppressFootprint } from './oceanSuppress.ts'
import {
  SEA_QUALITY_PRESETS,
  normalizeSeaQuality,
  type SeaQuality,
} from './environmentMode.ts'
import { createWindVane, type WindVaneHandle } from './windVane.ts'
import {
  createWindStrings,
  type WindStringsHandle,
} from './windStrings.ts'
import {
  WIND_OCEAN_RAMP_SECONDS,
  createWindOceanDriver,
  type WindOceanDriver,
} from './windOceanCoupling.ts'

/**
 * Realistic sea + sky (Phase 13.2 Sky + 14.2a Gerstner + 14.2b wind bus +
 * 14.2c shore foam + 14.3f strings).
 *
 * Replaces `three/examples/jsm/objects/Water` (flat normal-mapped plane).
 * Wave time is a shared clock — see `gerstnerOcean.ts` header. Do not re-open
 * the OUT “call tick from the 3D pump” follow-up unless that clock is removed.
 *
 * **Wind (14.2b):** this handle subscribes to `windBus` (snapshot on create,
 * unsubscribe on dispose). `createScene` does not grow new wind methods —
 * Ops / API publish on the bus and the sea follows. Direction/speed ramp
 * over `WIND_OCEAN_RAMP_SECONDS` (shortest arc). Default wind from 000°
 * travels **+Z**, not the uncoupled Gerstner −Z default.
 *
 * **Vane (14.3f lite):** a tens-of-tris shaft+arrow at a fixed origin offset,
 * yawed to the same ramped travel as the sea. Length scales with kt (min
 * length so from-deg is never invisible).
 *
 * **Strings (14.3f / 16.2):** Windy-style streamlines above the water, same
 * ramped travel as the sea. Ops preview + 3D NDI only (inherits this mount).
 */
export const REALISTIC_ENVIRONMENT_DEFAULTS = {
  skyScale: 80_000,
  /** Preetham sky — muted / slightly overcast. */
  turbidity: 6,
  rayleigh: 1.4,
  mieCoefficient: 0.004,
  mieDirectionalG: 0.7,
  /** Sun spherical: phi from zenith, theta azimuth (radians). */
  sunPhi: Math.PI * 0.38,
  sunTheta: Math.PI * 0.22,
  fogColor: GERSTNER_OCEAN_DEFAULTS.horizonColor,
  fogNear: 900,
  fogFar: 5200,
  sunColor: GERSTNER_OCEAN_DEFAULTS.sunColor,
  liftY: GERSTNER_OCEAN_DEFAULTS.liftY,
  directionRad: GERSTNER_OCEAN_DEFAULTS.directionRad,
  windSpeed: GERSTNER_OCEAN_DEFAULTS.windSpeed,
  windRampSeconds: WIND_OCEAN_RAMP_SECONDS,
} as const

export type RealisticEnvironmentOptions = {
  skyScale: number
  turbidity: number
  rayleigh: number
  mieCoefficient: number
  mieDirectionalG: number
  sunPhi: number
  sunTheta: number
  fogColor: number
  fogNear: number
  fogFar: number
  sunColor: number
  liftY: number
  directionRad: number
  windSpeed: number
  /** Shared clock in ms; forwarded to the ocean (tests). */
  now?: () => number
  ocean?: Partial<GerstnerOceanOptions>
  /** Wind bus to follow. Default shared `windBus`. */
  wind?: WindBus
  /** Direction/speed lerp duration. Default 3 s. */
  windRampSeconds?: number
  /**
   * Subscribe to the wind bus (default true). Tests that need the uncoupled
   * Gerstner default can pass false.
   */
  coupleWind?: boolean
  /**
   * Clipmap / shore-foam LOD. Default `high` (7 rings, half-res foam).
   * `low` drops two rings and uses quarter-res foam (`?sea=low` / Ops).
   */
  seaQuality?: SeaQuality
}

export type RealisticEnvironmentHandle = {
  root: THREE.Group
  ocean: THREE.Mesh
  sky: Sky
  /** Fog to assign on `scene.fog` while mounted (caller owns scene.fog). */
  fog: THREE.Fog
  getDirectionRad: () => number
  setDirectionRad: (rad: number) => void
  getWindSpeed: () => number
  setWindSpeed: (ms: number) => void
  /**
   * Samples the shared wave clock and advances the wind ramp. `dt` is ignored
   * for wave time (shared clock); it is used for the ramp when `now` is frozen.
   */
  tick: (dtSeconds: number) => void
  /**
   * Terrain group for 14.2c shore foam. `null` drops the extra depth FBO.
   */
  setShoreContact: (terrainRoot: THREE.Object3D | null) => void
  getShoreFoamEnabled: () => boolean
  getShoreDepthTarget: () => THREE.WebGLRenderTarget | null
  getSeaQuality: () => SeaQuality
  /** 19.15 local Gerstner flatten under flat-on-water platforms (no discard). */
  setSuppressFootprints: (footprints: readonly OceanSuppressFootprint[]) => void
  /** Environment **sea m** — moves Gerstner rest Y. */
  setSeaHeightYM: (yM: number) => void
  getSeaHeightYM: () => number
  dispose: () => void
}

function sunDirectionFromSpherical(phi: number, theta: number): THREE.Vector3 {
  // Same convention as three.js sky examples: phi = zenith angle, theta = azimuth.
  const dir = new THREE.Vector3()
  dir.setFromSphericalCoords(1, phi, theta)
  return dir
}

/**
 * Create Gerstner sea + sky (+ fog handle). Caller adds `root` to the scene
 * and sets `scene.fog = handle.fog` while mounted; clears fog on dispose.
 *
 * Course `waterCue` is hidden while this is mounted (createScene hook).
 */
export function createRealisticEnvironment(
  options?: Partial<RealisticEnvironmentOptions>,
): RealisticEnvironmentHandle {
  const opts: RealisticEnvironmentOptions = {
    ...REALISTIC_ENVIRONMENT_DEFAULTS,
    ...options,
  }

  const root = new THREE.Group()
  root.name = 'realisticEnvironment'

  const seaQuality = normalizeSeaQuality(opts.seaQuality)
  const qualityPreset = SEA_QUALITY_PRESETS[seaQuality]

  const sunDir = sunDirectionFromSpherical(opts.sunPhi, opts.sunTheta)

  const oceanHandle: GerstnerOceanHandle = createGerstnerOcean({
    innerSegments: qualityPreset.innerSegments,
    ringCount: qualityPreset.ringCount,
    shoreDepthScale: qualityPreset.shoreDepthScale,
    ...opts.ocean,
    liftY: opts.liftY,
    directionRad: opts.directionRad,
    windSpeed: opts.windSpeed,
    sunColor: opts.sunColor,
    sunDirection: sunDir,
    ...(opts.now ? { now: opts.now } : {}),
  })
  root.add(oceanHandle.mesh)

  const vaneHandle: WindVaneHandle = createWindVane({ liftY: opts.liftY })
  root.add(vaneHandle.root)

  const _camWorld = new THREE.Vector3()
  let lastCenterX = 0
  let lastCenterY = 40
  let lastCenterZ = 0

  const sky = new Sky()
  sky.name = 'realisticSky'
  sky.scale.setScalar(opts.skyScale)
  const skyUniforms = (sky.material as THREE.ShaderMaterial).uniforms
  skyUniforms['turbidity']!.value = opts.turbidity
  skyUniforms['rayleigh']!.value = opts.rayleigh
  skyUniforms['mieCoefficient']!.value = opts.mieCoefficient
  skyUniforms['mieDirectionalG']!.value = opts.mieDirectionalG
  skyUniforms['sunPosition']!.value.copy(sunDir)
  root.add(sky)

  const fog = new THREE.Fog(opts.fogColor, opts.fogNear, opts.fogFar)

  const now = opts.now ?? (() => performance.now())
  const stringsHandle: WindStringsHandle = createWindStrings({
    liftY: opts.liftY,
    now,
  })
  root.add(stringsHandle.root)

  const coupleWind = opts.coupleWind !== false
  let driver: WindOceanDriver | null = null
  let unsubWind: (() => void) | null = null

  if (coupleWind) {
    driver = createWindOceanDriver({
      apply: {
        setDirectionRad: (rad) => oceanHandle.setDirectionRad(rad),
        setWindSpeed: (ms) => oceanHandle.setWindSpeed(ms),
        setAmplitudeScale: (scale) => oceanHandle.setAmplitudeScale(scale),
      },
      now,
      rampSeconds: opts.windRampSeconds,
    })
    const bus = opts.wind ?? windBus
    let first = true
    unsubWind = bus.subscribe((frame) => {
      driver?.setTarget(frame, first)
      first = false
    })
  }

  function syncWindVfx(dtSeconds: number): void {
    const dir = oceanHandle.getDirectionRad()
    const speed = oceanHandle.getWindSpeed()
    vaneHandle.setTravel(dir, speed)
    stringsHandle.tick(
      dtSeconds,
      dir,
      speed,
      lastCenterX,
      lastCenterY,
      lastCenterZ,
    )
  }

  syncWindVfx(0)

  const prevBeforeRender = oceanHandle.mesh.onBeforeRender
  oceanHandle.mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    driver?.step(0)
    camera.getWorldPosition(_camWorld)
    lastCenterX = _camWorld.x
    lastCenterY = _camWorld.y
    lastCenterZ = _camWorld.z
    sky.position.copy(_camWorld)
    if (root.parent) root.worldToLocal(sky.position)
    syncWindVfx(0)
    prevBeforeRender.call(
      oceanHandle.mesh,
      renderer,
      scene,
      camera,
      geometry,
      material,
      group,
    )
  }

  let disposed = false

  return {
    root,
    ocean: oceanHandle.mesh,
    sky,
    fog,
    getDirectionRad: () => oceanHandle.getDirectionRad(),
    setDirectionRad(rad: number): void {
      oceanHandle.setDirectionRad(rad)
      syncWindVfx(0)
    },
    getWindSpeed: () => oceanHandle.getWindSpeed(),
    setWindSpeed(ms: number): void {
      oceanHandle.setWindSpeed(ms)
      syncWindVfx(0)
    },
    tick(dtSeconds: number): void {
      if (disposed) return
      driver?.step(dtSeconds)
      oceanHandle.tick(dtSeconds)
      syncWindVfx(dtSeconds)
    },
    setShoreContact(terrainRoot: THREE.Object3D | null): void {
      oceanHandle.setShoreContact(terrainRoot)
    },
    getShoreFoamEnabled: () => oceanHandle.getShoreFoamEnabled(),
    getShoreDepthTarget: () => oceanHandle.getShoreDepthTarget(),
    getSeaQuality: () => seaQuality,
    setSuppressFootprints(footprints: readonly OceanSuppressFootprint[]): void {
      oceanHandle.setSuppressFootprints(footprints)
    },
    setSeaHeightYM(yM: number): void {
      oceanHandle.setSeaHeightYM(yM)
    },
    getSeaHeightYM: () => oceanHandle.getSeaHeightYM(),
    dispose(): void {
      if (disposed) return
      disposed = true
      unsubWind?.()
      unsubWind = null
      driver = null
      oceanHandle.mesh.onBeforeRender = () => {}
      root.clear()
      stringsHandle.dispose()
      vaneHandle.dispose()
      oceanHandle.dispose()
      const skyMat = sky.material as THREE.ShaderMaterial
      skyMat.dispose()
      sky.geometry.dispose()
    },
  }
}
