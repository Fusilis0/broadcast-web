import * as THREE from 'three'

export type BoatTagIdentity = {
  displayName: string
  /** `#rrggbb` category tint; omit / invalid → neutral plate. */
  color?: string
}

export type BoatTagOptions = {
  id: string
  /** Stub display name until catalogue resolves. */
  displayName?: string
  /** Category tint `#rrggbb`. */
  color?: string
  /** Local Y offset above the boat root (meters). */
  height?: number
}

export type BoatTagHandle = {
  root: THREE.Sprite
  update: (camera: THREE.Camera, viewportHeightPx: number) => void
  /** Redraw canvas when catalogue loads after first spawn. */
  setTagIdentity: (identity: BoatTagIdentity) => void
  dispose: () => void
}

const REF_DISTANCE_M = 100
const DESIRED_SCREEN_HEIGHT_PX = 48
const SIZE_MULTIPLIER = 1.4
/** Unity BoatTagRotation-style falloff: 0 = constant screen size. */
const DISTANCE_FALLOFF = 0.45

/** Canvas aspect for the drawn tag plate (width / height). */
export const BOAT_TAG_CANVAS_ASPECT = 512 / 160

type Rgb = { r: number; g: number; b: number }

function parseRgb(hex: string | undefined): Rgb | null {
  if (!hex) return null
  const s = hex.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null
  return {
    r: Number.parseInt(s.slice(1, 3), 16),
    g: Number.parseInt(s.slice(3, 5), 16),
    b: Number.parseInt(s.slice(5, 7), 16),
  }
}

/** Mix toward white so neon Unity primaries stay readable on dark preview. */
function readableNameRgb(c: Rgb): Rgb {
  const t = 0.55
  return {
    r: Math.round(c.r + (255 - c.r) * t),
    g: Math.round(c.g + (255 - c.g) * t),
    b: Math.round(c.b + (255 - c.b) * t),
  }
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`
}

/**
 * World-space sprite height from camera distance (Unity BoatTagRotation spirit).
 * Pure helper — safe to unit-test without DOM.
 */
export function boatTagWorldHeight(
  distanceM: number,
  viewportHeightPx: number,
  verticalFovDeg: number,
): number {
  const distance = Math.max(distanceM, 0.001)
  const vFovRad = THREE.MathUtils.degToRad(verticalFovDeg)
  const frustumHeight = 2 * distance * Math.tan(vFovRad / 2)
  const worldPerPixel = frustumHeight / Math.max(viewportHeightPx, 1)
  const baseScale = worldPerPixel * DESIRED_SCREEN_HEIGHT_PX
  const ratio = distance / REF_DISTANCE_M
  const bias = Math.pow(ratio, -DISTANCE_FALLOFF)
  return baseScale * bias * SIZE_MULTIPLIER
}

function drawTagCanvas(
  canvas: HTMLCanvasElement,
  id: string,
  displayName: string,
  colorCss?: string,
): void {
  const w = 512
  const h = 160
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, w, h)

  const tint = parseRgb(colorCss)
  const plate = tint
    ? rgba(
        {
          r: Math.round(12 * 0.65 + tint.r * 0.35 * 0.25),
          g: Math.round(16 * 0.65 + tint.g * 0.35 * 0.25),
          b: Math.round(22 * 0.65 + tint.b * 0.35 * 0.25),
        },
        0.78,
      )
    : 'rgba(12, 16, 22, 0.72)'

  ctx.fillStyle = plate
  roundRect(ctx, 8, 16, w - 16, h - 32, 18)
  ctx.fill()

  ctx.strokeStyle = tint ? rgba(tint, 0.75) : 'rgba(232, 220, 200, 0.55)'
  ctx.lineWidth = 3
  roundRect(ctx, 8, 16, w - 16, h - 32, 18)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (tint) {
    const name = readableNameRgb(tint)
    ctx.fillStyle = rgba(name, 1)
  } else {
    ctx.fillStyle = '#f5f2ea'
  }
  ctx.font = '600 52px "Segoe UI", system-ui, sans-serif'
  ctx.fillText(displayName, w / 2, h / 2 - 22)

  ctx.fillStyle = '#c9d0da'
  ctx.font = '500 36px "Segoe UI", system-ui, sans-serif'
  ctx.fillText(`id ${id}`, w / 2, h / 2 + 32)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * Billboard boat label (Unity BoatTag spirit).
 * THREE.Sprite faces the camera automatically; we only apply mild distance scale.
 */
export function createBoatTag(options: BoatTagOptions): BoatTagHandle {
  const id = options.id
  let displayName = options.displayName ?? `Boat ${id}`
  let colorCss = options.color
  const height = options.height ?? 10

  const canvas = document.createElement('canvas')
  drawTagCanvas(canvas, id, displayName, colorCss)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.needsUpdate = true

  const material = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = 'boatTag'
  sprite.position.set(0, height, 0)
  sprite.scale.set(14, 14 / BOAT_TAG_CANVAS_ASPECT, 1)

  const _world = new THREE.Vector3()

  function redraw(): void {
    drawTagCanvas(canvas, id, displayName, colorCss)
    map.needsUpdate = true
  }

  return {
    root: sprite,
    update(camera: THREE.Camera, viewportHeightPx: number): void {
      sprite.getWorldPosition(_world)
      const distance = camera.position.distanceTo(_world)
      const perspective =
        camera instanceof THREE.PerspectiveCamera ? camera : null
      const vFov = perspective?.fov ?? 50
      const heightWorld = boatTagWorldHeight(distance, viewportHeightPx, vFov)
      sprite.scale.set(
        heightWorld * BOAT_TAG_CANVAS_ASPECT,
        heightWorld,
        1,
      )
    },
    setTagIdentity(identity: BoatTagIdentity): void {
      displayName = identity.displayName
      colorCss = identity.color
      redraw()
    },
    dispose(): void {
      map.dispose()
      material.dispose()
    },
  }
}
