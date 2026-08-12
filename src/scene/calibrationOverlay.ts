import * as THREE from 'three'
import { COURSE_WATER_Y } from './course/courseLayout.ts'
import { gateBaseName } from './course/gatePairing.ts'
import { getLayoutFeatures } from './features/layoutStore.ts'
import type { LayoutFeature, WorldFeatureType } from './features/types.ts'

/**
 * ENU coordinate / marks overlay for manual AR calibration (Phase 13.7).
 * Read-only visualization through the same POV camera — no offset writes.
 *
 * Grid defaults (v1, no per-venue UI):
 * - spacing **50 m**
 * - half-extent **1000 m** → **2 km** side (typical course footprint clamp)
 */

export const CALIBRATION_OVERLAY_DEFAULTS = {
  spacingM: 50,
  halfExtentM: 1000,
  poleHeightM: 12,
  poleRadiusM: 0.18,
  gridColor: 0x40e8ff,
  majorGridColor: 0xffe08a,
  originColor: 0xffee44,
  markColor: 0xff4db8,
  lineColor: 0xff88cc,
  /** Label major grid lines every N×spacing along axes. */
  majorEvery: 4,
} as const

const MARK_TYPES = new Set<WorldFeatureType>([
  'mark',
  'gateLeft',
  'gateRight',
  'buoy',
  'start',
  'finish',
])

export type CalibrationOverlayOptions = {
  spacingM?: number
  halfExtentM?: number
  poleHeightM?: number
  /** Override layout source (tests). Default: `getLayoutFeatures()`. */
  getFeatures?: () => readonly LayoutFeature[]
}

export type CalibrationOverlayHandle = {
  root: THREE.Group
  isEnabled: () => boolean
  setEnabled: (enabled: boolean) => void
  /** Rebuild geometry from layout while enabled (no-op when off). */
  rebuild: () => void
  dispose: () => void
}

type Disposable = {
  geom?: THREE.BufferGeometry
  mat?: THREE.Material | THREE.Material[]
  tex?: THREE.Texture
}

function disposeObject(obj: THREE.Object3D, bag: Disposable[]): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      const geom = child.geometry
      if (geom) bag.push({ geom })
      const mat = child.material
      if (Array.isArray(mat)) {
        for (const m of mat) bag.push({ mat: m })
      } else if (mat) {
        bag.push({ mat })
      }
    }
    if (child instanceof THREE.Sprite) {
      const mat = child.material
      if (mat.map) bag.push({ tex: mat.map })
      bag.push({ mat })
    }
  })
}

function flushDisposables(bag: Disposable[]): void {
  for (const d of bag) {
    d.geom?.dispose()
    if (Array.isArray(d.mat)) {
      for (const m of d.mat) m.dispose()
    } else {
      d.mat?.dispose()
    }
    d.tex?.dispose()
  }
  bag.length = 0
}

function makeLabelSprite(
  text: string,
  accent: number,
  bag: Disposable[],
): THREE.Sprite {
  const w = 256
  const h = 64
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(8, 12, 18, 0.78)'
    ctx.fillRect(4, 8, w - 8, h - 16)
    const r = (accent >> 16) & 0xff
    const g = (accent >> 8) & 0xff
    const b = accent & 0xff
    ctx.strokeStyle = `rgba(${r},${g},${b},0.95)`
    ctx.lineWidth = 3
    ctx.strokeRect(4, 8, w - 8, h - 16)
    ctx.fillStyle = '#f5f7fa'
    ctx.font = '600 26px "Segoe UI", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2, w - 24)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  bag.push({ tex })
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  })
  bag.push({ mat })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(8, 2, 1)
  return sprite
}

function addPole(
  parent: THREE.Group,
  x: number,
  z: number,
  label: string,
  color: number,
  heightM: number,
  radiusM: number,
  bag: Disposable[],
): void {
  const geom = new THREE.CylinderGeometry(radiusM, radiusM * 1.15, heightM, 8)
  bag.push({ geom })
  const mat = new THREE.MeshBasicMaterial({ color })
  bag.push({ mat })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.name = 'calibPole'
  mesh.position.set(x, COURSE_WATER_Y + heightM * 0.5, z)
  parent.add(mesh)

  const sprite = makeLabelSprite(label, color, bag)
  sprite.name = 'calibLabel'
  sprite.position.set(x, COURSE_WATER_Y + heightM + 1.2, z)
  parent.add(sprite)
}

