import './style.css'
import { startLibraryPanel } from './assets/library/index.ts'
import type { LibraryPanelHandle } from './assets/library/index.ts'
import {
  snapshotCalibrationByPovId,
  startOffsetSliders,
  type OffsetSlidersHandle,
} from './calibration/index.ts'
import { loadConfig } from './config/index.ts'
import type { AppConfig } from './config/types.ts'
import {
  applyDeeplinkToBoot,
  parseConsoleDeeplink,
} from './console/index.ts'
import {
  applyConfigOrigin,
  ensureEgm96Loaded,
  enuToGpsAmsl,
  gpsToEnuAmsl,
  type ConfigOrigin,
} from './geodesy/index.ts'
import {
  applyRaceProjectToConfig,
  buildRaceProject,
  buildVenuePack,
  canWriteProjectsApi,
  confirmSaveWithOrphanBoatIds,
  defaultEditedRaceId,
  downloadRaceProject,
  downloadVenuePack,
  getDefaultVenuePackCache,
  isSafeRaceId,
  listLocalRaceIds,
  loadRaceProject,
  materializeVenuePack,
  parseVenuePack,
  projectsApiBearerToken,
  resolveProjectsRole,
  retainMaterializedVenuePack,
  startProjectManagerPanel,
  writeRaceProject,
  WriteRaceProjectError,
  type RaceProject,
} from './projects/index.ts'
import type { ProjectManagerPanelHandle } from './projects/index.ts'
import { promptModal } from './ui/promptModal.ts'
import {
  applyOutputMode,
  getStudioBridge,
  normalizeOutputMode,
  resolveClearAppearance,
  startNdiControllerPanel,
  startNdiFramePump,
  startOutputModeControl,
  startVisualTimecode,
  startWhepUnderlay,
  STUDIO_OUTPUT_HEIGHT,
  STUDIO_OUTPUT_WIDTH,
  type NdiControllerPanelHandle,
  type NdiFramePumpHandle,
  type OutputModeControlHandle,
  type TimecodeCorner,
  type VisualTimecodeHandle,
  type WhepUnderlayHandle,
} from './output/index.ts'
import { startPosePipeline, stopPosePipeline } from './pose/index.ts'
import {
  boatColorsFromCatalogue,
  createSidebar,
  layoutFeatures,
  loadFleetLiveFromSession,
  loadWorldExtrasFeatures,
  resolveAssetFocusEnu,
  setLayoutFeatures,
  startAssetInspector,
  startFleetLivePanel,
  startMapFeatureEditor,
  startScene,
  startStubHud,
  createWorldAuthoringWorkspace,
  mountWorldMapAuthoringLauncher,
  resolveAuthoringInitiallyOpen,
  WORLD_AUTHORING_MAP_SIZE,
  type AssetInspectorHandle,

  type AssetRowId,
  type BoatVisibilityMode,
  type FleetLivePanelHandle,
  type MapFeatureEditorHandle,
  type SceneHandle,
  type WorldAuthoringWorkspaceHandle,
  type WorldMapAuthoringLauncherHandle,
  type WorldFeature,
} from './scene/index.ts'
import {
  DEFAULT_LIVE_WS_BASE,
  startTelemetryIngest,
  stripLiveWsId,
  type IngestHandle,
  type LiveStatusSnapshot,
} from './telemetry/index.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('#app root missing')
}

let calib: OffsetSlidersHandle | null = null

let scene: SceneHandle | null = null
let ingest: IngestHandle | null = null
let outputControl: OutputModeControlHandle | null = null
let visualTimecode: VisualTimecodeHandle | null = null
let whepUnderlay: WhepUnderlayHandle | null = null
let ndiPump: NdiFramePumpHandle | null = null
let ndiController: NdiControllerPanelHandle | null = null
let mapEditor: MapFeatureEditorHandle | null = null
let worldAuthoring: WorldAuthoringWorkspaceHandle | null = null
let worldMapLauncher: WorldMapAuthoringLauncherHandle | null = null
let fleetPanel: FleetLivePanelHandle | null = null
let assetInspector: AssetInspectorHandle | null = null
/** Soft POV map-dot visibility (false = hidden). Missing → true. */
const povMapVisible = new Map<string, boolean>()
/** Soft POV 3D flag (no mesh yet). Missing → true. */
const povVisible3d = new Map<string, boolean>()
let unsubLiveStatus: (() => void) | null = null
let bootConfig: AppConfig | null = null
let raceProject: RaceProject | null = null
let currentWorldFeatures: WorldFeature[] = []
let replayUrl = '/fixtures/telemetry/spine-demo.json'
let courseUrl = '/fixtures/course/demo-istanbul.json'
let sponsorsUrl = '/fixtures/sponsors/demo-istanbul.json'
let flagsUrl = '/fixtures/flags/demo-istanbul-countdown.json'
let boatNamesUrl = '/fixtures/boats/demo-istanbul-names.json'
let boatIds: string[] = ['21', '22', '23', '24']
let povIds: string[] = ['1', '2']
/** Enabled ids for live sockets only (subset of registry; may be empty). */
let liveBoatIds: string[] = []
let livePovIds: string[] = []
/** Live WS bases (no id) — Fleet panel / sessionStorage; not written to config.json. */
let wsUrl = DEFAULT_LIVE_WS_BASE
let wsBoatUrl = DEFAULT_LIVE_WS_BASE
let chromaKey = ''
let switching = false
let switchingRace = false
let liveStatusPoll: ReturnType<typeof setInterval> | null = null

/** Push catalogue category colours onto 2D map boat dots (hull tint is via scene). */
function syncMapBoatDotColors(): void {
  if (!scene) return
  const colors = boatColorsFromCatalogue(scene.getBoatNamesCatalogue())
  hud.getMap().setBoatDotColors(colors)
  hud.getStreamMap().setBoatDotColors(colors)
}

