/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as THREE from 'three'
import {
  BOAT_VISUAL_LOCAL_OFFSET,
  applyBoatVisualOffset,
} from '../assets/boatVisualOffset.ts'
import { createProceduralBoatVisual } from '../assets/createProceduralBoatVisual.ts'
import { boatTagWorldHeight } from './boatTag.ts'
import { createBoatEntity, normalizeBoatHullScale } from './boatEntity.ts'

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

describe('boat tag plate', () => {
  it('is a sprite rectangle with no leader line', () => {
    const boat = createBoatEntity({
      id: '21',
      tryGltf: false,
      color: '#e53935',
    })
    const tag = boat.root.getObjectByName('boatTag')
    const sprite = boat.root.getObjectByName('boatTagSprite')
    expect(tag).toBeTruthy()
    expect(sprite).toBeTruthy()
    expect(boat.root.getObjectByName('boatTagLeader')).toBeFalsy()
    expect(tag!.visible).toBe(true)

    boat.setVisibilityMode('hidden')
    expect(tag!.visible).toBe(true)
    const hull = boat.root.getObjectByName('hull') as THREE.Mesh
    expect(hull.visible).toBe(true)
    expect(hull.parent?.visible).toBe(false)

    boat.setVisibilityMode('ghost')
    expect(tag!.visible).toBe(true)

    boat.setVisibilityMode('solid')
    expect(tag!.visible).toBe(true)

    boat.dispose()
  })
})

describe('SRT channel layers', () => {
  it('ANDs AR tags-only onto authoring (no hull, heading off)', () => {
    const boat = createBoatEntity({ id: '21', tryGltf: false })
    boat.applyPose({
      id: '21',
      kind: 'boat',
      position: { x: 0, y: 0, z: 0 },
      rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: 0,
    })
    const arrow = boat.root.getObjectByName('headingArrow')
    expect(arrow).toBeTruthy()
    expect(arrow!.visible).toBe(true)

    boat.setChannelLayers({
      boatModel: false,
      boatTag: true,
      headingArrow: false,
    })
    const hull = boat.root.getObjectByName('hull') as THREE.Mesh
    expect(hull.parent?.visible).toBe(false)
    expect(boat.root.getObjectByName('boatTag')!.visible).toBe(true)
    expect(arrow!.visible).toBe(false)

    boat.setVisibilityMode('solid')
    expect(hull.parent?.visible).toBe(false)

    boat.setChannelLayers({
      boatModel: true,
      boatTag: false,
      headingArrow: true,
    })
    expect(hull.parent?.visible).toBe(true)
    expect(boat.root.getObjectByName('boatTag')!.visible).toBe(false)
    expect(arrow!.visible).toBe(true)

    boat.setVisibilityMode('hidden')
    boat.setChannelLayers({
      boatModel: true,
      boatTag: true,
      headingArrow: true,
    })
    expect(hull.parent?.visible).toBe(false)
    expect(boat.root.getObjectByName('boatTag')!.visible).toBe(true)

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

describe('boat tag plate', () => {
  it('draws a sharp rectangle (not a pennant or rounded pill)', () => {
    const src = readFileSync(join(__dirname, 'boatTag.ts'), 'utf8')
    expect(src).toContain('fillRect(0, 0, w, h)')
    expect(src).toContain('strokeRect(3, 3, w - 6, h - 6)')
    expect(src).not.toContain('roundRect')
    expect(src).not.toContain('arcTo')
  })
})

describe('boat heightM uniform hull scale', () => {
  it('defaults to 1 when omitted and scales XYZ equally', () => {
    expect(normalizeBoatHullScale(undefined)).toBe(1)
    expect(normalizeBoatHullScale(Number.NaN)).toBe(1)
    expect(normalizeBoatHullScale(0)).toBe(1)
    expect(normalizeBoatHullScale(2)).toBe(2)

    const plain = createBoatEntity({ id: '21', tryGltf: false })
    const hull = plain.root.getObjectByName('hull')
    expect(plain.getHullScale()).toBe(1)
    expect(hull?.parent?.scale.x).toBe(1)
    expect(hull?.parent?.scale.y).toBe(1)
    expect(hull?.parent?.scale.z).toBe(1)
    plain.dispose()

    const tall = createBoatEntity({ id: '22', tryGltf: false, heightM: 2 })
    const tallHull = tall.root.getObjectByName('hull')
    expect(tall.getHullScale()).toBe(2)
    expect(tallHull?.parent?.scale.x).toBe(2)
    expect(tallHull?.parent?.scale.y).toBe(2)
    expect(tallHull?.parent?.scale.z).toBe(2)

    tall.setHullScale(0.5)
    expect(tall.getHullScale()).toBe(0.5)
    expect(tallHull?.parent?.scale.x).toBe(0.5)
    expect(tallHull?.parent?.scale.y).toBe(0.5)
    expect(tallHull?.parent?.scale.z).toBe(0.5)

    tall.setHullScale(undefined)
    expect(tall.getHullScale()).toBe(1)
    expect(tallHull?.parent?.scale.x).toBe(1)
    tall.dispose()
  })
})
