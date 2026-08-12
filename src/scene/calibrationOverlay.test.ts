/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  CALIBRATION_OVERLAY_DEFAULTS,
  createCalibrationOverlay,
} from './calibrationOverlay.ts'
import {
  clearLayoutFeatures,
  setLayoutFeatures,
} from './features/layoutStore.ts'
import type { LayoutFeature } from './features/types.ts'

function markFeature(
  partial: Partial<LayoutFeature> & Pick<LayoutFeature, 'id' | 'name' | 'type'>,
): LayoutFeature {
  return {
    points: [{ x: 10, y: 0, z: -20 }],
    rawPoints: [{ lat: 0, lon: 0, altMsl: 0 }],
    ...partial,
  }
}

describe('createCalibrationOverlay', () => {
  const scenes: THREE.Scene[] = []
  const handles: ReturnType<typeof createCalibrationOverlay>[] = []

  afterEach(() => {
    for (const h of handles) h.dispose()
    handles.length = 0
    clearLayoutFeatures()
    for (const scene of scenes) {
      scene.clear()
    }
    scenes.length = 0
  })

  it('defaults off; enable mounts grid+origin; disable removes', () => {
    const scene = new THREE.Scene()
    scenes.push(scene)
    const handle = createCalibrationOverlay(scene)
    handles.push(handle)

    expect(handle.isEnabled()).toBe(false)
    expect(scene.getObjectByName('calibrationOverlay')).toBeFalsy()

    handle.setEnabled(true)
    expect(handle.isEnabled()).toBe(true)
    expect(scene.getObjectByName('calibrationOverlay')).toBe(handle.root)
    expect(handle.root.getObjectByName('calibGrid')).toBeTruthy()
    expect(handle.root.getObjectByName('calibOrigin')).toBeTruthy()
    expect(handle.root.getObjectByName('calibGridMinor')).toBeTruthy()
    expect(handle.root.getObjectByName('calibGridMajor')).toBeTruthy()

    handle.setEnabled(false)
    expect(handle.isEnabled()).toBe(false)
    expect(scene.getObjectByName('calibrationOverlay')).toBeFalsy()
    expect(handle.root.children.length).toBe(0)
  })

  it('force-shows marks even when visible3d/visible2d are false', () => {
    const scene = new THREE.Scene()
    scenes.push(scene)
    setLayoutFeatures([
      markFeature({
        id: 'mark:hidden',
        name: 'Hidden Mark',
        type: 'mark',
        visible3d: false,
        visible2d: false,
        points: [{ x: 40, y: 0, z: 15 }],
      }),
      markFeature({
        id: 'buoy:1',
        name: 'Free Buoy',
        type: 'buoy',
        telemetryId: '9',
        visible3d: false,
        points: [{ x: -5, y: 0, z: 8 }],
      }),
      markFeature({
        id: 'start:1',
        name: 'Start',
        type: 'start',
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 30, y: 0, z: 0 },
        ],
      }),
    ])

    const handle = createCalibrationOverlay(scene)
    handles.push(handle)
    handle.setEnabled(true)

    const marks = handle.root.getObjectByName('calibMarks')
    expect(marks).toBeTruthy()
    const poles = marks!
      .children
      .filter((c) => c.name === 'calibPole')
    // hidden mark + buoy + start A + start B
    expect(poles.length).toBe(4)
    expect(handle.root.getObjectByName('calibMarkLines')).toBeTruthy()
  })

  it('rebuild refreshes marks after layout changes while enabled', () => {
    const scene = new THREE.Scene()
    scenes.push(scene)
    setLayoutFeatures([])
    const handle = createCalibrationOverlay(scene)
    handles.push(handle)
    handle.setEnabled(true)
    expect(
      handle.root.getObjectByName('calibMarks')?.children.filter(
        (c) => c.name === 'calibPole',
      ).length,
    ).toBe(0)

    setLayoutFeatures([
      markFeature({
        id: 'mark:a',
        name: 'A',
        type: 'mark',
        points: [{ x: 1, y: 0, z: 2 }],
      }),
    ])
    handle.rebuild()
    expect(
      handle.root.getObjectByName('calibMarks')?.children.filter(
        (c) => c.name === 'calibPole',
      ).length,
    ).toBe(1)
  })

  it('uses lines/poles only — no opaque sky/ground plane fill', () => {
    const scene = new THREE.Scene()
    scenes.push(scene)
    const handle = createCalibrationOverlay(scene, {
      halfExtentM: 100,
      spacingM: 50,
    })
    handles.push(handle)
    handle.setEnabled(true)

    let hasOpaquePlane = false
    handle.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (obj.name === 'calibPole') return
      const geom = obj.geometry
      if (geom instanceof THREE.PlaneGeometry) hasOpaquePlane = true
      if (
        geom instanceof THREE.CircleGeometry &&
        (geom.parameters.radius ?? 0) > 20
      ) {
        hasOpaquePlane = true
      }
    })
    expect(hasOpaquePlane).toBe(false)
    expect(CALIBRATION_OVERLAY_DEFAULTS.spacingM).toBe(50)
    expect(CALIBRATION_OVERLAY_DEFAULTS.halfExtentM).toBe(1000)
  })
})
