import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  BOAT_VISUAL_LOCAL_OFFSET,
  applyBoatVisualOffset,
} from '../assets/boatVisualOffset.ts'
import { createProceduralBoatVisual } from '../assets/createProceduralBoatVisual.ts'
import { boatTagWorldHeight } from './boatTag.ts'

describe('boat visual', () => {
  it('procedural hull has clear bow/stern children and +Z length bias', () => {
    const visual = createProceduralBoatVisual()
    const names = new Set<string>()
    visual.traverse((o) => {
      if (o.name) names.add(o.name)
    })
    expect(names.has('hullBow')).toBe(true)
    expect(names.has('hullStern')).toBe(true)
    expect(names.has('cabin')).toBe(true)

    const box = new THREE.Box3().setFromObject(visual)
    const size = box.getSize(new THREE.Vector3())
    // Longer along Z (forward) than X (beam)
    expect(size.z).toBeGreaterThan(size.x)
    expect(size.z).toBeGreaterThan(14)
  })

  it('visual offset defaults to identity (authored +Z forward)', () => {
    expect(BOAT_VISUAL_LOCAL_OFFSET.scale.x).toBe(1)
    const g = new THREE.Group()
    applyBoatVisualOffset(g)
    expect(g.position.length()).toBe(0)
    expect(g.rotation.x).toBe(0)
    expect(g.scale.z).toBe(1)
  })
})

describe('boatTagWorldHeight', () => {
  it('grows world height with distance (partial screen-size compensation)', () => {
    const near = boatTagWorldHeight(80, 1080, 40)
    const far = boatTagWorldHeight(320, 1080, 40)
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(near)
    // Mild falloff: less than full constant-screen (×4 for 80→320)
    expect(far / near).toBeLessThan(4)
  })
})
