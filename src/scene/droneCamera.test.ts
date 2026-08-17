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
    // Scene ENU: x=East, z=−North. Boat NE of drone, ~16° below horizon.
    const dronePos = { x: 0, y: 50, z: 0 }
    const boatPos = { x: 200, y: -37, z: -200 }
    const toBoat = new THREE.Vector3(
      boatPos.x - dronePos.x,
      boatPos.y - dronePos.y,
      boatPos.z - dronePos.z,
    )
    // Compass yaw: 0 = −Z (north), 90 = +X (east).
    const bearingDeg = THREE.MathUtils.radToDeg(Math.atan2(toBoat.x, -toBoat.z))
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

  it('yaw 0 looks geographic north (−Z); yaw 90 looks east (+X)', () => {
    const drone = createDroneCamera(16 / 9)
    drone.applyPose({
      id: '1',
      kind: 'drone',
      position: { x: 0, y: 50, z: 0 },
      rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: 0,
    })
    const north = new THREE.Vector3()
    drone.camera.getWorldDirection(north)
    expect(north.z).toBeLessThan(-0.98)
    expect(Math.abs(north.x)).toBeLessThan(0.05)

    drone.applyPose({
      id: '1',
      kind: 'drone',
      position: { x: 0, y: 50, z: 0 },
      rotation: { yawDeg: 90, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: 0,
    })
    const east = new THREE.Vector3()
    drone.camera.getWorldDirection(east)
    expect(east.x).toBeGreaterThan(0.98)
    expect(Math.abs(east.z)).toBeLessThan(0.05)
  })
})
