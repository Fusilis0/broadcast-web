import './style.css'
import { loadConfig } from './config/index.ts'
import { applyConfigOrigin, ensureEgm96Loaded } from './geodesy/index.ts'
import { startPosePipeline, stopPosePipeline, poseBus } from './pose/index.ts'
import { startScene } from './scene/index.ts'
import { startTelemetryIngest, telemetryBus } from './telemetry/index.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('#app root missing')
}

const scene = startScene({ container: app })

const status = document.createElement('div')
status.style.cssText =
  'position:fixed;left:8px;bottom:8px;color:#bbb;font:12px/1.4 monospace;z-index:1;pointer-events:none;white-space:pre'
status.textContent = 'boot: loading config…'
app.appendChild(status)

const counts = { drone: 0, boat: 0, stream_anchor: 0 }
const lastEnu: {
  drone: string
  boat: string
} = { drone: '—', boat: '—' }

function fmtEnu(p: { x: number; y: number; z: number }): string {
  return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`
}

function renderStatus(mode: string): void {
  status.textContent =
    `telemetry ${mode}  drone=${counts.drone}  boat=${counts.boat}  stream_anchor=${counts.stream_anchor}\n` +
    `ENU m  drone=${lastEnu.drone}  boat=${lastEnu.boat}`
}

telemetryBus.on('drone', () => {
  counts.drone += 1
})
telemetryBus.on('boat', () => {
  counts.boat += 1
})
telemetryBus.on('stream_anchor', () => {
  counts.stream_anchor += 1
})

poseBus.on('pose', (p) => {
  const s = fmtEnu(p.position)
  if (p.kind === 'drone') lastEnu.drone = s
  else lastEnu.boat = s
})

void (async () => {
  const config = await loadConfig()
  status.textContent = 'boot: EGM96…'
  await ensureEgm96Loaded()
  applyConfigOrigin(config.origin)

  const ingest = await startTelemetryIngest({ mode: config.telemetryMode })
  startPosePipeline({ takeoffAltitudeMSL: config.takeoffAltitudeMSL })

  const refresh = (): void => {
    renderStatus(ingest.mode)
  }
  refresh()
  setInterval(refresh, 200)

  window.addEventListener('beforeunload', () => {
    stopPosePipeline()
    ingest.stop()
    scene.stop()
  })
})()
