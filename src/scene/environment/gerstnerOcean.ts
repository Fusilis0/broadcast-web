import * as THREE from 'three'
import { COURSE_WATER_Y } from '../course/courseLayout.ts'
import {
  SHORE_FOAM_DEFAULTS,
  createShoreDepthTarget,
  currentDrawingSize,
  disposeShoreDepthTarget,
  renderTerrainDepthPrepass,
  resizeShoreDepthTarget,
  shoreDepthSize,
} from './shoreFoam.ts'

/**
 * WebGL2 Gerstner ocean (Phase 14.2a).
 *
 * **Shared clock (3D-NDI freeze fix):** wave time is `now() * 0.001` seconds,
 * sampled in `onBeforeRender` (and `tick` for tests). It is **not** accumulated
 * from `createScene.tick(dt)`. The 3D NDI pump `directRender`s without that
 * tick path; sampling wall/studio time at render is enough — OUT does not need
 * to call `tick` from the 3D pump unless this clock is later replaced.
 *
 * **Direction:** `uDirectionRad` is travel in scene XZ. `0` = +X (east);
 * `π/2` → (0, +1) = toward +Z (south). The uncoupled default is still `−π/2`
 * (toward −Z). 14.2b `windOceanCoupling` drives this from `windBus` so default
 * wind from 000° travels **+Z**, not the old northward swell.
 *
 * **Clipmap (conservative, 10 fps NDI / ~30 fps preview):** inner 48×48 over
 * ±48 m (~2 m spacing), 7 concentric rings, 24 segments/ring. Outer half-extent
 * 48 × 2^7 = 6144 m; scene fog hides the far edge. No extra `readPixels`.
 * Shore foam (14.2c) adds **one half-res depth FBO** of the terrain group
 * only while terrain + realistic ocean are both mounted (skipped on
 * transparent/chroma).
 *
 * **Wind streaks (14.3e):** one anisotropic value-noise in the fragment
 * shader, scrolled along `uDirectionRad` (same XZ travel as swell). Intensity
 * and scroll scale from `setWindSpeed`; calm wind fades the mask to 0 so it
 * does not sit as a static texture. No particles, no extra FBO, no
 * `readPixels`.
 */

export const GERSTNER_WAVE_COUNT = 5 as const

export const GERSTNER_OCEAN_DEFAULTS = {
  /** Inner grid half-extent (meters) at the camera. */
  innerHalfExtentM: 48,
  /** Inner subdivisions — ~2 m near-field spacing. */
  innerSegments: 48,
  /** Concentric rings beyond the inner grid. Outer half-extent = inner × 2^n. */
  ringCount: 7,
  /** Segments along each ring's long edge (half of the outer span uses 2×). */
  ringSegments: 24,
  /**
   * Lift above local MSL (`COURSE_WATER_Y` = 0) so this surface draws on top
   * of Cesium's baked water. Terrain is not clipped; 14.2c shore foam uses a
   * terrain-only depth prepass (half-res FBO) when both are mounted.
   */
  liftY: 0.25,
  /**
   * Wave travel in scene XZ (radians). `waveDirectionXZ(θ) = (cos θ, sin θ)`.
   * Default −π/2 = toward −Z = geographic north.
   */
  directionRad: -Math.PI / 2,
  /** Foam scale only this slice (m/s); 14.2b may drive it from the wind bus. */
  windSpeed: 6,
  deepColor: 0x1e3a4c,
  shallowColor: 0x3d6a78,
  skyColor: 0xb7cce0,
  horizonColor: 0x8a9aaa,
  foamColor: 0xe8eef2,
  sunColor: 0xe8eef5,
  glitterSharpness: 220,
  glitterIntensity: 0.55,
} as const

/**
 * 14.3e gust-mask knobs. Spatial stretch lives in the fragment shader
 * (~0.012 /m along-wind, ~0.10 /m across) so streaks stay elongated.
 */
export const WIND_STREAK_DEFAULTS = {
  /** At or below this speed (m/s), streak intensity is 0. */
  fadeMsLo: 0.4,
  /** Full streak intensity (m/s). */
  fadeMsHi: 5,
  /** World-space scroll (m/s) per 1 m/s of wind. */
  scrollPerWind: 1.5,
  /** How hard the mask darkens albedo / kills glitter (0–1). */
  contrast: 0.62,
} as const

