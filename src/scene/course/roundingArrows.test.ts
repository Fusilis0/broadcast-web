/**
 * @vitest-environment happy-dom
 */
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createBuoyMarkers } from './buoyMarkers.ts'
import { DEFAULT_COURSE_APPEARANCE } from './normalizeCourse.ts'
import {
  createRoundingArrowRing,
  DEFAULT_ROUNDING_RADIUS_M,
  ROUNDING_RING_LIFT_Y,
} from './roundingArrows.ts'
import { ROUNDING_REVOLUTION_SEC } from '../features/rounding.ts'

function fireBeforeRender(mesh: THREE.Mesh): void {
  mesh.onBeforeRender(
    {} as THREE.WebGLRenderer,
    {} as THREE.Scene,
    {} as THREE.Camera,
    mesh.geometry,
    mesh.material,
    {} as THREE.Group,
  )
}

describe('createRoundingArrowRing', () => {
  it('returns null for none (no spinning mesh)', () => {
    expect(createRoundingArrowRing({ sense: 'none' })).toBeNull()
  })

  it('omitted sense builds a CW ring at the drone-readable default radius', () => {
    const omitted = createRoundingArrowRing({})
    expect(omitted).not.toBeNull()
    const torus = omitted!.root.getObjectByName('roundingTorus') as THREE.Mesh
    const geom = torus.geometry as THREE.TorusGeometry
    expect(geom.parameters.radius).toBeGreaterThanOrEqual(
      DEFAULT_ROUNDING_RADIUS_M,
    )
    omitted!.dispose()
  })

  it('builds a two-head ring that yaws from the shared clock', () => {
    const cw = createRoundingArrowRing({
      sense: 'cw',
      nowSec: () => ROUNDING_REVOLUTION_SEC / 4,
    })
    expect(cw).not.toBeNull()
    expect(cw!.root.name).toBe('roundingArrows')
    expect(cw!.root.position.y).toBeCloseTo(ROUNDING_RING_LIFT_Y)
    expect(cw!.root.getObjectByName('roundingHead0')).toBeTruthy()
    expect(cw!.root.getObjectByName('roundingHead1')).toBeTruthy()

    const torus = cw!.root.getObjectByName('roundingTorus') as THREE.Mesh
    const spin = cw!.root.getObjectByName('roundingSpin') as THREE.Group
    fireBeforeRender(torus)
    expect(spin.rotation.y).toBeCloseTo(-Math.PI / 2)
    cw!.dispose()

    const ccw = createRoundingArrowRing({
      sense: 'ccw',
      nowSec: () => ROUNDING_REVOLUTION_SEC / 4,
    })
    const torusCcw = ccw!.root.getObjectByName('roundingTorus') as THREE.Mesh
    const spinCcw = ccw!.root.getObjectByName('roundingSpin') as THREE.Group
    fireBeforeRender(torusCcw)
    expect(spinCcw.rotation.y).toBeCloseTo(Math.PI / 2)
    ccw!.dispose()
  })
})

describe('createBuoyMarkers rounding', () => {
  it('omitted defaults to a CW ring; explicit none hides; cw/ccw attach', () => {
    const appearance = DEFAULT_COURSE_APPEARANCE
    const omitted = createBuoyMarkers(
      [{ name: 'A', type: 'mark', x: 0, y: 0, z: 0 }],
      appearance,
    )
    expect(omitted.root.getObjectByName('roundingArrows')).toBeTruthy()
    omitted.dispose()

    const none = createBuoyMarkers(
      [{ name: 'B', type: 'mark', x: 1, y: 0, z: 1, rounding: 'none' }],
      appearance,
    )
    expect(none.root.getObjectByName('roundingArrows')).toBeFalsy()
    none.dispose()

    const cw = createBuoyMarkers(
      [{ name: 'C', type: 'mark', x: 2, y: 0, z: 2, rounding: 'cw' }],
      appearance,
    )
    expect(cw.root.getObjectByName('roundingArrows')).toBeTruthy()
    cw.dispose()

    const gate = createBuoyMarkers(
      [{ name: 'G', type: 'gateLeft', x: 3, y: 0, z: 3 }],
      appearance,
    )
    expect(gate.root.getObjectByName('roundingArrows')).toBeTruthy()
    gate.dispose()
  })
})

describe('createBuoyMarkers mesh / tag visibility', () => {
  const appearance = DEFAULT_COURSE_APPEARANCE

  it('mesh off + tag on + arrows off → only the name sprite', () => {
    const handle = createBuoyMarkers(
      [
        {
          name: 'TagOnly',
          type: 'mark',
          x: 0,
          y: 0,
          z: 0,
          visibleBuoyMesh: false,
          rounding: 'none',
        },
      ],
      appearance,
    )
    const pole = handle.root.getObjectByName('buoy_TagOnly')!
    expect(pole.getObjectByName('buoyFloat')).toBeFalsy()
    expect(pole.getObjectByName('buoyBand')).toBeFalsy()
    expect(pole.getObjectByName('buoyStem')).toBeFalsy()
    expect(pole.getObjectByName('buoyCap')).toBeFalsy()
    expect(pole.getObjectByName('buoyLabel')).toBeTruthy()
    expect(pole.getObjectByName('roundingArrows')).toBeFalsy()
    handle.dispose()
  })

  it('tag off + mesh on → buoy without name', () => {
    const handle = createBuoyMarkers(
      [
        {
          name: 'MeshOnly',
          type: 'mark',
          x: 1,
          y: 0,
          z: 1,
          visibleTag: false,
          rounding: 'none',
        },
      ],
      appearance,
    )
    const pole = handle.root.getObjectByName('buoy_MeshOnly')!
    expect(pole.getObjectByName('buoyFloat')).toBeTruthy()
    expect(pole.getObjectByName('buoyLabel')).toBeFalsy()
    handle.dispose()
  })

  it('omit mesh/tag flags still draws both (old packs)', () => {
    const handle = createBuoyMarkers(
      [{ name: 'Default', type: 'gateLeft', x: 2, y: 0, z: 2, rounding: 'none' }],
      appearance,
    )
    const pole = handle.root.getObjectByName('buoy_Default')!
    expect(pole.getObjectByName('buoyFloat')).toBeTruthy()
    expect(pole.getObjectByName('buoyLabel')).toBeTruthy()
    handle.dispose()
  })

  it('mesh off + tag off + arrows off → empty water (group with no prop)', () => {
    const handle = createBuoyMarkers(
      [
        {
          name: 'Empty',
          type: 'mark',
          x: 3,
          y: 0,
          z: 3,
          visibleBuoyMesh: false,
          visibleTag: false,
          rounding: 'none',
        },
      ],
      appearance,
    )
    const pole = handle.root.getObjectByName('buoy_Empty')!
    expect(pole.children).toHaveLength(0)
    handle.dispose()
  })
})
