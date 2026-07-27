import * as THREE from 'three'

export type BoatTagOptions = {
  id: string
  /** Stub display name until roadmap 2.7 JSON. */
  displayName?: string
  /** Local Y offset above the boat root (meters). */
  height?: number
}

export type BoatTagHandle = {
  root: THREE.Sprite
  update: (camera: THREE.Camera, viewportHeightPx: number) => void
  dispose: () => void
}

const REF_DISTANCE_M = 100
const DESIRED_SCREEN_HEIGHT_PX = 48
const SIZE_MULTIPLIER = 1.4
/** Unity BoatTagRotation-style falloff: 0 = constant screen size. */
const DISTANCE_FALLOFF = 0.45

/** Canvas aspect for the drawn tag plate (width / height). */
export const BOAT_TAG_CANVAS_ASPECT = 512 / 160

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
): void {
  const w = 512
  const h = 160
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, w, h)

  // Soft plate behind text (readable on dark preview / future chroma)
  ctx.fillStyle = 'rgba(12, 16, 22, 0.72)'
  roundRect(ctx, 8, 16, w - 16, h - 32, 18)
  ctx.fill()

  ctx.strokeStyle = 'rgba(232, 220, 200, 0.55)'
  ctx.lineWidth = 3
  roundRect(ctx, 8, 16, w - 16, h - 32, 18)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f5f2ea'
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
  const displayName = options.displayName ?? `Boat ${id}`
  const height = options.height ?? 10

  const canvas = document.createElement('canvas')
  drawTagCanvas(canvas, id, displayName)
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
    dispose(): void {
      map.dispose()
      material.dispose()
    },
  }
}
