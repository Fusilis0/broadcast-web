import * as THREE from 'three'
import { poseBus, type EnuPosition, type PoseEvent } from '../pose/index.ts'
import { gpsToEnuAmsl } from '../geodesy/index.ts'
import {
  createBoatEntity,
  normalizeBoatHullScale,
  type BoatEntityHandle,
} from './boatEntity.ts'
import {
  DEFAULT_BOAT_VISIBILITY_MODE,
  normalizeBoatVisibilityMode,
  type BoatVisibilityMode,
} from './boatVisibility.ts'
import { disposeWorldGeometryHandles } from './disposeWorldGeometry.ts'
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
import { createDroneCamera, TEMP_HFOV_DEG, horizontalToVerticalFovDeg } from './droneCamera.ts'
import {
  canApplyStaticHull,
  canAuthorStaticHull,
  resolveStaticHullPosition,
  staticBoatPose,
  type StaticHullSeed,
} from './staticFleetHulls.ts'
import {
  createFreeCam,
  DEFAULT_OPS_VIEW_MODE,
  isFreeCamView,
  type FreeCamHandle,
  type FreeCamView,
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
  DEFAULT_SEA_QUALITY,
  collectOceanSuppressFootprints,
  createRealisticEnvironment,
  REALISTIC_ENVIRONMENT_DEFAULTS,
  normalizeEnvironmentMode,
  normalizeSeaQuality,
  shouldShowRealisticEnvironment,
  shouldEnableShoreFoam,
  type EnvironmentMode,
  type RealisticEnvironmentHandle,
  type SeaQuality,
} from './environment/index.ts'
import { createCalibrationOverlay } from './calibrationOverlay.ts'
import {
  CESIUM_ION_BING_AERIAL_ASSET_ID,
  CESIUM_ION_BING_ROAD_ASSET_ID,
  CESIUM_ION_WORLD_TERRAIN_ASSET_ID,
  DEFAULT_TERRAIN_ENABLED,
  DEFAULT_TERRAIN_OVERLAY,
  DEFAULT_TERRAIN_WATER_DISCARD_Y,
  CINEMATIC_TERRAIN_VRAM_BYTES_TARGET,
  TERRAIN_STATUS_NO_TOKEN,
  TERRAIN_STATUS_OFF,
  TERRAIN_STATUS_ON,
  createTerrain,
  normalizeTerrainOverlay,
  overlayKindFromImageryAssetId,
  overlayToImageryAssetId,
  shouldHideTerrainWater,
  type TerrainHandle,
  type TerrainOverlayKind,
} from './terrain/index.ts'
import {
  BUILDINGS_ERROR_TARGET,
  BUILDINGS_STATUS_NO_TOKEN,
  BUILDINGS_STATUS_OFF,
  BUILDINGS_STATUS_ON,
  DEFAULT_BUILDINGS_ENABLED,
  createBuildings,
  type BuildingsHandle,
  type OccupancyHole,
} from './buildings/index.ts'
import {
  DEFAULT_HEROES_ENABLED,
  LANDMARK_CCBY_CREDIT,
  createLandmarks,
  type LandmarkPoseOffset,
  type LandmarkTextureReport,
  type LandmarksHandle,
} from './landmarks/index.ts'
import type { RaceProjectLandmarks } from '../projects/types.ts'
import {
  applyCinematicCamera,
  createCinematicPins,
  createCinematicPlayer,
  createCloudOverlay,
  loadSequence,
  loadWarmManifest,
  mergeWarmManifest,
  raceChromeVisible,
  regionUsesOsm,
  warmCinematicTiles,
  downloadSequenceTileWarm,
  cinematicSequenceUrl,
  formatWarmTilesStatus,
  cinematicTilesReadyToLock,
  cinematicTileCacheIdle,
  CINEMATIC_LOCK_MIN_VISIBLE,
  CINEMATIC_LOCK_MIN_VISIBLE_ENU,
  WARM_GLOBE_ERROR_TARGET_MIN,
  CINEMATIC_ENU_PLAY_ERROR_TARGET,
  WARM_STATUS_IDLE,
  CINEMATIC_ENU_FAR_M,
  CINEMATIC_ENU_NEAR_M,
  CINEMATIC_ENU_FOG_COLOR,
  CINEMATIC_ENU_FOG_NEAR_M,
  CINEMATIC_ENU_FOG_FAR_M,
  type CinematicPinsHandle,
  type CinematicSample,
  type CinematicSequence,
  type CinematicTransport,
  type CloudOverlayHandle,
  type WarmManifest,
  type WarmRegion,
  type WarmTilesAdapter,
  type WarmTilesStatus,
} from './cinematics/index.ts'
import {
  SEA_HEIGHT_Y_DEFAULT,
  clampSeaHeightYM,
  setWaterPlaneY,
} from './waterPlanePlacement.ts'

