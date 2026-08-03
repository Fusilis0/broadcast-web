import * as THREE from 'three'
import { poseBus, type PoseEvent } from '../pose/index.ts'
import {
  createBoatEntity,
  type BoatEntityHandle,
} from './boatEntity.ts'
import {
  loadBoatNames,
  lookupBoatName,
  upsertBoatNameEntry,
  type BoatNameEntry,
  type BoatNamesCatalogue,
  type UpsertBoatNameInput,
} from './boatNames/index.ts'
import {
  DEFAULT_COURSE_APPEARANCE,
  loadCourse,
  mountCourse,
  type CourseAppearance,
  type CourseHandle,
} from './course/index.ts'
import {
  featuresToCourseData,
  featuresToFlagsData,
  featuresToSponsorsData,
  type FlagsRemountMeta,
} from './features/editor/reverseAdapters.ts'
import type { WorldFeature } from './features/types.ts'
import { clearLayoutFeatures } from './features/layoutStore.ts'
import { createDroneCamera, TEMP_HFOV_DEG } from './droneCamera.ts'
import {
  boatIdAllowSet,
  isAllowedBoatId,
  orphanBoatIds,
} from './fleetRegistry.ts'
import {
  DEFAULT_DRONE_ID,
  clampActivePovId,
  isAllowedPovId,
  orphanPovCacheIds,
  povIdAllowSet,
  resolveInitialPovId,
  resolvePovIdList,
} from './povSwitcher.ts'
import {
  loadCountdownFlags,
  mountCountdownFlags,
  type FlagsHandle,
} from './flags/index.ts'
import type { CountdownFlagsData } from './flags/types.ts'
import {
  loadSponsors,
  mountSponsors,
  type SponsorsHandle,
} from './sponsors/index.ts'

export { DEFAULT_DRONE_ID }

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
  /**
   * Allowed POV / drone+cam ids (from `loadConfig().povIds`).
   * Default `["1","2"]` if omitted/empty.
   */
  povIds?: readonly string[]
  /**
   * @deprecated Prefer `povIds`. When `povIds` omitted, becomes the sole
   * allow-list entry; when both set, selects initial active id if allowed.
   */
  droneId?: string
  /**
   * Initial WebGL clear color. OUT owns values via `resolveClearAppearance`
   * / `applyOutputMode`; pass the resolved color at boot.
   */
  clearColor?: number
  /**
   * Lock drawing-buffer size (e.g. studio NDI 1920×1080). CSS may still
   * scale the canvas in the window; resize events do not change the buffer.
   */
  outputSize?: { width: number; height: number }
  /**
   * Keep rendering when the document is hidden / window minimized (Electron
   * studio). Fallback setInterval only — prefer `frameClock` from main process.
   */
  keepRenderingWhenHidden?: boolean
  /**
   * External frame clock (Electron main `studio:tick`). When set, this drives
   * rendering instead of rAF so minimize does not throttle NDI.
   */
  frameClock?: {
    subscribe: (onTick: () => void) => () => void
  }
}

export type FleetAllowLists = {
  boatIds: readonly string[]
  povIds: readonly string[]
}

