import './style.css'
import { startOffsetSliders } from './calibration/index.ts'
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
  defaultEditedRaceId,
  downloadRaceProject,
  isSafeRaceId,
  listLocalRaceIds,
  loadRaceProject,
  writeRaceProject,
  WriteRaceProjectError,
  type RaceProject,
} from './projects/index.ts'
import {
  applyOutputMode,
  getStudioBridge,
  normalizeOutputMode,
  resolveClearAppearance,
  startNdiFramePump,
  startOutputModeControl,
  startVisualTimecode,
  startWhepUnderlay,
  STUDIO_OUTPUT_HEIGHT,
  STUDIO_OUTPUT_WIDTH,
  type NdiFramePumpHandle,
  type OutputModeControlHandle,
  type TimecodeCorner,
  type VisualTimecodeHandle,
  type WhepUnderlayHandle,
} from './output/index.ts'
import { startPosePipeline, stopPosePipeline } from './pose/index.ts'
import {
  layoutFeatures,
  loadFleetLiveFromSession,
  setLayoutFeatures,
  startFleetLivePanel,
  startMapFeatureEditor,
  startScene,
  startStubHud,
  type FleetLivePanelHandle,
  type MapFeatureEditorHandle,
  type SceneHandle,
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

const calib = startOffsetSliders({ container: app })

let scene: SceneHandle | null = null
let ingest: IngestHandle | null = null
let outputControl: OutputModeControlHandle | null = null
let visualTimecode: VisualTimecodeHandle | null = null
let whepUnderlay: WhepUnderlayHandle | null = null
let ndiPump: NdiFramePumpHandle | null = null
let mapEditor: MapFeatureEditorHandle | null = null
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
let fleetPanel: FleetLivePanelHandle | null = null
let liveStatusPoll: ReturnType<typeof setInterval> | null = null

function editorQueryOpen(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('editor') === '1'
  } catch {
    return false
  }
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
  calib.setPovIds(povIds, active)
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

function promptSaveAsMeta(defaults: {
  id: string
  name: string
}): { id: string; name: string } | null {
  const idRaw = window.prompt('Save as — project id', defaults.id)
  if (idRaw === null) return null
  const id = idRaw.trim()
  if (!isSafeRaceId(id)) {
    window.alert(
      'Invalid project id. Use letters, digits, dash, underscore (see RaceProject contract).',
    )
    return null
  }
  const nameRaw = window.prompt('Save as — display name', defaults.name || id)
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
    hud.setRaceIds(ids, activeId ?? raceProject?.id ?? ids[0])
  } catch {
    /* keep existing picker */
  }
}

