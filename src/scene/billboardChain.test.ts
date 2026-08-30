/**
 * @vitest-environment happy-dom
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { mountBillboardChains } from './billboardChain.ts'
import { SPONSOR_WATER_Y } from './sponsors/sponsorLayout.ts'
import type { WorldFeature } from './features/types.ts'

describe('mountBillboardChains', () => {
  it('keeps chain instances upright (does not inherit sponsor flat placement)', async () => {
    const features: WorldFeature[] = [
      {
        id: 'chain:1',
        name: 'chain',
        type: 'billboardChain',
        points: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 50, altMsl: 0 },
        ],
        heightM: 8,
        spacingM: 100,
        label: 'Chain',
      },
    ]
    const scene = new THREE.Scene()
    const handle = await mountBillboardChains(scene, features, (_lat, lon) => ({
      x: lon,
      y: 0,
      z: 0,
    }))
    expect(handle).not.toBeNull()
    try {
      const mesh = handle!.root.children[0] as THREE.Mesh
      expect(mesh).toBeDefined()
      expect(mesh.position.y).toBeCloseTo(SPONSOR_WATER_Y + 4)
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion)
      expect(localUp.y).toBeCloseTo(1)
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion)
      expect(Math.abs(normal.y)).toBeLessThan(1e-6)
      const mat = mesh.material as THREE.MeshBasicMaterial
      expect(mat.transparent).toBe(false)
      expect(mat.depthWrite).toBe(true)
    } finally {
      handle!.dispose()
    }
  })
})