function buildGrid(
  parent: THREE.Group,
  spacingM: number,
  halfExtentM: number,
  majorEvery: number,
  bag: Disposable[],
): void {
  const minorPos: number[] = []
  const majorPos: number[] = []
  const n = Math.floor(halfExtentM / spacingM)

  for (let i = -n; i <= n; i++) {
    if (i === 0) continue
    const t = i * spacingM
    const major = i % majorEvery === 0
    const buf = major ? majorPos : minorPos
    // Line parallel to East (varying x, fixed z=t)
    buf.push(-halfExtentM, COURSE_WATER_Y, t, halfExtentM, COURSE_WATER_Y, t)
    // Line parallel to North (fixed x=t, varying z)
    buf.push(t, COURSE_WATER_Y, -halfExtentM, t, COURSE_WATER_Y, halfExtentM)
  }

  // Axes through origin (major)
  majorPos.push(
    -halfExtentM,
    COURSE_WATER_Y,
    0,
    halfExtentM,
    COURSE_WATER_Y,
    0,
    0,
    COURSE_WATER_Y,
    -halfExtentM,
    0,
    COURSE_WATER_Y,
    halfExtentM,
  )

  function addLines(
    positions: number[],
    color: number,
    name: string,
  ): void {
    if (positions.length === 0) return
    const geom = new THREE.BufferGeometry()
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    )
    bag.push({ geom })
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
    bag.push({ mat })
    const lines = new THREE.LineSegments(geom, mat)
    lines.name = name
    parent.add(lines)
  }

  addLines(minorPos, CALIBRATION_OVERLAY_DEFAULTS.gridColor, 'calibGridMinor')
  addLines(majorPos, CALIBRATION_OVERLAY_DEFAULTS.majorGridColor, 'calibGridMajor')

  // Axis offset labels on major ticks
  for (let i = -n; i <= n; i++) {
    if (i === 0 || i % majorEvery !== 0) continue
    const t = i * spacingM
    const east = makeLabelSprite(`E ${t}m`, CALIBRATION_OVERLAY_DEFAULTS.majorGridColor, bag)
    east.position.set(t, COURSE_WATER_Y + 1.5, 0)
    east.scale.set(10, 2.5, 1)
    parent.add(east)
    const north = makeLabelSprite(`N ${t}m`, CALIBRATION_OVERLAY_DEFAULTS.majorGridColor, bag)
    north.position.set(0, COURSE_WATER_Y + 1.5, t)
    north.scale.set(10, 2.5, 1)
    parent.add(north)
  }
}

function buildOrigin(
  parent: THREE.Group,
  poleHeightM: number,
  bag: Disposable[],
): void {
  const color = CALIBRATION_OVERLAY_DEFAULTS.originColor
  addPole(parent, 0, 0, 'origin', color, poleHeightM * 1.15, 0.28, bag)

  // Cross on water plane for pitch/roll cue
  const cross: number[] = [
    -6,
    COURSE_WATER_Y + 0.05,
    0,
    6,
    COURSE_WATER_Y + 0.05,
    0,
    0,
    COURSE_WATER_Y + 0.05,
    -6,
    0,
    COURSE_WATER_Y + 0.05,
    6,
  ]
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(cross, 3))
  bag.push({ geom })
  const mat = new THREE.LineBasicMaterial({ color, depthWrite: false })
  bag.push({ mat })
  const lines = new THREE.LineSegments(geom, mat)
  lines.name = 'calibOriginCross'
  parent.add(lines)
}