export type SceneHandle = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  /** Live fleet registry (boats with at least one applied pose). */
  boats: ReadonlyMap<string, BoatEntityHandle>
  /** Configured POV ids (ordered). Live — updates after `setFleetAllowLists`. */
  readonly povIds: readonly string[]
  /** Currently selected render camera POV id. */
  getActivePovId: () => string
  /**
   * Switch active POV. Applies cached last pose immediately when available.
   * Returns false if `id` is not in the allow-list.
   */
  setActivePovId: (id: string) => boolean
  /**
   * Replace boat + POV allow-lists (soft race switch). Drops orphan boats,
   * prunes POV pose cache, clamps active POV. Returns the active POV id.
   */
  setFleetAllowLists: (lists: FleetAllowLists) => string
  /**
   * Load static course after GEO origin + EGM96 are ready.
   * Returns map points (marks + gate ends) for the 2D overlay.
   */
  loadCourseFromUrl: (url?: string) => Promise<CourseHandle | null>
  /**
   * Load static sponsor billboards after GEO origin + EGM96 are ready.
   */
  loadSponsorsFromUrl: (url?: string) => Promise<SponsorsHandle | null>
  /**
   * Load countdown flags + timer after GEO origin + EGM96 are ready.
   */
  loadCountdownFlagsFromUrl: (
    url?: string,
  ) => Promise<FlagsHandle | null>
  /**
   * Remount course / sponsors / flags from editable WorldFeature[] (map editor).
   * Stub types (start/finish/arrow) stay map-only.
   */
  remountWorldFromFeatures: (
    features: readonly WorldFeature[],
  ) => Promise<void>
  /**
   * Load boat name/colour catalogue and apply to existing + future tags.
   * Safe anytime after `startScene` (before or after boats spawn).
   */
  loadBoatNamesFromUrl: (url?: string) => Promise<BoatNamesCatalogue>
  /** Snapshot of the in-memory name catalogue (ops Fleet panel). */
  getBoatNamesCatalogue: () => BoatNamesCatalogue
  /** Upsert one boat name/category/color and apply to a live entity if present. */
  upsertBoatName: (input: UpsertBoatNameInput) => BoatNameEntry | null
  /** Start / pause / reset / restart the loaded countdown (no-op if none). */
  controlCountdown: (
    action: 'start' | 'pause' | 'reset' | 'restart',
  ) => void
  /**
   * Thin OUT hook: set WebGL clear color + alpha at runtime.
   * Prefer `applyOutputMode(renderer, …)` from `src/output/` for mode mapping.
   */
  setClearColor: (color: number, alpha?: number) => void
  stop: () => void
}

/**
 * Own the Three scene, resize, RAF render loop, and poseBus → entity apply.
 * Draws only — no lat/lon math, no telemetry bus.
 * Course/sponsors/flags lat/lon → ENU goes through GEO via loaders (after origin).
 */
