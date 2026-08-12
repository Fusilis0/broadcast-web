import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createRealisticEnvironment } from './realisticEnvironment.ts'

describe('createRealisticEnvironment', () => {
  const scenes: THREE.Scene[] = []

  afterEach(() => {
    for (const scene of scenes) {
      scene.clear()
    }
    scenes.length = 0
  })

  it('mounts water+sky and disposes cleanly', () => {
    const handle = createRealisticEnvironment({
      waterSizeM: 100,
      textureSize: 32,
      normalsSize: 32,
      skyScale: 100,
    })
    const scene = new THREE.Scene()
    scenes.push(scene)
    scene.add(handle.root)
    scene.fog = handle.fog

    expect(handle.root.name).toBe('realisticEnvironment')
    expect(handle.root.getObjectByName('realisticWater')).toBeTruthy()
    expect(handle.root.getObjectByName('realisticSky')).toBeTruthy()
    expect(scene.fog).toBe(handle.fog)

    handle.tick(0.016)
    scene.remove(handle.root)
    scene.fog = null
    handle.dispose()
    expect(handle.root.children.length).toBe(0)
  })
})
