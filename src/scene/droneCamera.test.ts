import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createDroneCamera, horizontalToVerticalFovDeg } from './droneCamera.ts'

describe('droneCamera', () => {
  it('converts horizontal FOV to vertical for aspect', () => {
    const v = horizontalToVerticalFovDeg(66.8832, 16 / 9)
    expect(v).toBeGreaterThan(35)
    expect(v).toBeLessThan(45)
  })

  it('Unity +Z forward maps to Three look toward boat when yaw/pitch match ENU bearing', () => {
    // Mock-ish geometry: boat SE of drone, ~16° below horizon, bearing ~135° from north.
    const dronePos = { x: 0, y: 50, z: 0 }
    const boatPos = { x: 200, y: -37, z: -200 }
    const toBoat = new THREE.Vector3(
      boatPos.x - dronePos.x,
      boatPos.y - dronePos.y,
      boatPos.z - dronePos.z,
    )
    const bearingDeg = THREE.MathUtils.radToDeg(Math.atan2(toBoat.x, toBoat.z))
    const elevDeg = THREE.MathUtils.radToDeg(
      Math.atan2(toBoat.y, Math.hypot(toBoat.x, toBoat.z)),
    )

    // GEO/Unity: pitchDeg positive = look down (DJI pitch negated). elevDeg is negative for below.
    const pitchDeg = -elevDeg

    const drone = createDroneCamera(16 / 9)
    drone.applyPose({
      id: '1',
      kind: 'drone',
      position: dronePos,
      rotation: { yawDeg: bearingDeg, pitchDeg, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: 0,
    })

    const forward = new THREE.Vector3()
    drone.camera.getWorldDirection(forward)
    const expected = toBoat.clone().normalize()
    expect(forward.dot(expected)).toBeGreaterThan(0.98)
  })
})
