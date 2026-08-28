import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createProceduralBoatVisual } from './createProceduralBoatVisual.ts'
import {
  applyBoatHullTint,
  applyBoatSailTint,
  boatColorToSailTint,
  CATEGORY_TINT_USERDATA_KEY,
  parseCssHexToThreeColor,
  SAIL_TINT_USERDATA_KEY,
} from './tintBoatVisual.ts'

describe('parseCssHexToThreeColor', () => {
  it('parses #rrggbb', () => {
    const c = parseCssHexToThreeColor('#ff66b3')
    expect(c).not.toBeNull()
    expect(c!.getHexString()).toBe('ff66b3')
  })

  it('rejects invalid', () => {
    expect(parseCssHexToThreeColor(undefined)).toBeNull()
    expect(parseCssHexToThreeColor('red')).toBeNull()
    expect(parseCssHexToThreeColor('#fff')).toBeNull()
  })
})

describe('createProceduralBoatVisual', () => {
  it('has named hull, sail, jib, and mastTop', () => {
    const visual = createProceduralBoatVisual()
    expect(visual.getObjectByName('hull')).toBeTruthy()
    expect(visual.getObjectByName('sail')).toBeTruthy()
    expect(visual.getObjectByName('jib')).toBeTruthy()
    expect(visual.getObjectByName('mastTop')).toBeTruthy()
    expect(visual.getObjectByName('mast')).toBeTruthy()
    expect(visual.getObjectByName('boom')).toBeTruthy()
    expect(visual.getObjectByName('keel')).toBeTruthy()

    const sail = visual.getObjectByName('sail') as THREE.Mesh
    const jib = visual.getObjectByName('jib') as THREE.Mesh
    expect(sail.material).toBe(jib.material)
    const sailMat = sail.material as THREE.MeshStandardMaterial
    expect(sailMat.userData[SAIL_TINT_USERDATA_KEY]).toBe(true)
    expect(sailMat.side).toBe(THREE.DoubleSide)
  })
})

describe('applyBoatHullTint', () => {
  it('tints only marked procedural hull materials', () => {
    const visual = createProceduralBoatVisual()
    applyBoatHullTint(visual, '#0000ff')

    const hull = visual.getObjectByName('hull') as THREE.Mesh
    const deck = visual.getObjectByName('deck') as THREE.Mesh
    const hullMat = hull.material as THREE.MeshStandardMaterial
    const deckMat = deck.material as THREE.MeshStandardMaterial

    expect(hullMat.userData[CATEGORY_TINT_USERDATA_KEY]).toBe(true)
    expect(hullMat.color.getHexString()).toBe('0000ff')
    expect(hullMat.emissive.getHexString()).toBe('0000ff')
    // Deck stays cream (not category-tinted).
    expect(deckMat.color.getHexString()).not.toBe('0000ff')
  })

  it('tints sails lighter/desaturated than the hull', () => {
    const visual = createProceduralBoatVisual()
    applyBoatHullTint(visual, '#0000ff')
    const sail = visual.getObjectByName('sail') as THREE.Mesh
    const sailMat = sail.material as THREE.MeshStandardMaterial
    const expected = boatColorToSailTint(new THREE.Color('#0000ff'))
    expect(sailMat.color.getHexString()).toBe(expected.getHexString())
    expect(sailMat.color.getHexString()).not.toBe('0000ff')
    const hsl = { h: 0, s: 0, l: 0 }
    sailMat.color.getHSL(hsl)
    expect(hsl.l).toBeGreaterThan(0.55)
  })

  it('tints all standard materials when none are marked (glTF path)', () => {
    const group = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 })
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat))
    applyBoatHullTint(group, '#00ff00')
    expect(mat.color.getHexString()).toBe('00ff00')
    expect(mat.emissive.getHexString()).toBe('00ff00')
  })
})

describe('applyBoatSailTint', () => {
  it('no-ops when colour is invalid', () => {
    const visual = createProceduralBoatVisual()
    const sail = visual.getObjectByName('sail') as THREE.Mesh
    const before = (sail.material as THREE.MeshStandardMaterial).color.getHex()
    applyBoatSailTint(visual, 'nope')
    expect((sail.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      before,
    )
  })
})
