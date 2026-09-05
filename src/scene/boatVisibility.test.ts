import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createProceduralBoatVisual } from '../assets/createProceduralBoatVisual.ts'
import {
  applyBoatVisibilityMode,
  applyHullMaterialOpacity,
  cloneSharedMaterials,
  createGhostBoatRing,
  DEFAULT_BOAT_VISIBILITY_MODE,
  GHOST_HULL_OPACITY,
  isBoatVisibilityMode,
  normalizeBoatVisibilityMap,
  normalizeBoatVisibilityMode,
  tintGhostBoatRing,
} from './boatVisibility.ts'

describe('normalizeBoatVisibilityMode', () => {
  it('accepts known modes', () => {
    expect(isBoatVisibilityMode('solid')).toBe(true)
    expect(isBoatVisibilityMode('ghost')).toBe(true)
    expect(isBoatVisibilityMode('hidden')).toBe(true)
    expect(normalizeBoatVisibilityMode('ghost')).toBe('ghost')
  })

  it('soft-defaults invalid values to solid', () => {
    expect(normalizeBoatVisibilityMode(undefined)).toBe(
      DEFAULT_BOAT_VISIBILITY_MODE,
    )
    expect(normalizeBoatVisibilityMode('nope')).toBe('solid')
    expect(normalizeBoatVisibilityMode(1)).toBe('solid')
  })
})

describe('normalizeBoatVisibilityMap', () => {
  it('keeps only valid id→mode pairs', () => {
    const map = normalizeBoatVisibilityMap({
      '21': 'ghost',
      '22': 'hidden',
      '23': 'solid',
      '24': 'nope',
      '': 'ghost',
    })
    expect(map.get('21')).toBe('ghost')
    expect(map.get('22')).toBe('hidden')
    expect(map.get('23')).toBe('solid')
    expect(map.has('24')).toBe(false)
    expect(map.has('')).toBe(false)
  })
})

describe('applyHullMaterialOpacity', () => {
  it('sets transparent + opacity on mesh materials', () => {
    const visual = createProceduralBoatVisual()
    applyHullMaterialOpacity(visual, GHOST_HULL_OPACITY, true)
    const hull = visual.getObjectByName('hull') as THREE.Mesh
    const mat = hull.material as THREE.MeshStandardMaterial
    expect(mat.transparent).toBe(true)
    expect(mat.opacity).toBe(GHOST_HULL_OPACITY)
    expect(mat.depthWrite).toBe(false)

    applyHullMaterialOpacity(visual, 1, false)
    expect(mat.transparent).toBe(false)
    expect(mat.opacity).toBe(1)
    expect(mat.depthWrite).toBe(true)
  })
})

describe('createGhostBoatRing', () => {
  it('tints from category colour', () => {
    const ring = createGhostBoatRing('#00ff00')
    const mat = ring.material as THREE.MeshBasicMaterial
    expect(mat.color.getHexString()).toBe('00ff00')
    tintGhostBoatRing(ring, '#ff00ff')
    expect(mat.color.getHexString()).toBe('ff00ff')
  })
})

describe('applyBoatVisibilityMode', () => {
  function targets() {
    const visual = createProceduralBoatVisual()
    const ghostRing = createGhostBoatRing('#ff66b3')
    const tagRoot = new THREE.Object3D()
    tagRoot.name = 'tagStub'
    return { visual, ghostRing, tagRoot }
  }

  it('ghost: translucent hull + ring + tag', () => {
    const t = targets()
    applyBoatVisibilityMode('ghost', t)

    expect(t.visual.visible).toBe(true)
    expect(t.ghostRing.visible).toBe(true)
    expect(t.tagRoot.visible).toBe(true)
    const hull = t.visual.getObjectByName('hull') as THREE.Mesh
    const mat = hull.material as THREE.MeshStandardMaterial
    expect(mat.opacity).toBe(GHOST_HULL_OPACITY)
    expect(mat.transparent).toBe(true)
  })

  it('hidden: hull/ring off, tag on (map-dot tracks separately)', () => {
    const t = targets()
    applyBoatVisibilityMode('hidden', t)

    expect(t.visual.visible).toBe(false)
    expect(t.ghostRing.visible).toBe(false)
    expect(t.tagRoot.visible).toBe(true)
  })

  it('solid: opaque hull, no ring', () => {
    const t = targets()
    applyBoatVisibilityMode('ghost', t)
    applyBoatVisibilityMode('solid', t)

    expect(t.visual.visible).toBe(true)
    expect(t.ghostRing.visible).toBe(false)
    expect(t.tagRoot.visible).toBe(true)
    const hull = t.visual.getObjectByName('hull') as THREE.Mesh
    const mat = hull.material as THREE.MeshStandardMaterial
    expect(mat.opacity).toBe(1)
    expect(mat.transparent).toBe(false)
  })
})

describe('cloneSharedMaterials', () => {
  it('Object3D.clone(true) shares materials (ghost leak without clone)', () => {
    const a = createProceduralBoatVisual()
    const b = a.clone(true)
    const hullA = a.getObjectByName('hull') as THREE.Mesh
    const hullB = b.getObjectByName('hull') as THREE.Mesh
    expect(hullA.material).toBe(hullB.material)

    applyHullMaterialOpacity(b, GHOST_HULL_OPACITY, true)
    expect((hullA.material as THREE.MeshStandardMaterial).opacity).toBe(
      GHOST_HULL_OPACITY,
    )
  })

  it('isolates ghost opacity across clones; keeps in-boat sharing', () => {
    const solid = createProceduralBoatVisual()
    const ghost = solid.clone(true)
    cloneSharedMaterials(ghost)

    const hullSolid = solid.getObjectByName('hull') as THREE.Mesh
    const hullGhost = ghost.getObjectByName('hull') as THREE.Mesh
    expect(hullSolid.material).not.toBe(hullGhost.material)

    const sail = ghost.getObjectByName('sail') as THREE.Mesh
    const jib = ghost.getObjectByName('jib') as THREE.Mesh
    expect(sail.material).toBe(jib.material)

    const ring = createGhostBoatRing()
    const tagRoot = new THREE.Object3D()
    applyBoatVisibilityMode('ghost', { visual: ghost, ghostRing: ring, tagRoot })
    applyBoatVisibilityMode('solid', {
      visual: solid,
      ghostRing: createGhostBoatRing(),
      tagRoot: new THREE.Object3D(),
    })

    expect((hullSolid.material as THREE.MeshStandardMaterial).opacity).toBe(1)
    expect(
      (hullSolid.material as THREE.MeshStandardMaterial).transparent,
    ).toBe(false)
    expect((hullGhost.material as THREE.MeshStandardMaterial).opacity).toBe(
      GHOST_HULL_OPACITY,
    )
    expect(
      (hullGhost.material as THREE.MeshStandardMaterial).transparent,
    ).toBe(true)
  })
})
