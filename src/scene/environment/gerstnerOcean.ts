import * as THREE from 'three'
import { COURSE_WATER_Y } from '../course/courseLayout.ts'
import { clampSeaHeightYM } from '../waterPlanePlacement.ts'
import {
  SHORE_FOAM_DEFAULTS,
  createShoreDepthTarget,
  currentDrawingSize,
  disposeShoreDepthTarget,
  renderTerrainDepthPrepass,
  shoreDepthSize,
} from './shoreFoam.ts'
import {
  OCEAN_SUPPRESS_CAP,
  oceanSuppressShaderChunk,
  type OceanSuppressFootprint,
} from './oceanSuppress.ts'

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
 * **Flat sea (19.15 / DSP-04-01 … 04-08):** `displacementScale` defaults
 * to **0** — vertex Gerstner stays off so boards are not buried. Fragment
 * evaluates the **same** Gerstner train with **shading amps** (authored × wind,
 * **not** × disp) for animated N / jacobian / crest foam + glitter. 04-03 adds
 * Gerstner trough albedo + wide sky sheen; 04-04 quiets foam crests, softens
 * sheen/glitter/fade falloff; 04-07 locks **dark deep water** (not 04-06 bright
 * cyan) with gentler troughs (no charcoal bands). 04-08 scales fragment
 * spatial frequency **`OCEAN_LOOK_XZ_SCALE` (1/9 wavelengths / ×9 noise)** so
 * ripples read finer — clipmap extent is unchanged. 04-08 first shipped ×3
 * (too coarse / “zoomed in”). Operator: use 1/9. That kills
 * the camera-locked half-screen Blinn terminator on a constant up normal.
 * Environment **sea m** moves `mesh.position.y`. Platform suppress flatten
 * remains optional; fragment **discard** holes are gone. No extra FBO /
 * `readPixels`. Terrain land-only + Cesium hide-m discard unchanged.
 *
 * **Wind streaks (14.3e, cranked 15.2 / 16.1, muted 04-03):** anisotropic gust
 * mask scrolled along `uDirectionRad` (same XZ travel as swell). **Albedo
 * darkening retired** — the old `gust * contrast` multiply drew N–S curtains
 * that fought E–W Gerstner foam. Gust may chop glitter only. Trough darkening
 * is fragment `waveHeight` from `uShadingWaves` (same train as foam). Procedural
 * value-noise is a 256² tileable **mipmapped** texture; `fwidth()` + distance
 * fade band-limit foam/streak/glitter. Masks sample **world XZ**. Intensity and
 * scroll from `setWindSpeed`; calm → 0. No particles, extra FBO, or `readPixels`.
 * A cheap 3D vane (14.3f lite) lives in `windVane.ts`.
 */

/**
 * Fragment look scale (DSP-04-08 Fail). Wavelengths × this; streak/noise UV
 * frequencies ÷ this. **1/9** (not 3) — operator wanted finer ripples, not
 * stretched blobs. Clipmap extent is unchanged (coverage, not look).
 */
export const OCEAN_LOOK_XZ_SCALE = 1 / 9

/** Authored Gerstner wavelengths before look-scale (meters). */
export const OCEAN_LOOK_BASE_WAVELENGTHS_M = [48, 31, 19, 11, 7] as const

export const OCEAN_LOOK_STREAK_ALONG = 0.016 / OCEAN_LOOK_XZ_SCALE
export const OCEAN_LOOK_STREAK_ACROSS = 0.22 / OCEAN_LOOK_XZ_SCALE
export const OCEAN_LOOK_STREAK_NOISE = 0.07 / OCEAN_LOOK_XZ_SCALE

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
   * Multiply rest-pose Gerstner amplitudes after wind scale.
   * **0** = flat shaded plane (product lock); fragment look stays.
   */
  displacementScale: 0,
  /**
   * Wave travel in scene XZ (radians). `waveDirectionXZ(θ) = (cos θ, sin θ)`.
   * Default −π/2 = toward −Z = geographic north.
   */
  directionRad: -Math.PI / 2,
  /** Foam scale only this slice (m/s); 14.2b may drive it from the wind bus. */
  windSpeed: 6,
  /** Near-field dark deep water (04-07). Not 04-06 bright cyan 0x15606c. */
  deepColor: 0x0c2f3a,
  /** Shallow bands — dark slate-teal, not tropical 0x2e8a86. */
  shallowColor: 0x164a55,
  skyColor: 0xb7cce0,
  /** Dark horizon — shared with realistic fog. Not 04-06 mid-teal 0x5a8a8c. */
  horizonColor: 0x2a4a52,
  /** Quieter crest (was 0xe8eef2 — near-white bands). */
  foamColor: 0x9ab0bc,
  sunColor: 0xe8eef5,
  /** Mild sun sparkle (was 220 / 0.55 + a second glint — blew out a quadrant). */
  glitterSharpness: 78,
  /** Weaker blob (04-04); keep mild sun hit, smoother falloff. */
  glitterIntensity: 0.1,
  /** Shore-foam depth RT scale vs drawing buffer. High 0.5; low 0.25. */
  shoreDepthScale: 0.5,
} as const