async function maybeWriteRaceProjectApi(
  project: RaceProject,
  mode: 'save' | 'saveAs',
): Promise<RaceProject | null> {
  const config = bootConfig
  const apiBase = config?.projectsApiBase?.trim()
  if (!apiBase) return null

  try {
    if (mode === 'saveAs') {
      try {
        return await writeRaceProject(project, {
          projectsApiBase: apiBase,
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
          projectsApiBase: apiBase,
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
          projectsApiBase: apiBase,
          mode: 'create',
        })
      }
    }

    if (expectedRevision === undefined) {
      return await writeRaceProject(project, {
        projectsApiBase: apiBase,
        mode: 'create',
      })
    }

    try {
      return await writeRaceProject(project, {
        projectsApiBase: apiBase,
        mode: 'update',
        expectedRevision,
      })
    } catch (err) {
      if (err instanceof WriteRaceProjectError && err.status === 404) {
        return await writeRaceProject(project, {
          projectsApiBase: apiBase,
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

  try {
    const project = buildRaceProject({
      id,
      name,
      origin: { ...config.origin },
      boatIds,
      povIds,
      features,
      takeoffAltitudeMSL: config.takeoffAltitudeMSL,
      boatNamesUrl: boatNamesUrl || config.boatNamesUrl,
      courseUrl: courseUrl || config.courseUrl,
      sponsorsUrl: sponsorsUrl || config.sponsorsUrl,
      flagsUrl: flagsUrl || config.flagsUrl,
      replayUrl: replayUrl || config.replayUrl,
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

function saveAsRaceProject(): void {
  const defaults = {
    id: defaultEditedRaceId(),
    name: raceProject?.name ? `${raceProject.name} (copy)` : 'Edited race',
  }
  const meta = promptSaveAsMeta(defaults)
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
    return world
  }
  const course = await scene.loadCourseFromUrl(courseUrl)
  const sponsors = await scene.loadSponsorsFromUrl(sponsorsUrl)
  const flags = await scene.loadCountdownFlagsFromUrl(flagsUrl)
  return [
    ...(course?.worldFeatures ?? []),
    ...(sponsors?.worldFeatures ?? []),
    ...(flags?.worldFeatures ?? []),
  ]
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

    const world = await loadWorldForProject(project)
    await applyWorldFeatures(world)

    mapEditor?.setProjectMeta(project.id, project.name)
    hud.setActiveRaceId(project.id)
    // Scene allow-lists are boot-time unless refreshed here (soft switch).
    const activePov = scene.setFleetAllowLists({
      boatIds: config.boatIds,
      povIds: config.povIds,
    })
    hud.setPovIds(config.povIds, activePov)
    calib.setPovIds(config.povIds, activePov)
    syncRaceQuery(project.id)

    // Pack load restores registry; keep live-enabled subsets within new allow-lists.
    liveBoatIds = liveBoatIds.filter((id) => boatIds.includes(id))
    livePovIds = livePovIds.filter((id) => povIds.includes(id))

    await restartIngest(ingest?.mode ?? config.telemetryMode)
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
      })),
    })
    hud.setBootMessage(`project: ${project.id}`)
    console.info('[projects] switched race pack', { id: project.id })
  } catch (err) {
    console.warn('[projects] race pack switch failed', err)
    hud.setBootMessage(`project load failed: ${trimmed}`)
  } finally {
    switchingRace = false
  }
}

const hud = startStubHud({
  container: app,
  editorInitiallyOpen: editorQueryOpen(),
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
    calib.setDeviceId(id)
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
    mapEditor?.setOpen(open)
  },
  onRaceLoad: (id) => {
    void switchRace(id)
  },
  onSaveProject: () => {
    void saveCurrentRaceProject({ mode: 'save' })
  },
  onSaveAsProject: () => {
    saveAsRaceProject()
  },
  onOriginApply: (origin) => {
    void applyWorldOrigin(origin)
  },
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
  calib.setPovIds(povIds, activePov)

  outputControl = startOutputModeControl({
    container: app,
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
  }

  const projectIdDefault = raceProject?.id ?? defaultEditedRaceId()
  const projectNameDefault = raceProject?.name ?? 'Edited race'

  // V1 map feature editor — seeded from adapters; edits re-layout + remount 3D.
  mapEditor = startMapFeatureEditor({
    container: app.querySelector('.ops-overlay') ?? app,
    map: hud.getMap(),
    initialFeatures: currentWorldFeatures,
    gpsToEnuAmsl: gpsToEnu,
    enuToGpsAmsl: (east, up, north) => {
      const g = enuToGpsAmsl(east, up, north)
      return { lat: g.lat, lon: g.lon, alt: g.alt }
    },
    initiallyOpen: editorQueryOpen(),
    initialProjectId: projectIdDefault,
    initialProjectName: projectNameDefault,
    onApply: async (features) => {
      currentWorldFeatures = cloneWorldFeatures(features)
      await scene?.remountWorldFromFeatures(features)
    },
    onSaveProject: (meta) => {
      // Editor id/name fields → Save as semantics (explicit pack identity).
      void saveCurrentRaceProject({ meta, mode: 'saveAs' })
    },
  })
  hud.setEditorOpen(editorQueryOpen())

  // Local pack picker — manifest under /races/index.json
  try {
    const ids = await listLocalRaceIds({
      projectsApiBase: config.projectsApiBase,
    })
    hud.setRaceIds(ids, raceProject?.id ?? ids[0])
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

  fleetPanel = startFleetLivePanel({
    container: app,
    initial: {
      wsUrl,
      wsBoatUrl,
      boatIds: [...boatIds],
      povIds: [...povIds],
      enabledBoatIds: [...liveBoatIds],
      enabledPovIds: [...livePovIds],
      boats:
        sessionFleet?.boats?.length && sessionFleet.boats.length > 0
          ? sessionFleet.boats.map((b) => ({ ...b }))
          : [...scene.getBoatNamesCatalogue().entries()].map(([id, e]) => ({
              id,
              name: e.name,
              category: e.category,
            })),
      activePovId: scene.getActivePovId(),
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
      applyFleetToScene()
    },
    onPovChange: (id) => {
      scene?.setActivePovId(id)
      calib.setDeviceId(id)
      hud.setActivePovId(id)
    },
    onOpsViewChange: (mode) => {
      scene?.setOpsViewMode(mode)
      hud.setOpsViewMode(mode)
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
    ndiPump?.stop()
    ndiPump = null
    visualTimecode?.stop()
    visualTimecode = null
    whepUnderlay?.stop()
    whepUnderlay = null
    calib.stop()
    outputControl?.stop()
    mapEditor?.dispose()
    mapEditor = null
    fleetPanel?.stop()
    fleetPanel = null
    hud.stop()
    scene?.stop()
  })
})()
