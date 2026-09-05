/**
 * @vitest-environment happy-dom
 */
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { startVisualTimecode } from './visualTimecodeOverlay.ts'

function stubRenderer(): {
  renderer: THREE.WebGLRenderer
  calls: Array<{ scene: THREE.Object3D; camera: THREE.Camera }>
} {
  const calls: Array<{ scene: THREE.Object3D; camera: THREE.Camera }> = []
  const renderer = {
    autoClear: true,
    domElement: { width: 1920, height: 1080 },
    getPixelRatio: () => 1,
    render: (scene: THREE.Object3D, camera: THREE.Camera) => {
      calls.push({ scene, camera })
    },
  }
  return {
    renderer: renderer as unknown as THREE.WebGLRenderer,
    calls,
  }
}

describe('startVisualTimecode wrap (Phase 19.1 re-enable)', () => {
  let stop: (() => void) | null = null
  afterEach(() => {
    stop?.()
    stop = null
  })

  it('wraps renderer.render as a post-pass and stop restores the original', () => {
    const { renderer, calls } = stubRenderer()
    const original = renderer.render
    const handle = startVisualTimecode({
      renderer,
      getActivePovId: () => '1',
      enabled: true,
    })
    stop = () => handle.stop()
    const wrapped = renderer.render
    expect(wrapped).not.toBe(original)

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera()
    renderer.render(scene, cam)
    expect(calls).toHaveLength(2)
    expect(calls[0]?.scene).toBe(scene)
    expect(calls[0]?.camera).toBe(cam)
    expect(calls[1]?.camera).toBeInstanceOf(THREE.OrthographicCamera)

    handle.stop()
    stop = null
    expect(renderer.render).not.toBe(wrapped)
    calls.length = 0
    renderer.render(scene, cam)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.scene).toBe(scene)
    expect(calls[0]?.camera).toBe(cam)
  })
})
