import './style.css'
import { startOffsetSliders } from './calibration/index.ts'
import { loadConfig } from './config/index.ts'
import { applyConfigOrigin, ensureEgm96Loaded } from './geodesy/index.ts'
import {
  applyOutputMode,
  normalizeOutputMode,
  resolveClearAppearance,
  startOutputModeControl,
  startVisualTimecode,
  type OutputModeControlHandle,
  type TimecodeCorner,
  type VisualTimecodeHandle,
} from './output/index.ts'
import { startPosePipeline, stopPosePipeline } from './pose/index.ts'
import { startScene, startStubHud, type SceneHandle } from './scene/index.ts'
import {
  startTelemetryIngest,
  type IngestHandle,
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
let replayUrl = '/fixtures/telemetry/spine-demo.json'
let courseUrl = '/fixtures/course/demo-istanbul.json'
let sponsorsUrl = '/fixtures/sponsors/demo-istanbul.json'
let flagsUrl = '/fixtures/flags/demo-istanbul-countdown.json'
let boatNamesUrl = '/fixtures/boats/demo-istanbul-names.json'
let boatIds: string[] = ['21', '22', '23', '24']
let povIds: string[] = ['1', '2']
let chromaKey = ''
let switching = false

const hud = startStubHud({
  container: app,
  onModeChange: (mode) => {
    void (async () => {
      if (switching) return
      switching = true
      try {
        ingest?.stop()
        ingest = await startTelemetryIngest({
          mode,
          replayUrl,
          boatIds,
          povIds,
        })
        hud.setMode(mode)
      } finally {
        switching = false
      }
    })()
  },
  onPovChange: (id) => {
    scene?.setActivePovId(id)
  },
  onCountdownControl: (action) => {
    scene?.controlCountdown(action)
  },
})

void (async () => {
  const config = await loadConfig()
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
  hud.setPovIds(config.povIds, scene.getActivePovId())

  outputControl = startOutputModeControl({
    container: app,
    initialMode: outputMode,
    onChange: (mode) => {
      if (!scene) return
      applyOutputMode(scene.renderer, mode, {
        chromaKey: chromaKey || undefined,
      })
    },
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

  hud.setBootMessage('boot: EGM96…')
  await ensureEgm96Loaded()
  applyConfigOrigin(config.origin)

  // Course + sponsors + flags need origin + EGM96 (gpsToEnuAmsl). Static — not poseBus-driven.
  const course = await scene.loadCourseFromUrl(courseUrl)
  if (course) hud.setCourseMarks(course.mapPoints)
  await scene.loadSponsorsFromUrl(sponsorsUrl)
  await scene.loadCountdownFlagsFromUrl(flagsUrl)

  ingest = await startTelemetryIngest({
    mode: config.telemetryMode,
    replayUrl: config.replayUrl,
    boatIds: config.boatIds,
    povIds: config.povIds,
  })
  startPosePipeline({ takeoffAltitudeMSL: config.takeoffAltitudeMSL })
  hud.setMode(config.telemetryMode)

  window.addEventListener('beforeunload', () => {
    stopPosePipeline()
    ingest?.stop()
    visualTimecode?.stop()
    visualTimecode = null
    calib.stop()
    outputControl?.stop()
    hud.stop()
    scene?.stop()
  })
})()
