import './style.css'
import { startOffsetSliders } from './calibration/index.ts'
import { loadConfig } from './config/index.ts'
import { applyConfigOrigin, ensureEgm96Loaded } from './geodesy/index.ts'
import { startPosePipeline, stopPosePipeline } from './pose/index.ts'
import { startScene, startStubHud } from './scene/index.ts'
import { startTelemetryIngest } from './telemetry/index.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('#app root missing')
}

const scene = startScene({ container: app })
const hud = startStubHud({ container: app })
const calib = startOffsetSliders({ container: app })

void (async () => {
  const config = await loadConfig()
  hud.setBootMessage('boot: EGM96…')
  await ensureEgm96Loaded()
  applyConfigOrigin(config.origin)

  const ingest = await startTelemetryIngest({ mode: config.telemetryMode })
  startPosePipeline({ takeoffAltitudeMSL: config.takeoffAltitudeMSL })
  hud.setMode(config.telemetryMode)

  window.addEventListener('beforeunload', () => {
    stopPosePipeline()
    ingest.stop()
    calib.stop()
    hud.stop()
    scene.stop()
  })
})()
