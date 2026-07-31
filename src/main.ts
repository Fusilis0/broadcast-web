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
} from './geodesy/index.ts'
import {
  applyRaceProjectToConfig,
  buildRaceProject,
  defaultEditedRaceId,
  downloadRaceProject,
  isSafeRaceId,
  listLocalRaceIds,
  loadRaceProject,
  type RaceProject,
} from './projects/index.ts'
import {
  applyOutputMode,
  normalizeOutputMode,
  resolveClearAppearance,
  startOutputModeControl,
  startVisualTimecode,
  startWhepUnderlay,
  type OutputModeControlHandle,
  type TimecodeCorner,
  type VisualTimecodeHandle,
  type WhepUnderlayHandle,
} from './output/index.ts'
import { startPosePipeline, stopPosePipeline } from './pose/index.ts'
import {
  layoutFeatures,
  setLayoutFeatures,
  startMapFeatureEditor,
  startScene,
  startStubHud,
  type MapFeatureEditorHandle,
  type SceneHandle,
  type WorldFeature,
} from './scene/index.ts'
import {
  startTelemetryIngest,
  type IngestHandle,
  type LiveWsStatus,
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
let chromaKey = ''
let switching = false
let switchingRace = false

function editorQueryOpen(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('editor') === '1'
  } catch {
    return false
  }
}

function clearLiveStatusSub(): void {
  unsubLiveStatus?.()
  unsubLiveStatus = null
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

function saveCurrentRaceProject(meta?: { id?: string; name?: string }): void {
  const config = bootConfig
  if (!config) {
    console.warn('[projects] save skipped; config not ready')
    return
  }
  const features =
    mapEditor?.getFeatures() ?? currentWorldFeatures
  const id =
    meta?.id?.trim() ||
    raceProject?.id ||
    defaultEditedRaceId()
  if (!isSafeRaceId(id)) {
    console.warn('[projects] save skipped; invalid race id', id)
    hud.setBootMessage(`save failed: invalid id`)
    return
  }
  const name =
    meta?.name?.trim() ||
    raceProject?.name ||
    id
  try {
    const project = buildRaceProject({
      id,
      name,
      origin: config.origin,
      boatIds: config.boatIds,
      povIds: config.povIds,
      features,
      takeoffAltitudeMSL: config.takeoffAltitudeMSL,
      boatNamesUrl: config.boatNamesUrl,
      courseUrl: config.courseUrl,
      sponsorsUrl: config.sponsorsUrl,
      flagsUrl: config.flagsUrl,
      replayUrl: config.replayUrl,
      revision: raceProject?.revision,
      output: {
        outputMode: config.outputMode,
        whepUrl: config.whepUrl || undefined,
        chromaKey: config.chromaKey || undefined,
        timecodeEnabled: config.timecodeEnabled,
        timecodeCorner: config.timecodeCorner,
        timecodeSizePx: config.timecodeSizePx,
      },
    })
    downloadRaceProject(project)
    mapEditor?.setProjectMeta(project.id, project.name)
    hud.setActiveRaceId(project.id)
    console.info('[projects] downloaded RaceProject', {
      id: project.id,
      features: project.features?.length ?? 0,
    })
  } catch (err) {
    console.warn('[projects] save/download failed', err)
    hud.setBootMessage('save failed')
  }
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
    const project = await loadRaceProject(trimmed)
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
    await scene.loadBoatNamesFromUrl(boatNamesUrl)

    const world = await loadWorldForProject(project)
    await applyWorldFeatures(world)

    mapEditor?.setProjectMeta(project.id, project.name)
    hud.setActiveRaceId(project.id)
    hud.setPovIds(config.povIds, scene.getActivePovId())
    calib.setPovIds(config.povIds, scene.getActivePovId())
    syncRaceQuery(project.id)

    clearLiveStatusSub()
    ingest?.stop()
    ingest = await startTelemetryIngest({
      mode: ingest?.mode ?? config.telemetryMode,
      replayUrl: config.replayUrl,
      boatIds: config.boatIds,
      povIds: config.povIds,
    })
    applyIngestConnectionStatus(ingest)
    hud.setMode(ingest.mode)
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
        clearLiveStatusSub()
        ingest?.stop()
        ingest = await startTelemetryIngest({
          mode,
          replayUrl,
          boatIds,
          povIds,
        })
        applyIngestConnectionStatus(ingest)
        hud.setMode(mode)
      } finally {
        switching = false
      }
    })()
  },
  onPovChange: (id) => {
    scene?.setActivePovId(id)
    calib.setDeviceId(id)
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
    saveCurrentRaceProject()
  },
})