/** Build soft RaceProject fleet.boatVisibility from Fleet rows (skip pure solid). */
function fleetBoatVisibilityRecord(
  boats:
    | ReadonlyArray<{ id: string; visibility?: BoatVisibilityMode }>
    | undefined,
): Record<string, BoatVisibilityMode> | undefined {
  if (!boats?.length) return undefined
  const out: Record<string, BoatVisibilityMode> = {}
  for (const b of boats) {
    const id = b.id.trim()
    if (id === '') continue
    const mode = b.visibility ?? 'solid'
    if (mode === 'solid') continue
    out[id] = mode
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Soft fleet.boatMapVisible — only persist explicit `false` entries. */
function fleetBoatMapVisibleRecord(
  boats:
    | ReadonlyArray<{ id: string; mapVisible?: boolean }>
    | undefined,
): Record<string, boolean> | undefined {
  if (!boats?.length) return undefined
  const out: Record<string, boolean> = {}
  for (const b of boats) {
    const id = b.id.trim()
    if (id === '' || b.mapVisible !== false) continue
    out[id] = false
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Soft fleet.povMapVisible — only persist explicit `false` entries. */
function fleetPovMapVisibleRecord(
  ids: readonly string[],
): Record<string, boolean> | undefined {
  const out: Record<string, boolean> = {}
  for (const raw of ids) {
    const id = raw.trim()
    if (id === '') continue
    if (povMapVisible.get(id) === false) out[id] = false
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Push hidden boat/POV ids to ops + stream maps. */
function syncMapHiddenPoseIds(): void {
  const hidden: string[] = []
  const boats = fleetPanel?.getState().boats ?? []
  for (const b of boats) {
    if (b.mapVisible === false) hidden.push(b.id)
  }
  for (const [id, visible] of povMapVisible) {
    if (visible === false) hidden.push(id)
  }
  hud.getMap().setHiddenPoseIds(hidden)
  hud.getStreamMap().setHiddenPoseIds(hidden)
}

/** Apply Fleet / pack visibility modes onto live boat entities. */
function syncBoatVisibilityToScene(
  boats: ReadonlyArray<{ id: string; visibility?: BoatVisibilityMode }>,
): void {
  if (!scene) return
  const modes: Record<string, BoatVisibilityMode> = {}
  for (const b of boats) {
    const id = b.id.trim()
    if (id === '') continue
    modes[id] = b.visibility ?? 'solid'
  }
  scene.setBoatVisibilityModes(modes)
}

async function patchWorldFeature(
  id: string,
  patch: Partial<WorldFeature>,
): Promise<void> {
  const src = mapEditor?.getFeatures() ?? currentWorldFeatures
  const next = src.map((f) => {
    if (f.id !== id) {
      return { ...f, points: f.points.map((p) => ({ ...p })) }
    }
    const merged: WorldFeature = {
      ...f,
      ...patch,
      points: (patch.points ?? f.points).map((p) => ({ ...p })),
    }
    return merged
  })
  currentWorldFeatures = cloneWorldFeatures(next)
  mapEditor?.replaceFeatures(currentWorldFeatures, true)
  const layout = layoutFeatures(currentWorldFeatures, gpsToEnu)
  setLayoutFeatures(layout)
  hud.setLayoutFeatures(layout)
  assetInspector?.refresh()
}

function focusAssetRow(target: AssetRowId): void {
  if (!scene) return
  const fleet = fleetPanel?.getState()
  const enu = resolveAssetFocusEnu(target, {
    getBoatEnu: (id) => scene?.getBoatEnuPosition(id) ?? null,
    getPovEnu: (id) => scene?.getPovEnuPosition(id) ?? null,
    getBoatPlanned: (id) => {
      const b = fleet?.boats.find((row) => row.id === id)
      if (
        typeof b?.plannedLat === 'number' &&
        typeof b?.plannedLon === 'number'
      ) {
        return { lat: b.plannedLat, lon: b.plannedLon }
      }
      return null
    },
    getPovPlanned: (id) => {
      const p = fleet?.plannedPovs?.find((row) => row.id === id)
      return p ? { lat: p.plannedLat, lon: p.plannedLon } : null
    },
    features: mapEditor?.getFeatures() ?? currentWorldFeatures,
    gpsToEnuAmsl: gpsToEnu,
  })
  if (!enu) {
    console.warn('[assets] Focus: no position for', target)
    return
  }
  scene.frameEnuPoint(enu, 80)
  hud.getMap().focusEnu(enu.x, enu.z, 80)
  hud.setOpsViewMode('free')
  fleetPanel?.setOpsViewMode('free')
}

/** Transparent NDI plate: clear page chrome so only WebGL alpha matters for ops view. */
function applyOutputModeChrome(mode: string): void {
  const on = mode === 'transparent'
  document.documentElement.classList.toggle('output-transparent', on)
  document.body.classList.toggle('output-transparent', on)
  document.getElementById('app')?.classList.toggle('output-transparent', on)
}

function clearLiveStatusSub(): void {
  unsubLiveStatus?.()
  unsubLiveStatus = null
  if (liveStatusPoll !== null) {
    clearInterval(liveStatusPoll)
    liveStatusPoll = null
  }
}

function applyFleetToScene(): void {
  if (!scene) return
  const active = scene.setFleetAllowLists({ boatIds, povIds })
  hud.setPovIds(povIds, active)
  calib?.setPovIds(povIds, active)
  fleetPanel?.setState({ boatIds, povIds, activePovId: active })
}

async function restartIngest(mode?: 'mock' | 'replay' | 'live'): Promise<void> {
  clearLiveStatusSub()
  const nextMode = mode ?? ingest?.mode ?? bootConfig?.telemetryMode ?? 'mock'
  ingest?.stop()
  // Live uses enabled-id lists only; mock/replay keep full registry.
  const useBoatIds = nextMode === 'live' ? liveBoatIds : boatIds
  const usePovIds = nextMode === 'live' ? livePovIds : povIds
  ingest = await startTelemetryIngest({
    mode: nextMode,
    replayUrl,
    boatIds: useBoatIds,
    povIds: usePovIds,
    wsUrl,
    wsBoatUrl,
  })
  applyIngestConnectionStatus(ingest)
  hud.setMode(ingest.mode)
}

function cloneWorldFeatures(
  features: readonly WorldFeature[],
): WorldFeature[] {
  return features.map((f) => ({
    ...f,
    points: f.points.map((p) => ({ ...p })),
  }))
}

function gpsToEnu(lat: number, lon: number, alt: number) {
  const v = gpsToEnuAmsl(lat, lon, alt)
  return { x: v.x, y: v.y, z: v.z }
}

/** Keep ops (+ stream) maps able to draw OSM + convert click-to-anchor. */
function syncMapGeoBridge(maps: {
  ops: { setGeoBridge: (b: {
    enuToLatLon: (east: number, north: number) => { lat: number; lon: number }
    latLonToEnu: (lat: number, lon: number) => { east: number; north: number }
  } | null) => void }
  stream: { setGeoBridge: (b: {
    enuToLatLon: (east: number, north: number) => { lat: number; lon: number }
    latLonToEnu: (lat: number, lon: number) => { east: number; north: number }
  } | null) => void }
}): void {
  const bridge = {
    enuToLatLon: (east: number, north: number) => {
      const g = enuToGpsAmsl(east, 0, north)
      return { lat: g.lat, lon: g.lon }
    },
    latLonToEnu: (lat: number, lon: number) => {
      const v = gpsToEnuAmsl(lat, lon, 0)
      return { east: v.x, north: v.z }
    },
  }
  maps.ops.setGeoBridge(bridge)
  maps.stream.setGeoBridge(bridge)
}

/** Seed 2D map dots for map-placed fleet until live pose arrives. */
function seedPlannedFleetOnMap(
  map: {
    updatePose: (pose: {
      id: string
      kind: 'boat' | 'drone' | 'buoy'
      position: { x: number; y: number; z: number }
      rotation: { yawDeg: number; pitchDeg: number; rollDeg: number }
      fovHDeg: number
      ts: number
    }) => void
  },
  boats: readonly {
    id: string
    plannedLat?: number
    plannedLon?: number
  }[],
  plannedPovs: readonly {
    id: string
    plannedLat: number
    plannedLon: number
  }[] = [],
): void {
  const now = Date.now()
  for (const b of boats) {
    if (
      typeof b.plannedLat !== 'number' ||
      typeof b.plannedLon !== 'number'
    ) {
      continue
    }
    const enu = gpsToEnu(b.plannedLat, b.plannedLon, 0)
    map.updatePose({
      id: b.id,
      kind: 'boat',
      position: { x: enu.x, y: 0, z: enu.z },
      rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: now,
    })
  }
  for (const p of plannedPovs) {
    const enu = gpsToEnu(p.plannedLat, p.plannedLon, 0)
    map.updatePose({
      id: p.id,
      kind: 'drone',
      position: { x: enu.x, y: 10, z: enu.z },
      rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: now,
    })
  }
}

function syncRaceQuery(id: string): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('race', id)
    window.history.replaceState(null, '', url)
  } catch {
    /* ignore */
  }
}

type SaveRaceProjectOptions = {
  /** Explicit id/name (Save as / editor fields). */
  meta?: { id?: string; name?: string }
  /**
   * `save` = overwrite current id (API PUT when configured).
   * `saveAs` = new id (API POST when configured).
   */
  mode?: 'save' | 'saveAs'
}

function syncFleetIntoConfig(config: AppConfig): void {
  config.boatIds = [...boatIds]
  config.povIds = [...povIds]
  config.boatNamesUrl = boatNamesUrl
  config.courseUrl = courseUrl
  config.sponsorsUrl = sponsorsUrl
  config.flagsUrl = flagsUrl
  config.replayUrl = replayUrl
}

async function promptSaveAsMeta(defaults: {
  id: string
  name: string
}): Promise<{ id: string; name: string } | null> {
  // Electron overrides window.prompt to throw — use shared DOM modal.
  const idRaw = await promptModal('Save as — project id', defaults.id)
  if (idRaw === null) return null
  const id = idRaw.trim()
  if (!isSafeRaceId(id)) {
    window.alert(
      'Invalid project id. Use letters, digits, dash, underscore (see RaceProject contract).',
    )
    return null
  }
  const nameRaw = await promptModal(
    'Save as — display name',
    defaults.name || id,
  )
  if (nameRaw === null) return null
  const name = nameRaw.trim() || id
  return { id, name }
}

async function refreshRacePicker(activeId?: string): Promise<void> {
  const config = bootConfig
  if (!config) return
  try {
    const ids = await listLocalRaceIds({
      projectsApiBase: config.projectsApiBase,
    })
    let cached: string[] = []
    try {
      cached = await getDefaultVenuePackCache().listIds()
    } catch {
      /* ignore */
    }
    const merged = [...ids]
    for (const id of cached) {
      if (!merged.includes(id)) merged.push(id)
    }
    hud.setRaceIds(merged, activeId ?? raceProject?.id ?? merged[0])
    void projectManagerPanel?.refresh()
  } catch {
    /* keep existing picker */
  }
}

/** Build RaceProject from current editor/config (shared by Save + Pack ↓). */
function buildCurrentRaceProject(meta?: {
  id?: string
  name?: string
  revision?: number
}): RaceProject | null {
  const config = bootConfig
  if (!config) return null
  const fleet = fleetPanel?.getState()
  if (fleet) {
    boatIds = [...fleet.boatIds]
    povIds = [...fleet.povIds]
  }
  syncFleetIntoConfig(config)
  const features = mapEditor?.getFeatures() ?? currentWorldFeatures
  const id =
    meta?.id?.trim() || raceProject?.id || defaultEditedRaceId()
  if (!isSafeRaceId(id)) return null
  const name = meta?.name?.trim() || raceProject?.name || id
  const boatVisibility = fleetBoatVisibilityRecord(fleet?.boats)
  const boatMapVisible = fleetBoatMapVisibleRecord(fleet?.boats)
  const povMapVisibleRecord = fleetPovMapVisibleRecord(povIds)
  const calibration = snapshotCalibrationByPovId(povIds)
  return buildRaceProject({
    id,
    name,
    origin: { ...config.origin },
    boatIds,
    povIds,
    features,
    takeoffAltitudeMSL: config.takeoffAltitudeMSL,
    boatNamesUrl: boatNamesUrl || config.boatNamesUrl,
    boatVisibility,
    boatMapVisible,
    povMapVisible: povMapVisibleRecord,
    courseUrl: courseUrl || config.courseUrl,
    sponsorsUrl: sponsorsUrl || config.sponsorsUrl,
    flagsUrl: flagsUrl || config.flagsUrl,
    replayUrl: replayUrl || config.replayUrl,
    calibration,
    revision: meta?.revision,
    output: {
      outputMode: config.outputMode,
      whepUrl: config.whepUrl || undefined,
      chromaKey: config.chromaKey || undefined,
      timecodeEnabled: config.timecodeEnabled,
      timecodeCorner: config.timecodeCorner,
      timecodeSizePx: config.timecodeSizePx,
    },
  })
}

function projectsWriteOpts(apiBase: string) {
  const config = bootConfig
  return {
    projectsApiBase: apiBase,
    bearerToken: config ? projectsApiBearerToken(config) : undefined,
  }
}

async function maybeWriteRaceProjectApi(
  project: RaceProject,
  mode: 'save' | 'saveAs',
): Promise<RaceProject | null> {
  const config = bootConfig
  if (!config) return null
  const apiBase = config.projectsApiBase.trim()
  if (!apiBase) return null
  // Air-only LAN role: never POST/PUT (UI also disables Save).
  if (!canWriteProjectsApi(config, window.location.search)) {
    return null
  }

  const auth = projectsWriteOpts(apiBase)

  try {
    if (mode === 'saveAs') {
      try {
        return await writeRaceProject(project, {
          ...auth,
          mode: 'create',
        })
      } catch (err) {
        // Editor Save project may reuse an existing id → fall back to PUT.
        if (!(err instanceof WriteRaceProjectError) || err.status !== 409) {
          throw err
        }
        let expectedRevision =
          typeof project.revision === 'number'
            ? project.revision
            : typeof raceProject?.revision === 'number'
              ? raceProject.revision
              : undefined
        if (expectedRevision === undefined) {
          const existing = await loadRaceProject(project.id, {
            projectsApiBase: apiBase,
          })
          expectedRevision = existing.revision
        }
        if (expectedRevision === undefined) throw err
        return await writeRaceProject(project, {
          ...auth,
          mode: 'update',
          expectedRevision,
        })
      }
    }

    let expectedRevision =
      typeof project.revision === 'number'
        ? project.revision
        : typeof raceProject?.revision === 'number'
          ? raceProject.revision
          : undefined

    if (expectedRevision === undefined) {
      try {
        const existing = await loadRaceProject(project.id, {
          projectsApiBase: apiBase,
        })
        expectedRevision = existing.revision
      } catch {
        return await writeRaceProject(project, {
          ...auth,
          mode: 'create',
        })
      }
    }

    if (expectedRevision === undefined) {
      return await writeRaceProject(project, {
        ...auth,
        mode: 'create',
      })
    }

    try {
      return await writeRaceProject(project, {
        ...auth,
        mode: 'update',
        expectedRevision,
      })
    } catch (err) {
      if (err instanceof WriteRaceProjectError && err.status === 404) {
        return await writeRaceProject(project, {
          ...auth,
          mode: 'create',
        })
      }
      throw err
    }
  } catch (err) {
    console.warn('[projects] API write failed (download kept)', err)
    const detail =
      err instanceof WriteRaceProjectError
        ? `API ${err.status}`
        : 'API write failed'
    hud.setBootMessage(`saved download · ${detail}`)
    return null
  }
}

async function saveCurrentRaceProject(
  options: SaveRaceProjectOptions = {},
): Promise<void> {
  const config = bootConfig
  if (!config) {
    console.warn('[projects] save skipped; config not ready')
    return
  }
  if (!canWriteProjectsApi(config, window.location.search)) {
    console.warn('[projects] save skipped; air-only role')
    hud.setBootMessage('air-only · Save disabled')
    return
  }

  const mode = options.mode ?? 'save'
  const fleet = fleetPanel?.getState()
  if (fleet) {
    boatIds = [...fleet.boatIds]
    povIds = [...fleet.povIds]
  }
  syncFleetIntoConfig(config)

  const features = mapEditor?.getFeatures() ?? currentWorldFeatures
  const id =
    options.meta?.id?.trim() ||
    raceProject?.id ||
    defaultEditedRaceId()
  if (!isSafeRaceId(id)) {
    console.warn('[projects] save skipped; invalid race id', id)
    hud.setBootMessage(`save failed: invalid id`)
    return
  }
  const name =
    options.meta?.name?.trim() ||
    raceProject?.name ||
    id

  const catalogueIds = scene
    ? [...scene.getBoatNamesCatalogue().keys()]
    : []
  if (!confirmSaveWithOrphanBoatIds(boatIds, catalogueIds)) {
    hud.setBootMessage('save cancelled')
    return
  }

  try {
    const boatVisibility = fleetBoatVisibilityRecord(fleet?.boats)
    const boatMapVisible = fleetBoatMapVisibleRecord(fleet?.boats)
    const povMapVisibleRecord = fleetPovMapVisibleRecord(povIds)
    const calibration = snapshotCalibrationByPovId(povIds)
    const project = buildRaceProject({
      id,
      name,
      origin: { ...config.origin },
      boatIds,
      povIds,
      features,
      takeoffAltitudeMSL: config.takeoffAltitudeMSL,
      boatNamesUrl: boatNamesUrl || config.boatNamesUrl,
      boatVisibility,
      boatMapVisible,
      povMapVisible: povMapVisibleRecord,
      courseUrl: courseUrl || config.courseUrl,
      sponsorsUrl: sponsorsUrl || config.sponsorsUrl,
      flagsUrl: flagsUrl || config.flagsUrl,
      replayUrl: replayUrl || config.replayUrl,
      calibration,
      revision: mode === 'save' ? raceProject?.revision : undefined,
      output: {
        outputMode: config.outputMode,
        whepUrl: config.whepUrl || undefined,
        chromaKey: config.chromaKey || undefined,
        timecodeEnabled: config.timecodeEnabled,
        timecodeCorner: config.timecodeCorner,
        timecodeSizePx: config.timecodeSizePx,
      },
    })

    // Primary persist path: browser download (git drop under public/races/<id>/).
    downloadRaceProject(project)

    const stored = await maybeWriteRaceProjectApi(project, mode)
    const finalProject = stored ?? project
    raceProject = finalProject
    mapEditor?.setProjectMeta(finalProject.id, finalProject.name)
    hud.setActiveRaceId(finalProject.id)
    syncRaceQuery(finalProject.id)
    if (stored) {
      await refreshRacePicker(finalProject.id)
      hud.setBootMessage(`saved: ${finalProject.id} (download + API)`)
    } else {
      hud.setBootMessage(
        config.projectsApiBase.trim()
          ? `saved: ${finalProject.id} (download)`
          : `saved: ${finalProject.id} (download · drop into public/races/)`,
      )
    }
    console.info('[projects] saved RaceProject', {
      id: finalProject.id,
      mode,
      origin: finalProject.origin,
      boatIds: finalProject.fleet.boatIds,
      povIds: finalProject.povIds,
      features: finalProject.features?.length ?? 0,
      api: Boolean(stored),
    })
  } catch (err) {
    console.warn('[projects] save/download failed', err)
    hud.setBootMessage('save failed')
  }
}

async function saveAsRaceProject(): Promise<void> {
  const defaults = {
    id: defaultEditedRaceId(),
    name: raceProject?.name ? `${raceProject.name} (copy)` : 'Edited race',
  }
  const meta = await promptSaveAsMeta(defaults)
  if (!meta) return
  void saveCurrentRaceProject({ meta, mode: 'saveAs' })
}

async function loadWorldForProject(
  project: RaceProject | null,
): Promise<WorldFeature[]> {
  if (!scene) return []
  const packFeatures = project?.features
  if (packFeatures && packFeatures.length > 0) {
    const world = cloneWorldFeatures(packFeatures)
    await scene.remountWorldFromFeatures(world)
    await scene.loadPositionMarkersFromUrl()
    return world
  }
  const course = await scene.loadCourseFromUrl(courseUrl)
  const sponsors = await scene.loadSponsorsFromUrl(sponsorsUrl)
  const flags = await scene.loadCountdownFlagsFromUrl(flagsUrl)
  const extras = await loadWorldExtrasFeatures()
  const world = [
    ...(course?.worldFeatures ?? []),
    ...(sponsors?.worldFeatures ?? []),
    ...(flags?.worldFeatures ?? []),
    ...extras,
  ]
  scene.syncLineSignsFromFeatures(world)
  await scene.loadPositionMarkersFromUrl()
  return world
}

async function applyWorldFeatures(world: WorldFeature[]): Promise<void> {
  currentWorldFeatures = cloneWorldFeatures(world)
  const layout = layoutFeatures(currentWorldFeatures, gpsToEnu)
  setLayoutFeatures(layout)
  hud.setLayoutFeatures(layout)
  // 3D already mounted by loadWorldForProject — sync editor/map only.
  mapEditor?.replaceFeatures(currentWorldFeatures, false)
}

/**
 * Ops world-anchor Apply: update runtime config.origin, GEO cache, remount ENU.
 * GPS feature points stay; boats/features shift consistently in ENU.
 */
async function applyWorldOrigin(origin: ConfigOrigin): Promise<void> {
  const config = bootConfig
  if (!config || !scene) {
    console.warn('[geo] origin apply skipped; boot not ready')
    return
  }
  config.origin = { ...origin }
  applyConfigOrigin(config.origin)
  hud.setOrigin(config.origin)

  syncMapGeoBridge({ ops: hud.getMap(), stream: hud.getStreamMap() })

  const features = mapEditor?.getFeatures() ?? currentWorldFeatures
  currentWorldFeatures = cloneWorldFeatures(features)
  await scene.remountWorldFromFeatures(currentWorldFeatures)
  const layout = layoutFeatures(currentWorldFeatures, gpsToEnu)
  setLayoutFeatures(layout)
  hud.setLayoutFeatures(layout)
  mapEditor?.replaceFeatures(currentWorldFeatures, false)

  hud.setBootMessage(
    `origin: ${config.origin.lat}, ${config.origin.lon}, altMsl=${config.origin.altMsl}`,
  )
  console.info('[geo] world anchor applied', config.origin)
}

async function applyLoadedRaceProject(project: RaceProject): Promise<void> {
  const config = bootConfig
  if (!scene || !config) return

  applyRaceProjectToConfig(config, project)
  raceProject = project
  replayUrl = config.replayUrl
  courseUrl = config.courseUrl
  sponsorsUrl = config.sponsorsUrl
  flagsUrl = config.flagsUrl
  boatNamesUrl = config.boatNamesUrl
  boatIds = config.boatIds
  povIds = config.povIds

  applyConfigOrigin(config.origin)
  hud.setOrigin(config.origin)
  await scene.loadBoatNamesFromUrl(boatNamesUrl)
  syncMapBoatDotColors()

  const world = await loadWorldForProject(project)
  await applyWorldFeatures(world)

  mapEditor?.setProjectMeta(project.id, project.name)
  const streamTitle = project.name.trim()
  hud.getStreamMap().setTitle(streamTitle || 'Race map')
  hud.setActiveRaceId(project.id)
  const activePov = scene.setFleetAllowLists({
    boatIds: config.boatIds,
    povIds: config.povIds,
  })
  hud.setPovIds(config.povIds, activePov)
  calib?.setPovIds(config.povIds, activePov)
  syncRaceQuery(project.id)

  liveBoatIds = liveBoatIds.filter((id) => boatIds.includes(id))
  livePovIds = livePovIds.filter((id) => povIds.includes(id))

  await restartIngest(ingest?.mode ?? config.telemetryMode)
  const packVis = project.fleet.boatVisibility ?? {}
  const packBoatMap = project.fleet.boatMapVisible ?? {}
  povMapVisible.clear()
  povVisible3d.clear()
  if (project.fleet.povMapVisible) {
    for (const [id, v] of Object.entries(project.fleet.povMapVisible)) {
      if (typeof v === 'boolean') povMapVisible.set(id, v)
    }
  }
  fleetPanel?.setState({
    boatIds: config.boatIds,
    povIds: config.povIds,
    enabledBoatIds: [...liveBoatIds],
    enabledPovIds: [...livePovIds],
    activePovId: activePov,
    boats: [...scene.getBoatNamesCatalogue().entries()].map(([id, e]) => ({
      id,
      name: e.name,
      category: e.category,
      visibility: packVis[id] ?? 'solid',
      mapVisible: packBoatMap[id] === false ? false : undefined,
    })),
  })
  syncBoatVisibilityToScene(
    fleetPanel?.getState().boats ??
      Object.entries(packVis).map(([id, visibility]) => ({ id, visibility })),
  )
  syncMapHiddenPoseIds()
  assetInspector?.refresh()
  hud.setBootMessage(`project: ${project.id}`)
  console.info('[projects] switched race pack', { id: project.id })
}

async function switchRace(id: string): Promise<void> {
  const config = bootConfig
  if (!scene || !config || switchingRace) return
  const trimmed = id.trim()
  if (!isSafeRaceId(trimmed)) {
    console.warn('[projects] invalid race id', id)
    hud.setBootMessage(`invalid race id`)
    return
  }
  switchingRace = true
  try {
    hud.setBootMessage(`project: loading ${trimmed}…`)
    const project = await loadRaceProject(trimmed, {
      projectsApiBase: config.projectsApiBase,
    })
    await applyLoadedRaceProject(project)
  } catch (err) {
    console.warn('[projects] race pack switch failed', err)
    hud.setBootMessage(`project load failed: ${trimmed}`)
  } finally {
    switchingRace = false
  }
}

async function downloadCurrentVenuePack(): Promise<void> {
  const project = buildCurrentRaceProject({
    id: raceProject?.id,
    name: raceProject?.name,
    revision: raceProject?.revision,
  })
  if (!project) {
    hud.setBootMessage('venue pack: no project')
    return
  }
  try {
    hud.setBootMessage(`venue pack: building ${project.id}…`)
    const pack = await buildVenuePack(project)
    downloadVenuePack(pack)
    await getDefaultVenuePackCache().put(pack)
    await refreshRacePicker(project.id)
    const n = Object.keys(pack.files).length
    hud.setBootMessage(`venue pack: ${pack.id} (${n} files)`)
    console.info('[venuePack] downloaded', { id: pack.id, files: n })
  } catch (err) {
    console.warn('[venuePack] download failed', err)
    hud.setBootMessage('venue pack download failed')
  }
}

async function loadVenuePackFromFile(file: File): Promise<void> {
  if (switchingRace) return
  switchingRace = true
  try {
    hud.setBootMessage(`venue pack: reading ${file.name}…`)
    const raw = JSON.parse(await file.text()) as unknown
    const pack = parseVenuePack(raw)
    await getDefaultVenuePackCache().put(pack)
    const mat = retainMaterializedVenuePack(materializeVenuePack(pack))
    await applyLoadedRaceProject(mat.project)
    await refreshRacePicker(pack.id)
    const n = Object.keys(pack.files).length
    hud.setBootMessage(`venue pack loaded: ${pack.id} (${n} files)`)
    console.info('[venuePack] loaded file', { id: pack.id, files: n })
  } catch (err) {
    console.warn('[venuePack] load file failed', err)
    hud.setBootMessage('venue pack load failed')
  } finally {
    switchingRace = false
  }
}

const opsSidebar = createSidebar({ container: app })

const authoringShell = createWorldAuthoringWorkspace({
  container: opsSidebar.getOverlayHost(),
  initiallyOpen: false,
})
worldAuthoring = authoringShell

/** Section body hosts — filled synchronously by registerSection mount. */
let projectSectionEl!: HTMLElement
let assetsSectionEl!: HTMLElement
let calibSectionEl!: HTMLElement
let librarySectionEl!: HTMLElement
let liveSectionEl!: HTMLElement
let ndiSectionEl!: HTMLElement
let opsSectionEl!: HTMLElement
let libraryPanel: LibraryPanelHandle | null = null
let projectManagerPanel: ProjectManagerPanelHandle | null = null

opsSidebar.registerSection({
  id: 'project',
  label: 'Project',
  order: 10,
  mount(container) {
    projectSectionEl = container
    return {
      dispose() {
        projectManagerPanel?.dispose()
        projectManagerPanel = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'world-map',
  label: 'World Map',
  order: 20,
  mount(container) {
    worldMapLauncher = mountWorldMapAuthoringLauncher(container, authoringShell)
    return {
      dispose() {
        worldMapLauncher?.dispose()
        worldMapLauncher = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'assets',
  label: 'Assets',
  order: 30,
  mount(container) {
    assetsSectionEl = container
    return {
      dispose() {
        assetInspector?.dispose()
        assetInspector = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'calib',
  label: 'Calib',
  order: 35,
  mount(container) {
    calibSectionEl = container
    return {
      dispose() {
        calib?.stop()
        calib = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'library',
  label: 'Library',
  order: 40,
  mount(container) {
    librarySectionEl = container
    return {
      dispose() {
        libraryPanel?.dispose()
        libraryPanel = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'live',
  label: 'Live',
  order: 50,
  mount(container) {
    liveSectionEl = container
    return { dispose: () => {} }
  },
})
opsSidebar.registerSection({
  id: 'ndi',
  label: 'NDI',
  order: 55,
  mount(container) {
    ndiSectionEl = container
    return { dispose: () => {} }
  },
})
opsSidebar.registerSection({
  id: 'ops',
  label: 'Ops',
  order: 60,
  mount(container) {
    opsSectionEl = container
    return { dispose: () => {} }
  },
})

// CAL offset sliders — sidebar Calib section (no fixed top-left chrome).
calib = startOffsetSliders({ container: calibSectionEl })

// Read-only NDI status tab (OUT). Polls pump + POV; never feeds the render loop.
ndiController = startNdiControllerPanel({
  container: ndiSectionEl,
  getPump: () => ndiPump,
  getActivePovId: () => scene?.getActivePovId() ?? null,
})

const hud = startStubHud({
  container: app,
  hosts: {
    project: projectSectionEl,
    ops: opsSectionEl,
    map: authoringShell.getMapHost(),
    streamMapHost: opsSidebar.getOverlayHost(),
  },
  editorInitiallyOpen: false,
  onModeChange: (mode) => {
    void (async () => {
      if (switching) return
      switching = true
      try {
        await restartIngest(mode)
      } finally {
        switching = false
      }
    })()
  },
  onPovChange: (id) => {
    scene?.setActivePovId(id)
    calib?.setDeviceId(id)
    fleetPanel?.setState({ activePovId: id })
  },
  onOpsViewChange: (mode) => {
    scene?.setOpsViewMode(mode)
    fleetPanel?.setOpsViewMode(mode)
  },
  onCountdownControl: (action) => {
    scene?.controlCountdown(action)
  },
  onEditorToggle: (open) => {
    authoringShell.setOpen(open)
  },
  onRaceLoad: (id) => {
    void switchRace(id)
  },
  onSaveProject: () => {
    void saveCurrentRaceProject({ mode: 'save' })
  },
  onSaveAsProject: () => {
    void saveAsRaceProject()
  },
  onDownloadVenuePack: () => {
    void downloadCurrentVenuePack()
  },
  onLoadVenuePackFile: (file) => {
    void loadVenuePackFromFile(file)
  },
  onOriginApply: (origin) => {
    void applyWorldOrigin(origin)
  },
})

authoringShell.onOpenChange((open) => {
  mapEditor?.setOpen(open)
  hud.setEditorOpen(open, false)
  if (open) mapEditor?.resyncChrome()
})

function pushLiveStatus(snapshot: LiveStatusSnapshot): void {
  hud.setConnectionStatus({ kind: 'live', channels: snapshot })
  fleetPanel?.setLiveStatus(snapshot)
}

function applyIngestConnectionStatus(handle: IngestHandle): void {
  clearLiveStatusSub()
  if (handle.mode === 'live' && handle.getLiveStatus && handle.onLiveStatus) {
    const push = (): void => {
      const snap = handle.getLiveStatus?.()
      if (snap) pushLiveStatus(snap)
    }
    push()
    unsubLiveStatus = handle.onLiveStatus(() => {
      push()
    })
    // Refresh last-packet ages while live (status events alone miss packets).
    liveStatusPoll = setInterval(push, 250)
    return
  }
  fleetPanel?.setLiveStatus(null)
  hud.setConnectionStatus({
    kind: 'non_live',
    mode: handle.mode === 'replay' ? 'replay' : 'mock',
  })
}
void (async () => {
  const config = await loadConfig()
  bootConfig = config
  const deeplink = parseConsoleDeeplink(window.location.search)
  libraryPanel = startLibraryPanel({
    container: librarySectionEl,
    projectsApiBase: config.projectsApiBase,
    bearerToken: projectsApiBearerToken(config),
    canUpload: canWriteProjectsApi(config, window.location.search),
  })
  projectManagerPanel = startProjectManagerPanel({
    container: projectSectionEl,
    projectsApiBase: config.projectsApiBase,
    bearerToken: projectsApiBearerToken(config),
    canWrite: canWriteProjectsApi(config, window.location.search),
    getActiveProjectId: () => raceProject?.id,
    onProjectsChanged: async (activeId) => {
      await refreshRacePicker(activeId)
    },
    onRenamedActive: async (project) => {
      await applyLoadedRaceProject(project)
    },
  })
  const projectWritesEnabled = canWriteProjectsApi(
    config,
    window.location.search,
  )
  hud.setProjectWritesEnabled(projectWritesEnabled)
  console.info('[projects] LAN role', {
    role: resolveProjectsRole(config, window.location.search),
    writes: projectWritesEnabled,
    apiBase: config.projectsApiBase || '(static)',
  })

  // PLT+CON: ?race=<id> → local pack under /races/<id>/; miss → config.json (warn).
  if (deeplink.race) {
    try {
      raceProject = await loadRaceProject(deeplink.race, {
        projectsApiBase: config.projectsApiBase,
      })
      applyRaceProjectToConfig(config, raceProject)
      console.info('[projects] loaded race pack', { id: raceProject.id })
      hud.setBootMessage(`project: ${raceProject.id}`)
      hud.setActiveRaceId(raceProject.id)
    } catch (err) {
      console.warn(
        '[projects] race pack load failed; continuing with config.json',
        err,
      )
      raceProject = null
    }
  }

  // CON: query overrides after config + pack; before origin / ingest (token not validated).
  applyDeeplinkToBoot(config, deeplink)
  replayUrl = config.replayUrl
  courseUrl = config.courseUrl
  sponsorsUrl = config.sponsorsUrl
  flagsUrl = config.flagsUrl
  boatNamesUrl = config.boatNamesUrl
  boatIds = config.boatIds
  povIds = config.povIds
  // Bases only — strip any id/type from config; default to VPS if empty.
  wsUrl = stripLiveWsId(config.wsUrl) || DEFAULT_LIVE_WS_BASE
  wsBoatUrl = stripLiveWsId(config.wsBoatUrl) || DEFAULT_LIVE_WS_BASE

  // Ops Fleet panel session overlays config (URLs / ids) without editing files.
  const sessionFleet = loadFleetLiveFromSession()
  if (sessionFleet) {
    if (typeof sessionFleet.wsUrl === 'string') {
      wsUrl = stripLiveWsId(sessionFleet.wsUrl) || DEFAULT_LIVE_WS_BASE
    }
    if (typeof sessionFleet.wsBoatUrl === 'string') {
      wsBoatUrl =
        stripLiveWsId(sessionFleet.wsBoatUrl) || DEFAULT_LIVE_WS_BASE
    }
    if (sessionFleet.boatIds?.length) boatIds = [...sessionFleet.boatIds]
    if (sessionFleet.povIds?.length) povIds = [...sessionFleet.povIds]
    // Enabled-for-live subset (may be empty — do not reopen full default fleet).
    if (Array.isArray(sessionFleet.enabledBoatIds)) {
      liveBoatIds = sessionFleet.enabledBoatIds.filter((id) =>
        boatIds.includes(id),
      )
    }
    if (Array.isArray(sessionFleet.enabledPovIds)) {
      livePovIds = sessionFleet.enabledPovIds.filter((id) =>
        povIds.includes(id),
      )
    }
  }

  chromaKey = config.chromaKey
  const outputMode = normalizeOutputMode(config.outputMode)
  const clear = resolveClearAppearance(outputMode, {
    chromaKey: chromaKey || undefined,
  })
  applyOutputModeChrome(outputMode)

  // Scene after config so boatIds / povIds allow-lists are known before first poses.
  // Clear color from OUT (preview / chroma / transparent).
  // Electron studio: lock WebGL/NDI to 1920×1080; main-process clock when minimized.
  const studioBridge = getStudioBridge()
  scene = startScene({
    container: app,
    boatIds,
    povIds,
    clearColor: clear.color,
    ...(studioBridge
      ? {
          outputSize: {
            width: STUDIO_OUTPUT_WIDTH,
            height: STUDIO_OUTPUT_HEIGHT,
          },
          frameClock: {
            subscribe: (onTick) => studioBridge.onStudioTick(onTick),
          },
        }
      : {}),
  })
  if (studioBridge) {
    console.info(
      `[boot] studio shell: output locked ${STUDIO_OUTPUT_WIDTH}×${STUDIO_OUTPUT_HEIGHT}; main-process tick clock (minimize-safe)`,
    )
  }
  applyOutputMode(scene.renderer, outputMode, {
    chromaKey: chromaKey || undefined,
  })
  const activePov = scene.getActivePovId()
  hud.setPovIds(povIds, activePov)
  calib?.setPovIds(povIds, activePov)

  // Ops sidebar (above mode/POV) — not fixed canvas chrome.
  outputControl = startOutputModeControl({
    container: opsSectionEl,
    mountAt: 'start',
    initialMode: outputMode,
    onChange: (mode) => {
      if (!scene) return
      applyOutputMode(scene.renderer, mode, {
        chromaKey: chromaKey || undefined,
      })
      applyOutputModeChrome(mode)
      whepUnderlay?.setMode(mode)
    },
  })

  // Video still under the WebGL canvas on `app`; WHEP status attaches to the
  // sidebar output-mode control (looked up after mount above).
  whepUnderlay = startWhepUnderlay({
    container: app,
    whepUrl: config.whepUrl,
    initialMode: outputMode,
    renderer: scene.renderer,
  })

  if (config.timecodeEnabled && scene) {
    const sceneHandle = scene
    visualTimecode = startVisualTimecode({
      renderer: sceneHandle.renderer,
      getActivePovId: () => sceneHandle.getActivePovId(),
      enabled: true,
      corner: config.timecodeCorner as TimecodeCorner,
      sizePx: config.timecodeSizePx,
    })
  }

  // Electron studio only — after timecode wrap so barcode is in readback.
  // Air lock: NDI always captures active POV (dual-render if preview ≠ air).
  ndiPump = startNdiFramePump({
    renderer: scene.renderer,
    getAirCamera: () => scene?.getActivePovCamera() ?? null,
    prepareCameraPass: (camera) => {
      scene?.orientOpsBillboards(camera)
    },
  })

  hud.setBootMessage(
    raceProject ? `project: ${raceProject.id} · EGM96…` : 'boot: EGM96…',
  )
  await ensureEgm96Loaded()
  applyConfigOrigin(config.origin)
  hud.setOrigin(config.origin)

  // Shared GPS→ENU layout: one list for 2D map + editor.
  const world = await loadWorldForProject(raceProject)
  currentWorldFeatures = cloneWorldFeatures(world)
  const layout = layoutFeatures(currentWorldFeatures, gpsToEnu)
  setLayoutFeatures(layout)
  hud.setLayoutFeatures(layout)
  if (raceProject) {
    hud.setBootMessage(`project: ${raceProject.id}`)
    const streamTitle = raceProject.name.trim()
    hud.getStreamMap().setTitle(streamTitle || 'Race map')
  }

  const projectIdDefault = raceProject?.id ?? defaultEditedRaceId()
  const projectNameDefault = raceProject?.name ?? 'Edited race'

  // World Authoring workspace — large map + tool palette (SCN-04).
  // Editor role defaults open; air closed; ?editor=1|0 overrides.
  const authoringOpen = resolveAuthoringInitiallyOpen(projectWritesEnabled)
  syncMapGeoBridge({ ops: hud.getMap(), stream: hud.getStreamMap() })
  mapEditor = startMapFeatureEditor({
    container: authoringShell.getToolsHost(),
    map: hud.getMap(),
    initialFeatures: currentWorldFeatures,
    gpsToEnuAmsl: gpsToEnu,
    enuToGpsAmsl: (east, up, north) => {
      const g = enuToGpsAmsl(east, up, north)
      return { lat: g.lat, lon: g.lon, alt: g.alt }
    },
    initiallyOpen: false,
    mapSizeOpen: WORLD_AUTHORING_MAP_SIZE,
    getMapSizeOpen: () => authoringShell.getMapSizePx(),
    showPanelTitle: false,

    groupedTools: true,
    initialProjectId: projectIdDefault,
    initialProjectName: projectNameDefault,
    projectWritesEnabled,
    knownBuoyIds: bootConfig?.buoyIds ?? [],
    onApply: async (features) => {
      currentWorldFeatures = cloneWorldFeatures(features)
      await scene?.remountWorldFromFeatures(features)
      assetInspector?.refresh()
      authoringShell.setStatus(
        `Authoring: open · ${features.length} feature(s)`,
      )
    },
    onSaveProject: (meta) => {
      // Editor id/name fields → Save as semantics (explicit pack identity).
      void saveCurrentRaceProject({ meta, mode: 'saveAs' })
    },
    onSetAnchor: (lat, lon, altMsl) => {
      void applyWorldOrigin({ lat, lon, altMsl })
    },
    onPlaceFleet: (kind, east, north, id) => {
      const g = enuToGpsAmsl(east, 0, north)
      if (kind === 'boat') {
        fleetPanel?.addBoat({
          id,
          plannedLat: g.lat,
          plannedLon: g.lon,
        })
      } else {
        fleetPanel?.addDrone({
          id,
          plannedLat: g.lat,
          plannedLon: g.lon,
        })
      }
      seedPlannedFleetOnMap(
        hud.getMap(),
        kind === 'boat'
          ? [{ id, plannedLat: g.lat, plannedLon: g.lon }]
          : [],
        kind === 'drone'
          ? [{ id, plannedLat: g.lat, plannedLon: g.lon }]
          : [],
      )
    },
  })
  // Maximize / map-resize should re-layout the canvas backing store while open.
  authoringShell.onMapSizeChange(() => {
    if (authoringShell.isOpen()) mapEditor?.resyncChrome()
  })
  const maxBtn = authoringShell.root.querySelector(
    '.world-authoring__max-btn',
  )
  maxBtn?.addEventListener('click', () => {
    mapEditor?.resyncChrome()
  })

  authoringShell.setOpen(authoringOpen)
  hud.setEditorOpen(authoringOpen, false)
  if (authoringOpen) {
    authoringShell.setStatus(
      `Authoring: open · ${currentWorldFeatures.length} feature(s)`,
    )
  }

  // Local pack picker — static/API index + cached venue packs
  try {
    await refreshRacePicker(raceProject?.id)
  } catch {
    hud.setRaceIds(['demo-istanbul'], raceProject?.id ?? 'demo-istanbul')
  }

  // Name/colour catalogue — before TEL so first boat spawn can resolve tags.
  await scene.loadBoatNamesFromUrl(boatNamesUrl)
  if (sessionFleet?.boats?.length) {
    for (const b of sessionFleet.boats) {
      scene.upsertBoatName({
        id: b.id,
        name: b.name,
        category: b.category,
      })
    }
  }
  // Soft pack field (if boot race had boatVisibility) — session boats win after.
  if (raceProject?.fleet.boatVisibility) {
    scene.setBoatVisibilityModes(raceProject.fleet.boatVisibility)
  }
  if (raceProject?.fleet.povMapVisible) {
    for (const [id, v] of Object.entries(raceProject.fleet.povMapVisible)) {
      if (typeof v === 'boolean') povMapVisible.set(id, v)
    }
  }
  syncMapBoatDotColors()

  const packBoatMap = raceProject?.fleet.boatMapVisible ?? {}
  fleetPanel = startFleetLivePanel({
    container: liveSectionEl,
    initial: {
      wsUrl,
      wsBoatUrl,
      boatIds: [...boatIds],
      povIds: [...povIds],
      enabledBoatIds: [...liveBoatIds],
      enabledPovIds: [...livePovIds],
      boats:
        sessionFleet?.boats?.length && sessionFleet.boats.length > 0
          ? sessionFleet.boats.map((b) => ({
              ...b,
              mapVisible:
                b.mapVisible === false || packBoatMap[b.id] === false
                  ? false
                  : b.mapVisible,
            }))
          : [...scene.getBoatNamesCatalogue().entries()].map(([id, e]) => ({
              id,
              name: e.name,
              category: e.category,
              visibility:
                raceProject?.fleet.boatVisibility?.[id] ?? 'solid',
              mapVisible: packBoatMap[id] === false ? false : undefined,
            })),
      activePovId: scene.getActivePovId(),
      plannedPovs: sessionFleet?.plannedPovs?.map((p) => ({ ...p })) ?? [],
    },
    onFleetChange: ({ boatIds: nextBoats, povIds: nextPovs, boats }) => {
      boatIds = nextBoats
      povIds = nextPovs
      liveBoatIds = liveBoatIds.filter((id) => boatIds.includes(id))
      livePovIds = livePovIds.filter((id) => povIds.includes(id))
      if (bootConfig) {
        bootConfig.boatIds = [...nextBoats]
        bootConfig.povIds = [...nextPovs]
      }
      for (const b of boats) {
        scene?.upsertBoatName({
          id: b.id,
          name: b.name,
          category: b.category,
        })
      }
      syncMapBoatDotColors()
      syncBoatVisibilityToScene(boats)
      syncMapHiddenPoseIds()
      applyFleetToScene()
      assetInspector?.refresh()
    },
    onBoatVisibilityChange: (id, mode) => {
      scene?.setBoatVisibilityMode(id, mode)
      assetInspector?.refresh()
    },
    onPovChange: (id) => {
      scene?.setActivePovId(id)
      calib?.setDeviceId(id)
      hud.setActivePovId(id)
    },
    onOpsViewChange: (mode) => {
      scene?.setOpsViewMode(mode)
      hud.setOpsViewMode(mode)
    },
    onFrameFleet: () => {
      const n = scene?.frameFleet() ?? 0
      hud.setOpsViewMode('free')
      fleetPanel?.setOpsViewMode('free')
      fleetPanel?.setStatus(
        n > 0
          ? `framed ${n} boat(s) — orbit with free cam`
          : 'no boat meshes yet — need packets + boat id in fleet (check HUD ENU)',
      )
    },
    onLiveApply: ({
      wsUrl: nextWs,
      wsBoatUrl: nextBoatWs,
      boatIds: enabledBoats,
      povIds: enabledPovs,
      goLive,
    }) => {
      void (async () => {
        if (switching) return
        switching = true
        try {
          wsUrl = nextWs
          wsBoatUrl = nextBoatWs
          // Connect uses enabled ids only — do not replace scene registry.
          liveBoatIds = [...enabledBoats]
          livePovIds = [...enabledPovs]
          await restartIngest(goLive ? 'live' : undefined)
          fleetPanel?.setStatus(
            goLive
              ? `live · ${liveBoatIds.length} boat + ${livePovIds.length} drone socket(s) · open ≠ packets`
              : `reconnected · mode=${ingest?.mode ?? '?'}`,
          )
        } finally {
          switching = false
        }
      })()
    },
  })
  // Session / pack visibility → scene (entities spawn on first pose).
  syncBoatVisibilityToScene(fleetPanel.getState().boats)
  syncMapHiddenPoseIds()
  seedPlannedFleetOnMap(
    hud.getMap(),
    fleetPanel.getState().boats,
    fleetPanel.getState().plannedPovs ?? [],
  )

  assetInspector = startAssetInspector({
    container: assetsSectionEl,
    projectsApiBase: config.projectsApiBase,
    getBoats: () => fleetPanel?.getState().boats ?? [],
    getBoatIds: () => fleetPanel?.getState().boatIds ?? boatIds,
    getPovIds: () => fleetPanel?.getState().povIds ?? povIds,
    getFeatures: () => mapEditor?.getFeatures() ?? currentWorldFeatures,
    gpsToEnuAmsl: gpsToEnu,
    getBoatMapVisible: (id) => {
      const row = fleetPanel?.getState().boats.find((b) => b.id === id)
      return row?.mapVisible !== false
    },
    getPovMapVisible: (id) => povMapVisible.get(id) !== false,
    getPovVisible3d: (id) => povVisible3d.get(id) !== false,
    onFocus: focusAssetRow,
    onBoatVisibilityChange: (id, mode) => {
      scene?.setBoatVisibilityMode(id, mode)
      const state = fleetPanel?.getState()
      if (!state) return
      const boats = state.boats.map((b) =>
        b.id === id ? { ...b, visibility: mode } : b,
      )
      // Ensure row exists
      if (!boats.some((b) => b.id === id)) {
        boats.push({
          id,
          name: id,
          category: '',
          visibility: mode,
        })
      }
      fleetPanel?.setState({ boats })
      assetInspector?.refresh()
    },
    onBoatMapVisibleChange: (id, visible) => {
      const state = fleetPanel?.getState()
      if (!state) return
      const boats = state.boats.map((b) =>
        b.id === id
          ? { ...b, mapVisible: visible ? undefined : false }
          : b,
      )
      if (!boats.some((b) => b.id === id)) {
        boats.push({
          id,
          name: id,
          category: '',
          mapVisible: visible ? undefined : false,
        })
      }
      fleetPanel?.setState({ boats })
      syncMapHiddenPoseIds()
      assetInspector?.refresh()
    },
    onPovMapVisibleChange: (id, visible) => {
      if (visible) povMapVisible.delete(id)
      else povMapVisible.set(id, false)
      syncMapHiddenPoseIds()
      assetInspector?.refresh()
    },
    onPovVisible3dChange: (id, visible) => {
      if (visible) povVisible3d.delete(id)
      else povVisible3d.set(id, false)
      assetInspector?.refresh()
    },
    onFeaturePatch: patchWorldFeature,
    onOpenBoatDetails: (id) => {
      fleetPanel?.highlightBoat(id)
    },
  })

  // Boot live uses enabled lists (often empty until Connect); mock/replay use registry.
  const bootLive = config.telemetryMode === 'live'
  ingest = await startTelemetryIngest({
    mode: config.telemetryMode,
    replayUrl: config.replayUrl,
    boatIds: bootLive ? liveBoatIds : boatIds,
    povIds: bootLive ? livePovIds : povIds,
    wsUrl,
    wsBoatUrl,
  })
  startPosePipeline({ takeoffAltitudeMSL: config.takeoffAltitudeMSL })
  applyIngestConnectionStatus(ingest)
  hud.setMode(config.telemetryMode)

  window.addEventListener('beforeunload', () => {
    stopPosePipeline()
    clearLiveStatusSub()
    ingest?.stop()
    ndiController?.dispose()
    ndiController = null
    ndiPump?.stop()
    ndiPump = null
    visualTimecode?.stop()
    visualTimecode = null
    whepUnderlay?.stop()
    whepUnderlay = null
    calib?.stop()
    calib = null
    outputControl?.stop()
    mapEditor?.dispose()
    mapEditor = null
    worldAuthoring?.dispose()
    worldAuthoring = null
    fleetPanel?.stop()
    fleetPanel = null
    hud.stop()
    opsSidebar.dispose()
    scene?.stop()
  })
})()
