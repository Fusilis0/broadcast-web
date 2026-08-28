import * as THREE from 'three'
import { COURSE_WATER_Y } from '../course/courseLayout.ts'
import {
  SHORE_FOAM_DEFAULTS,
  createShoreDepthTarget,
  currentDrawingSize,
  disposeShoreDepthTarget,
  renderTerrainDepthPrepass,
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
 * **Clipmap (15.2, 60 fps preview budget after OUT-01):** inner 32×32 over
 * ±48 m (~3 m spacing), 7 concentric rings, 24 segments/ring. Outer half-extent
 * 48 × 2^7 = 6144 m; scene fog (far 5200) hides the far edge. Inner 48→32 is
 * the default cost cut (near-field verts 49²→33² ≈ −55%). Rings stay at 7 so
 * the rim stays past fog — `seaQuality: 'low'` drops to 5 rings (rim 1536 m)
 * plus quarter-res shore foam. Follow is a **per-pass `uClipmapCenter` uniform**
 * (quantized to the inner cell), not `mesh.position` — preview and NDI air
 * cameras must not fight over one mesh transform. Coarser rings overlap the
 * finer level by ≥ one finer cell so T-junctions sit inside the denser patch
 * (no white hairline seams). No extra `readPixels`. Shore foam (14.2c) adds
 * **one half-res depth FBO** of the terrain group only while terrain +
 * realistic ocean are both mounted (skipped on transparent/chroma). Preview vs
 * NDI drawing sizes keep **two** cached depth targets so the RT is not resized
 * every dual-render.
 *
 * **Wind streaks (14.3e, cranked 15.2 / 16.1):** anisotropic gust mask scrolled
 * along `uDirectionRad` (same XZ travel as swell). Procedural value-noise is
 * replaced by a 256² tileable **mipmapped** noise texture so camera motion
 * does not boil; `fwidth()` widens foam/streak/glitter edges, and a distance +
 * grazing fade kills high-frequency shading before the outer rings. Masks
 * sample **world XZ** (`vWorldPos`), never clipmap-local coords. Intensity and
 * scroll scale from `setWindSpeed`; calm wind fades the mask to 0. No particles,
 * no extra FBO, no `readPixels`. A cheap 3D vane (14.3f lite) lives in
 * `windVane.ts`.
 */

export const GERSTNER_WAVE_COUNT = 5 as const

export const GERSTNER_OCEAN_DEFAULTS = {
  /** Inner grid half-extent (meters) at the camera. */
  innerHalfExtentM: 48,
  /**
   * Inner subdivisions. 48→32 is the 15.2 default cost cut (~3 m spacing;
   * 49²→33² verts). Keep 7 rings so the rim stays past fog — see header.
   */
  innerSegments: 32,
  /** Concentric rings beyond the inner grid. Outer half-extent = inner × 2^n. */
  ringCount: 7,
  /** Segments along each ring's long edge (half of the outer span uses 2×). */
  ringSegments: 24,
  /**
   * Tiny lift above local MSL (`COURSE_WATER_Y` = 0) so the Gerstner surface
   * does not z-fight land skirts. Terrain **water** is discarded in the tileset
   * shader (16.1) — do not raise this to cover Cesium's baked sea.
   */
  liftY: 0.08,
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
  /** Mild sun sparkle (was 220 / 0.55 + a second glint — blew out a quadrant). */
  glitterSharpness: 78,
  glitterIntensity: 0.16,
  /** Shore-foam depth RT scale vs drawing buffer. High 0.5; low 0.25. */
  shoreDepthScale: 0.5,
} as const

/**
 * 14.3e gust-mask knobs (15.2: higher contrast + tighter cross-wind scale so
 * travel reads on grey water at ~5–12 m/s). Spatial stretch lives in the
 * fragment shader (~0.016 /m along-wind, ~0.22 /m across).
 */
export const WIND_STREAK_DEFAULTS = {
  /** At or below this speed (m/s), streak intensity is 0. */
  fadeMsLo: 0.4,
  /** Full streak intensity (m/s). */
  fadeMsHi: 5,
  /** World-space scroll (m/s) per 1 m/s of wind. */
  scrollPerWind: 1.8,
  /** How hard the mask darkens albedo / kills glitter (0–1). */
  contrast: 0.88,
} as const

/** Edge length of the tileable foam/streak/glitter noise texture. */
export const OCEAN_NOISE_SIZE = 256 as const

/**
 * High-frequency foam / streaks / glitter fade to 0 well before the outer
 * clipmap rings (rim 6144 m). Shore foam is not faded — it must still read
 * from a drone height.
 */
export const OCEAN_DETAIL_FADE = {
  nearM: 80,
  farM: 900,
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
  shoreDepthScale: number
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

function wrapPeriod(i: number, period: number): number {
  const p = Math.max(1, period | 0)
  return ((i % p) + p) % p
}

function hash2(ix: number, iy: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return (n >>> 0) / 4294967296
}

function tileableValueNoise(u: number, v: number, cells: number): number {
  const x = u * cells
  const y = v * cells
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash2(wrapPeriod(x0, cells), wrapPeriod(y0, cells))
  const b = hash2(wrapPeriod(x0 + 1, cells), wrapPeriod(y0, cells))
  const c = hash2(wrapPeriod(x0, cells), wrapPeriod(y0 + 1, cells))
  const d = hash2(wrapPeriod(x0 + 1, cells), wrapPeriod(y0 + 1, cells))
  return a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + d * sx * sy
}

/**
 * 256² tileable RGBA noise (`Repeat`, `LinearMipmapLinear`) for foam / streak /
 * glitter masks. GPU mips band-limit the pattern under camera motion.
 */
export function createOceanNoiseTexture(
  size: number = OCEAN_NOISE_SIZE,
): THREE.DataTexture {
  const n = Math.max(16, size | 0)
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n
      const v = y / n
      const t =
        tileableValueNoise(u, v, 8) * 0.65 + tileableValueNoise(u, v, 16) * 0.35
      const b = Math.round(Math.min(1, Math.max(0, t)) * 255)
      const i = (y * n + x) * 4
      data[i] = b
      data[i + 1] = b
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(
    data,
    n,
    n,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  )
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  tex.colorSpace = THREE.NoColorSpace
  tex.name = 'gerstnerOceanNoise'
  return tex
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
 * Coarser rings overlap the finer level by ≥ one finer cell so T-junctions
 * after Gerstner displacement sit inside the denser patch.
 */
export type ClipmapPatchSpec = {
  x0: number
  x1: number
  z0: number
  z1: number
  segmentsX: number
  segmentsZ: number
}

/** Nominal inner half-extent of ring `ringIndex` (1-based). */
export function clipmapRingInnerM(
  innerHalfExtentM: number,
  ringIndex: number,
): number {
  const half = Math.max(1, innerHalfExtentM)
  const i = Math.max(1, ringIndex | 0)
  return half * 2 ** (i - 1)
}

export function clipmapRingOuterM(
  innerHalfExtentM: number,
  ringIndex: number,
): number {
  const half = Math.max(1, innerHalfExtentM)
  const i = Math.max(1, ringIndex | 0)
  return half * 2 ** i
}

/**
 * Inward overlap (m) of ring `ringIndex` under the finer level.
 * Clamped on tiny test grids so the hole stays open.
 */
export function clipmapRingOverlapM(
  innerHalfExtentM: number,
  innerSegments: number,
  ringSegments: number,
  ringIndex: number,
): number {
  const half = Math.max(1, innerHalfExtentM)
  const innerSeg = Math.max(2, innerSegments | 0)
  const ringSeg = Math.max(4, ringSegments | 0)
  const nRadial = Math.max(2, (ringSeg / 2) | 0)
  const i = Math.max(1, ringIndex | 0)
  const inner = clipmapRingInnerM(half, i)
  const finerCell =
    i <= 1 ? (2 * half) / innerSeg : clipmapRingInnerM(half, i - 1) / nRadial
  return Math.min(finerCell, inner * 0.35)
}

export function clipmapPatchSpecs(
  innerHalfExtentM: number,
  innerSegments: number,
  ringCount: number,
  ringSegments: number,
): ClipmapPatchSpec[] {
  const half = Math.max(1, innerHalfExtentM)
  const innerSeg = Math.max(2, innerSegments | 0)
  const rings = Math.max(1, ringCount | 0)
  const ringSeg = Math.max(4, ringSegments | 0)
  const nLong = ringSeg * 2
  const nRadial = Math.max(2, (ringSeg / 2) | 0)

  const patches: ClipmapPatchSpec[] = [
    {
      x0: -half,
      x1: half,
      z0: -half,
      z1: half,
      segmentsX: innerSeg,
      segmentsZ: innerSeg,
    },
  ]

  for (let i = 1; i <= rings; i++) {
    const inner = clipmapRingInnerM(half, i)
    const outer = clipmapRingOuterM(half, i)
    const overlap = clipmapRingOverlapM(half, innerSeg, ringSeg, i)
    const innerEdge = inner - overlap
    patches.push(
      {
        x0: -outer,
        x1: outer,
        z0: -outer,
        z1: -innerEdge,
        segmentsX: nLong,
        segmentsZ: nRadial,
      },
      {
        x0: -outer,
        x1: outer,
        z0: innerEdge,
        z1: outer,
        segmentsX: nLong,
        segmentsZ: nRadial,
      },
      {
        x0: -outer,
        x1: -innerEdge,
        z0: -innerEdge,
        z1: innerEdge,
        segmentsX: nRadial,
        segmentsZ: nLong,
      },
      {
        x0: innerEdge,
        x1: outer,
        z0: -innerEdge,
        z1: innerEdge,
        segmentsX: nRadial,
        segmentsZ: nLong,
      },
    )
  }
  return patches
}

export function createClipmapGeometry(
  innerHalfExtentM: number,
  innerSegments: number,
  ringCount: number,
  ringSegments: number,
): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []

  for (const p of clipmapPatchSpecs(
    innerHalfExtentM,
    innerSegments,
    ringCount,
    ringSegments,
  )) {
    addGrid(positions, indices, p.x0, p.x1, p.z0, p.z1, p.segmentsX, p.segmentsZ)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

/** Inner clipmap cell size (m). Follow snaps to this so vertices do not swim. */
export function clipmapCellSizeM(
  innerHalfExtentM: number,
  innerSegments: number,
): number {
  const half = Math.max(1, innerHalfExtentM)
  const segs = Math.max(2, innerSegments | 0)
  return (half * 2) / segs
}

/** Quantize camera XZ to the clipmap cell so dual-pass follow stays stable. */
export function quantizeClipmapCenter(
  x: number,
  z: number,
  cellM: number,
): { x: number; z: number } {
  const c = Number.isFinite(cellM) && cellM > 1e-6 ? cellM : 1
  return {
    x: Math.round(x / c) * c,
    z: Math.round(z / c) * c,
  }
}

const VERTEX_SHADER = /* glsl */ `
  #define WAVE_COUNT ${GERSTNER_WAVE_COUNT}

  uniform float uTime;
  uniform float uDirectionRad;
  uniform vec2 uClipmapCenter;
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
    vec4 worldRest4 = modelMatrix * vec4(position, 1.0);
    vec3 worldRest = vec3(
      worldRest4.x + uClipmapCenter.x,
      worldRest4.y,
      worldRest4.z + uClipmapCenter.y
    );
    gerstner(worldRest.xz, uTime, disp, tangent, bitangent, jacobian);

    vec3 worldPos = worldRest + disp;
    vWorldPos = worldPos;
    vNormal = normalize(cross(bitangent, tangent));
    vJacobian = jacobian;
    vWaveHeight = disp.y;

    vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
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
  uniform sampler2D uNoise;
  uniform float uDetailFadeNear;
  uniform float uDetailFadeFar;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vJacobian;
  varying float vWaveHeight;

  #include <common>
  #include <fog_pars_fragment>

  float streakNoise(vec2 p) {
    return texture2D(uNoise, p * 0.07).r;
  }

  float windStreak(vec2 xz) {
    vec2 travel = vec2(cos(uDirectionRad), sin(uDirectionRad));
    vec2 across = vec2(-travel.y, travel.x);
    float along = dot(xz, travel) - uTime * uStreakScroll;
    float cross = dot(xz, across);
    vec2 uv = vec2(along * 0.016, cross * 0.22);
    float n = streakNoise(uv);
    n = n * 0.65 + streakNoise(uv * vec2(2.1, 1.4) + vec2(11.2, -4.7)) * 0.35;
    float w = max(fwidth(n), 1e-4);
    float gust = smoothstep(0.32 - w, 0.58 + w, n);
    return gust * uStreakIntensity;
  }

  float highFreqFade(float ndv) {
    float dist = length(cameraPosition.xz - vWorldPos.xz);
    float distFade = 1.0 - smoothstep(uDetailFadeNear, uDetailFadeFar, dist);
    float graze = pow(max(ndv, 0.0), 0.45);
    return distFade * graze;
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

    float fade = highFreqFade(ndv);

    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), uGlitterSharpness);
    float specW = max(fwidth(spec), 1e-4);
    spec = smoothstep(0.0, specW * 2.0, spec);
    float sparkle = texture2D(uNoise, vWorldPos.xz * 0.045 + vec2(0.17, -0.09)).r;
    float sparkleW = max(fwidth(sparkle), 1e-4);
    sparkle = smoothstep(0.42 - sparkleW, 0.72 + sparkleW, sparkle);

    float gust = windStreak(vWorldPos.xz) * fade;
    float glitterAmt = spec * sparkle * uGlitterIntensity * fade;
    glitterAmt *= 1.0 - gust * 0.85;
    color *= 1.0 - gust * uStreakContrast * 0.70;
    color += uShallowColor * gust * 0.14;
    color += uSunColor * glitterAmt;

    float windF = clamp(uWindSpeed / 12.0, 0.15, 1.0);
    float jacW = max(fwidth(vJacobian), 1e-4);
    float fold = 1.0 - smoothstep(0.52 - jacW, 0.94 + jacW, vJacobian);
    float crestW = max(fwidth(vWaveHeight), 1e-4);
    float crest = smoothstep(0.10 - crestW, 0.36 + crestW, vWaveHeight);
    float foam = max(fold, crest * 0.4) * windF * fade;

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

  const noiseTex = createOceanNoiseTexture(OCEAN_NOISE_SIZE)

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDirectionRad: { value: opts.directionRad },
      uClipmapCenter: { value: new THREE.Vector2(0, 0) },
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
      uNoise: { value: noiseTex },
      uDetailFadeNear: { value: OCEAN_DETAIL_FADE.nearM },
      uDetailFadeFar: { value: OCEAN_DETAIL_FADE.farM },
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
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'gerstnerOcean'
  mesh.frustumCulled = false
  mesh.renderOrder = -20
  mesh.position.set(0, COURSE_WATER_Y + opts.liftY, 0)

  const now = opts.now
  const cellM = clipmapCellSizeM(opts.innerHalfExtentM, opts.innerSegments)
  const _camWorld = new THREE.Vector3()
  const _clipCenter = uniforms['uClipmapCenter']!.value as THREE.Vector2
  const _invProjection = uniforms['uInvProjection']!.value as THREE.Matrix4
  const _invView = uniforms['uInvView']!.value as THREE.Matrix4
  const _viewport = uniforms['uViewport']!.value as THREE.Vector2
  const _depthUvScale = uniforms['uDepthUvScale']!.value as THREE.Vector2
  let disposed = false
  let lastTime = 0
  let shoreContact: THREE.Object3D | null = null
  let lastShoreTarget: THREE.WebGLRenderTarget | null = null
  const shoreCache: { key: string; target: THREE.WebGLRenderTarget }[] = []
  let prepassing = false

  function sampleClock(): void {
    if (disposed) return
    lastTime = now() * 0.001
    uniforms['uTime']!.value = lastTime
  }

  function disposeShoreCache(): void {
    for (const entry of shoreCache) {
      disposeShoreDepthTarget(entry.target)
    }
    shoreCache.length = 0
    lastShoreTarget = null
  }

  function disarmShoreFoam(): void {
    uniforms['uShoreFoamEnabled']!.value = 0
    uniforms['uTerrainDepth']!.value = dummyDepth
    disposeShoreCache()
  }

  function shoreTargetForSize(
    width: number,
    height: number,
  ): THREE.WebGLRenderTarget {
    const key = `${width}x${height}`
    const hit = shoreCache.find((e) => e.key === key)
    if (hit) return hit.target
    const target = createShoreDepthTarget(width, height)
    shoreCache.push({ key, target })
    while (shoreCache.length > 2) {
      const evict = shoreCache.shift()
      if (evict) disposeShoreDepthTarget(evict.target)
    }
    return target
  }

  mesh.onBeforeRender = (renderer, _scene, camera) => {
    if (disposed) return
    sampleClock()
    camera.getWorldPosition(_camWorld)
    const snapped = quantizeClipmapCenter(_camWorld.x, _camWorld.z, cellM)
    _clipCenter.set(snapped.x, snapped.z)

    const contact = shoreContact
    if (!contact || !contact.visible || prepassing) {
      uniforms['uShoreFoamEnabled']!.value = 0
      return
    }

    const drawing = currentDrawingSize(renderer)
    const depth = shoreDepthSize(
      drawing.width,
      drawing.height,
      opts.shoreDepthScale,
    )
    const target = shoreTargetForSize(depth.width, depth.height)
    lastShoreTarget = target
    uniforms['uTerrainDepth']!.value = target.depthTexture

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
      if (!terrainRoot) {
        disarmShoreFoam()
        return
      }
      if (shoreCache.length === 0) {
        const placeholder = createShoreDepthTarget(1, 1)
        shoreCache.push({ key: '1x1', target: placeholder })
        lastShoreTarget = placeholder
        uniforms['uTerrainDepth']!.value = placeholder.depthTexture
      }
    },
    getShoreFoamEnabled: () => shoreContact !== null,
    getShoreDepthTarget: () => lastShoreTarget,
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
      noiseTex.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}
