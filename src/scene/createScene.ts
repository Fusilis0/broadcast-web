import * as THREE from 'three'
import { poseBus, type PoseEvent } from '../pose/index.ts'
import {
  createBoatEntity,
  type BoatEntityHandle,
} from './boatEntity.ts'
import { createDroneCamera, TEMP_HFOV_DEG } from './droneCamera.ts'
import { boatIdAllowSet, isAllowedBoatId } from './fleetRegistry.ts'

/** Mock drone id from TEL (`src/telemetry/mockSource.ts`). */
export const DEFAULT_DRONE_ID = '1'

export type SceneOptions = {
  /** Container for the canvas (e.g. `#app`). */
  container: HTMLElement
  /**
   * Allowed boat channel ids (from `loadConfig().boatIds`).
   * Poses with other boat ids are ignored. Default `["21"]` if omitted/empty.
   */
  boatIds?: readonly string[]
  /** @deprecated Prefer `boatIds`. Single-id allow-list when `boatIds` omitted. */
  boatId?: string
  droneId?: string
  /** Dark preview clear — OUT owns chroma later. */
  clearColor?: number
}

export type SceneHandle = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  /** Live fleet registry (boats with at least one applied pose). */
  boats: ReadonlyMap<string, BoatEntityHandle>
  stop: () => void
}

/**
 * Own the Three scene, resize, RAF render loop, and poseBus → entity apply.
 * Draws only — no lat/lon math, no telemetry bus.
 */
export function startScene(options: SceneOptions): SceneHandle {
  const allow =
    options.boatIds !== undefined
      ? boatIdAllowSet(options.boatIds)
      : boatIdAllowSet(options.boatId !== undefined ? [options.boatId] : undefined)
  const droneId = options.droneId ?? DEFAULT_DRONE_ID
  const clearColor = options.clearColor ?? 0x1a1a1a

  const scene = new THREE.Scene()

  // Minimal lights so MeshStandard / glTF materials read on dark preview.
  const ambient = new THREE.AmbientLight(0xffffff, 0.85)
  ambient.name = 'ambient'
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.6)
  sun.name = 'sun'
  sun.position.set(40, 80, 20)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xa8c4ff, 0.45)
  fill.name = 'fill'
  fill.position.set(-30, 40, -20)
  scene.add(fill)

  const drone = createDroneCamera(1, TEMP_HFOV_DEG)
  const boats = new Map<string, BoatEntityHandle>()

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setClearColor(clearColor, 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  options.container.appendChild(renderer.domElement)

  let rafId = 0
  let stopped = false
  let viewH = 1

  function resize(): void {
    const width = window.innerWidth
    const height = Math.max(window.innerHeight, 1)
    viewH = height
    drone.setAspect(width / height)
    renderer.setSize(width, height, false)
  }

  function ensureBoat(id: string): BoatEntityHandle {
    let boat = boats.get(id)
    if (boat) return boat
    boat = createBoatEntity({ id })
    boats.set(id, boat)
    scene.add(boat.root)
    return boat
  }

  function onPose(pose: PoseEvent): void {
    if (pose.kind === 'drone' && pose.id === droneId) {
      drone.applyPose(pose)
      return
    }
    if (pose.kind === 'boat') {
      if (!isAllowedBoatId(pose.id, allow)) return
      ensureBoat(pose.id).applyPose(pose)
    }
  }

  function frame(): void {
    if (stopped) return
    rafId = requestAnimationFrame(frame)
    try {
      for (const boat of boats.values()) {
        boat.updateTag(drone.camera, viewH)
      }
      renderer.render(scene, drone.camera)
    } catch (err) {
      console.error('[scene] frame error', err)
      stopped = true
    }
  }

  const unsubPose = poseBus.on('pose', onPose)
  window.addEventListener('resize', resize)
  resize()
  rafId = requestAnimationFrame(frame)

  return {
    scene,
    camera: drone.camera,
    renderer,
    boats,
    stop(): void {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      unsubPose()
      for (const boat of boats.values()) {
        scene.remove(boat.root)
        boat.dispose()
      }
      boats.clear()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