export { DEFAULT_DRONE_ID }
export type { TerrainOverlayKind }

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
   * studio). Fallback setInterval only — prefer `frameClock` (OUT dual clock:
   * studio tick when hidden).
   */
  keepRenderingWhenHidden?: boolean
  /**
   * External preview clock. Studio wires `startDualFrameClock` so this is
   * rAF when the window is visible and `studio:tick` when hidden/minimized.
   * When set, this drives presenting instead of the internal rAF loop.
   */
  frameClock?: {
    subscribe: (onTick: () => void) => () => void
  }
  /**
   * Fired after `activePovId` actually changes (switch or allow-list clamp).
   * OUT swaps the warm video texture; TEL resamples at the new LUT + PTS.
   * Not called when the requested id is already active.
   */
  onActivePovChange?: (id: string) => void
  /**
   * Cesium ion token (Phase 14.1). Empty → terrain stays off, no throw.
   * Git-shared via `public/config.json`; Ops can paste and Apply at runtime.
   */
  cesiumIonToken?: string
  /** ion terrain asset id. Default `1` (Cesium World Terrain). */
  cesiumIonAssetId?: number
  /**
   * ion imagery overlay asset id. Prefer `terrainOverlay` (`road` = 4, `aerial` = 2).
   * Explicit id still wins when `terrainOverlay` is omitted. `0` skips overlay.
   */
  cesiumIonImageryAssetId?: number
  /** Bing Road vs Aerial drape. Default **aerial** (ion 2). Switching remounts terrain. */
  terrainOverlay?: TerrainOverlayKind
  /**
   * Cesium OSM Buildings (default **on**). Opaque-only — same gate as terrain.
   * HUD session `bw.buildings.enabled` is applied by the caller at boot.
   */
  buildingsEnabled?: boolean
  /**
   * Hero landmarks (default **on**). Opaque-only — same gate as buildings.
   * HUD session `bw.heroes.enabled` is applied by the caller at boot.
   */
  heroesEnabled?: boolean
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
  /**
   * Live fleet registry (boats with a live or static/planned pose).
   * Allow-listed ids spawn without telemetry via `syncFleetHulls`.
   */
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
  /** Free-cam eye + orbit target (SRT 3D plate mirrors ops). */
  getFreeCamView: () => FreeCamView | null
  /** Apply a free-cam view. Forces ops view to `free`. */
  applyFreeCamView: (view: FreeCamView) => void
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
   * Does not spawn hulls — call `syncFleetHulls` after to seed static poses.
   */
  setFleetAllowLists: (lists: FleetAllowLists) => string
  /**
   * Ensure an allow-listed boat mesh exists and apply a static/planned ENU pose
   * unless a live boat packet has already been applied for this id.
   */
  upsertStaticBoat: (id: string, position?: EnuPosition) => void
  /**
   * True when the operator may drag this hull (no current live packet).
   */
  canAuthorBoatPose: (id: string) => boolean
  /**
   * Apply a map-authored ENU pose. No-op while live telem is fresh.
   * Unlike `upsertStaticBoat` / `syncFleetHulls`, this may move a hull that
   * once had live telem after the hold window.
   */
  applyAuthoredBoatPose: (id: string, position?: EnuPosition) => boolean
  /**
   * Spawn/move hulls for every seed whose id is allow-listed and has never
   * received live telem. Missing `position` uses an origin grid by index.
   */
  syncFleetHulls: (seeds: readonly StaticHullSeed[]) => void
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
   * Remount course / sponsors / flags / start–finish / buoys / chains from
   * WorldFeature[]. Empty list disposes leftover 3D (including billboard
   * chains and flags) before mounting nothing.
   * Position markers remount from last loaded markers fixture unless
   * `retainPositionMarkers` is false (pack load).
   * `arrow` / `rotation` stay map-only until a later asset DSP.
   */
  remountWorldFromFeatures: (
    features: readonly WorldFeature[],
    options?: { retainPositionMarkers?: boolean },
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
  /**
   * Uniform hull scale from boat `heightM` (omit / non-finite / ≤0 → 1).
   * Independent of Alt MSL (pose ENU y). Applies even after live telem.
   */
  setBoatHeightM: (id: string, heightM?: number) => void
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
   * Gerstner clipmap / shore-foam LOD (`high` | `low`). Remounts the realistic
   * env when it is already created. Does not touch the preview/NDI frame clock.
   */
  setSeaQuality: (quality: SeaQuality) => void
  getSeaQuality: () => SeaQuality
  /**
   * Whether an opaque clear context allows realistic env meshes.
   * Pass `true` for `preview` (and a future dedicated 3D opaque channel);
   * `false` for `transparent` / `chroma` so AR alpha stays clean.
   */
  setEnvironmentOpaqueClearSafe: (safe: boolean) => void
  getEnvironmentOpaqueClearSafe: () => boolean
  /**
   * Cesium ion World Terrain (default **off**). Opaque-only — hidden when
   * `setEnvironmentOpaqueClearSafe(false)` (transparent / chroma AR).
   */
  setTerrainEnabled: (enabled: boolean) => void
  getTerrainEnabled: () => boolean
  /**
   * Cesium OSM Buildings (default **on**). Opaque-only — hidden when
   * `setEnvironmentOpaqueClearSafe(false)` (transparent / chroma AR).
   */
  setBuildingsEnabled: (enabled: boolean) => void
  getBuildingsEnabled: () => boolean
  getBuildingsStatusMessage: () => string
  /**
   * Hero glTF / named proxies (default **on**). Opaque-only — hidden when
   * `setEnvironmentOpaqueClearSafe(false)` (transparent / chroma AR).
   * Off clears occupancy so OSM boxes fill the hole.
   */
  setHeroesEnabled: (enabled: boolean) => void
  getHeroesEnabled: () => boolean
  setLandmarkPoseOffset: (
    id: string,
    pose: Partial<LandmarkPoseOffset>,
  ) => void
  getLandmarkPoseOffsets: () => Record<string, LandmarkPoseOffset>
  applyLandmarkPoseOffsets: (landmarks?: RaceProjectLandmarks) => void
  getLandmarkWorldPosition: (
    id: string,
  ) => { x: number; y: number; z: number } | null
  getLandmarkPinAnchor: (
    id: string,
  ) => { x: number; y: number; z: number } | null
  getLandmarkFocusRadius: (id: string) => number | null
  getLandmarkTextureReport: () => LandmarkTextureReport[]
  /** Settles when every hero glTF attempt has finished. */
  landmarksReady: Promise<void>
  /**
   * Hero occupancy disks in scene ENU (x=East, z=−North). Default `[]`.
   * Clips OSM Buildings only — not World Terrain or ocean.
   * Landmarks own this after layout; empty when heroes are hidden.
   */
  setOccupancyHoles: (holes: readonly OccupancyHole[]) => void
  getOccupancyHoles: () => readonly OccupancyHole[]
  /** Extra metres of +Y after HAE reorientation (operator venue nudge). */
  setTerrainAltitudeNudgeM: (nudgeM: number) => void
  getTerrainAltitudeNudgeM: () => number
  /**
   * Height-fallback AMSL (m) for hiding Cesium water when a tile has no
   * quantized-mesh water mask. Default +0.5 m. Water-mask tiles ignore this.
   */
  setTerrainWaterDiscardYM: (yM: number) => void
  getTerrainWaterDiscardYM: () => number
  /**
   * Environment **sea m** (−20…+20, default 0). Moves Gerstner rest Y + shared
   * water-plane Y (wakes). Does not change Cesium tile discard.
   */
  setSeaHeightYM: (yM: number) => void
  getSeaHeightYM: () => number
  /** Freeze tile LOD updates once the shot is framed. */
  setTerrainTilesLocked: (locked: boolean) => void
  getTerrainTilesLocked: () => boolean
  /**
   * Bing Aerial (ion 2, default) vs Bing Road (ion 4) on World Terrain.
   * Remounts the terrain handle only — OSM Buildings stay mounted.
   */
  setTerrainOverlay: (kind: TerrainOverlayKind) => void
  getTerrainOverlay: () => TerrainOverlayKind
  getTerrainStatusMessage: () => string
  /** Terrain + OSM Buildings + Maiden’s Tower CC-BY merged for the **DOM** overlay (never WebGL / AR). */
  getTerrainCredits: () => readonly string[]
  /** Notify when ion credit strings change (DOM overlay; never WebGL). */
  setTerrainCreditsListener: (
    listener: ((lines: readonly string[]) => void) | null,
  ) => void
  /**
   * Replace the ion token and remount terrain **and** OSM buildings
   * (auth plugin is baked at create). Empty string disposes tiles and leaves
   * both off. Does not log the value.
   */
  setCesiumIonToken: (token: string) => void
  getCesiumIonToken: () => string
  /**
   * Toggle ENU grid + force-visible mark helpers for AR calibration.
   * Default **off**. Read-only — does not write calibration offsets.
   */
  setCalibrationOverlayEnabled: (enabled: boolean) => void
  getCalibrationOverlayEnabled: () => boolean
  /** Rebuild overlay from `getLayoutFeatures()` when enabled (no-op when off). */
  refreshCalibrationOverlay: () => void
  /**
   * Cinematic sequence player (Phase 21 authoring). Default off = race view.
   * OUT Record should hook play/seek + `renderer.domElement` + 30 Hz clock.
   */
  loadCinematicSequence: (url: string) => Promise<CinematicSequence | null>
  getCinematicSequence: () => CinematicSequence | null
  playCinematic: () => void
  pauseCinematic: () => void
  seekCinematic: (tSec: number) => void
  stopCinematic: () => void
  isCinematicActive: () => boolean
  isCinematicPlaying: () => boolean
  getCinematicTimeSec: () => number
  getCinematicTransport: () => CinematicTransport
  getCinematicCamera: () => THREE.PerspectiveCamera
  setCinematicTransportListener: (
    listener: ((transport: CinematicTransport) => void) | null,
  ) => void
  /** Prefetch ion tiles from the git warm manifest. No-op without token / AR. */
  warmCinematicTiles: () => Promise<WarmTilesStatus>
  getCinematicWarmStatus: () => WarmTilesStatus
  setCinematicWarmStatusListener: (
    listener: ((status: WarmTilesStatus) => void) | null,
  ) => void
  dumpCinematicWarmUrls: () => void
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
  let opsViewMode: OpsViewMode = DEFAULT_OPS_VIEW_MODE
  let stopped = false
  const boats = new Map<string, BoatEntityHandle>()
  /** Wall-clock ms of last live boat poseBus packet (hold last live after stale). */
  const lastLiveBoatAt = new Map<string, number>()
  /** Per-id draw mode; defaults to solid when missing. */
  const boatVisibility = new Map<string, BoatVisibilityMode>()
  /** Per-id uniform hull scale from `heightM`; missing → 1. */
  const boatHeightM = new Map<string, number>()
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
  let seaQuality: SeaQuality = DEFAULT_SEA_QUALITY
  /**
   * Opaque-clear gate — main sets from outputMode (`preview` → true).
   * Start false until main confirms so a transparent boot never flashes sea.
   */
  let environmentOpaqueClearSafe = false
  let realisticEnv: RealisticEnvironmentHandle | null = null
  let realisticEnvMounted = false
  /** Last sponsor + start/finish features for 19.15 Gerstner holes. */
  let lastOceanSuppressFeatures: WorldFeature[] = []
  /** DSP-SCN-20260817-01 — terrain hooks only; ocean stays in environment/. */
  let terrain: TerrainHandle | null = null
  let terrainEnabled = DEFAULT_TERRAIN_ENABLED
  let terrainNudgeM = 0
  let terrainWaterDiscardYM = DEFAULT_TERRAIN_WATER_DISCARD_Y
  let seaHeightYM = SEA_HEIGHT_Y_DEFAULT
  let terrainTilesLocked = false
  /** Operator lock-tiles checkbox; cinematic play forces lock and restores this. */
  let operatorTilesLocked = false
  let terrainOverlay: TerrainOverlayKind = DEFAULT_TERRAIN_OVERLAY
  let terrainImageryAssetId = overlayToImageryAssetId(terrainOverlay)
  if (options.terrainOverlay !== undefined) {
    terrainOverlay = normalizeTerrainOverlay(options.terrainOverlay)
    terrainImageryAssetId = overlayToImageryAssetId(terrainOverlay)
  } else if (options.cesiumIonImageryAssetId !== undefined) {
    terrainImageryAssetId = Math.floor(options.cesiumIonImageryAssetId)
    terrainOverlay = overlayKindFromImageryAssetId(terrainImageryAssetId)
  }
  let terrainToken = (options.cesiumIonToken ?? '').trim()
  const terrainAssetId =
    options.cesiumIonAssetId !== undefined && options.cesiumIonAssetId > 0
      ? Math.floor(options.cesiumIonAssetId)
      : CESIUM_ION_WORLD_TERRAIN_ASSET_ID
  let terrainCreditsListener: ((lines: readonly string[]) => void) | null =
    null
  /** DSP-SCN-20260907-01 — OSM Buildings. DSP-02 heroes clip via occupancy. */
  let buildings: BuildingsHandle | null = null
  let buildingsEnabled =
    options.buildingsEnabled !== undefined
      ? options.buildingsEnabled === true
      : DEFAULT_BUILDINGS_ENABLED
  let occupancyHoles: OccupancyHole[] = []
  let landmarks: LandmarksHandle | null = null
  let heroesEnabled =
    options.heroesEnabled !== undefined
      ? options.heroesEnabled === true
      : DEFAULT_HEROES_ENABLED
  const calibrationOverlay = createCalibrationOverlay(scene)
  const cinematicPlayer = createCinematicPlayer()
  const cinematicPins: CinematicPinsHandle = createCinematicPins({
    heroAnchor: (id) => landmarks?.getLandmarkPinAnchor(id) ?? null,
  })
  scene.add(cinematicPins.root)
  const cinematicCamera = new THREE.PerspectiveCamera(
    horizontalToVerticalFovDeg(TEMP_HFOV_DEG, 1),
    1,
    CINEMATIC_ENU_NEAR_M,
    CINEMATIC_ENU_FAR_M,
  )
  cinematicCamera.name = 'cinematicCamera'
  let cloudOverlay: CloudOverlayHandle | null = null
  let cinematicTransportListener:
    | ((transport: CinematicTransport) => void)
    | null = null
  let terrainReorient = true
  /** Which frame the live `terrain` handle was built for (park/reuse). */
  let terrainMountedReorient = true
  let cinematicTerrainFrame: 'globe' | 'enu' | null = null
  let parkedGlobeTerrain: TerrainHandle | null = null
  let parkedEnuTerrain: TerrainHandle | null = null
  let cinematicOceanOn = false
  let cinematicFogOn = false
  let tilesWarmCamera: THREE.PerspectiveCamera | null = null
  let cinematicLockHeld = false
  let cinematicCoverUntilTilesReady = false
  let cinematicCoverStartedAt = 0
  let cinematicTileIdleFrames = 0
  let warmStatus: WarmTilesStatus = { ...WARM_STATUS_IDLE }
  let warmStatusListener: ((status: WarmTilesStatus) => void) | null = null
  let warmPromise: Promise<WarmTilesStatus> | null = null
  let lastWarmToken = ''
  let lookSnapshot: {
    environmentMode: EnvironmentMode
    terrainEnabled: boolean
    buildingsEnabled: boolean
    heroesEnabled: boolean
    terrainOverlay: TerrainOverlayKind
    calibrationEnabled: boolean
    opsViewMode: OpsViewMode
  } | null = null

  function applyWaterCueForEnvironment(): void {
    const hidePad = cinematicPlayer.isActive()
      ? cinematicOceanOn
      : shouldShowRealisticEnvironment(
          environmentMode,
          environmentOpaqueClearSafe,
        )
    course?.setWaterCueVisible(!hidePad)
  }

  const sceneGpsToEnu = (lat: number, lon: number, alt: number) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  }

  function applyHeroOccupancy(holes: readonly OccupancyHole[]): void {
    occupancyHoles = holes.map((h) => ({
      x: h.x,
      z: h.z,
      radiusM: h.radiusM,
    }))
    buildings?.setOccupancyHoles(occupancyHoles)
  }

  landmarks = createLandmarks({
    gpsToEnuAmsl: sceneGpsToEnu,
    enabled: heroesEnabled,
    onOccupancyHoles: applyHeroOccupancy,
  })
  scene.add(landmarks.root)

  function syncLandmarks(): void {
    if (stopped || !landmarks) return
    landmarks.setEnabled(heroesEnabled)
    landmarks.setOpaqueClearSafe(environmentOpaqueClearSafe)
  }
  syncLandmarks()

  function applyOceanSuppress(): void {
    realisticEnv?.setSuppressFootprints(
      collectOceanSuppressFootprints(lastOceanSuppressFeatures, sceneGpsToEnu),
    )
  }

  function setOceanSuppressFeatures(features: readonly WorldFeature[]): void {
    lastOceanSuppressFeatures = features.filter(
      (f) => f.type === 'sponsor' || f.type === 'start' || f.type === 'finish',
    )
    applyOceanSuppress()
  }

  function mergeOceanSuppressSponsors(features: readonly WorldFeature[]): void {
    const signs = lastOceanSuppressFeatures.filter(
      (f) => f.type === 'start' || f.type === 'finish',
    )
    const sponsors = features.filter((f) => f.type === 'sponsor')
    lastOceanSuppressFeatures = [...sponsors, ...signs]
    applyOceanSuppress()
  }

  function applySeaHeight(): void {
    setWaterPlaneY(seaHeightYM)
    realisticEnv?.setSeaHeightYM(seaHeightYM)
  }

  function syncRealisticEnvironment(): void {
    if (stopped) return
    const cinematic = cinematicPlayer.isActive()
    const want = cinematic
      ? cinematicOceanOn && environmentOpaqueClearSafe
      : shouldShowRealisticEnvironment(
          environmentMode,
          environmentOpaqueClearSafe,
        )
    if (want) {
      if (!realisticEnv) {
        realisticEnv = createRealisticEnvironment({ seaQuality })
        applyOceanSuppress()
      }
      if (!realisticEnvMounted) {
        scene.add(realisticEnv.root)
        scene.fog = realisticEnv.fog
        realisticEnvMounted = true
      }
      applySeaHeight()
      applyWaterCueForEnvironment()
      syncShoreFoam()
      syncTerrainWaterHide()
      if (cinematic) {
        realisticEnv.sky.visible = false
        realisticEnv.fog.color.setHex(CINEMATIC_ENU_FOG_COLOR)
        realisticEnv.fog.near = CINEMATIC_ENU_FOG_NEAR_M
        realisticEnv.fog.far = CINEMATIC_ENU_FOG_FAR_M
        scene.fog = realisticEnv.fog
      } else {
        realisticEnv.sky.visible = true
        realisticEnv.fog.color.setHex(REALISTIC_ENVIRONMENT_DEFAULTS.fogColor)
        realisticEnv.fog.near = REALISTIC_ENVIRONMENT_DEFAULTS.fogNear
        realisticEnv.fog.far = REALISTIC_ENVIRONMENT_DEFAULTS.fogFar
        scene.fog = realisticEnv.fog
      }
      return
    }
    if (realisticEnvMounted && realisticEnv) {
      scene.remove(realisticEnv.root)
      scene.fog = null
      realisticEnvMounted = false
    }
    applyWaterCueForEnvironment()
    syncShoreFoam()
    syncTerrainWaterHide()
  }

  function previewCamera(): THREE.PerspectiveCamera {
    if (cinematicPlayer.isActive()) return cinematicCamera
    return opsViewMode === 'free' && freeCam
      ? freeCam.camera
      : drone.camera
  }

  function setOpsViewMode(mode: OpsViewMode): void {
    if (stopped) return
    opsViewMode = mode
    freeCam?.setEnabled(mode === 'free' && !cinematicPlayer.isActive())
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
  // powerPreference: cost-only hint so Chromium prefers the discrete GPU (PRF-01).
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  // Pin: three default is already SRGBColorSpace (canvas encode). Explicit so a
  // future three upgrade cannot silently change preview. NDI AR/3D FBOs pin the
  // same via applyNdiCaptureColorSpace — this is not a look change.
  renderer.outputColorSpace = THREE.SRGBColorSpace
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
  setOpsViewMode(opsViewMode)
  cloudOverlay = createCloudOverlay()

  // Log + gate preview while GL is dead. preventDefault is required for restore;
  // three.js also listens — ours only tracks state so tick does not set stopped.
  let webglContextLost = false
  const onWebglContextLost = (ev: Event): void => {
    ev.preventDefault()
    webglContextLost = true
    console.error('[scene] webglcontextlost', {
      remountGen,
      canvasInHost: options.container.contains(renderer.domElement),
    })
  }
  const onWebglContextRestored = (): void => {
    webglContextLost = false
    console.warn('[scene] webglcontextrestored', { remountGen })
    try {
      resize()
    } catch (err) {
      console.error('[scene] resize after context restore failed', err)
    }
  }
  renderer.domElement.addEventListener('webglcontextlost', onWebglContextLost, false)
  renderer.domElement.addEventListener(
    'webglcontextrestored',
    onWebglContextRestored,
    false,
  )

  function disposeTerrainInstance(): void {
    if (!terrain) return
    scene.remove(terrain.root)
    terrain.dispose()
    terrain = null
  }

  function disposeParkedCinematicTerrain(): void {
    for (const parked of [parkedGlobeTerrain, parkedEnuTerrain]) {
      if (!parked || parked === terrain) continue
      scene.remove(parked.root)
      parked.dispose()
    }
    parkedGlobeTerrain = null
    parkedEnuTerrain = null
  }

  function parkActiveTerrain(): void {
    if (!terrain) return
    terrain.root.visible = false
    const slot = terrainMountedReorient ? 'enu' : 'globe'
    if (slot === 'enu') {
      if (parkedEnuTerrain && parkedEnuTerrain !== terrain) {
        scene.remove(parkedEnuTerrain.root)
        parkedEnuTerrain.dispose()
      }
      parkedEnuTerrain = terrain
    } else {
      if (parkedGlobeTerrain && parkedGlobeTerrain !== terrain) {
        scene.remove(parkedGlobeTerrain.root)
        parkedGlobeTerrain.dispose()
      }
      parkedGlobeTerrain = terrain
    }
    terrain = null
  }

  function adoptParkedTerrain(reorient: boolean): TerrainHandle | null {
    const parked = reorient ? parkedEnuTerrain : parkedGlobeTerrain
    if (!parked) return null
    if (reorient) parkedEnuTerrain = null
    else parkedGlobeTerrain = null
    terrain = parked
    terrainMountedReorient = reorient
    if (terrain.root.parent !== scene) scene.add(terrain.root)
    terrain.root.visible = true
    terrain.setAltitudeNudgeM(reorient ? terrainNudgeM : 0)
    terrain.setWaterDiscardYM(terrainWaterDiscardYM)
    terrain.setTilesLocked(terrainTilesLocked)
    terrain.setEnabled(terrainEnabled)
    terrain.setOpaqueClearSafe(environmentOpaqueClearSafe)
    syncTerrainWaterHide()
    return terrain
  }

  function disposeBuildingsInstance(): void {
    if (!buildings) return
    scene.remove(buildings.root)
    buildings.dispose()
    buildings = null
  }

  function remountTerrainOnly(options?: { reuseParked?: boolean }): void {
    const reuseParked = options?.reuseParked === true
    const keepParked =
      reuseParked &&
      (cinematicTerrainFrame !== null || cinematicPlayer.isActive())
    let reused = false
    if (keepParked) {
      parkActiveTerrain()
      reused = adoptParkedTerrain(terrainReorient) !== null
    } else {
      disposeParkedCinematicTerrain()
      disposeTerrainInstance()
    }
    if (!terrain && terrainEnabled && terrainToken !== '') {
      ensureTerrain()
    }
    if (
      !reused &&
      cinematicLockHeld &&
      cinematicPlayer.isActive()
    ) {
      applyCinematicTileLock(false)
      cinematicCoverUntilTilesReady = true
      cinematicCoverStartedAt = performance.now()
      cinematicTileIdleFrames = 0
      cinematicPlayer.pause()
    }
  }

  function ensureTerrain(): TerrainHandle | null {
    if (stopped) return null
    if (terrain) return terrain
    if (terrainToken === '') return null
    terrain = createTerrain({
      renderer,
      token: terrainToken,
      assetId: terrainAssetId,
      imageryAssetId: terrainImageryAssetId,
      reorient: terrainReorient,
      fadeTiles: cinematicTerrainFrame === null && !cinematicPlayer.isActive(),
      unloadTiles: cinematicTerrainFrame === null && !cinematicPlayer.isActive(),
      vramBytesTarget:
        cinematicTerrainFrame !== null || cinematicPlayer.isActive()
          ? CINEMATIC_TERRAIN_VRAM_BYTES_TARGET
          : undefined,
      onImageryRejected: (fromAssetId) => {
        if (stopped) return
        if (fromAssetId !== CESIUM_ION_BING_ROAD_ASSET_ID) return
        if (terrainImageryAssetId === CESIUM_ION_BING_AERIAL_ASSET_ID) return
        terrainImageryAssetId = CESIUM_ION_BING_AERIAL_ASSET_ID
        terrainOverlay = 'aerial'
        queueMicrotask(() => {
          if (stopped) return
          remountTerrainOnly()
        })
      },
    })
    scene.add(terrain.root)
    terrainMountedReorient = terrainReorient
    terrain.setAltitudeNudgeM(terrainReorient ? terrainNudgeM : 0)
    terrain.setWaterDiscardYM(terrainWaterDiscardYM)
    terrain.setTilesLocked(terrainTilesLocked)
    terrain.setEnabled(terrainEnabled)
    terrain.setOpaqueClearSafe(environmentOpaqueClearSafe)
    syncTerrainWaterHide()
    return terrain
  }

  function ensureBuildings(): BuildingsHandle | null {
    if (stopped) return null
    if (buildings) return buildings
    if (terrainToken === '') return null
    buildings = createBuildings({
      renderer,
      token: terrainToken,
      fadeTiles: cinematicTerrainFrame === null && !cinematicPlayer.isActive(),
      unloadTiles: cinematicTerrainFrame === null && !cinematicPlayer.isActive(),
    })
    scene.add(buildings.root)
    buildings.setAltitudeNudgeM(terrainNudgeM)
    buildings.setTilesLocked(terrainTilesLocked)
    buildings.setOccupancyHoles(occupancyHoles)
    buildings.setEnabled(buildingsEnabled)
    buildings.setOpaqueClearSafe(environmentOpaqueClearSafe)
    return buildings
  }

  function syncTerrain(): void {
    if (stopped) return
    if (terrainEnabled && terrainToken !== '') {
      ensureTerrain()
    }
    terrain?.setEnabled(terrainEnabled)
    terrain?.setOpaqueClearSafe(environmentOpaqueClearSafe)
    syncShoreFoam()
    syncTerrainWaterHide()
  }

  function syncBuildings(): void {
    if (stopped) return
    if (buildingsEnabled && terrainToken !== '') {
      ensureBuildings()
    }
    buildings?.setEnabled(buildingsEnabled)
    buildings?.setOpaqueClearSafe(environmentOpaqueClearSafe)
  }

  function syncShoreFoam(): void {
    if (!realisticEnv) return
    const on = shouldEnableShoreFoam({
      realisticMounted: realisticEnvMounted,
      terrainEnabled: terrainEnabled && terrain !== null,
      opaqueClearSafe: environmentOpaqueClearSafe,
    })
    realisticEnv.setShoreContact(on && terrain ? terrain.root : null)
  }

  function syncTerrainWaterHide(): void {
    if (cinematicPlayer.isActive()) {
      terrain?.setHideWater(cinematicOceanOn === true)
      return
    }
    terrain?.setHideWater(
      shouldHideTerrainWater({ realisticOceanMounted: realisticEnvMounted }),
    )
  }

  function mergeTilesetCredits(): readonly string[] {
    const lines: string[] = []
    const push = (src: readonly string[]): void => {
      for (const line of src) {
        if (line !== '' && !lines.includes(line)) lines.push(line)
      }
    }
    if (terrainEnabled) push(terrain?.getCredits() ?? [])
    if (buildingsEnabled) push(buildings?.getCredits() ?? [])
    if (heroesEnabled && environmentOpaqueClearSafe) {
      push([LANDMARK_CCBY_CREDIT])
    }
    return lines
  }

  function emitTerrainCredits(): void {
    if (!terrainCreditsListener) return
    terrainCreditsListener(mergeTilesetCredits())
  }

  function buildingsStatusSuffix(): string {
    if (terrainToken === '') return ''
    if (!buildingsEnabled) return ''
    const msg = buildings?.getStatusMessage() ?? BUILDINGS_STATUS_ON
    return ` · ${msg}`
  }

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
      cinematicCamera.aspect = aspect
      cinematicCamera.fov = horizontalToVerticalFovDeg(TEMP_HFOV_DEG, aspect)
      cinematicCamera.updateProjectionMatrix()
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
    cinematicCamera.aspect = aspect
    cinematicCamera.fov = horizontalToVerticalFovDeg(TEMP_HFOV_DEG, aspect)
    cinematicCamera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  function visibilityFor(id: string): BoatVisibilityMode {
    return boatVisibility.get(id) ?? DEFAULT_BOAT_VISIBILITY_MODE
  }

  function hullScaleFor(id: string): number {
    return normalizeBoatHullScale(boatHeightM.get(id))
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
      heightM: hullScaleFor(id),
    })
    boats.set(id, boat)
    scene.add(boat.root)
    if (!raceChromeVisible(cinematicPlayer.isActive())) {
      boat.root.visible = false
    }
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
      lastLiveBoatAt.set(pose.id, Date.now())
    }
  }

  function upsertStaticBoat(id: string, position?: EnuPosition): void {
    if (stopped) return
    const trimmed = id.trim()
    if (trimmed === '' || !isAllowedBoatId(trimmed, allow)) return
    if (!canApplyStaticHull(lastLiveBoatAt.get(trimmed))) {
      ensureBoat(trimmed)
      return
    }
    const pos = resolveStaticHullPosition({ id: trimmed, position }, 0)
    ensureBoat(trimmed).applyPose(staticBoatPose(trimmed, pos))
  }

  function canAuthorBoatPose(id: string): boolean {
    const trimmed = id.trim()
    if (trimmed === '' || !isAllowedBoatId(trimmed, allow)) return false
    return canAuthorStaticHull(lastLiveBoatAt.get(trimmed))
  }

  function applyAuthoredBoatPose(
    id: string,
    position?: EnuPosition,
  ): boolean {
    if (stopped) return false
    const trimmed = id.trim()
    if (trimmed === '' || !isAllowedBoatId(trimmed, allow)) return false
    if (!canAuthorStaticHull(lastLiveBoatAt.get(trimmed))) return false
    const pos = resolveStaticHullPosition({ id: trimmed, position }, 0)
    ensureBoat(trimmed).applyPose(staticBoatPose(trimmed, pos))
    return true
  }

  function syncFleetHulls(seeds: readonly StaticHullSeed[]): void {
    if (stopped) return
    seeds.forEach((seed, index) => {
      const trimmed = seed.id.trim()
      if (trimmed === '' || !isAllowedBoatId(trimmed, allow)) return
      if (!canApplyStaticHull(lastLiveBoatAt.get(trimmed))) {
        ensureBoat(trimmed)
        return
      }
      const pos = resolveStaticHullPosition(seed, index)
      ensureBoat(trimmed).applyPose(staticBoatPose(trimmed, pos))
    })
  }

  function setActivePovId(id: string): boolean {
    if (!isAllowedPovId(id, povAllow)) return false
    if (id === activePovId) return true
    activePovId = id
    const cached = lastPoseByPovId.get(id)
    if (cached) drone.applyPose(cached)
    options.onActivePovChange?.(id)
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
      lastLiveBoatAt.delete(id)
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
      options.onActivePovChange?.(activePovId)
    }
    return activePovId
  }

  function emitCinematicTransport(): void {
    cinematicTransportListener?.(cinematicPlayer.getTransport())
  }

  function snapshotLookIfNeeded(): void {
    if (lookSnapshot) return
    lookSnapshot = {
      environmentMode,
      terrainEnabled,
      buildingsEnabled,
      heroesEnabled,
      terrainOverlay,
      calibrationEnabled: calibrationOverlay.isEnabled(),
      opsViewMode,
    }
  }

  function applyRaceChromeVisible(): void {
    const vis = raceChromeVisible(cinematicPlayer.isActive())
    for (const boat of boats.values()) {
      boat.root.visible = vis
    }
    if (course) course.root.visible = vis
    if (sponsors) sponsors.root.visible = vis
    if (countdownFlags) countdownFlags.root.visible = vis
    if (lineSigns) lineSigns.root.visible = vis
    if (worldBuoys) worldBuoys.root.visible = vis
    if (billboardChains) billboardChains.root.visible = vis
    if (positionMarkers) positionMarkers.root.visible = vis
    if (!vis) {
      calibrationOverlay.setEnabled(false)
    } else if (lookSnapshot) {
      calibrationOverlay.setEnabled(lookSnapshot.calibrationEnabled)
    }
  }

  function applyCinematicLook(sample: CinematicSample): void {
    const wantReorient = sample.domain === 'enu'
    const overlayChanged = terrainOverlay !== sample.imagery
    const frameChanged = cinematicTerrainFrame !== sample.domain
    const reorientChanged = terrainReorient !== wantReorient
    if (frameChanged || overlayChanged || reorientChanged) {
      cinematicTerrainFrame = sample.domain
      terrainReorient = wantReorient
      terrainOverlay = sample.imagery
      terrainImageryAssetId = overlayToImageryAssetId(sample.imagery)
      terrainEnabled = true
      remountTerrainOnly({ reuseParked: !overlayChanged })
    }
    terrain?.setErrorTarget(
      sample.domain === 'globe'
        ? WARM_GLOBE_ERROR_TARGET_MIN
        : CINEMATIC_ENU_PLAY_ERROR_TARGET,
    )
    buildings?.setErrorTarget(CINEMATIC_ENU_PLAY_ERROR_TARGET)
    terrain?.setEnabled(true)
    terrain?.setOpaqueClearSafe(environmentOpaqueClearSafe)
    cinematicOceanOn = sample.ocean
    cinematicFogOn = sample.fog
    buildingsEnabled = sample.domain === 'enu' && sample.buildings
    heroesEnabled = sample.domain === 'enu'
    syncBuildings()
    syncLandmarks()
    syncRealisticEnvironment()
    cloudOverlay?.setOpacity(
      cinematicCoverUntilTilesReady ? 1 : sample.cloud01,
    )
    applyCinematicCamera(cinematicCamera, sample)
    if (sample.domain === 'enu') {
      renderer.setClearColor(CINEMATIC_ENU_FOG_COLOR, 1)
    } else {
      renderer.setClearColor(clearColor, 1)
    }
    const seq = cinematicPlayer.getSequence()
    const globe = sample.domain === 'globe'
    cinematicPins.setFrame(globe ? 'globe' : 'enu')
    cinematicPins.setPins(
      globe ? (seq?.pins ?? []) : (seq?.heroPins ?? []),
    )
    cinematicPins.setVisible(true)
    cinematicPins.update(cinematicCamera, sample.lookId ?? null)
    applyRaceChromeVisible()
  }

  function restoreCinematicLook(): void {
    const snap = lookSnapshot
    lookSnapshot = null
    cinematicTerrainFrame = null
    terrainReorient = true
    disposeParkedCinematicTerrain()
    cinematicOceanOn = false
    cinematicFogOn = false
    renderer.setClearColor(clearColor, 1)
    cloudOverlay?.setOpacity(0)
    cinematicPins.setVisible(false)
    cinematicPins.setPins([])
    if (snap) {
      environmentMode = snap.environmentMode
      terrainEnabled = snap.terrainEnabled
      buildingsEnabled = snap.buildingsEnabled
      heroesEnabled = snap.heroesEnabled
      terrainOverlay = snap.terrainOverlay
      terrainImageryAssetId = overlayToImageryAssetId(terrainOverlay)
      remountTerrainOnly()
      disposeBuildingsInstance()
      setOpsViewMode(snap.opsViewMode)
      calibrationOverlay.setEnabled(snap.calibrationEnabled)
    }
    syncRealisticEnvironment()
    syncTerrain()
    syncBuildings()
    buildings?.setErrorTarget(BUILDINGS_ERROR_TARGET)
    syncLandmarks()
    applyRaceChromeVisible()
    freeCam?.setEnabled(opsViewMode === 'free')
    emitWarmStatus({ ...WARM_STATUS_IDLE })
  }

  function emitWarmStatus(next: WarmTilesStatus): void {
    warmStatus = next
    warmStatusListener?.(next)
  }

  function applyCinematicTileLock(locked: boolean): void {
    terrainTilesLocked = locked === true
    terrain?.setTilesLocked(terrainTilesLocked)
    buildings?.setTilesLocked(terrainTilesLocked)
  }

  function applyWarmRegionLook(region: WarmRegion): void {
    snapshotLookIfNeeded()
    const wantReorient = region.domain === 'enu'
    const overlayChanged = terrainOverlay !== 'aerial'
    const frameChanged = cinematicTerrainFrame !== region.domain
    const reorientChanged = terrainReorient !== wantReorient
    cinematicTerrainFrame = region.domain
    terrainReorient = wantReorient
    terrainOverlay = 'aerial'
    terrainImageryAssetId = overlayToImageryAssetId('aerial')
    terrainEnabled = true
    applyCinematicTileLock(false)
    if (frameChanged || overlayChanged || reorientChanged || !terrain) {
      remountTerrainOnly({ reuseParked: !overlayChanged })
    }
    terrain?.setEnabled(true)
    terrain?.setOpaqueClearSafe(environmentOpaqueClearSafe)
    if (regionUsesOsm(region)) {
      buildingsEnabled = true
      ensureBuildings()
    } else {
      buildingsEnabled = false
      disposeBuildingsInstance()
    }
    heroesEnabled = region.domain === 'enu'
    syncBuildings()
    syncLandmarks()
    cinematicOceanOn = region.domain === 'enu'
    cinematicFogOn = false
    syncRealisticEnvironment()
    syncTerrainWaterHide()
  }

  function cinematicTilesAreReady(): boolean {
    const visible =
      (terrain?.getVisibleTileCount() ?? 0) +
      (buildings?.getVisibleTileCount() ?? 0)
    const downloadIdle = terrain?.isDownloadIdle() ?? true
    const buildingsIdle = !buildings || buildings.isDownloadIdle()
    const cacheIdle = cinematicTileCacheIdle()
    if (downloadIdle && buildingsIdle && cacheIdle && visible > 0) {
      cinematicTileIdleFrames += 1
    } else {
      cinematicTileIdleFrames = 0
    }
    return cinematicTilesReadyToLock({
      visibleTerrain: visible,
      downloadIdle: downloadIdle && buildingsIdle,
      cacheIdle,
      idleFrames: cinematicTileIdleFrames,
      minVisible:
        cinematicTerrainFrame === 'enu'
          ? CINEMATIC_LOCK_MIN_VISIBLE_ENU
          : CINEMATIC_LOCK_MIN_VISIBLE,
    })
  }

  function waitFrame(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve())
        return
      }
      setTimeout(resolve, 16)
    })
  }

  async function waitCinematicTilesReady(timeoutMs: number): Promise<void> {
    const start = performance.now()
    cinematicTileIdleFrames = 0
    applyCinematicTileLock(false)
    while (performance.now() - start < timeoutMs) {
      terrain?.tick(cinematicCamera, cinematicCamera, renderer)
      buildings?.tick(cinematicCamera, cinematicCamera, renderer)
      if (cinematicTilesAreReady()) return
      await waitFrame()
    }
  }

  function beginCinematicTileLock(): void {
    if (!cinematicLockHeld) {
      operatorTilesLocked = terrainTilesLocked
    }
    cinematicLockHeld = true
  }

  function endCinematicTileLock(): void {
    cinematicLockHeld = false
    cinematicCoverUntilTilesReady = false
    cinematicCoverStartedAt = 0
    cinematicTileIdleFrames = 0
    applyCinematicTileLock(operatorTilesLocked)
  }

  async function runCinematicTileWarm(): Promise<WarmTilesStatus> {
    if (warmPromise) return warmPromise
    const token = terrainToken
    if (
      warmStatus.phase === 'ready' &&
      lastWarmToken === token &&
      token !== ''
    ) {
      return warmStatus
    }
    if (token === '') {
      const skipped: WarmTilesStatus = {
        phase: 'skipped',
        label: 'tiles: skipped (no ion token)',
        done: 0,
        total: 0,
      }
      emitWarmStatus(skipped)
      return skipped
    }
    const work = (async (): Promise<WarmTilesStatus> => {
      const manifest: WarmManifest | null = await loadWarmManifest()
      if (stopped || !manifest) {
        const skipped: WarmTilesStatus = {
          phase: 'skipped',
          label: manifest ? 'tiles: skipped' : 'tiles: skipped (no manifest)',
          done: 0,
          total: 0,
        }
        emitWarmStatus(skipped)
        return skipped
      }
      lastWarmToken = token
      tilesWarmCamera = cinematicCamera
      applyCinematicTileLock(false)
      const sequence = await loadSequence(
        cinematicSequenceUrl('intro-bosphorus'),
      )
      const merged = mergeWarmManifest(manifest, sequence)
      const host = {
        camera: cinematicCamera,
        renderer,
        opaqueClearSafe: () => environmentOpaqueClearSafe,
        token: () => terrainToken,
        applyRegionLook: applyWarmRegionLook,
        restoreLook: () => {
          tilesWarmCamera = null
          if (!cinematicPlayer.isActive()) {
            restoreCinematicLook()
            applyCinematicTileLock(operatorTilesLocked)
          }
        },
        terrain: (): WarmTilesAdapter | null => {
          if (!terrain) return null
          return {
            setErrorTarget: (v) => terrain?.setErrorTarget(v),
            getErrorTarget: () => terrain?.getErrorTarget() ?? 16,
            isDownloadIdle: () => terrain?.isDownloadIdle() ?? true,
            getVisibleTileCount: () => terrain?.getVisibleTileCount() ?? 0,
            tick: (preview, air, gl) => terrain?.tick(preview, air, gl),
          }
        },
        buildings: (): WarmTilesAdapter | null => {
          if (!buildings) return null
          return {
            setErrorTarget: (v) => buildings?.setErrorTarget(v),
            getErrorTarget: () => buildings?.getErrorTarget() ?? 16,
            isDownloadIdle: () => buildings?.isDownloadIdle() ?? true,
            getVisibleTileCount: () => buildings?.getVisibleTileCount() ?? 0,
            tick: (preview, air, gl) => buildings?.tick(preview, air, gl),
          }
        },
      }
      try {
        const result = await warmCinematicTiles(host, merged, emitWarmStatus)
        return result.status
      } catch (err) {
        console.warn('[cinematics] warm failed', err)
        tilesWarmCamera = null
        const skipped: WarmTilesStatus = {
          phase: 'skipped',
          label: 'tiles: skipped (error)',
          done: 0,
          total: merged.regions.length,
        }
        emitWarmStatus(skipped)
        return skipped
      }
    })()
    warmPromise = work
    try {
      return await work
    } finally {
      if (warmPromise === work) warmPromise = null
    }
  }

  async function playCinematicAfterWarm(): Promise<void> {
    if (stopped) return
    if (!cinematicPlayer.getSequence()) return
    emitWarmStatus({
      ...warmStatus,
      phase: warmStatus.phase === 'ready' ? 'ready' : 'warming',
      label:
        warmStatus.phase === 'ready'
          ? warmStatus.label
          : formatWarmTilesStatus({
              phase: 'warming',
              label: '',
              done: warmStatus.done,
              total: Math.max(warmStatus.total, 1),
            }),
    })
    snapshotLookIfNeeded()
    beginCinematicTileLock()
    // Active before warm `restoreLook` so it does not remount race and dump GPU tiles.
    cinematicPlayer.seek(0)
    if (warmPromise) {
      await warmPromise
    } else if (warmStatus.phase !== 'ready' && terrainToken !== '') {
      await runCinematicTileWarm()
    }
    if (stopped) return
    const primed = cinematicPlayer.sync()
    if (primed) applyCinematicLook(primed)
    await waitCinematicTilesReady(20_000)
    if (stopped) return
    applyCinematicTileLock(false)
    cinematicCoverUntilTilesReady = false
    cinematicPlayer.play()
    const sample = cinematicPlayer.sync()
    if (sample) applyCinematicLook(sample)
    freeCam?.setEnabled(false)
    emitCinematicTransport()
  }

  function orientOpsBillboards(camera: THREE.Camera): void {
    if (stopped) return
    for (const boat of boats.values()) {
      boat.updateTag(camera, viewH)
    }
    countdownFlags?.orientBillboards(camera, viewH)
  }

  function tick(): void {
    if (stopped || webglContextLost) return
    try {
      const dt = Math.min(clock.getDelta(), 0.1)
      if (cinematicPlayer.isActive()) {
        const sample = cinematicPlayer.sync()
        if (sample) applyCinematicLook(sample)
        freeCam?.setEnabled(false)
        if (cinematicCoverUntilTilesReady) {
          cloudOverlay?.setOpacity(1)
          const coverMs = performance.now() - cinematicCoverStartedAt
          if (cinematicTilesAreReady() || coverMs > 20_000) {
            cinematicCoverUntilTilesReady = false
            applyCinematicTileLock(false)
            cinematicPlayer.play()
          }
        }
      } else if (opsViewMode === 'free') {
        freeCam?.update(dt)
      }
      const cam = previewCamera()
      countdownFlags?.tickClock(dt)
      // Foam wakes share this tick (preview rAF / studio when hidden). Do not
      // raise STUDIO_TICK_FPS or add a second clock.
      for (const boat of boats.values()) {
        boat.tickWake(dt)
      }
      // Ocean time is a shared clock (onBeforeRender); tick is not required for 3D NDI.
      if (realisticEnvMounted) realisticEnv?.tick(dt)
      const tilesCam =
        tilesWarmCamera ?? (cinematicPlayer.isActive() ? cinematicCamera : cam)
      // Race view uses the preview camera only. Binding the parked drone at
      // the origin (no SRT pose) makes SSE infinite there and starves the
      // rest of the frustum down to a handful of tiles.
      if (terrain && terrainEnabled) {
        terrain.tick(tilesCam, tilesCam, renderer)
      }
      if (buildings && buildingsEnabled) {
        buildings.tick(tilesCam, tilesCam, renderer)
      }
      if (
        (terrain && terrainEnabled) ||
        (buildings && buildingsEnabled)
      ) {
        emitTerrainCredits()
      }
      // Preview pass scales; NDI dual-render re-orients for air via prepareCameraPass.
      orientOpsBillboards(cam)
      // Screen preview may be free cam; active POV camera keeps tracking for OUT/NDI.
      renderer.render(scene, cam)
      if (cinematicPlayer.isActive()) {
        cloudOverlay?.render(renderer)
        emitCinematicTransport()
      }
    } catch (err) {
      const gl = renderer.getContext()
      const lost =
        webglContextLost ||
        (typeof gl?.isContextLost === 'function' && gl.isContextLost())
      console.error('[scene] frame error', err, { contextLost: lost, remountGen })
      // Context loss is recoverable via webglcontextrestored — do not freeze forever.
      if (lost) {
        webglContextLost = true
        return
      }
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
    // OUT dual clock: rAF when visible; studio tick when hidden (NDI-safe).
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
    getFreeCamView: () => (freeCam ? freeCam.getView() : null),
    applyFreeCamView(view: FreeCamView): void {
      if (!isFreeCamView(view) || !freeCam) return
      setOpsViewMode('free')
      freeCam.setView(view)
    },
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
    upsertStaticBoat,
    canAuthorBoatPose,
    applyAuthoredBoatPose,
    syncFleetHulls,
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
      applyWaterCueForEnvironment()
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
      mergeOceanSuppressSponsors(handle?.worldFeatures ?? [])
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
      remountOpts?: { retainPositionMarkers?: boolean },
    ): Promise<void> {
      if (stopped) return
      const gen = ++remountGen
      // Soft visible3d=false → omit from 3D remount (map may still show).
      const for3d = filterFeaturesFor3d(features)
      const retainPositionMarkers = remountOpts?.retainPositionMarkers !== false
      const clear = new THREE.Color()
      renderer.getClearColor(clear)
      console.info('[scene] remount start', {
        gen,
        features: features.length,
        for3d: for3d.length,
        retainPositionMarkers,
        contextLost: webglContextLost,
        canvasInHost: options.container.contains(renderer.domElement),
        clearHex: clear.getHex(),
        clearAlpha: renderer.getClearAlpha(),
      })

      // Empty for3d must still dispose leftover 3D (chains, flags, …).
      disposeWorldGeometryHandles({
        course,
        sponsors,
        countdownFlags,
        lineSigns,
        worldBuoys,
        billboardChains,
        positionMarkers,
      })
      course = null
      sponsors = null
      countdownFlags = null
      lineSigns = null
      worldBuoys = null
      billboardChains = null
      positionMarkers = null
      if (!retainPositionMarkers) {
        positionMarkersData = null
      }
      if (stopped || gen !== remountGen) {
        console.info('[scene] remount stale abort', {
          gen,
          remountGen,
          phase: 'after-dispose',
        })
        return
      }
      setOceanSuppressFeatures([])

      const courseData = featuresToCourseData(for3d, courseAppearance)
      if (courseData.waypoints.length > 0) {
        course = mountCourse(scene, courseData)
      }
      if (stopped || gen !== remountGen) {
        course?.dispose()
        course = null
        console.info('[scene] remount stale abort', {
          gen,
          remountGen,
          phase: 'after-course',
        })
        return
      }
      applyWaterCueForEnvironment()

      const sponsorsData = featuresToSponsorsData(for3d)
      if (sponsorsData.sponsors.length > 0) {
        const handle = await mountSponsors(scene, sponsorsData)
        if (stopped || gen !== remountGen) {
          handle.dispose()
          console.info('[scene] remount stale abort', {
            gen,
            remountGen,
            phase: 'after-sponsors',
          })
          return
        }
        sponsors = handle
      }

      const flagsData = featuresToFlagsData(for3d, flagsMeta)
      if (flagsData) {
        captureFlagsMeta(flagsData)
        if (stopped || gen !== remountGen) {
          console.info('[scene] remount stale abort', {
            gen,
            remountGen,
            phase: 'after-flags-meta',
          })
          return
        }
        countdownFlags = mountCountdownFlags(scene, {
          ...flagsData,
          autoStart: false,
        })
      }

      if (stopped || gen !== remountGen) {
        console.info('[scene] remount stale abort', {
          gen,
          remountGen,
          phase: 'before-line-signs',
        })
        return
      }
      lineSigns = mountLineSignsFromFeatures(scene, for3d)

      if (stopped || gen !== remountGen) {
        console.info('[scene] remount stale abort', {
          gen,
          remountGen,
          phase: 'before-buoys',
        })
        return
      }
      worldBuoys = mountWorldBuoys(scene, for3d, undefined, courseAppearance)

      if (stopped || gen !== remountGen) {
        console.info('[scene] remount stale abort', {
          gen,
          remountGen,
          phase: 'before-chains',
        })
        return
      }
      {
        const chainHandle = await mountBillboardChains(scene, for3d)
        if (stopped || gen !== remountGen) {
          chainHandle?.dispose()
          console.info('[scene] remount stale abort', {
            gen,
            remountGen,
            phase: 'after-chains',
          })
          return
        }
        billboardChains = chainHandle
      }

      if (
        retainPositionMarkers &&
        positionMarkersData &&
        positionMarkersData.markers.length > 0
      ) {
        if (stopped || gen !== remountGen) {
          console.info('[scene] remount stale abort', {
            gen,
            remountGen,
            phase: 'before-markers',
          })
          return
        }
        positionMarkers = mountPositionMarkers(scene, positionMarkersData)
      }
      calibrationOverlay.rebuild()
      setOceanSuppressFeatures(for3d)
      applyRaceChromeVisible()
      console.info('[scene] remount complete', {
        gen,
        contextLost: webglContextLost,
        hasChains: billboardChains !== null,
        chainSegments: billboardChains?.stats.instanceCount ?? 0,
        chainTextures: billboardChains?.stats.uniqueBoardKeyCount ?? 0,
        chainLegacyInstances: billboardChains?.stats.legacyInstanceEstimate ?? 0,
        canvasInHost: options.container.contains(renderer.domElement),
      })
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
      setOceanSuppressFeatures(features)
      applyRaceChromeVisible()
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
    setBoatHeightM(id, heightM): void {
      if (stopped) return
      const trimmed = id.trim()
      if (trimmed === '') return
      const scale = normalizeBoatHullScale(heightM)
      if (typeof heightM === 'number' && Number.isFinite(heightM) && heightM > 0) {
        boatHeightM.set(trimmed, scale)
      } else {
        boatHeightM.delete(trimmed)
      }
      boats.get(trimmed)?.setHullScale(scale)
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
    setSeaQuality(quality): void {
      if (stopped) return
      const next = normalizeSeaQuality(quality)
      if (next === seaQuality) return
      seaQuality = next
      if (!realisticEnv) return
      if (realisticEnvMounted) {
        scene.remove(realisticEnv.root)
        realisticEnvMounted = false
      }
      scene.fog = null
      realisticEnv.dispose()
      realisticEnv = null
      syncRealisticEnvironment()
    },
    getSeaQuality: () => seaQuality,
    setEnvironmentOpaqueClearSafe(safe): void {
      if (stopped) return
      environmentOpaqueClearSafe = safe === true
      syncRealisticEnvironment()
      syncTerrain()
      syncBuildings()
      syncLandmarks()
      emitTerrainCredits()
    },
    getEnvironmentOpaqueClearSafe: () => environmentOpaqueClearSafe,
    setTerrainEnabled(enabled): void {
      if (stopped) return
      terrainEnabled = enabled === true
      syncTerrain()
      emitTerrainCredits()
    },
    getTerrainEnabled: () => terrainEnabled,
    setBuildingsEnabled(enabled): void {
      if (stopped) return
      buildingsEnabled = enabled === true
      syncBuildings()
      emitTerrainCredits()
    },
    getBuildingsEnabled: () => buildingsEnabled,
    setHeroesEnabled(enabled): void {
      if (stopped) return
      heroesEnabled = enabled === true
      syncLandmarks()
      emitTerrainCredits()
    },
    getHeroesEnabled: () => heroesEnabled,
    setLandmarkPoseOffset(id, pose): void {
      landmarks?.setLandmarkPoseOffset(id, pose)
    },
    getLandmarkPoseOffsets: () => landmarks?.getLandmarkPoseOffsets() ?? {},
    applyLandmarkPoseOffsets(next): void {
      landmarks?.applyLandmarkPoseOffsets(next)
    },
    getLandmarkWorldPosition(id) {
      return landmarks?.getLandmarkWorldPosition(id) ?? null
    },
    getLandmarkPinAnchor(id) {
      return landmarks?.getLandmarkPinAnchor(id) ?? null
    },
    getLandmarkFocusRadius(id) {
      return landmarks?.getLandmarkFocusRadius(id) ?? null
    },
    getLandmarkTextureReport: () => landmarks?.getLandmarkTextureReport() ?? [],
    landmarksReady: landmarks?.ready ?? Promise.resolve(),
    getBuildingsStatusMessage(): string {
      if (buildings) return buildings.getStatusMessage()
      if (terrainToken === '') return BUILDINGS_STATUS_NO_TOKEN
      return buildingsEnabled ? BUILDINGS_STATUS_ON : BUILDINGS_STATUS_OFF
    },
    setOccupancyHoles(holes): void {
      if (stopped) return
      occupancyHoles = holes.map((h) => ({
        x: h.x,
        z: h.z,
        radiusM: h.radiusM,
      }))
      buildings?.setOccupancyHoles(occupancyHoles)
    },
    getOccupancyHoles: () => occupancyHoles,
    setTerrainAltitudeNudgeM(nudgeM): void {
      if (stopped) return
      terrainNudgeM = Number.isFinite(nudgeM) ? nudgeM : 0
      terrain?.setAltitudeNudgeM(terrainNudgeM)
      buildings?.setAltitudeNudgeM(terrainNudgeM)
    },
    getTerrainAltitudeNudgeM: () =>
      terrain?.getAltitudeNudgeM() ?? terrainNudgeM,
    setTerrainWaterDiscardYM(yM): void {
      if (stopped) return
      terrainWaterDiscardYM = Number.isFinite(yM)
        ? yM
        : DEFAULT_TERRAIN_WATER_DISCARD_Y
      terrain?.setWaterDiscardYM(terrainWaterDiscardYM)
    },
    getTerrainWaterDiscardYM: () =>
      terrain?.getWaterDiscardYM() ?? terrainWaterDiscardYM,
    setSeaHeightYM(yM): void {
      if (stopped) return
      seaHeightYM = clampSeaHeightYM(yM)
      applySeaHeight()
    },
    getSeaHeightYM: () => seaHeightYM,
    setTerrainTilesLocked(locked): void {
      if (stopped) return
      operatorTilesLocked = locked === true
      if (cinematicLockHeld) return
      applyCinematicTileLock(operatorTilesLocked)
    },
    getTerrainTilesLocked: () =>
      terrain?.getTilesLocked() ?? terrainTilesLocked,
    setTerrainOverlay(kind): void {
      if (stopped) return
      const next = normalizeTerrainOverlay(kind)
      const nextId = overlayToImageryAssetId(next)
      if (next === terrainOverlay && nextId === terrainImageryAssetId) return
      terrainOverlay = next
      terrainImageryAssetId = nextId
      remountTerrainOnly()
      emitTerrainCredits()
    },
    getTerrainOverlay: () => terrainOverlay,
    getTerrainStatusMessage(): string {
      const terrainMsg = terrain
        ? terrain.getStatusMessage()
        : terrainToken === ''
          ? TERRAIN_STATUS_NO_TOKEN
          : terrainEnabled
            ? `${TERRAIN_STATUS_ON} · ${terrainOverlay}`
            : TERRAIN_STATUS_OFF
      return `${terrainMsg}${buildingsStatusSuffix()}`
    },
    getTerrainCredits: () => mergeTilesetCredits(),
    setTerrainCreditsListener(listener): void {
      terrainCreditsListener = listener
      emitTerrainCredits()
    },
    setCesiumIonToken(token): void {
      if (stopped) return
      const next = (token ?? '').trim()
      if (next === terrainToken) return
      terrainToken = next
      disposeTerrainInstance()
      disposeBuildingsInstance()
      syncTerrain()
      syncBuildings()
      emitTerrainCredits()
    },
    getCesiumIonToken: () => terrainToken,
    setCalibrationOverlayEnabled(enabled): void {
      if (stopped) return
      calibrationOverlay.setEnabled(enabled === true)
    },
    getCalibrationOverlayEnabled: () => calibrationOverlay.isEnabled(),
    refreshCalibrationOverlay(): void {
      if (stopped) return
      calibrationOverlay.rebuild()
    },
    async loadCinematicSequence(url: string): Promise<CinematicSequence | null> {
      if (stopped) return null
      const seq = await loadSequence(url)
      if (stopped) return null
      cinematicPlayer.load(seq)
      emitCinematicTransport()
      return seq
    },
    getCinematicSequence: () => cinematicPlayer.getSequence(),
    playCinematic(): void {
      if (stopped) return
      void playCinematicAfterWarm()
    },
    pauseCinematic(): void {
      if (stopped) return
      cinematicPlayer.pause()
      emitCinematicTransport()
    },
    seekCinematic(tSec: number): void {
      if (stopped) return
      if (!cinematicPlayer.getSequence()) return
      snapshotLookIfNeeded()
      cinematicPlayer.seek(tSec)
      const sample = cinematicPlayer.sync()
      if (sample) applyCinematicLook(sample)
      if (!cinematicLockHeld) beginCinematicTileLock()
      freeCam?.setEnabled(false)
      emitCinematicTransport()
    },
    stopCinematic(): void {
      if (stopped) return
      cinematicPlayer.stop()
      cinematicPlayer.load(null)
      endCinematicTileLock()
      restoreCinematicLook()
      emitCinematicTransport()
    },
    isCinematicActive: () => cinematicPlayer.isActive(),
    isCinematicPlaying: () => cinematicPlayer.isPlaying(),
    getCinematicTimeSec: () => cinematicPlayer.getTimeSec(),
    getCinematicTransport: () => cinematicPlayer.getTransport(),
    getCinematicCamera: () => cinematicCamera,
    setCinematicTransportListener(listener): void {
      cinematicTransportListener = listener
      emitCinematicTransport()
    },
    warmCinematicTiles(): Promise<WarmTilesStatus> {
      if (stopped) {
        return Promise.resolve({ ...WARM_STATUS_IDLE, phase: 'skipped' })
      }
      return runCinematicTileWarm()
    },
    getCinematicWarmStatus: () => warmStatus,
    setCinematicWarmStatusListener(listener): void {
      warmStatusListener = listener
      listener?.(warmStatus)
    },
    dumpCinematicWarmUrls(): void {
      void (async () => {
        const id =
          cinematicPlayer.getSequence()?.id.trim() || 'intro-bosphorus'
        let raw: Record<string, unknown> = { id }
        try {
          const res = await fetch(cinematicSequenceUrl(id))
          if (res.ok) {
            const parsed: unknown = await res.json()
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              raw = parsed as Record<string, unknown>
            }
          }
        } catch {
          /* download whatever we collected */
        }
        downloadSequenceTileWarm(raw)
      })()
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
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        onWebglContextLost,
        false,
      )
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        onWebglContextRestored,
        false,
      )
      unsubPose()
      cinematicPlayer.stop()
      cinematicPins.dispose()
      scene.remove(cinematicPins.root)
      tilesWarmCamera = null
      cinematicLockHeld = false
      cinematicCoverUntilTilesReady = false
      lookSnapshot = null
      cinematicTerrainFrame = null
      terrainReorient = true
      disposeParkedCinematicTerrain()
      cinematicOceanOn = false
      cinematicFogOn = false
      cinematicTransportListener = null
      cloudOverlay?.dispose()
      cloudOverlay = null
      freeCam?.dispose()
      freeCam = null
      opsViewMode = DEFAULT_OPS_VIEW_MODE
      calibrationOverlay.dispose()
      if (realisticEnvMounted && realisticEnv) {
        scene.remove(realisticEnv.root)
        realisticEnvMounted = false
      }
      scene.fog = null
      realisticEnv?.dispose()
      realisticEnv = null
      lastOceanSuppressFeatures = []
      environmentMode = DEFAULT_ENVIRONMENT_MODE
      seaQuality = DEFAULT_SEA_QUALITY
      environmentOpaqueClearSafe = false
      disposeParkedCinematicTerrain()
      if (terrain) {
        scene.remove(terrain.root)
        terrain.dispose()
        terrain = null
      }
      if (buildings) {
        scene.remove(buildings.root)
        buildings.dispose()
        buildings = null
      }
      if (landmarks) {
        scene.remove(landmarks.root)
        landmarks.dispose()
        landmarks = null
      }
      terrainEnabled = DEFAULT_TERRAIN_ENABLED
      buildingsEnabled = DEFAULT_BUILDINGS_ENABLED
      heroesEnabled = DEFAULT_HEROES_ENABLED
      occupancyHoles = []
      terrainOverlay = DEFAULT_TERRAIN_OVERLAY
      terrainImageryAssetId = overlayToImageryAssetId(terrainOverlay)
      terrainCreditsListener = null
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
      lastLiveBoatAt.clear()
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
export type { EnvironmentMode, SeaQuality } from './environment/index.ts'
