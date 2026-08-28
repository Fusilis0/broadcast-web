import * as THREE from 'three'
import { COURSE_WATER_Y } from '../course/courseLayout.ts'

/**
 * Phase 16.2 / 14.3f — Windy-style moving strings above the water.
 *
 * Short polyline ribbons drift along Gerstner / `windTravelSceneXZ` travel
 * (from-000° → +Z). One mesh, one draw call, CPU-updated buffers. Mounted
 * inside the realistic environment so they never hit the AR plate. Shared
 * clock via `tick` from `onBeforeRender` (3D NDI `directRender` animates).
 *
 * No extra FBO, no `readPixels`, no particle framework.
 */
export const WIND_STRINGS_DEFAULTS = {
  /** Instance budget. Speed scales how many are actually visible. */
  count: 180,
  /** Vertices along each string (inclusive). */
  points: 6,
  /** Spawn disc radius around the camera / clipmap centre (m). */
  radiusM: 800,
  minHeightM: 4,
  maxHeightM: 10,
  /** World-space ribbon half-thickness is this / 2; billboarded to camera. */
  widthM: 0.85,
  color: 0xc8e6ff,
  /** At or below this speed (m/s) the field is fully faded. */
  fadeMsLo: 0.5,
  /** Full opacity (m/s). */
  fadeMsHi: 6,
  /** Length at 0 m/s (hidden anyway). 5 m/s ≈ 20 m; 12 m/s ≈ 35 m. */
  minLengthM: 10,
  lengthPerMs: 2.1,
  minLifeS: 4,
  extraLifeS: 3,
  /** Visible count at 5 m/s (typical light race breeze). */
  countAt5Ms: 100,
} as const

export type WindStringsOptions = {
  count: number
  points: number
  radiusM: number
  minHeightM: number
  maxHeightM: number
  widthM: number
  color: number
  liftY: number
  minLifeS: number
  extraLifeS: number
  now: () => number
}

export type WindStringsHandle = {
  root: THREE.Mesh
  tick: (
    dtSeconds: number,
    directionRad: number,
    speedMs: number,
    centerX: number,
    centerY: number,
    centerZ: number,
  ) => void
  setTravel: (directionRad: number, speedMs: number) => void
  getDirectionRad: () => number
  getWindSpeed: () => number
  getOpacity: () => number
  getActiveCount: () => number
  getLengthM: () => number
  sampleMeanXZ: () => { x: number; z: number }
  dispose: () => void
}

type Slot = {
  originX: number
  originZ: number
  y: number
  age: number
  life: number
  waveAmp: number
  gen: number
}

function hash01(i: number, salt: number): number {
  const n = Math.imul(i + 1, 1103515245) + Math.imul(salt + 1, 12345)
  return ((n >>> 0) % 10_000) / 10_000
}

function smoothstep(lo: number, hi: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - lo) / Math.max(hi - lo, 1e-6)))
  return t * t * (3 - 2 * t)
}

function lifeFade(age: number, life: number): number {
  const span = Math.max(life, 1e-6)
  const t = Math.min(1, Math.max(0, age / span))
  const fadeIn = 0.14
  const fadeOut = 0.22
  if (t < fadeIn) return smoothstep(0, fadeIn, t)
  if (t > 1 - fadeOut) return 1 - smoothstep(1 - fadeOut, 1, t)
  return 1
}

/**
 * Unit XZ travel — same mapping as Gerstner `waveDirectionXZ`
 * (`θ = 0` → +X, `θ = π/2` → +Z). From-000° coupling sets `π/2`.
 */
export function stringTravelXZ(directionRad: number): { x: number; z: number } {
  return { x: Math.cos(directionRad), z: Math.sin(directionRad) }
}