function buildMarks(
  parent: THREE.Group,
  features: readonly LayoutFeature[],
  poleHeightM: number,
  poleRadiusM: number,
  bag: Disposable[],
): void {
  const markColor = CALIBRATION_OVERLAY_DEFAULTS.markColor
  const lineColor = CALIBRATION_OVERLAY_DEFAULTS.lineColor
  const linePositions: number[] = []

  for (const f of features) {
    if (!MARK_TYPES.has(f.type)) continue
    // Force-show: ignore visible3d / visible2d
    if (f.type === 'start' || f.type === 'finish') {
      const a = f.points[0]
      const b = f.points[1]
      if (!a) continue
      addPole(
        parent,
        a.x,
        a.z,
        `${f.name}·A`,
        markColor,
        poleHeightM,
        poleRadiusM,
        bag,
      )
      if (b) {
        addPole(
          parent,
          b.x,
          b.z,
          `${f.name}·B`,
          markColor,
          poleHeightM,
          poleRadiusM,
          bag,
        )
        linePositions.push(
          a.x,
          COURSE_WATER_Y + 0.2,
          a.z,
          b.x,
          COURSE_WATER_Y + 0.2,
          b.z,
        )
      }
      continue
    }

    const p = f.points[0]
    if (!p) continue
    const label =
      f.type === 'buoy' && f.telemetryId
        ? `${f.name}·${f.telemetryId}`
        : f.name
    addPole(parent, p.x, p.z, label, markColor, poleHeightM, poleRadiusM, bag)
  }

  // Gate pairing lines (Unity-style base name)
  const lefts = features.filter((f) => f.type === 'gateLeft' && f.points[0])
  const rights = features.filter((f) => f.type === 'gateRight' && f.points[0])
  for (const left of lefts) {
    const base = gateBaseName(left.name)
    const right = rights.find((r) => gateBaseName(r.name) === base) ?? null
    if (!right?.points[0] || !left.points[0]) continue
    const a = left.points[0]
    const b = right.points[0]
    linePositions.push(
      a.x,
      COURSE_WATER_Y + 0.2,
      a.z,
      b.x,
      COURSE_WATER_Y + 0.2,
      b.z,
    )
  }

  if (linePositions.length > 0) {
    const geom = new THREE.BufferGeometry()
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3),
    )
    bag.push({ geom })
    const mat = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    bag.push({ mat })
    const lines = new THREE.LineSegments(geom, mat)
    lines.name = 'calibMarkLines'
    parent.add(lines)
  }
}

/**
 * Create a calibration overlay controller. Default **off** (not mounted).
 * Geometry is lines + thin poles + sprites only — never an opaque sky fill.
 */
export function createCalibrationOverlay(
  scene: THREE.Scene,
  options: CalibrationOverlayOptions = {},
): CalibrationOverlayHandle {
  const spacingM = options.spacingM ?? CALIBRATION_OVERLAY_DEFAULTS.spacingM
  const halfExtentM =
    options.halfExtentM ?? CALIBRATION_OVERLAY_DEFAULTS.halfExtentM
  const poleHeightM =
    options.poleHeightM ?? CALIBRATION_OVERLAY_DEFAULTS.poleHeightM
  const getFeatures = options.getFeatures ?? getLayoutFeatures

  const root = new THREE.Group()
  root.name = 'calibrationOverlay'
  const bag: Disposable[] = []
  let enabled = false

  function clearContent(): void {
    disposeObject(root, bag)
    root.clear()
    flushDisposables(bag)
  }

  function rebuildContent(): void {
    clearContent()
    if (!enabled) return
    const grid = new THREE.Group()
    grid.name = 'calibGrid'
    buildGrid(
      grid,
      spacingM,
      halfExtentM,
      CALIBRATION_OVERLAY_DEFAULTS.majorEvery,
      bag,
    )
    root.add(grid)

    const origin = new THREE.Group()
    origin.name = 'calibOrigin'
    buildOrigin(origin, poleHeightM, bag)
    root.add(origin)

    const marks = new THREE.Group()
    marks.name = 'calibMarks'
    buildMarks(
      marks,
      getFeatures(),
      poleHeightM,
      CALIBRATION_OVERLAY_DEFAULTS.poleRadiusM,
      bag,
    )
    root.add(marks)
  }

  return {
    root,
    isEnabled(): boolean {
      return enabled
    },
    setEnabled(next: boolean): void {
      if (next === enabled) {
        if (next) rebuildContent()
        return
      }
      enabled = next === true
      if (enabled) {
        rebuildContent()
        if (!root.parent) scene.add(root)
      } else {
        clearContent()
        scene.remove(root)
      }
    },
    rebuild(): void {
      if (enabled) rebuildContent()
    },
    dispose(): void {
      enabled = false
      clearContent()
      scene.remove(root)
    },
  }
}
