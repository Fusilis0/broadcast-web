import './style.css'
import { startOffsetSliders } from './calibration/index.ts'
import { loadConfig } from './config/index.ts'
import { applyConfigOrigin, ensureEgm96Loaded } from './geodesy/index.ts'
import { startPosePipeline, stopPosePipeline } from './pose/index.ts'
import { startScene, startStubHud } from './scene/index.ts'
import {
  startTelemetryIngest,
  type IngestHandle,
} from './telemetry/index.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('#app root missing')
}

const scene = startScene({ container: app })
const calib = startOffsetSliders({ container: app })

let ingest: IngestHandle | null = null
let replayUrl = '/fixtures/telemetry/spine-demo.json'
let switching = false

const hud = startStubHud({
  container: app,
  onModeChange: (mode) => {
    void (async () => {
      if (switching) return
      switching = true
      try {
        ingest?.stop()
        ingest = await startTelemetryIngest({ mode, replayUrl })
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
  hud.setBootMessage('boot: EGM96…')
  await ensureEgm96Loaded()
  applyConfigOrigin(config.origin)

  ingest = await startTelemetryIngest({
    mode: config.telemetryMode,
    replayUrl: config.replayUrl,
  })
  startPosePipeline({ takeoffAltitudeMSL: config.takeoffAltitudeMSL })
  hud.setMode(config.telemetryMode)

  window.addEventListener('beforeunload', () => {
    stopPosePipeline()
    ingest?.stop()
    calib.stop()
    hud.stop()
    scene.stop()
  })
})()
