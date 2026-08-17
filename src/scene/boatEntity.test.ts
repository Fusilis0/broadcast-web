/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  BOAT_VISUAL_LOCAL_OFFSET,
  applyBoatVisualOffset,
} from '../assets/boatVisualOffset.ts'
import { createProceduralBoatVisual } from '../assets/createProceduralBoatVisual.ts'
import { boatTagWorldHeight } from './boatTag.ts'
import { createBoatEntity } from './boatEntity.ts'

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

  it('yaw 0 points geographic north (−Z); yaw 90 points east (+X)', () => {
    const boat = createBoatEntity({ id: '21', tryGltf: false })
    const forward = new THREE.Vector3()

    boat.applyPose({
      id: '21',
      kind: 'boat',
      position: { x: 0, y: 0, z: 0 },
      rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: 0,
    })
    boat.root.getWorldDirection(forward)
    expect(forward.z).toBeLessThan(-0.98)
    expect(Math.abs(forward.x)).toBeLessThan(0.05)

    boat.applyPose({
      id: '21',
      kind: 'boat',
      position: { x: 0, y: 0, z: 0 },
      rotation: { yawDeg: 90, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: 0,
    })
    boat.root.getWorldDirection(forward)
    expect(forward.x).toBeGreaterThan(0.98)
    expect(Math.abs(forward.z)).toBeLessThan(0.05)

    boat.dispose()
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