/**
 * Wide wet sheen (04-03 / softer 04-04). Soft Blinn + sky tint so matte water
 * still reads wet. Wider + weaker than 04-03 so the lobe ramps (no terminator).
 * Must stay far below `glitterSharpness` — do not crank (old quadrant blowout).
 */
export const OCEAN_SHEEN_DEFAULTS = {
  sharpness: 3.5,
  intensity: 0.1,
} as const

/**
 * Trough albedo (04-05). Old `deep * 0.58` × mix 0.82 read charcoal on
 * `0x1e3a4c`. Scale closer to 1 and a lighter mix keep bands teal.
 */
export const OCEAN_TROUGH_DEFAULTS = {
  deepScale: 0.82,
  mix: 0.48,
} as const

/**
 * 14.3e gust-mask knobs. Spatial stretch lives in the fragment
 * (`OCEAN_LOOK_STREAK_ALONG` / `_ACROSS` after 04-08 look-scale). **04-03:**
 * albedo darkening retired (`contrast` 0); gust only chops glitter. Troughs
 * come from Gerstner `waveHeight`.
 */
export const WIND_STREAK_DEFAULTS = {
  /** At or below this speed (m/s), streak intensity is 0. */
  fadeMsLo: 0.4,
  /** Full streak intensity (m/s). */
  fadeMsHi: 5,
  /** World-space scroll (m/s) per 1 m/s of wind. */
  scrollPerWind: 1.8,
  /** Albedo multiply retired (was 0.88 — N–S curtains). Keep 0. */
  contrast: 0,
} as const

/** Edge length of the tileable foam/streak/glitter noise texture. */
export const OCEAN_NOISE_SIZE = 256 as const

/**
 * High-frequency foam / streaks / glitter fade to 0 well before the outer
 * clipmap rings (rim 6144 m). Wider band (04-04) so detail does not ring-cut.
 * Shore foam is not faded — it must still read from a drone height.
 */
export const OCEAN_DETAIL_FADE = {
  nearM: 40,
  farM: 1600,
} as const

