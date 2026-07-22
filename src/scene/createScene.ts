import * as THREE from 'three'
import { poseBus, type PoseEvent } from '../pose/index.ts'
import { createBoatEntity, DEFAULT_BOAT_ID } from './boatEntity.ts'
import { createDroneCamera, TEMP_HFOV_DEG } from './droneCamera.ts'

/** Mock drone id from TEL (`src/telemetry/mockSource.ts`). */
export const DEFAULT_DRONE_ID = '1'

export type SceneOptions = {
  /** Container for the canvas (e.g. `#app`). */
  container: HTMLElement
  boatId?: string
  droneId?: string
  /** Dark preview clear — OUT owns chroma later. */
  clearColor?: number
}

export type SceneHandle = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  stop: () => void
}

/**
 * Own the Three scene, resize, RAF render loop, and poseBus → entity apply.
 * Draws only — no lat/lon math, no telemetry bus.
 */
export function startScene(options: SceneOptions): SceneHandle {
  const boatId = options.boatId ?? DEFAULT_BOAT_ID
  const droneId = options.droneId ?? DEFAULT_DRONE_ID
  const clearColor = options.clearColor ?? 0x1a1a1a

  const scene = new THREE.Scene()

  const drone = createDroneCamera(1, TEMP_HFOV_DEG)
  const boat = createBoatEntity()
  scene.add(boat.root)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setClearColor(clearColor, 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  options.container.appendChild(renderer.domElement)

  let rafId = 0
  let stopped = false

  function resize(): void {
    const width = window.innerWidth
    const height = Math.max(window.innerHeight, 1)
    drone.setAspect(width / height)
    renderer.setSize(width, height, false)
  }

  function onPose(pose: PoseEvent): void {
    if (pose.kind === 'drone' && pose.id === droneId) {
      drone.applyPose(pose)
      return
    }
    if (pose.kind === 'boat' && pose.id === boatId) {
      boat.applyPose(pose)
    }
  }

  function frame(): void {
    if (stopped) return
    rafId = requestAnimationFrame(frame)
    renderer.render(scene, drone.camera)
  }

  const unsubPose = poseBus.on('pose', onPose)
  window.addEventListener('resize', resize)
  resize()
  rafId = requestAnimationFrame(frame)

  return {
    scene,
    camera: drone.camera,
    renderer,
    stop(): void {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      unsubPose()
      boat.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
