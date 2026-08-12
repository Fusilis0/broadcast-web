import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { COURSE_WATER_Y } from '../course/courseLayout.ts'

/**
 * Fixed look tuned toward a shaded grey-blue sea (reference: stylized model,
 * not photoreal). No weather UI in v1.
 */
export const REALISTIC_ENVIRONMENT_DEFAULTS = {
  /** Large ocean plane edge length (meters). */
  waterSizeM: 10_000,
  waterY: COURSE_WATER_Y - 0.2,
  waterColor: 0x4a6578,
  sunColor: 0xe8eef5,
  distortionScale: 3.2,
  /** Mirror RT resolution (lower = cheaper). */
  textureSize: 256,
  skyScale: 10_000,
  /** Preetham sky — muted / slightly overcast. */
  turbidity: 6,
  rayleigh: 1.4,
  mieCoefficient: 0.004,
  mieDirectionalG: 0.7,
  /** Sun spherical: phi from zenith, theta azimuth (radians). */
  sunPhi: Math.PI * 0.38,
  sunTheta: Math.PI * 0.22,
  fogColor: 0x8a9aaa,
  fogNear: 900,
  fogFar: 5200,
  /** Procedural normal map size. */
  normalsSize: 256,
} as const

export type RealisticEnvironmentOptions = {
  waterSizeM: number
  waterY: number
  waterColor: number
  sunColor: number
  distortionScale: number
  textureSize: number
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
  normalsSize: number
}

export type RealisticEnvironmentHandle = {
  root: THREE.Group
  water: Water
  sky: Sky
  /** Fog to assign on `scene.fog` while mounted (caller owns scene.fog). */
  fog: THREE.Fog
  /** Advance water time uniform. */
  tick: (dtSeconds: number) => void
  dispose: () => void
}

/**
 * Soft procedural normals so we do not ship a binary waternormals.jpg.
 * Enough for shaded ripples; not a photo-sourced map.
 * Uses `DataTexture` (no DOM) so unit tests can construct without canvas.
 */
export function createProceduralWaterNormals(
  size: number = REALISTIC_ENVIRONMENT_DEFAULTS.normalsSize,
): THREE.DataTexture {
  const dim = Math.max(32, size | 0)
  const data = new Uint8Array(dim * dim * 4)
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const i = (y * dim + x) * 4
      const nx =
        128 +
        Math.sin(x * 0.05) * 22 +
        Math.sin(y * 0.08 + x * 0.02) * 18
      const ny =
        128 +
        Math.cos(x * 0.06) * 20 +
        Math.sin(y * 0.04) * 24
      data[i] = Math.max(0, Math.min(255, nx))
      data[i + 1] = Math.max(0, Math.min(255, ny))
      data[i + 2] = 255
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, dim, dim)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

function sunDirectionFromSpherical(phi: number, theta: number): THREE.Vector3 {
  // Same convention as three.js sky examples: phi = zenith angle, theta = azimuth.
  const dir = new THREE.Vector3()
  dir.setFromSphericalCoords(1, phi, theta)
  return dir
}

/**
 * Create sea + sky (+ fog handle). Caller adds `root` to the scene and sets
 * `scene.fog = handle.fog` while mounted; clears fog on dispose.
 *
 * Course `waterCue` pad stays mounted as a crisp local tint **on top of** this
 * ocean (slightly higher Y) — not hidden when realistic mode is on.
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

  const sunDir = sunDirectionFromSpherical(opts.sunPhi, opts.sunTheta)
  const normals = createProceduralWaterNormals(opts.normalsSize)

  const waterGeo = new THREE.PlaneGeometry(opts.waterSizeM, opts.waterSizeM)
  const water = new Water(waterGeo, {
    textureWidth: opts.textureSize,
    textureHeight: opts.textureSize,
    waterNormals: normals,
    sunDirection: sunDir.clone(),
    sunColor: opts.sunColor,
    waterColor: opts.waterColor,
    distortionScale: opts.distortionScale,
    fog: true,
  })
  water.name = 'realisticWater'
  water.rotation.x = -Math.PI / 2
  water.position.y = opts.waterY
  // Below course waterCue pads (renderOrder -10) so the local tint stays readable.
  water.renderOrder = -20
  root.add(water)

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

  let disposed = false

  return {
    root,
    water,
    sky,
    fog,
    tick(dtSeconds: number): void {
      if (disposed) return
      const mat = water.material as THREE.ShaderMaterial
      const u = mat.uniforms['time']
      if (u) u.value += dtSeconds
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      root.clear()
      waterGeo.dispose()
      normals.dispose()
      const mat = water.material as THREE.ShaderMaterial
      // Water keeps its mirror RT private; disposing the mirror sampler
      // texture is best-effort (full RT cleanup needs a three.js dispose hook).
      const mirror = mat.uniforms['mirrorSampler']?.value
      if (mirror && typeof (mirror as THREE.Texture).dispose === 'function') {
        ;(mirror as THREE.Texture).dispose()
      }
      mat.dispose()
      const skyMat = sky.material as THREE.ShaderMaterial
      skyMat.dispose()
      sky.geometry.dispose()
    },
  }
}