export type GerstnerOceanOptions = {
  innerHalfExtentM: number
  innerSegments: number
  ringCount: number
  ringSegments: number
  liftY: number
  /**
   * Rest-pose amplitude multiplier (0 = flat plane). Applied on top of
   * `setAmplitudeScale` (wind). Default 0.
   */
  displacementScale: number
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
   * Vertex amp = authored × `displacementScale` × scale.
   * Fragment shading amp = authored × scale (**not** × disp) so flat sea still
   * animates N/foam. Scale **0** zeros both.
   */
  setAmplitudeScale: (scale: number) => void
  /** Rest Y offset (Environment **sea m**). Mesh y = COURSE_WATER_Y + liftY + seaYM. */
  setSeaHeightYM: (yM: number) => void
  getSeaHeightYM: () => number
  /**
   * Terrain group to depth-prepass for shore foam. `null` disables the extra
   * FBO (terrain off, simple env, or transparent/chroma).
   */
  setShoreContact: (terrainRoot: THREE.Object3D | null) => void
  /**
   * World-XZ footprints to flatten (19.15). Cap `OCEAN_SUPPRESS_CAP`.
   * Empty → no local flatten. Same mesh; no extra FBO. No fragment discard.
   */
  setSuppressFootprints: (footprints: readonly OceanSuppressFootprint[]) => void
  getSuppressCount: () => number
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

/** Calm swell train; offsets are radians from `directionRad`. Look-scale 1/9. */
const WAVES: readonly WaveDef[] = [
  { wavelength: 48 * OCEAN_LOOK_XZ_SCALE, amplitude: 0.32, steepness: 0.35, dirOffset: 0, phase: 0.15 },
  { wavelength: 31 * OCEAN_LOOK_XZ_SCALE, amplitude: 0.18, steepness: 0.32, dirOffset: 0.22, phase: 1.7 },
  { wavelength: 19 * OCEAN_LOOK_XZ_SCALE, amplitude: 0.09, steepness: 0.28, dirOffset: -0.18, phase: 0.4 },
  { wavelength: 11 * OCEAN_LOOK_XZ_SCALE, amplitude: 0.045, steepness: 0.22, dirOffset: 0.51, phase: 2.2 },
  { wavelength: 7 * OCEAN_LOOK_XZ_SCALE, amplitude: 0.025, steepness: 0.18, dirOffset: -0.62, phase: 3.1 },
]

export function gerstnerWaveWavelengthsM(): number[] {
  return WAVES.map((w) => w.wavelength)
}

/** Rest-pose peak |Y| if all crests aligned — exceeds board lift (~0.08 m). */
export function gerstnerPeakAmplitudeM(): number {
  let sum = 0
  for (const w of WAVES) sum += w.amplitude
  return sum
}

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

/**
 * Shared Gerstner train. `waveUniform` is `uWaves` (vertex disp) or
 * `uShadingWaves` (fragment N/foam — not × displacementScale).
 */
function gerstnerFunctionChunk(waveUniform: 'uWaves' | 'uShadingWaves'): string {
  return /* glsl */ `
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
      vec4 w = ${waveUniform}[i];
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
`
}

const VERTEX_SHADER = /* glsl */ `
  #define WAVE_COUNT ${GERSTNER_WAVE_COUNT}
  ${oceanSuppressShaderChunk()}

  uniform float uTime;
  uniform float uDirectionRad;
  uniform vec2 uClipmapCenter;
  uniform vec4 uWaves[WAVE_COUNT];
  uniform float uWavePhase[WAVE_COUNT];

  varying vec3 vWorldPos;

  #include <common>
  #include <fog_pars_vertex>

  ${gerstnerFunctionChunk('uWaves')}

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

    vec2 suppress = oceanSuppressAmounts(worldRest.xz);
    disp *= 1.0 - suppress.x;

    vec3 worldPos = worldRest + disp;
    vWorldPos = worldPos;

    vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  #define WAVE_COUNT ${GERSTNER_WAVE_COUNT}

  uniform float uTime;
  uniform float uDirectionRad;
  uniform vec4 uShadingWaves[WAVE_COUNT];
  uniform float uWavePhase[WAVE_COUNT];
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

  #include <common>
  #include <fog_pars_fragment>

  ${gerstnerFunctionChunk('uShadingWaves')}

  float streakNoise(vec2 p) {
    return texture2D(uNoise, p * float(${OCEAN_LOOK_STREAK_NOISE})).r;
  }

  float windStreak(vec2 xz) {
    vec2 travel = vec2(cos(uDirectionRad), sin(uDirectionRad));
    vec2 across = vec2(-travel.y, travel.x);
    float along = dot(xz, travel) - uTime * uStreakScroll;
    float cross = dot(xz, across);
    vec2 uv = vec2(along * float(${OCEAN_LOOK_STREAK_ALONG}), cross * float(${OCEAN_LOOK_STREAK_ACROSS}));
    float n = streakNoise(uv);
    n = n * 0.65 + streakNoise(uv * vec2(2.1, 1.4) + vec2(11.2, -4.7)) * 0.35;
    float w = max(fwidth(n), 1e-4);
    float gust = smoothstep(0.32 - w, 0.58 + w, n);
    return gust * uStreakIntensity;
  }

  float highFreqFade(float ndv) {
    float dist = length(cameraPosition.xz - vWorldPos.xz);
    float distFade = 1.0 - smoothstep(uDetailFadeNear, uDetailFadeFar, dist);
    // Softer graze (was 0.45) so lighting does not hard-cut at the horizon.
    float graze = pow(max(ndv, 0.0), 0.28);
    return distFade * graze;
  }

  float shadingAmpFade() {
    float dist = length(cameraPosition.xz - vWorldPos.xz);
    return 1.0 - smoothstep(uDetailFadeNear, uDetailFadeFar, dist);
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
    // Fragment Gerstner for lighting only (mesh Y stays rest when disp=0).
    vec3 shadeDisp;
    vec3 shadeTangent;
    vec3 shadeBitangent;
    float shadeJacobian;
    gerstner(
      vWorldPos.xz,
      uTime,
      shadeDisp,
      shadeTangent,
      shadeBitangent,
      shadeJacobian
    );
    float shadeAmp = shadingAmpFade();
    // Do not flatten fragment shading under board footprints (disp=0 product
    // lock). suppress.x painted rectangular “plates” of matte water behind
    // logos / START / FINISH. Distance fade only.
    float flatten = 1.0 - shadeAmp;
    shadeTangent = mix(shadeTangent, vec3(1.0, 0.0, 0.0), flatten);
    shadeBitangent = mix(shadeBitangent, vec3(0.0, 0.0, 1.0), flatten);
    shadeJacobian = mix(shadeJacobian, 1.0, flatten);
    float waveHeight = shadeDisp.y * (1.0 - flatten);

    vec3 N = normalize(cross(shadeBitangent, shadeTangent));
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);
    vec3 R = reflect(-V, N);

    float ndv = max(dot(N, V), 0.0);
    // Nadir floor 0 — 0.10 washed near-field teal into grey sky/fog when looking down.
    float fresnel = mix(0.0, 1.0, pow(1.0 - ndv, 4.0));

    float skyT = clamp(R.y * 0.65 + 0.35, 0.0, 1.0);
    vec3 skyCol = mix(uHorizonColor, uSkyColor, skyT);

    // Trough/crest albedo from the same Gerstner height as foam — not gust.
    float hW = max(fwidth(waveHeight), 1e-4);
    float trough = 1.0 - smoothstep(-0.20 - hW, 0.06 + hW, waveHeight);
    float crestLift = smoothstep(-0.04 - hW, 0.20 + hW, waveHeight);
    vec3 waterCol = mix(uDeepColor, uShallowColor, ndv);
    waterCol = mix(waterCol, uDeepColor * float(${OCEAN_TROUGH_DEFAULTS.deepScale}), trough * float(${OCEAN_TROUGH_DEFAULTS.mix}));
    waterCol = mix(waterCol, uShallowColor * 1.10, crestLift * 0.18);
    // Soft ndl (was 0.82…1.05) — no hard lit/shade terminator on the plane.
    float ndl = max(dot(N, L), 0.0);
    float ndlSoft = smoothstep(0.0, 0.55, ndl);
    waterCol *= mix(0.90, 1.02, ndlSoft);

    vec3 color = mix(waterCol, skyCol, fresnel);

    float fade = highFreqFade(ndv);

    vec3 H = normalize(L + V);
    // Slope faces catch sky even when the sun blob is out of frame.
    float slopeWet = pow(1.0 - clamp(N.y, 0.0, 1.0), 0.65) * 0.38;
    color = mix(color, skyCol, slopeWet * fade);
    // Wide wet sheen — sky-tinted, soft. Not uSunColor (avoids quadrant blowout).
    float wetSheen = pow(max(dot(N, H), 0.0), float(${OCEAN_SHEEN_DEFAULTS.sharpness}));
    float sheenW = max(fwidth(wetSheen), 1e-4);
    wetSheen = smoothstep(0.0, sheenW * 4.0, wetSheen);
    color += skyCol * wetSheen * float(${OCEAN_SHEEN_DEFAULTS.intensity}) * fade;

    // Spec on perturbed N — no camera-locked half-plane on constant up.
    float spec = pow(max(dot(N, H), 0.0), uGlitterSharpness);
    float specW = max(fwidth(spec), 1e-4);
    spec = smoothstep(0.0, specW * 3.0, spec);
    float sparkle = texture2D(uNoise, vWorldPos.xz * 0.045 + vec2(0.17, -0.09)).r;
    float sparkleW = max(fwidth(sparkle), 1e-4);
    sparkle = smoothstep(0.42 - sparkleW, 0.72 + sparkleW, sparkle);

    float gust = windStreak(vWorldPos.xz) * fade;
    float glitterAmt = spec * sparkle * uGlitterIntensity * fade;
    glitterAmt *= 1.0 - gust * 0.35;
    color += uSunColor * glitterAmt;

    float windF = clamp(uWindSpeed / 12.0, 0.15, 1.0);
    float jacW = max(fwidth(shadeJacobian), 1e-4);
    float fold = 1.0 - smoothstep(0.52 - jacW, 0.94 + jacW, shadeJacobian);
    float crestW = max(fwidth(waveHeight), 1e-4);
    float crest = smoothstep(-0.02 - crestW, 0.18 + crestW, waveHeight);
    float foamGrain = texture2D(uNoise, vWorldPos.xz * 0.09).r;
    // Quieter crest/fold (04-04) — still travels, less near-white.
    float foam = max(fold * 0.55, crest * 0.38) * windF * fade;
    foam *= mix(0.72, 1.12, foamGrain);

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

    color = mix(color, uFoamColor, clamp(foam, 0.0, 0.55));

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

function suppressRectUniforms(): THREE.Vector4[] {
  return Array.from(
    { length: OCEAN_SUPPRESS_CAP },
    () => new THREE.Vector4(0, 0, 0, 0),
  )
}

function suppressDirUniforms(): THREE.Vector2[] {
  return Array.from(
    { length: OCEAN_SUPPRESS_CAP },
    () => new THREE.Vector2(1, 0),
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
      uShadingWaves: { value: waveUniformVec4s() },
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
      uSuppressRect: { value: suppressRectUniforms() },
      uSuppressDir: { value: suppressDirUniforms() },
      uSuppressCount: { value: 0 },
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
  let seaHeightYM = 0
  mesh.position.set(0, COURSE_WATER_Y + opts.liftY + seaHeightYM, 0)

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
  let amplitudeScale = 1

  function applyWaveAmplitudes(): void {
    const disp =
      Number.isFinite(opts.displacementScale) && opts.displacementScale >= 0
        ? opts.displacementScale
        : 0
    const vertexScale = amplitudeScale * disp
    // Shading amps: authored × wind only — keep fragment motion when disp=0.
    const shadingScale = amplitudeScale
    const waves = uniforms['uWaves']!.value as THREE.Vector4[]
    const shading = uniforms['uShadingWaves']!.value as THREE.Vector4[]
    for (let i = 0; i < WAVES.length; i++) {
      const authored = WAVES[i]!.amplitude
      waves[i]!.y = authored * vertexScale
      shading[i]!.y = authored * shadingScale
    }
  }
  applyWaveAmplitudes()

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
      amplitudeScale = Number.isFinite(scale) ? Math.max(0, scale) : 1
      applyWaveAmplitudes()
    },
    setSeaHeightYM(yM: number): void {
      seaHeightYM = clampSeaHeightYM(yM)
      mesh.position.y = COURSE_WATER_Y + opts.liftY + seaHeightYM
    },
    getSeaHeightYM: () => seaHeightYM,
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
    setSuppressFootprints(footprints: readonly OceanSuppressFootprint[]): void {
      if (disposed) return
      const rects = uniforms['uSuppressRect']!.value as THREE.Vector4[]
      const dirs = uniforms['uSuppressDir']!.value as THREE.Vector2[]
      const n = Math.min(OCEAN_SUPPRESS_CAP, footprints.length)
      uniforms['uSuppressCount']!.value = n
      for (let i = 0; i < OCEAN_SUPPRESS_CAP; i++) {
        const fp = i < n ? footprints[i] : undefined
        if (fp) {
          rects[i]!.set(fp.cx, fp.cz, fp.halfAlong, fp.halfAcross)
          dirs[i]!.set(fp.dirX, fp.dirZ)
        } else {
          rects[i]!.set(0, 0, 0, 0)
          dirs[i]!.set(1, 0)
        }
      }
    },
    getSuppressCount: () => uniforms['uSuppressCount']!.value as number,
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
