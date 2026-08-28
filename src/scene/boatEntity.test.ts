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
  it('procedural sailboat has hull/sail/mastTop and +Z length bias', () => {
    const visual = createProceduralBoatVisual()
    const names = new Set<string>()
    visual.traverse((o) => {
      if (o.name) names.add(o.name)
    })
    expect(names.has('hull')).toBe(true)
    expect(names.has('sail')).toBe(true)
    expect(names.has('mastTop')).toBe(true)
    expect(names.has('jib')).toBe(true)

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

describe('boat tag leader line', () => {
  it('connects mastTop to the tag and follows tag visibility', () => {
    const boat = createBoatEntity({
      id: '21',
      tryGltf: false,
      color: '#e53935',
    })
    const tag = boat.root.getObjectByName('boatTag')
    const line = boat.root.getObjectByName('boatTagLeader') as THREE.Line
    expect(tag).toBeTruthy()
    expect(line).toBeTruthy()
    expect(tag!.visible).toBe(true)

    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 2000)
    cam.position.set(0, 40, 60)
    boat.updateTag(cam, 1080)
    const pos = line.geometry.getAttribute('position')
    expect(pos.getY(0)).toBeGreaterThan(15)
    expect(pos.getY(1)).toBeGreaterThan(pos.getY(0))

    const mat = line.material as THREE.LineBasicMaterial
    expect(mat.transparent).toBe(true)
    expect(mat.depthWrite).toBe(false)
    expect(mat.color.getHexString()).toBe('e53935')

    boat.setVisibilityMode('hidden')
    expect(tag!.visible).toBe(false)

    boat.setVisibilityMode('ghost')
    expect(tag!.visible).toBe(true)

    boat.setVisibilityMode('solid')
    expect(tag!.visible).toBe(true)

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
