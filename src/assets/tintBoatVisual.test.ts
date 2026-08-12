import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createProceduralBoatVisual } from './createProceduralBoatVisual.ts'
import {
  applyBoatHullTint,
  CATEGORY_TINT_USERDATA_KEY,
  parseCssHexToThreeColor,
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

describe('applyBoatHullTint', () => {
  it('tints only marked procedural hull materials', () => {
    const visual = createProceduralBoatVisual()
    applyBoatHullTint(visual, '#0000ff')

    const hullMid = visual.getObjectByName('hullMid') as THREE.Mesh
    const deck = visual.getObjectByName('deck') as THREE.Mesh
    const hullMat = hullMid.material as THREE.MeshStandardMaterial
    const deckMat = deck.material as THREE.MeshStandardMaterial

    expect(hullMat.userData[CATEGORY_TINT_USERDATA_KEY]).toBe(true)
    expect(hullMat.color.getHexString()).toBe('0000ff')
    expect(hullMat.emissive.getHexString()).toBe('0000ff')
    // Deck stays cream (not category-tinted).
    expect(deckMat.color.getHexString()).not.toBe('0000ff')
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