export function startScene(options: SceneOptions): SceneHandle {
  let allow =
    options.boatIds !== undefined
      ? boatIdAllowSet(options.boatIds)
      : boatIdAllowSet(options.boatId !== undefined ? [options.boatId] : undefined)
  let povIds = resolvePovIdList(options.povIds, options.droneId)
  let povAllow = povIdAllowSet(povIds)
  let activePovId = resolveInitialPovId(povIds, options.droneId)
  const lastPoseByPovId = new Map<string, PoseEvent>()
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
  let boatNames: BoatNamesCatalogue = new Map()
  let course: CourseHandle | null = null
  let sponsors: SponsorsHandle | null = null
  let countdownFlags: FlagsHandle | null = null
  let courseAppearance: CourseAppearance = { ...DEFAULT_COURSE_APPEARANCE }
  let flagsMeta: FlagsRemountMeta = {}
  let remountGen = 0
  const clock = new THREE.Clock()

  function captureFlagsMeta(data: CountdownFlagsData): void {
    flagsMeta = {
      startMinutes: data.startMinutes,
      whiteRaiseMinutes: data.whiteRaiseMinutes,
      orangeRaiseMinutes: data.orangeRaiseMinutes,
      blueWhiteRaiseMinutes: data.blueWhiteRaiseMinutes,
      blueWhiteLowerMinutes: data.blueWhiteLowerMinutes,
      point1FlagVerticalOffset: data.point1FlagVerticalOffset,
      point2FlagVerticalOffset: data.point2FlagVerticalOffset,
      blueWhiteExtraOffsetM: data.blueWhiteExtraOffsetM,
      canvasVerticalOffset: data.canvasVerticalOffset,
      poleHeightM: data.poleHeightM,
      autoStart: data.autoStart,
      demoTimeScale: data.demoTimeScale,
    }
  }

  function applyCatalogueToBoat(boat: BoatEntityHandle): void {
    const entry = lookupBoatName(boatNames, boat.id)
    if (!entry) return
    boat.setTagIdentity({
      displayName: entry.name,
      color: entry.color,
    })
  }

  // alpha:true so OUT WHEP underlay can show through transparent preview clear.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(clearColor, 1)
  const lockedOut = options.outputSize
  const keepWhenHidden = options.keepRenderingWhenHidden === true
  const frameClock = options.frameClock
  // Studio NDI needs exact buffer pixels — do not multiply by devicePixelRatio.
  renderer.setPixelRatio(
    lockedOut ? 1 : Math.min(window.devicePixelRatio, 2),
  )
  options.container.appendChild(renderer.domElement)

  let rafId = 0
  let intervalId: ReturnType<typeof setInterval> | 0 = 0
  let unsubFrameClock: (() => void) | null = null
  let stopped = false
  let viewH = 1

  function resize(): void {
    if (lockedOut) {
      const width = Math.max(1, lockedOut.width | 0)
      const height = Math.max(1, lockedOut.height | 0)
      viewH = height
      drone.setAspect(width / height)
      // updateStyle false — then force 1:1 CSS px so the window cannot
      // scale the bitmap (barcode must stay fixed on screen and on NDI).
      renderer.setSize(width, height, false)
      const el = renderer.domElement
      el.style.width = `${width}px`
      el.style.height = `${height}px`
      el.style.maxWidth = 'none'
      el.style.maxHeight = 'none'
      el.style.objectFit = 'fill'
      options.container.classList.add('studio-shell')
      return
    }
    options.container.classList.remove('studio-shell')
    const width = window.innerWidth
    const height = Math.max(window.innerHeight, 1)
    viewH = height
    drone.setAspect(width / height)
    renderer.setSize(width, height, false)
  }

  function ensureBoat(id: string): BoatEntityHandle {
    let boat = boats.get(id)
    if (boat) return boat
    const entry = lookupBoatName(boatNames, id)
    boat = createBoatEntity({
      id,
      displayName: entry?.name,
      color: entry?.color,
    })
    boats.set(id, boat)
    scene.add(boat.root)
    return boat
  }

  function onPose(pose: PoseEvent): void {
    if (pose.kind === 'drone') {
      if (!isAllowedPovId(pose.id, povAllow)) return
      lastPoseByPovId.set(pose.id, pose)
      if (pose.id === activePovId) {
        drone.applyPose(pose)
      }
      return
    }
    if (pose.kind === 'boat') {
      if (!isAllowedBoatId(pose.id, allow)) return
      ensureBoat(pose.id).applyPose(pose)
    }
  }

  function setActivePovId(id: string): boolean {
    if (!isAllowedPovId(id, povAllow)) return false
    if (id === activePovId) return true
    activePovId = id
    const cached = lastPoseByPovId.get(id)
    if (cached) drone.applyPose(cached)
    return true
  }

  function setFleetAllowLists(lists: FleetAllowLists): string {
    if (stopped) return activePovId

    allow = boatIdAllowSet(lists.boatIds)
    for (const id of orphanBoatIds(boats.keys(), allow)) {
      const boat = boats.get(id)
      if (!boat) continue
      scene.remove(boat.root)
      boat.dispose()
      boats.delete(id)
    }

    povIds = resolvePovIdList(lists.povIds)
    povAllow = povIdAllowSet(povIds)
    for (const id of orphanPovCacheIds(lastPoseByPovId.keys(), povAllow)) {
      lastPoseByPovId.delete(id)
    }

    const nextActive = clampActivePovId(activePovId, povIds)
    if (nextActive !== activePovId) {
      activePovId = nextActive
      const cached = lastPoseByPovId.get(activePovId)
      if (cached) drone.applyPose(cached)
    }
    return activePovId
  }

  function tick(): void {
    if (stopped) return
    try {
      const dt = Math.min(clock.getDelta(), 0.1)
      for (const boat of boats.values()) {
        boat.updateTag(drone.camera, viewH)
      }
      countdownFlags?.update(dt, drone.camera, viewH)
      renderer.render(scene, drone.camera)
    } catch (err) {
      console.error('[scene] frame error', err)
      stopped = true
    }
  }

  function frame(): void {
    if (stopped) return
    rafId = requestAnimationFrame(frame)
    tick()
  }

  const unsubPose = poseBus.on('pose', onPose)
  window.addEventListener('resize', resize)
  resize()
  if (frameClock) {
    // Main-process clock — not throttled when the Electron window is minimized.
    unsubFrameClock = frameClock.subscribe(() => {
      if (stopped) return
      tick()
    })
  } else {
    rafId = requestAnimationFrame(frame)
    if (keepWhenHidden) {
      // Legacy fallback only (renderer timers are still Chromium-throttled).
      intervalId = setInterval(() => {
        if (stopped) return
        if (!document.hidden) return
        tick()
      }, 1000 / 30)
    }
  }

  return {
    scene,
    camera: drone.camera,
    renderer,
    boats,
    get povIds() {
      return povIds
    },
    getActivePovId: () => activePovId,
    setActivePovId,
    setFleetAllowLists,
    async loadCourseFromUrl(url?: string): Promise<CourseHandle | null> {
      if (stopped) return null
      course?.dispose()
      course = null
      const handle = await loadCourse({ scene, url })
      if (stopped) {
        handle?.dispose()
        return null
      }
      course = handle
      if (handle) courseAppearance = { ...handle.appearance }
      return handle
    },
    async loadSponsorsFromUrl(url?: string): Promise<SponsorsHandle | null> {
      if (stopped) return null
      sponsors?.dispose()
      sponsors = null
      const handle = await loadSponsors({ scene, url })
      if (stopped) {
        handle?.dispose()
        return null
      }
      sponsors = handle
      return handle
    },
    async loadCountdownFlagsFromUrl(
      url?: string,
    ): Promise<FlagsHandle | null> {
      if (stopped) return null
      countdownFlags?.dispose()
      countdownFlags = null
      const handle = await loadCountdownFlags({ scene, url })
      if (stopped) {
        handle?.dispose()
        return null
      }
      countdownFlags = handle
      if (handle) captureFlagsMeta(handle.flagsData)
      return handle
    },
    async remountWorldFromFeatures(
      features: readonly WorldFeature[],
    ): Promise<void> {
      if (stopped) return
      const gen = ++remountGen

      const courseData = featuresToCourseData(features, courseAppearance)
      course?.dispose()
      course = null
      if (courseData.waypoints.length > 0) {
        course = mountCourse(scene, courseData)
      }
      if (stopped || gen !== remountGen) {
        course?.dispose()
        course = null
        return
      }

      const sponsorsData = featuresToSponsorsData(features)
      sponsors?.dispose()
      sponsors = null
      if (sponsorsData.sponsors.length > 0) {
        const handle = await mountSponsors(scene, sponsorsData)
        if (stopped || gen !== remountGen) {
          handle.dispose()
          return
        }
        sponsors = handle
      }

      const flagsData = featuresToFlagsData(features, flagsMeta)
      if (flagsData) {
        captureFlagsMeta(flagsData)
        countdownFlags?.dispose()
        countdownFlags = null
        if (stopped || gen !== remountGen) return
        countdownFlags = mountCountdownFlags(scene, {
          ...flagsData,
          autoStart: false,
        })
      }
    },
    async loadBoatNamesFromUrl(url?: string): Promise<BoatNamesCatalogue> {
      if (stopped) return new Map()
      const catalogue = await loadBoatNames(url)
      if (stopped) return new Map()
      boatNames = catalogue
      for (const boat of boats.values()) {
        applyCatalogueToBoat(boat)
      }
      return catalogue
    },
    getBoatNamesCatalogue(): BoatNamesCatalogue {
      return boatNames
    },
    upsertBoatName(input): BoatNameEntry | null {
      if (stopped) return null
      const id = input.id.trim()
      if (id === '') return null
      boatNames = upsertBoatNameEntry(boatNames, input)
      const boat = boats.get(id)
      if (boat) applyCatalogueToBoat(boat)
      return lookupBoatName(boatNames, id) ?? null
    },
    controlCountdown(action): void {
      if (!countdownFlags) return
      if (action === 'start') countdownFlags.start()
      else if (action === 'pause') countdownFlags.pause()
      else if (action === 'reset') countdownFlags.reset()
      else countdownFlags.restart()
    },
    setClearColor(color, alpha = 1): void {
      if (stopped) return
      renderer.setClearColor(color, alpha)
    },
    stop(): void {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(rafId)
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = 0
      }
      if (unsubFrameClock) {
        unsubFrameClock()
        unsubFrameClock = null
      }
      window.removeEventListener('resize', resize)
      unsubPose()
      course?.dispose()
      course = null
      sponsors?.dispose()
      sponsors = null
      countdownFlags?.dispose()
      countdownFlags = null
      clearLayoutFeatures()
      boatNames = new Map()
      lastPoseByPovId.clear()
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
