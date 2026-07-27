import './style.css'
import { startOffsetSliders } from './calibration/index.ts'
import { loadConfig } from './config/index.ts'
import { applyConfigOrigin, ensureEgm96Loaded } from './geodesy/index.ts'
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
let replayUrl = '/fixtures/telemetry/spine-demo.json'
let courseUrl = '/fixtures/course/demo-istanbul.json'
let boatIds: string[] = ['21', '22', '23', '24']
let switching = false

const hud = startStubHud({
  container: app,
  onModeChange: (mode) => {
    void (async () => {
      if (switching) return
      switching = true
      try {
        ingest?.stop()
        ingest = await startTelemetryIngest({ mode, replayUrl, boatIds })
        hud.setMode(mode)
      } finally {
        switching = false
      }
    })()
  },
})

void (async () => {
  const config = await loadConfig()
  replayUrl = config.replayUrl
  courseUrl = config.courseUrl
  boatIds = config.boatIds

  // Scene after config so boatIds allow-list is known before first poses.
  scene = startScene({ container: app, boatIds: config.boatIds })

  hud.setBootMessage('boot: EGM96…')
  await ensureEgm96Loaded()
  applyConfigOrigin(config.origin)

  // Course needs origin + EGM96 (gpsToEnuAmsl). Static — not poseBus-driven.
  const course = await scene.loadCourseFromUrl(courseUrl)
  if (course) hud.setCourseMarks(course.mapPoints)

  ingest = await startTelemetryIngest({
    mode: config.telemetryMode,
    replayUrl: config.replayUrl,
    boatIds: config.boatIds,
  })
  startPosePipeline({ takeoffAltitudeMSL: config.takeoffAltitudeMSL })
  hud.setMode(config.telemetryMode)

  window.addEventListener('beforeunload', () => {
    stopPosePipeline()
    ingest?.stop()
    calib.stop()
    hud.stop()
    scene?.stop()
  })
})()
