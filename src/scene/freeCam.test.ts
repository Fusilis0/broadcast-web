/**
 * @vitest-environment happy-dom
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  cameraGroundBasis,
  createFreeCam,
  DEFAULT_OPS_VIEW_MODE,
  formatOpsViewStatus,
  isFreeCamView,
  isOpsViewMode,
  isTypingTarget,
  wasdGroundDelta,
  wasdSpeedMps,
} from './freeCam.ts'

describe('ops view mode helpers', () => {
  it('accepts follow | free only', () => {
    expect(isOpsViewMode('follow')).toBe(true)
    expect(isOpsViewMode('free')).toBe(true)
    expect(isOpsViewMode('orbit')).toBe(false)
    expect(isOpsViewMode('')).toBe(false)
    expect(DEFAULT_OPS_VIEW_MODE).toBe('free')
  })

  it('formats compact HUD status', () => {
    expect(formatOpsViewStatus('follow')).toBe('view=follow')
    expect(formatOpsViewStatus('free')).toBe('view=free')
  })
})

describe('free cam WASD', () => {
  const forward = new THREE.Vector3(0, 0, -1)
  const right = new THREE.Vector3(1, 0, 0)

  it('goes faster at higher camera height for the same hold', () => {
    expect(wasdSpeedMps(4000)).toBeGreaterThan(wasdSpeedMps(80) * 10)
    const held = new Set(['KeyW'])
    const near = wasdGroundDelta(held, forward, right, 80, 1)
    const far = wasdGroundDelta(held, forward, right, 4000, 1)
    expect(far.length()).toBeGreaterThan(near.length() * 10)
  })

  it('floors speed so a near-sea camera still moves', () => {
    expect(wasdSpeedMps(1)).toBe(wasdSpeedMps(12))
  })

  it('normalizes diagonal so W+D is not faster than W', () => {
    const w = wasdGroundDelta(new Set(['KeyW']), forward, right, 100, 1)
    const wd = wasdGroundDelta(
      new Set(['KeyW', 'KeyD']),
      forward,
      right,
      100,
      1,
    )
    expect(wd.length()).toBeCloseTo(w.length(), 5)
  })

  it('does not treat sidebar inputs as fly keys', () => {
    const input = document.createElement('input')
    expect(isTypingTarget(input)).toBe(true)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
  })

  it('top-down look still has a ground forward', () => {
    const cam = new THREE.PerspectiveCamera()
    cam.position.set(0, 200, 0)
    cam.up.set(0, 1, 0)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()
    const { forward: f } = cameraGroundBasis(cam)
    expect(f.y).toBeCloseTo(0)
    expect(f.length()).toBeCloseTo(1)
  })

  it('translates camera and pivot together while enabled', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const handle = createFreeCam(host)
    handle.setEnabled(true)
    const pos0 = handle.camera.position.clone()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }),
    )
    handle.update(1)
    expect(handle.camera.position.distanceTo(pos0)).toBeGreaterThan(10)
    handle.setEnabled(false)
    const pos1 = handle.camera.position.clone()
    handle.update(1)
    expect(handle.camera.position.distanceTo(pos1)).toBe(0)
    handle.dispose()
    host.remove()
  })

  it('getView / setView round-trip eye and target', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const handle = createFreeCam(host)
    handle.setView({ px: 10, py: 20, pz: -30, tx: 1, ty: 2, tz: 3 })
    const v = handle.getView()
    expect(v.px).toBeCloseTo(10)
    expect(v.py).toBeCloseTo(20)
    expect(v.pz).toBeCloseTo(-30)
    expect(v.tx).toBeCloseTo(1)
    expect(v.ty).toBeCloseTo(2)
    expect(v.tz).toBeCloseTo(3)
    expect(isFreeCamView(v)).toBe(true)
    expect(isFreeCamView({ px: 1 })).toBe(false)
    handle.dispose()
    host.remove()
  })
})
