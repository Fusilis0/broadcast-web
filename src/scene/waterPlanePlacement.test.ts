import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyFlatOnWaterPlacement,
  flatOnWaterBasis,
  WATER_PLANE_Y,
  WATER_PLANE_Y_OFFSET,
} from './waterPlanePlacement.ts'

describe('flatOnWaterBasis', () => {
  it('maps +X along A→B, +Z to world up', () => {
    // A→B east (+X)
    const basis = flatOnWaterBasis(0, 0, 10, 0)
    expect(basis).not.toBeNull()
    expect(basis!.along.x).toBeCloseTo(1)
    expect(basis!.along.z).toBeCloseTo(0)
    expect(basis!.up.y).toBeCloseTo(1)
    expect(basis!.across.y).toBeCloseTo(0)
  })

  it('returns null for a degenerate span', () => {
    expect(flatOnWaterBasis(1, 2, 1, 2)).toBeNull()
  })
})

describe('applyFlatOnWaterPlacement', () => {
  it('sets sky-facing quaternion and the shared water lift', () => {
    const obj = new THREE.Object3D()
    const ok = applyFlatOnWaterPlacement(obj, {
      ax: 0,
      az: 0,
      bx: 20,
      bz: 0,
      midX: 10,
      midZ: 0,
    })
    expect(ok).toBe(true)
    expect(obj.position.x).toBeCloseTo(10)
    expect(obj.position.y).toBeCloseTo(WATER_PLANE_Y + WATER_PLANE_Y_OFFSET)
    expect(obj.position.z).toBeCloseTo(0)
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion)
    expect(normal.x).toBeCloseTo(0)
    expect(normal.y).toBeCloseTo(1)
    expect(normal.z).toBeCloseTo(0)
    const along = new THREE.Vector3(1, 0, 0).applyQuaternion(obj.quaternion)
    expect(along.x).toBeCloseTo(1)
    expect(along.y).toBeCloseTo(0)
  })
})