function applyIngestConnectionStatus(handle: IngestHandle): void {
  clearLiveStatusSub()
  if (handle.mode === 'live' && handle.getLiveStatus && handle.onLiveStatus) {
    const channels = { ...handle.getLiveStatus() }
    hud.setConnectionStatus({ kind: 'live', channels })
    unsubLiveStatus = handle.onLiveStatus((channel, status: LiveWsStatus) => {
      channels[channel] = status
      hud.setConnectionStatus({
        kind: 'live',
        channels: { drone: channels.drone, boat: channels.boat },
      })
    })
    return
  }
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
      raceProject = await loadRaceProject(deeplink.race)
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

  chromaKey = config.chromaKey
  const outputMode = normalizeOutputMode(config.outputMode)
  const clear = resolveClearAppearance(outputMode, {
    chromaKey: chromaKey || undefined,
  })

  // Scene after config so boatIds / povIds allow-lists are known before first poses.
  // Clear color from OUT (preview dark / chroma green).
  scene = startScene({
    container: app,
    boatIds: config.boatIds,
    povIds: config.povIds,
    clearColor: clear.color,
  })
  applyOutputMode(scene.renderer, outputMode, {
    chromaKey: chromaKey || undefined,
  })
  const activePov = scene.getActivePovId()
  hud.setPovIds(config.povIds, activePov)
  calib.setPovIds(config.povIds, activePov)

  outputControl = startOutputModeControl({
    container: app,
    initialMode: outputMode,
    onChange: (mode) => {
      if (!scene) return
      applyOutputMode(scene.renderer, mode, {
        chromaKey: chromaKey || undefined,
      })
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

  // Name/colour catalogue — before TEL so first boat spawn can resolve tags.
  await scene.loadBoatNamesFromUrl(boatNamesUrl)

  hud.setBootMessage(
    raceProject ? `project: ${raceProject.id} · EGM96…` : 'boot: EGM96…',
  )
  await ensureEgm96Loaded()
  applyConfigOrigin(config.origin)

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
      saveCurrentRaceProject(meta)
    },
  })
  hud.setEditorOpen(editorQueryOpen())

  // Local pack picker — manifest under /races/index.json
  try {
    const ids = await listLocalRaceIds()
    hud.setRaceIds(ids, raceProject?.id ?? ids[0])
  } catch {
    hud.setRaceIds(['demo-istanbul'], raceProject?.id ?? 'demo-istanbul')
  }

  ingest = await startTelemetryIngest({
    mode: config.telemetryMode,
    replayUrl: config.replayUrl,
    boatIds: config.boatIds,
    povIds: config.povIds,
  })
  startPosePipeline({ takeoffAltitudeMSL: config.takeoffAltitudeMSL })
  applyIngestConnectionStatus(ingest)
  hud.setMode(config.telemetryMode)

  window.addEventListener('beforeunload', () => {
    stopPosePipeline()
    clearLiveStatusSub()
    ingest?.stop()
    visualTimecode?.stop()
    visualTimecode = null
    whepUnderlay?.stop()
    whepUnderlay = null
    calib.stop()
    outputControl?.stop()
    mapEditor?.dispose()
    mapEditor = null
    hud.stop()
    scene?.stop()
  })
})()