/** Global field opacity. 0 at/below ~0.5 m/s. */
export function stringOpacityFromSpeedMs(
  speedMs: number,
  fadeMsLo: number = WIND_STRINGS_DEFAULTS.fadeMsLo,
  fadeMsHi: number = WIND_STRINGS_DEFAULTS.fadeMsHi,
): number {
  const s = Number.isFinite(speedMs) && speedMs > 0 ? speedMs : 0
  return smoothstep(fadeMsLo, fadeMsHi, s)
}

export function stringLengthM(
  speedMs: number,
  minLengthM: number = WIND_STRINGS_DEFAULTS.minLengthM,
  lengthPerMs: number = WIND_STRINGS_DEFAULTS.lengthPerMs,
): number {
  const s = Number.isFinite(speedMs) && speedMs > 0 ? speedMs : 0
  return minLengthM + lengthPerMs * s
}

/**
 * How many of `count` slots should read as visible. ~100 at 5 m/s, full
 * budget at 12 m/s, none below the calm fade.
 */
export function stringActiveCount(
  speedMs: number,
  count: number = WIND_STRINGS_DEFAULTS.count,
): number {
  const opacity = stringOpacityFromSpeedMs(speedMs)
  if (opacity <= 0 || count <= 0) return 0
  const s = Number.isFinite(speedMs) && speedMs > 0 ? speedMs : 0
  const at5 = Math.min(count, WIND_STRINGS_DEFAULTS.countAt5Ms)
  let visible: number
  if (s <= 5) {
    const u = Math.min(1, Math.max(0, (s - WIND_STRINGS_DEFAULTS.fadeMsLo) / 4.5))
    visible = u * at5
  } else {
    const t = Math.min(1, Math.max(0, (s - 5) / 7))
    visible = at5 + t * (count - at5)
  }
  return Math.max(0, Math.min(count, Math.round(visible)))
}

function slotWeight(slot: number, active: number): number {
  if (active <= 0) return 0
  const edge = 4
  return 1 - smoothstep(active - edge, active + 0.5, slot)
}

