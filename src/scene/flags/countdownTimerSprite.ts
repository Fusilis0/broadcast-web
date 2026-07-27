import * as THREE from 'three'
import { boatTagWorldHeight, BOAT_TAG_CANVAS_ASPECT } from '../boatTag.ts'
import { formatCountdownMmSs } from './countdownPhase.ts'

export type CountdownTimerHandle = {
  root: THREE.Sprite
  setRemaining: (remainingSeconds: number, finished: boolean) => void
  update: (camera: THREE.Camera, viewportHeightPx: number) => void
  dispose: () => void
}

const CANVAS_W = 512
const CANVAS_H = 160
/** Slightly larger than boat tags — race timing must read from afar. */
const SIZE_BOOST = 1.35

const COLOR_RUNNING = '#c62828'
const COLOR_ZERO = '#05AD00'

function drawTimer(
  canvas: HTMLCanvasElement,
  text: string,
  finished: boolean,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.fillStyle = finished ? COLOR_ZERO : COLOR_RUNNING
  roundRect(ctx, 12, 20, CANVAS_W - 24, CANVAS_H - 40, 14)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.lineWidth = 4
  roundRect(ctx, 12, 20, CANVAS_W - 24, CANVAS_H - 40, 14)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 72px "Segoe UI", system-ui, sans-serif'
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2)
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
 * World-space countdown `MM:SS` above P1 (Sprite billboards to active camera).
 * Distance scale reuses boat-tag spirit.
 */
export function createCountdownTimerSprite(
  verticalOffsetM: number,
): CountdownTimerHandle {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  drawTimer(canvas, '06:00', false)

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
  sprite.name = 'countdownTimer'
  sprite.position.set(0, verticalOffsetM, 0)
  sprite.scale.set(14 * SIZE_BOOST, (14 / BOAT_TAG_CANVAS_ASPECT) * SIZE_BOOST, 1)

  let lastText = '06:00'
  let lastFinished = false
  const _world = new THREE.Vector3()

  return {
    root: sprite,
    setRemaining(remainingSeconds: number, finished: boolean): void {
      const text = formatCountdownMmSs(remainingSeconds)
      if (text === lastText && finished === lastFinished) return
      lastText = text
      lastFinished = finished
      drawTimer(canvas, text, finished)
      map.needsUpdate = true
    },
    update(camera: THREE.Camera, viewportHeightPx: number): void {
      sprite.getWorldPosition(_world)
      const distance = camera.position.distanceTo(_world)
      const perspective =
        camera instanceof THREE.PerspectiveCamera ? camera : null
      const vFov = perspective?.fov ?? 50
      const heightWorld =
        boatTagWorldHeight(distance, viewportHeightPx, vFov) * SIZE_BOOST
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
