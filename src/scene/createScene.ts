import * as THREE from 'three'
import { poseBus, type PoseEvent } from '../pose/index.ts'
import {
  createBoatEntity,
  type BoatEntityHandle,
} from './boatEntity.ts'
import {
  DEFAULT_BOAT_VISIBILITY_MODE,
  normalizeBoatVisibilityMode,
  type BoatVisibilityMode,
} from './boatVisibility.ts'
import { filterFeaturesFor3d } from './features/featureVisibility.ts'
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
import {
  mountLineSignsFromFeatures,
  type LineSignsHandle,
} from './lineSigns/index.ts'
import {
  loadPositionMarkers,
  mountPositionMarkers,
  type PositionMarkersData,
  type PositionMarkersHandle,
} from './positionMarkers/index.ts'
import { createDroneCamera, TEMP_HFOV_DEG } from './droneCamera.ts'
import {
  createFreeCam,
  type FreeCamHandle,
  type OpsViewMode,
} from './freeCam.ts'
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
import { mountBillboardChains, type BillboardChainHandle } from './billboardChain.ts'
import { mountWorldBuoys, type WorldBuoysHandle } from './worldBuoys.ts'
import {
  DEFAULT_ENVIRONMENT_MODE,
  createRealisticEnvironment,
  normalizeEnvironmentMode,
  shouldShowRealisticEnvironment,
  type EnvironmentMode,
  type RealisticEnvironmentHandle,
} from './environment/index.ts'
import { createCalibrationOverlay } from './calibrationOverlay.ts'

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
  /** Active POV perspective camera (same as `getActivePovCamera()`). */
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  /** Live fleet registry (boats with at least one applied pose). */
  boats: ReadonlyMap<string, BoatEntityHandle>
  /** Configured POV ids (ordered). Live — updates after `setFleetAllowLists`. */
  readonly povIds: readonly string[]
  /** Currently selected air / active POV id (unaffected by free cam). */
  getActivePovId: () => string
  /**
   * Active POV Three camera — air / NDI framing source (OUT air lock).
   * Ops free cam must not replace this; preview may use a different camera.
   */
  getActivePovCamera: () => THREE.PerspectiveCamera
  /** Camera drawn to the on-screen preview (free orbit or active POV). */
  getPreviewCamera: () => THREE.PerspectiveCamera
  /** Ops preview mode: `follow` = active POV; `free` = orbit/pan/zoom. */
  getOpsViewMode: () => OpsViewMode
  /**
   * Switch ops preview between free cam and follow-active-POV.
   * Free cam does not mutate `activePovId`.
   */
  setOpsViewMode: (mode: OpsViewMode) => void
  /**
   * Switch preview to free cam and orbit the live boat fleet (ENU centroid).
   * Returns how many boats were framed (0 = none spawned yet).
   */
  frameFleet: () => number
  /**
   * Switch preview to free cam and frame an ENU point (single-entity Focus).
   * Returns false if free cam is unavailable.
   */
  frameEnuPoint: (
    center: { x: number; y: number; z: number },
    radiusM?: number,
  ) => boolean
  /**
   * ENU position of a spawned boat root, or null if not spawned.
   */
  getBoatEnuPosition: (
    id: string,
  ) => { x: number; y: number; z: number } | null
  /**
   * Last known ENU for a POV (pose cache or active drone cam), or null.
   */
  getPovEnuPosition: (
    id: string,
  ) => { x: number; y: number; z: number } | null
  /**
   * Switch active POV. Applies cached last pose immediately when available.
   * Returns false if `id` is not in the allow-list.
   * Does not change ops view mode (free cam stays free).
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
   * Remount course / sponsors / flags / start–finish signs from WorldFeature[].
   * Position markers remount from last loaded markers fixture (not WorldFeature yet).
   * `arrow` / `rotation` stay map-only until a later asset DSP.
   */
  remountWorldFromFeatures: (
    features: readonly WorldFeature[],
  ) => Promise<void>
  /** Distances-style water labels (Unity Distances prefab spirit). */
  loadPositionMarkersFromUrl: (
    url?: string,
  ) => Promise<PositionMarkersHandle | null>
  /**
   * Mount/replace start–finish water signs from WorldFeature[] without
   * remounting course/sponsors/flags (URL boot path).
   */
  syncLineSignsFromFeatures: (features: readonly WorldFeature[]) => void
  /**
   * Load boat name/colour catalogue and apply to existing + future tags.
   * Safe anytime after `startScene` (before or after boats spawn).
   */
  loadBoatNamesFromUrl: (url?: string) => Promise<BoatNamesCatalogue>
  /** Snapshot of the in-memory name catalogue (ops Fleet panel). */
  getBoatNamesCatalogue: () => BoatNamesCatalogue
  /** Upsert one boat name/category/color and apply to a live entity if present. */
  upsertBoatName: (input: UpsertBoatNameInput) => BoatNameEntry | null
  /**
   * Set per-boat draw mode (`solid` | `ghost` | `hidden`).
   * Applies immediately if the entity is spawned; remembered for future spawns.
   */
  setBoatVisibilityMode: (id: string, mode: BoatVisibilityMode) => void
  /** Current mode for an id (default `solid` if never set). */
  getBoatVisibilityMode: (id: string) => BoatVisibilityMode
  /**
   * Apply many id→mode pairs (Fleet session / RaceProject soft field).
   * Ids omitted keep their previous mode.
   */
  setBoatVisibilityModes: (
    modes: ReadonlyMap<string, BoatVisibilityMode> | Record<string, BoatVisibilityMode>,
  ) => void
  /** Start / pause / reset / restart the loaded countdown (no-op if none). */
  controlCountdown: (
    action: 'start' | 'pause' | 'reset' | 'restart',
  ) => void
  /**
   * Thin OUT hook: set WebGL clear color + alpha at runtime.
   * Prefer `applyOutputMode(renderer, …)` from `src/output/` for mode mapping.
   */
  setClearColor: (color: number, alpha?: number) => void
  /**
   * Scene dressing: `simple` (default) vs `realistic` sea+sky.
   * Realistic still forced off when opaque clear is not safe (see
   * `setEnvironmentOpaqueClearSafe`).
   */
  setEnvironmentMode: (mode: EnvironmentMode) => void
  getEnvironmentMode: () => EnvironmentMode
  /**
   * Whether an opaque clear context allows realistic env meshes.
   * Pass `true` for `preview` (and a future dedicated 3D opaque channel);
   * `false` for `transparent` / `chroma` so AR alpha stays clean.
   */
  setEnvironmentOpaqueClearSafe: (safe: boolean) => void
  getEnvironmentOpaqueClearSafe: () => boolean
  /**
   * Toggle ENU grid + force-visible mark helpers for AR calibration.
   * Default **off**. Read-only — does not write calibration offsets.
   */
  setCalibrationOverlayEnabled: (enabled: boolean) => void
  getCalibrationOverlayEnabled: () => boolean
  /** Rebuild overlay from `getLayoutFeatures()` when enabled (no-op when off). */
  refreshCalibrationOverlay: () => void
  /**
   * Distance-scale boat tags + countdown plate for the camera about to render.
   * Call before each dual-render pass (air/NDI then preview). Sprites auto-face
   * the WebGL camera; this keeps scale matched to that same camera.
   */
  orientOpsBillboards: (camera: THREE.Camera) => void
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

  // Lights tuned for hull / sponsor / buoy readability on dark preview,
  // transparent (alpha plate), and chroma clears (no environment bounce).
  const ambient = new THREE.AmbientLight(0xffffff, 0.95)
  ambient.name = 'ambient'
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.75)
  sun.name = 'sun'
  sun.position.set(40, 80, 20)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xa8c4ff, 0.55)
  fill.name = 'fill'
  fill.position.set(-30, 40, -20)
  scene.add(fill)
  const bounce = new THREE.DirectionalLight(0xc8d8e8, 0.28)
  bounce.name = 'bounce'
  bounce.position.set(10, -25, 15)
  scene.add(bounce)

  const drone = createDroneCamera(1, TEMP_HFOV_DEG)
  let freeCam: FreeCamHandle | null = null
  let opsViewMode: OpsViewMode = 'follow'
  let stopped = false
  const boats = new Map<string, BoatEntityHandle>()
  /** Per-id draw mode; defaults to solid when missing. */
  const boatVisibility = new Map<string, BoatVisibilityMode>()
  let boatNames: BoatNamesCatalogue = new Map()
  let course: CourseHandle | null = null
  let sponsors: SponsorsHandle | null = null
  let countdownFlags: FlagsHandle | null = null
  let lineSigns: LineSignsHandle | null = null
  let positionMarkers: PositionMarkersHandle | null = null
  let positionMarkersData: PositionMarkersData | null = null
  let billboardChains: BillboardChainHandle | null = null
  let worldBuoys: WorldBuoysHandle | null = null
  let courseAppearance: CourseAppearance = { ...DEFAULT_COURSE_APPEARANCE }
  let flagsMeta: FlagsRemountMeta = {}
  let remountGen = 0
  const clock = new THREE.Clock()
  /** User-facing env mode; default simple so boot is unchanged. */
  let environmentMode: EnvironmentMode = DEFAULT_ENVIRONMENT_MODE
  /**
   * Opaque-clear gate — main sets from outputMode (`preview` → true).
   * Start false until main confirms so a transparent boot never flashes sea.
   */
  let environmentOpaqueClearSafe = false
  let realisticEnv: RealisticEnvironmentHandle | null = null
  let realisticEnvMounted = false
  const calibrationOverlay = createCalibrationOverlay(scene)

  function syncRealisticEnvironment(): void {
    if (stopped) return
    const want = shouldShowRealisticEnvironment(
      environmentMode,
      environmentOpaqueClearSafe,
    )
    if (want) {
      if (!realisticEnv) {
        realisticEnv = createRealisticEnvironment()
      }
      if (!realisticEnvMounted) {
        scene.add(realisticEnv.root)
        scene.fog = realisticEnv.fog
        realisticEnvMounted = true
      }
      return
    }
    if (realisticEnvMounted && realisticEnv) {
      scene.remove(realisticEnv.root)
      scene.fog = null
      realisticEnvMounted = false
    }
  }

  function previewCamera(): THREE.PerspectiveCamera {
    return opsViewMode === 'free' && freeCam
      ? freeCam.camera
      : drone.camera
  }

  function setOpsViewMode(mode: OpsViewMode): void {
    if (stopped) return
    opsViewMode = mode
    freeCam?.setEnabled(mode === 'free')
  }

  function frameEnuPoint(
    center: { x: number; y: number; z: number },
    radiusM = 80,
  ): boolean {
    if (stopped || !freeCam) return false
    setOpsViewMode('free')
    freeCam.frameTarget(
      new THREE.Vector3(center.x, center.y, center.z),
      radiusM,
    )
    return true
  }

  function frameFleet(): number {
    if (stopped || !freeCam) return 0
    if (boats.size === 0) return 0
    const box = new THREE.Box3()
    for (const boat of boats.values()) {
      box.expandByObject(boat.root)
    }
    if (box.isEmpty()) return 0
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.length() * 0.5, 60)
    frameEnuPoint({ x: center.x, y: center.y, z: center.z }, radius)
    return boats.size
  }

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
  freeCam = createFreeCam(renderer.domElement, 1, TEMP_HFOV_DEG)

  let rafId = 0
  let intervalId: ReturnType<typeof setInterval> | 0 = 0
  let unsubFrameClock: (() => void) | null = null
  let viewH = 1

  function resize(): void {
    if (lockedOut) {
      const width = Math.max(1, lockedOut.width | 0)
      const height = Math.max(1, lockedOut.height | 0)
      viewH = height
      const aspect = width / height
      drone.setAspect(aspect)
      freeCam?.setAspect(aspect)
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
    const aspect = width / height
    drone.setAspect(aspect)
    freeCam?.setAspect(aspect)
    renderer.setSize(width, height, false)
  }

  function visibilityFor(id: string): BoatVisibilityMode {
    return boatVisibility.get(id) ?? DEFAULT_BOAT_VISIBILITY_MODE
  }

  function ensureBoat(id: string): BoatEntityHandle {
    let boat = boats.get(id)
    if (boat) return boat
    const entry = lookupBoatName(boatNames, id)
    boat = createBoatEntity({
      id,
      displayName: entry?.name,
      color: entry?.color,
      visibilityMode: visibilityFor(id),
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

  function orientOpsBillboards(camera: THREE.Camera): void {
    if (stopped) return
    for (const boat of boats.values()) {
      boat.updateTag(camera, viewH)
    }
    countdownFlags?.orientBillboards(camera, viewH)
  }

  function tick(): void {
    if (stopped) return
    try {
      const dt = Math.min(clock.getDelta(), 0.1)
      const cam = previewCamera()
      if (opsViewMode === 'free') freeCam?.update()
      countdownFlags?.tickClock(dt)
      if (realisticEnvMounted) realisticEnv?.tick(dt)
      // Preview pass scales; NDI dual-render re-orients for air via prepareCameraPass.
      orientOpsBillboards(cam)
      // Screen preview may be free cam; active POV camera keeps tracking for OUT/NDI.
      renderer.render(scene, cam)
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
    getActivePovCamera: () => drone.camera,
    getPreviewCamera: () => previewCamera(),
    getOpsViewMode: () => opsViewMode,
    setOpsViewMode,
    frameFleet,
    frameEnuPoint,
    getBoatEnuPosition(id): { x: number; y: number; z: number } | null {
      const boat = boats.get(id.trim())
      if (!boat) return null
      const p = boat.root.position
      return { x: p.x, y: p.y, z: p.z }
    },
    getPovEnuPosition(id): { x: number; y: number; z: number } | null {
      const trimmed = id.trim()
      if (trimmed === '') return null
      const cached = lastPoseByPovId.get(trimmed)
      if (cached) {
        return {
          x: cached.position.x,
          y: cached.position.y,
          z: cached.position.z,
        }
      }
      if (trimmed === activePovId) {
        const p = drone.camera.position
        return { x: p.x, y: p.y, z: p.z }
      }
      return null
    },
    setActivePovId,
    setFleetAllowLists,
    orientOpsBillboards,
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
      // Soft visible3d=false → omit from 3D remount (map may still show).
      const for3d = filterFeaturesFor3d(features)

      const courseData = featuresToCourseData(for3d, courseAppearance)
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

      const sponsorsData = featuresToSponsorsData(for3d)
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

      const flagsData = featuresToFlagsData(for3d, flagsMeta)
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

      lineSigns?.dispose()
      lineSigns = null
      if (stopped || gen !== remountGen) return
      lineSigns = mountLineSignsFromFeatures(scene, for3d)

      worldBuoys?.dispose()
      worldBuoys = null
      if (stopped || gen !== remountGen) return
      worldBuoys = mountWorldBuoys(scene, for3d, undefined, courseAppearance)

      billboardChains?.dispose()
      billboardChains = null
      if (stopped || gen !== remountGen) return
      {
        const chainHandle = await mountBillboardChains(scene, for3d)
        if (stopped || gen !== remountGen) {
          chainHandle?.dispose()
          return
        }
        billboardChains = chainHandle
      }

      positionMarkers?.dispose()
      positionMarkers = null
      if (positionMarkersData && positionMarkersData.markers.length > 0) {
        if (stopped || gen !== remountGen) return
        positionMarkers = mountPositionMarkers(scene, positionMarkersData)
      }
      calibrationOverlay.rebuild()
    },
    async loadPositionMarkersFromUrl(
      url?: string,
    ): Promise<PositionMarkersHandle | null> {
      if (stopped) return null
      positionMarkers?.dispose()
      positionMarkers = null
      positionMarkersData = null
      const handle = await loadPositionMarkers({ scene, url })
      if (stopped) {
        handle?.dispose()
        return null
      }
      positionMarkers = handle
      positionMarkersData = handle?.data ?? null
      return handle
    },
    syncLineSignsFromFeatures(features: readonly WorldFeature[]): void {
      if (stopped) return
      lineSigns?.dispose()
      lineSigns = mountLineSignsFromFeatures(scene, features)
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
    setBoatVisibilityMode(id, mode): void {
      if (stopped) return
      const trimmed = id.trim()
      if (trimmed === '') return
      const next = normalizeBoatVisibilityMode(mode)
      boatVisibility.set(trimmed, next)
      boats.get(trimmed)?.setVisibilityMode(next)
    },
    getBoatVisibilityMode(id): BoatVisibilityMode {
      return visibilityFor(id.trim())
    },
    setBoatVisibilityModes(modes): void {
      if (stopped) return
      const entries =
        modes instanceof Map ? modes.entries() : Object.entries(modes)
      for (const [rawId, mode] of entries) {
        const id = rawId.trim()
        if (id === '') continue
        const next = normalizeBoatVisibilityMode(mode)
        boatVisibility.set(id, next)
        boats.get(id)?.setVisibilityMode(next)
      }
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
    setEnvironmentMode(mode): void {
      if (stopped) return
      environmentMode = normalizeEnvironmentMode(mode)
      syncRealisticEnvironment()
    },
    getEnvironmentMode: () => environmentMode,
    setEnvironmentOpaqueClearSafe(safe): void {
      if (stopped) return
      environmentOpaqueClearSafe = safe === true
      syncRealisticEnvironment()
    },
    getEnvironmentOpaqueClearSafe: () => environmentOpaqueClearSafe,
    setCalibrationOverlayEnabled(enabled): void {
      if (stopped) return
      calibrationOverlay.setEnabled(enabled === true)
    },
    getCalibrationOverlayEnabled: () => calibrationOverlay.isEnabled(),
    refreshCalibrationOverlay(): void {
      if (stopped) return
      calibrationOverlay.rebuild()
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
      freeCam?.dispose()
      freeCam = null
      opsViewMode = 'follow'
      calibrationOverlay.dispose()
      if (realisticEnvMounted && realisticEnv) {
        scene.remove(realisticEnv.root)
        realisticEnvMounted = false
      }
      scene.fog = null
      realisticEnv?.dispose()
      realisticEnv = null
      environmentMode = DEFAULT_ENVIRONMENT_MODE
      environmentOpaqueClearSafe = false
      course?.dispose()
      course = null
      sponsors?.dispose()
      sponsors = null
      countdownFlags?.dispose()
      countdownFlags = null
      lineSigns?.dispose()
      lineSigns = null
      worldBuoys?.dispose()
      worldBuoys = null
      billboardChains?.dispose()
      billboardChains = null
      positionMarkers?.dispose()
      positionMarkers = null
      positionMarkersData = null
      clearLayoutFeatures()
      boatNames = new Map()
      boatVisibility.clear()
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

export type { OpsViewMode } from './freeCam.ts'
export type { EnvironmentMode } from './environment/index.ts'