export function createWindStrings(
  options?: Partial<WindStringsOptions>,
): WindStringsHandle {
  const opts: WindStringsOptions = {
    count: WIND_STRINGS_DEFAULTS.count,
    points: WIND_STRINGS_DEFAULTS.points,
    radiusM: WIND_STRINGS_DEFAULTS.radiusM,
    minHeightM: WIND_STRINGS_DEFAULTS.minHeightM,
    maxHeightM: WIND_STRINGS_DEFAULTS.maxHeightM,
    widthM: WIND_STRINGS_DEFAULTS.widthM,
    color: WIND_STRINGS_DEFAULTS.color,
    liftY: 0.45,
    minLifeS: WIND_STRINGS_DEFAULTS.minLifeS,
    extraLifeS: WIND_STRINGS_DEFAULTS.extraLifeS,
    now: () => performance.now(),
    ...options,
  }

  const count = Math.max(1, Math.floor(opts.count))
  const points = Math.max(3, Math.floor(opts.points))
  const radius = Math.max(40, opts.radiusM)
  const waterY = COURSE_WATER_Y + opts.liftY
  const halfW = Math.max(0.08, opts.widthM) * 0.5

  const vertsPer = points * 2
  const vertCount = count * vertsPer
  const positions = new Float32Array(vertCount * 3)
  const alphas = new Float32Array(vertCount)
  const indexCount = count * (points - 1) * 6
  const indices = new Uint16Array(indexCount)

  let iPtr = 0
  for (let s = 0; s < count; s++) {
    const vBase = s * vertsPer
    for (let i = 0; i < points - 1; i++) {
      const a = vBase + i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices[iPtr++] = a
      indices[iPtr++] = b
      indices[iPtr++] = c
      indices[iPtr++] = b
      indices[iPtr++] = d
      indices[iPtr++] = c
    }
  }

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  const alphaAttr = new THREE.BufferAttribute(alphas, 1)
  posAttr.setUsage(THREE.DynamicDrawUsage)
  alphaAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('aAlpha', alphaAttr)
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color) },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        float a = vAlpha * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'windStrings'
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()

  const slots: Slot[] = []
  for (let s = 0; s < count; s++) {
    slots.push({
      originX: 0,
      originZ: 0,
      y: waterY + opts.minHeightM,
      age: 0,
      life: opts.minLifeS,
      waveAmp: 1,
      gen: 0,
    })
  }

  const polyX = new Float32Array(points)
  const polyY = new Float32Array(points)
  const polyZ = new Float32Array(points)

  let directionRad = Math.PI / 2
  let speedMs = 0
  let opacity = 0
  let activeCount = 0
  let lengthM = stringLengthM(0)
  let disposed = false
  let seeded = false

  let lastWall = opts.now()
  let simMs = lastWall

  function sampleClock(dtSeconds: number): number {
    const wall = opts.now()
    if (wall !== lastWall) {
      const dt = (wall - lastWall) / 1000
      lastWall = wall
      simMs = wall
      return dt > 0 ? dt : 0
    }
    if (dtSeconds > 0) {
      simMs += dtSeconds * 1000
      return dtSeconds
    }
    return 0
  }

  function spawn(
    slot: Slot,
    index: number,
    centerX: number,
    centerZ: number,
    dirX: number,
    dirZ: number,
    stagger: boolean,
  ): void {
    slot.gen += 1
    const u = hash01(index, slot.gen)
    const v = hash01(index, slot.gen + 17)
    const angleUp = Math.atan2(-dirZ, -dirX) + (u - 0.5) * Math.PI
    const r = Math.sqrt(v) * radius * 0.82
    slot.originX = centerX + Math.cos(angleUp) * r
    slot.originZ = centerZ + Math.sin(angleUp) * r
    const h = hash01(index, 97)
    slot.y =
      waterY +
      opts.minHeightM +
      h * Math.max(0.2, opts.maxHeightM - opts.minHeightM)
    slot.life = opts.minLifeS + hash01(index, 7) * opts.extraLifeS
    slot.age = stagger ? hash01(index, 13) * slot.life * 0.82 : 0
    slot.waveAmp = 0.55 + hash01(index, 23) * 1.1
  }

  function writeBuffers(
    dirX: number,
    dirZ: number,
    camX: number,
    camY: number,
    camZ: number,
  ): void {
    const perpX = -dirZ
    const perpZ = dirX
    const recede = radius * 1.25
    const recedeSq = recede * recede
    const speed = speedMs
    lengthM = stringLengthM(speed)
    opacity = stringOpacityFromSpeedMs(speed)
    activeCount = stringActiveCount(speed, count)
    material.uniforms['uOpacity']!.value = opacity

    let visible = 0
    let meanX = 0
    let meanZ = 0

    for (let s = 0; s < count; s++) {
      const slot = slots[s]!
      const driftedX = slot.originX + dirX * speed * slot.age
      const driftedZ = slot.originZ + dirZ * speed * slot.age
      const dx = driftedX - camX
      const dz = driftedZ - camZ
      const distSq = dx * dx + dz * dz
      if (distSq > recedeSq) {
        spawn(slot, s, camX, camZ, dirX, dirZ, false)
      }
      const dist = Math.hypot(
        slot.originX + dirX * speed * slot.age - camX,
        slot.originZ + dirZ * speed * slot.age - camZ,
      )
      const distFade = 1 - smoothstep(radius * 0.88, recede, dist)
      const weight = slotWeight(s, activeCount)
      const env = lifeFade(slot.age, slot.life) * weight * distFade

      const seed = hash01(s, 41) * Math.PI * 2
      for (let i = 0; i < points; i++) {
        const t = i / (points - 1)
        const along = (t - 1) * lengthM
        const phase = seed + slot.age * 1.85 + t * 6.2832
        const lateral = Math.sin(phase) * slot.waveAmp * (0.25 + 0.75 * t)
        const lift = Math.sin(phase * 0.73 + 1.1) * 0.32
        polyX[i] = slot.originX + dirX * (speed * slot.age + along) + perpX * lateral
        polyY[i] = slot.y + lift
        polyZ[i] = slot.originZ + dirZ * (speed * slot.age + along) + perpZ * lateral
      }

      const headA = env * (0.35 + 0.65)
      if (headA > 0.02 && opacity > 0) {
        visible += 1
        meanX += polyX[points - 1]!
        meanZ += polyZ[points - 1]!
      }

      const vBase = s * vertsPer
      for (let i = 0; i < points; i++) {
        const t = i / (points - 1)
        const px = polyX[i]!
        const py = polyY[i]!
        const pz = polyZ[i]!
        const toX = camX - px
        const toY = camY - py
        const toZ = camZ - pz
        let sx = -dirZ * toY
        let sy = dirZ * toX - dirX * toZ
        let sz = dirX * toY
        const slen = Math.hypot(sx, sy, sz)
        if (slen < 1e-4) {
          sx = perpX
          sy = 0
          sz = perpZ
        } else {
          const inv = 1 / slen
          sx *= inv
          sy *= inv
          sz *= inv
        }
        const hw = halfW * (0.4 + 0.6 * t)
        const a = env * (0.28 + 0.72 * t)
        const left = vBase + i * 2
        const right = left + 1
        const lp = left * 3
        const rp = right * 3
        positions[lp] = px - sx * hw
        positions[lp + 1] = py - sy * hw
        positions[lp + 2] = pz - sz * hw
        positions[rp] = px + sx * hw
        positions[rp + 1] = py + sy * hw
        positions[rp + 2] = pz + sz * hw
        alphas[left] = a
        alphas[right] = a
      }
    }

    activeCount = opacity > 0 ? visible : 0
    _meanX = visible > 0 ? meanX / visible : 0
    _meanZ = visible > 0 ? meanZ / visible : 0

    posAttr.needsUpdate = true
    alphaAttr.needsUpdate = true
  }

  let _meanX = 0
  let _meanZ = 0

  function seedIfNeeded(centerX: number, centerZ: number): void {
    if (seeded) return
    seeded = true
    const { x: dirX, z: dirZ } = stringTravelXZ(directionRad)
    for (let s = 0; s < count; s++) {
      spawn(slots[s]!, s, centerX, centerZ, dirX, dirZ, true)
    }
  }

  return {
    root: mesh,
    tick(dtSeconds, nextDir, nextSpeed, centerX, centerY, centerZ): void {
      if (disposed) return
      directionRad = nextDir
      speedMs = Number.isFinite(nextSpeed) && nextSpeed > 0 ? nextSpeed : 0
      const dt = sampleClock(dtSeconds)
      seedIfNeeded(centerX, centerZ)
      const { x: dirX, z: dirZ } = stringTravelXZ(directionRad)
      if (dt > 0) {
        for (let s = 0; s < count; s++) {
          const slot = slots[s]!
          slot.age += dt
          if (slot.age >= slot.life) {
            spawn(slot, s, centerX, centerZ, dirX, dirZ, false)
          }
        }
      }
      writeBuffers(dirX, dirZ, centerX, centerY, centerZ)
    },
    setTravel(nextRad: number, nextSpeed: number): void {
      if (disposed) return
      directionRad = nextRad
      speedMs = Number.isFinite(nextSpeed) && nextSpeed > 0 ? nextSpeed : 0
    },
    getDirectionRad: () => directionRad,
    getWindSpeed: () => speedMs,
    getOpacity: () => opacity,
    getActiveCount: () => activeCount,
    getLengthM: () => lengthM,
    sampleMeanXZ: () => ({ x: _meanX, z: _meanZ }),
    dispose(): void {
      if (disposed) return
      disposed = true
      geometry.dispose()
      material.dispose()
      mesh.removeFromParent()
    },
  }
}