export type GerstnerOceanOptions = {
  innerHalfExtentM: number
  innerSegments: number
  ringCount: number
  ringSegments: number
  liftY: number
  directionRad: number
  windSpeed: number
  deepColor: number
  shallowColor: number
  skyColor: number
  horizonColor: number
  foamColor: number
  sunColor: number
  glitterSharpness: number
  glitterIntensity: number
  /** Shared clock in ms (injectable for tests). Default `performance.now`. */
  now: () => number
  sunDirection: THREE.Vector3
}

export type GerstnerOceanHandle = {
  mesh: THREE.Mesh
  /** Seconds from the shared clock (last sample). */
  getTime: () => number
  getDirectionRad: () => number
  setDirectionRad: (rad: number) => void
  getWindSpeed: () => number
  setWindSpeed: (ms: number) => void
  /**
   * Multiply rest-pose Gerstner amplitudes (1 = authored train).
   * 14.2b uses a mild clamp from wind speed — not a shader rewrite.
   */
  setAmplitudeScale: (scale: number) => void
  /**
   * Terrain group to depth-prepass for shore foam. `null` disables the extra
   * FBO (terrain off, simple env, or transparent/chroma).
   */
  setShoreContact: (terrainRoot: THREE.Object3D | null) => void
  getShoreFoamEnabled: () => boolean
  /** Depth RT while foam is armed; `null` when the extra pass is off. */
  getShoreDepthTarget: () => THREE.WebGLRenderTarget | null
  /** Samples shared clock. `dt` is ignored (kept for RealisticEnvironmentHandle). */
  tick: (dtSeconds: number) => void
  dispose: () => void
}

/**
 * Unit XZ travel vector for a direction uniform (radians).
 * `θ = 0` → +X (east); `θ = −π/2` → −Z (geographic north).
 */
export function waveDirectionXZ(directionRad: number): { x: number; z: number } {
  return { x: Math.cos(directionRad), z: Math.sin(directionRad) }
}

/**
 * Gust-mask travel in scene XZ — same mapping as swell
 * (`θ = 0` → +X, `θ = π/2` → +Z). From-000° coupling sets `π/2`.
 */
export function streakTravelXZ(directionRad: number): { x: number; z: number } {
  return waveDirectionXZ(directionRad)
}

/** GLSL `smoothstep` of wind speed into the streak mask. 0 at calm. */
export function streakIntensityFromSpeedMs(speedMs: number): number {
  const s = Number.isFinite(speedMs) && speedMs > 0 ? speedMs : 0
  const lo = WIND_STREAK_DEFAULTS.fadeMsLo
  const hi = WIND_STREAK_DEFAULTS.fadeMsHi
  const t = Math.min(1, Math.max(0, (s - lo) / Math.max(hi - lo, 1e-6)))
  return t * t * (3 - 2 * t)
}

/** Along-wind scroll speed (m/s) for the gust UV. 0 when calm. */
export function streakScrollSpeedMs(speedMs: number): number {
  const s = Number.isFinite(speedMs) && speedMs > 0 ? speedMs : 0
  return s * WIND_STREAK_DEFAULTS.scrollPerWind
}

type WaveDef = {
  wavelength: number
  amplitude: number
  steepness: number
  dirOffset: number
  phase: number
}

/** Calm swell train; offsets are radians from `directionRad`. */
const WAVES: readonly WaveDef[] = [
  { wavelength: 48, amplitude: 0.32, steepness: 0.35, dirOffset: 0, phase: 0.15 },
  { wavelength: 31, amplitude: 0.18, steepness: 0.32, dirOffset: 0.22, phase: 1.7 },
  { wavelength: 19, amplitude: 0.09, steepness: 0.28, dirOffset: -0.18, phase: 0.4 },
  { wavelength: 11, amplitude: 0.045, steepness: 0.22, dirOffset: 0.51, phase: 2.2 },
  { wavelength: 7, amplitude: 0.025, steepness: 0.18, dirOffset: -0.62, phase: 3.1 },
]

function addGrid(
  positions: number[],
  indices: number[],
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  segmentsX: number,
  segmentsZ: number,
): void {
  const sx = Math.max(1, segmentsX | 0)
  const sz = Math.max(1, segmentsZ | 0)
  const base = positions.length / 3
  const nx = sx + 1
  const nz = sz + 1
  for (let iz = 0; iz < nz; iz++) {
    const z = z0 + ((z1 - z0) * iz) / sz
    for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ((x1 - x0) * ix) / sx
      positions.push(x, 0, z)
    }
  }
  for (let iz = 0; iz < sz; iz++) {
    for (let ix = 0; ix < sx; ix++) {
      const a = base + iz * nx + ix
      const b = a + 1
      const c = a + nx
      const d = c + 1
      // Winding so rest-pose normal is +Y (cross(+Z, +X)).
      indices.push(a, c, b, b, c, d)
    }
  }
}

/**
 * Concentric-ring clipmap on XZ, densest at the origin (moved to the camera).
 */
export function createClipmapGeometry(
  innerHalfExtentM: number,
  innerSegments: number,
  ringCount: number,
  ringSegments: number,
): THREE.BufferGeometry {
  const half = Math.max(1, innerHalfExtentM)
  const innerSeg = Math.max(2, innerSegments | 0)
  const rings = Math.max(1, ringCount | 0)
  const ringSeg = Math.max(4, ringSegments | 0)

  const positions: number[] = []
  const indices: number[] = []

  addGrid(positions, indices, -half, half, -half, half, innerSeg, innerSeg)

  const nLong = ringSeg * 2
  const nRadial = Math.max(2, (ringSeg / 2) | 0)
  for (let i = 1; i <= rings; i++) {
    const inner = half * 2 ** (i - 1)
    const outer = half * 2 ** i
    addGrid(positions, indices, -outer, outer, -outer, -inner, nLong, nRadial)
    addGrid(positions, indices, -outer, outer, inner, outer, nLong, nRadial)
    addGrid(positions, indices, -outer, -inner, -inner, inner, nRadial, nLong)
    addGrid(positions, indices, inner, outer, -inner, inner, nRadial, nLong)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

const VERTEX_SHADER = /* glsl */ `
  #define WAVE_COUNT ${GERSTNER_WAVE_COUNT}

  uniform float uTime;
  uniform float uDirectionRad;
  uniform vec4 uWaves[WAVE_COUNT];
  uniform float uWavePhase[WAVE_COUNT];

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vJacobian;
  varying float vWaveHeight;

  #include <common>
  #include <fog_pars_vertex>

  void gerstner(
    vec2 xz,
    float t,
    out vec3 disp,
    out vec3 tangent,
    out vec3 bitangent,
    out float jacobian
  ) {
    disp = vec3(0.0);
    float ddx_x = 0.0;
    float ddx_y = 0.0;
    float ddx_z = 0.0;
    float ddz_x = 0.0;
    float ddz_y = 0.0;
    float ddz_z = 0.0;

    for (int i = 0; i < WAVE_COUNT; i++) {
      vec4 w = uWaves[i];
      float lambda = w.x;
      float amp = w.y;
      float steep = w.z;
      float a = uDirectionRad + w.w;
      vec2 D = vec2(cos(a), sin(a));
      float k = 6.28318530718 / max(lambda, 0.001);
      float omega = sqrt(9.81 * k);
      float Q = steep / max(k * amp * float(WAVE_COUNT), 0.0001);
      float theta = k * dot(D, xz) - omega * t + uWavePhase[i];
      float s = sin(theta);
      float c = cos(theta);

      disp.x += Q * amp * D.x * c;
      disp.z += Q * amp * D.y * c;
      disp.y += amp * s;

      float wa = k * amp;
      ddx_x += -Q * D.x * D.x * wa * s;
      ddx_z += -Q * D.x * D.y * wa * s;
      ddz_x += -Q * D.y * D.x * wa * s;
      ddz_z += -Q * D.y * D.y * wa * s;
      ddx_y += D.x * wa * c;
      ddz_y += D.y * wa * c;
    }

    tangent = vec3(1.0 + ddx_x, ddx_y, ddx_z);
    bitangent = vec3(ddz_x, ddz_y, 1.0 + ddz_z);
    jacobian = (1.0 + ddx_x) * (1.0 + ddz_z) - ddx_z * ddz_x;
  }

  void main() {
    vec3 disp;
    vec3 tangent;
    vec3 bitangent;
    float jacobian;
    vec4 worldRest = modelMatrix * vec4(position, 1.0);
    gerstner(worldRest.xz, uTime, disp, tangent, bitangent, jacobian);

    vec3 localPos = position + disp;
    vec4 worldPos4 = modelMatrix * vec4(localPos, 1.0);
    vWorldPos = worldPos4.xyz;
    vNormal = normalize(cross(bitangent, tangent));
    vJacobian = jacobian;
    vWaveHeight = disp.y;

    vec4 mvPosition = viewMatrix * worldPos4;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uDirectionRad;
  uniform vec3 uSunDir;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSkyColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uFoamColor;
  uniform vec3 uSunColor;
  uniform float uWindSpeed;
  uniform float uGlitterSharpness;
  uniform float uGlitterIntensity;
  uniform float uStreakIntensity;
  uniform float uStreakScroll;
  uniform float uStreakContrast;
  uniform float uShoreFoamEnabled;
  uniform sampler2D uTerrainDepth;
  uniform mat4 uInvProjection;
  uniform mat4 uInvView;
  uniform vec2 uViewport;
  uniform vec2 uDepthUvScale;
  uniform float uLandY0;
  uniform float uLandY1;
  uniform float uTapPxInner;
  uniform float uTapPxOuter;
  uniform float uFoamStrength;
  uniform float uShallowStrength;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vJacobian;
  varying float vWaveHeight;

  #include <common>
  #include <fog_pars_fragment>

  float streakHash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float streakNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = streakHash21(i);
    float b = streakHash21(i + vec2(1.0, 0.0));
    float c = streakHash21(i + vec2(0.0, 1.0));
    float d = streakHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float windStreak(vec2 xz) {
    vec2 travel = vec2(cos(uDirectionRad), sin(uDirectionRad));
    vec2 across = vec2(-travel.y, travel.x);
    float along = dot(xz, travel) - uTime * uStreakScroll;
    float cross = dot(xz, across);
    vec2 uv = vec2(along * 0.012, cross * 0.10);
    float n = streakNoise(uv);
    n = n * 0.72 + streakNoise(uv * vec2(1.85, 1.55) + vec2(11.2, -4.7)) * 0.28;
    float gust = smoothstep(0.48, 0.76, n);
    return gust * uStreakIntensity;
  }

  vec3 worldFromDepth(vec2 uv, float depth) {
    vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 viewPos = uInvProjection * ndc;
    viewPos.xyz /= max(viewPos.w, 1e-6);
    vec4 worldPos = uInvView * vec4(viewPos.xyz, 1.0);
    return worldPos.xyz;
  }

  float landAt(vec2 screenUv) {
    vec2 depthUv = clamp(screenUv * uDepthUvScale, vec2(0.0), uDepthUvScale);
    float z = texture2D(uTerrainDepth, depthUv).r;
    if (z > 0.9995) return 0.0;
    vec3 wp = worldFromDepth(screenUv, z);
    return smoothstep(uLandY0, uLandY1, wp.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);
    vec3 R = reflect(-V, N);

    float ndv = max(dot(N, V), 0.0);
    float fresnel = mix(0.04, 1.0, pow(1.0 - ndv, 5.0));

    float skyT = clamp(R.y * 0.65 + 0.35, 0.0, 1.0);
    vec3 skyCol = mix(uHorizonColor, uSkyColor, skyT);
    vec3 waterCol = mix(uDeepColor, uShallowColor, ndv);
    vec3 color = mix(waterCol, skyCol, fresnel);

    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), uGlitterSharpness);
    float glint = pow(max(dot(R, L), 0.0), 96.0);
    float gust = windStreak(vWorldPos.xz);
    float glitterAmt = spec * uGlitterIntensity + glint * 0.45;
    glitterAmt *= 1.0 - gust * 0.7;
    color *= 1.0 - gust * uStreakContrast * 0.42;
    color += uSunColor * glitterAmt;

    float windF = clamp(uWindSpeed / 12.0, 0.15, 1.0);
    float fold = 1.0 - smoothstep(0.52, 0.94, vJacobian);
    float crest = smoothstep(0.10, 0.36, vWaveHeight);
    float foam = max(fold, crest * 0.4) * windF;

    if (uShoreFoamEnabled > 0.5) {
      vec2 screenUv = gl_FragCoord.xy / max(uViewport, vec2(1.0));
      vec2 texel = 1.0 / max(uViewport, vec2(1.0));
      float landHere = landAt(screenUv);
      float nearLand = landHere;
      float farLand = landHere;
      vec2 dirs[8];
      dirs[0] = vec2(1.0, 0.0);
      dirs[1] = vec2(-1.0, 0.0);
      dirs[2] = vec2(0.0, 1.0);
      dirs[3] = vec2(0.0, -1.0);
      dirs[4] = vec2(0.7071, 0.7071);
      dirs[5] = vec2(-0.7071, 0.7071);
      dirs[6] = vec2(0.7071, -0.7071);
      dirs[7] = vec2(-0.7071, -0.7071);
      for (int i = 0; i < 8; i++) {
        nearLand = max(nearLand, landAt(screenUv + dirs[i] * texel * uTapPxInner));
        farLand = max(farLand, landAt(screenUv + dirs[i] * texel * uTapPxOuter));
      }
      float waterHere = 1.0 - landHere;
      float shore = waterHere * nearLand;
      float shallow = waterHere * farLand;
      color = mix(color, uShallowColor, shallow * uShallowStrength);
      foam = max(foam, shore * uFoamStrength);
      foam = max(foam, landHere * 0.35);
    }

    color = mix(color, uFoamColor, clamp(foam, 0.0, 0.85));

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

function waveUniformVec4s(): THREE.Vector4[] {
  return WAVES.map(
    (w) => new THREE.Vector4(w.wavelength, w.amplitude, w.steepness, w.dirOffset),
  )
}

export function createGerstnerOcean(
  options?: Partial<GerstnerOceanOptions>,
): GerstnerOceanHandle {
  const { now: nowOpt, sunDirection: sunOpt, ...rest } = options ?? {}
  const opts: GerstnerOceanOptions = {
    ...GERSTNER_OCEAN_DEFAULTS,
    ...rest,
    now: nowOpt ?? (() => performance.now()),
    sunDirection:
      sunOpt ?? new THREE.Vector3(0.4, 0.75, 0.53).normalize(),
  }

  const geometry = createClipmapGeometry(
    opts.innerHalfExtentM,
    opts.innerSegments,
    opts.ringCount,
    opts.ringSegments,
  )

  const dummyDepth = new THREE.DepthTexture(1, 1)
  dummyDepth.format = THREE.DepthFormat
  dummyDepth.type = THREE.UnsignedIntType

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDirectionRad: { value: opts.directionRad },
      uWaves: { value: waveUniformVec4s() },
      uWavePhase: { value: WAVES.map((w) => w.phase) },
      uSunDir: { value: opts.sunDirection.clone().normalize() },
      uDeepColor: { value: new THREE.Color(opts.deepColor) },
      uShallowColor: { value: new THREE.Color(opts.shallowColor) },
      uSkyColor: { value: new THREE.Color(opts.skyColor) },
      uHorizonColor: { value: new THREE.Color(opts.horizonColor) },
      uFoamColor: { value: new THREE.Color(opts.foamColor) },
      uSunColor: { value: new THREE.Color(opts.sunColor) },
      uWindSpeed: { value: opts.windSpeed },
      uGlitterSharpness: { value: opts.glitterSharpness },
      uGlitterIntensity: { value: opts.glitterIntensity },
      uStreakIntensity: { value: streakIntensityFromSpeedMs(opts.windSpeed) },
      uStreakScroll: { value: streakScrollSpeedMs(opts.windSpeed) },
      uStreakContrast: { value: WIND_STREAK_DEFAULTS.contrast },
      uShoreFoamEnabled: { value: 0 },
      uTerrainDepth: { value: null as THREE.Texture | null },
      uInvProjection: { value: new THREE.Matrix4() },
      uInvView: { value: new THREE.Matrix4() },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uDepthUvScale: { value: new THREE.Vector2(1, 1) },
      uLandY0: { value: SHORE_FOAM_DEFAULTS.landY0 },
      uLandY1: { value: SHORE_FOAM_DEFAULTS.landY1 },
      uTapPxInner: { value: SHORE_FOAM_DEFAULTS.tapPxInner },
      uTapPxOuter: { value: SHORE_FOAM_DEFAULTS.tapPxOuter },
      uFoamStrength: { value: SHORE_FOAM_DEFAULTS.foamStrength },
      uShallowStrength: { value: SHORE_FOAM_DEFAULTS.shallowStrength },
    },
  ])
  uniforms['uTerrainDepth']!.value = dummyDepth

  const material = new THREE.ShaderMaterial({
    name: 'gerstnerOcean',
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    fog: true,
    lights: false,
    side: THREE.FrontSide,
    toneMapped: true,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'gerstnerOcean'
  mesh.frustumCulled = false
  mesh.renderOrder = -20
  mesh.position.y = COURSE_WATER_Y + opts.liftY

  const now = opts.now
  const _camWorld = new THREE.Vector3()
  const _invProjection = uniforms['uInvProjection']!.value as THREE.Matrix4
  const _invView = uniforms['uInvView']!.value as THREE.Matrix4
  const _viewport = uniforms['uViewport']!.value as THREE.Vector2
  const _depthUvScale = uniforms['uDepthUvScale']!.value as THREE.Vector2
  let disposed = false
  let lastTime = 0
  let shoreContact: THREE.Object3D | null = null
  let shoreTarget: THREE.WebGLRenderTarget | null = null
  let prepassing = false

  function sampleClock(): void {
    if (disposed) return
    lastTime = now() * 0.001
    uniforms['uTime']!.value = lastTime
  }

  function disarmShoreFoam(): void {
    uniforms['uShoreFoamEnabled']!.value = 0
    uniforms['uTerrainDepth']!.value = dummyDepth
    disposeShoreDepthTarget(shoreTarget)
    shoreTarget = null
  }

  function armShoreFoam(): void {
    if (!shoreTarget) {
      shoreTarget = createShoreDepthTarget(1, 1)
    }
    uniforms['uTerrainDepth']!.value = shoreTarget.depthTexture
  }

  mesh.onBeforeRender = (renderer, _scene, camera) => {
    if (disposed) return
    sampleClock()
    camera.getWorldPosition(_camWorld)
    mesh.position.x = _camWorld.x
    mesh.position.z = _camWorld.z
    mesh.position.y = COURSE_WATER_Y + opts.liftY

    const contact = shoreContact
    if (!contact || !contact.visible || prepassing) {
      uniforms['uShoreFoamEnabled']!.value = 0
      return
    }

    const drawing = currentDrawingSize(renderer)
    const depth = shoreDepthSize(drawing.width, drawing.height)
    armShoreFoam()
    const target = shoreTarget
    if (!target) {
      uniforms['uShoreFoamEnabled']!.value = 0
      return
    }
    resizeShoreDepthTarget(target, depth.width, depth.height)

    _viewport.set(drawing.width, drawing.height)
    _depthUvScale.set(1, 1)
    _invProjection.copy(camera.projectionMatrix).invert()
    _invView.copy(camera.matrixWorld)

    prepassing = true
    try {
      renderTerrainDepthPrepass(renderer, camera, contact, target)
      uniforms['uShoreFoamEnabled']!.value = 1
    } catch {
      uniforms['uShoreFoamEnabled']!.value = 0
    } finally {
      prepassing = false
    }
  }

  return {
    mesh,
    getTime: () => lastTime,
    getDirectionRad: () => uniforms['uDirectionRad']!.value as number,
    setDirectionRad(rad: number): void {
      uniforms['uDirectionRad']!.value = rad
    },
    getWindSpeed: () => uniforms['uWindSpeed']!.value as number,
    setWindSpeed(ms: number): void {
      uniforms['uWindSpeed']!.value = ms
      uniforms['uStreakIntensity']!.value = streakIntensityFromSpeedMs(ms)
      uniforms['uStreakScroll']!.value = streakScrollSpeedMs(ms)
    },
    setAmplitudeScale(scale: number): void {
      const s = Number.isFinite(scale) && scale > 0 ? scale : 1
      const waves = uniforms['uWaves']!.value as THREE.Vector4[]
      for (let i = 0; i < WAVES.length; i++) {
        waves[i]!.y = WAVES[i]!.amplitude * s
      }
    },
    setShoreContact(terrainRoot: THREE.Object3D | null): void {
      if (disposed) return
      shoreContact = terrainRoot
      if (terrainRoot) {
        armShoreFoam()
      } else {
        disarmShoreFoam()
      }
    },
    getShoreFoamEnabled: () => shoreContact !== null,
    getShoreDepthTarget: () => shoreTarget,
    tick(_dtSeconds: number): void {
      sampleClock()
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      mesh.onBeforeRender = () => {}
      shoreContact = null
      disarmShoreFoam()
      dummyDepth.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}
