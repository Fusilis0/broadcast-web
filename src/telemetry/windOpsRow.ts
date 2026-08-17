import { windBus, type WindBus } from './windBus.ts'
import {
  createDefaultWindFrame,
  formatWindSourceAge,
  msToKnots,
  parseOperatorWindInput,
} from './windDirection.ts'
import {
  getWindHoldMode,
  requestOpenMeteoPoll,
  setWindHoldMode,
  subscribeWindHoldMode,
} from './windOpenMeteo.ts'
import type { WindFrame } from './windTypes.ts'

export type WindOpsRowOptions = {
  container: HTMLElement
  bus?: WindBus
  /** Called after Follow API; default requests an Open-Meteo poll. */
  onFollowApi?: () => void
}

export type WindOpsRowHandle = {
  dispose: () => void
}

function formatFromDegField(directionFromDeg: number): string {
  return String(Math.round(directionFromDeg))
}

function formatSpeedKtField(speedMs: number): string {
  const kt = msToKnots(speedMs)
  return Number.isInteger(kt) ? String(kt) : kt.toFixed(1)
}

function fillFields(
  fromInput: HTMLInputElement,
  speedInput: HTMLInputElement,
  frame: WindFrame,
): void {
  fromInput.value = formatFromDegField(frame.directionFromDeg)
  speedInput.value = formatSpeedKtField(frame.speedMs)
}

/**
 * Ops row: meteorological from-deg + speed in knots. Publishes `source:
 * 'operator'` on change (and holds against Open-Meteo). Empty/invalid keeps
 * last (or default) — never throws. Open-Meteo CC BY 4.0 (ops, not on-air).
 */
export function mountWindOpsRow(options: WindOpsRowOptions): WindOpsRowHandle {
  const bus = options.bus ?? windBus
  if (bus.getSnapshot() === null) {
    bus.publish(createDefaultWindFrame())
  }

  const row = document.createElement('div')
  row.className = 'ops-hud__mode-row'
  row.setAttribute('data-ops', 'wind')
  options.container.appendChild(row)

  const label = document.createElement('span')
  label.className = 'ops-hud__mode-label'
  label.textContent = 'wind'
  row.appendChild(label)

  const fromInput = document.createElement('input')
  fromInput.id = 'ops-wind-direction-from'
  fromInput.name = 'directionFromDeg'
  fromInput.className = 'ops-hud__input ops-hud__input--wind'
  fromInput.type = 'text'
  fromInput.inputMode = 'decimal'
  fromInput.spellcheck = false
  fromInput.title =
    'Wind direction FROM, degrees clockwise from true north (0 = north). Travel is opposite.'
  fromInput.setAttribute('aria-label', 'Wind direction from degrees')
  row.appendChild(fromInput)

  const fromUnit = document.createElement('span')
  fromUnit.className = 'ops-hud__mode-hint'
  fromUnit.textContent = 'from°'
  row.appendChild(fromUnit)

  const speedInput = document.createElement('input')
  speedInput.id = 'ops-wind-speed-kt'
  speedInput.name = 'speedKt'
  speedInput.className = 'ops-hud__input ops-hud__input--wind'
  speedInput.type = 'text'
  speedInput.inputMode = 'decimal'
  speedInput.spellcheck = false
  speedInput.title = 'Wind speed in knots (stored internally as m/s)'
  speedInput.setAttribute('aria-label', 'Wind speed knots')
  row.appendChild(speedInput)

  const speedUnit = document.createElement('span')
  speedUnit.className = 'ops-hud__mode-hint'
  speedUnit.textContent = 'kt'
  row.appendChild(speedUnit)

  const hint = document.createElement('span')
  hint.className = 'ops-hud__mode-hint'
  hint.setAttribute('data-ops', 'wind-source')
  hint.title = 'Open-Meteo wind is CC BY 4.0 (non-commercial free tier).'
  row.appendChild(hint)

  const holdBtn = document.createElement('button')
  holdBtn.type = 'button'
  holdBtn.className = 'ops-hud__btn'
  holdBtn.setAttribute('data-ops', 'wind-hold')
  row.appendChild(holdBtn)

  const initial = bus.getSnapshot() ?? createDefaultWindFrame()
  fillFields(fromInput, speedInput, initial)

  function renderHint(nowMs = Date.now()): void {
    const snap = bus.getSnapshot()
    hint.textContent = snap ? formatWindSourceAge(snap, nowMs) : 'default'
  }

  function renderHoldBtn(): void {
    const holding = getWindHoldMode() === 'operator'
    holdBtn.textContent = holding ? 'API' : 'hold'
    holdBtn.title = holding
      ? 'Follow Open-Meteo (CC BY 4.0). Releases operator hold.'
      : 'Hold operator wind. Open-Meteo will not overwrite.'
    holdBtn.setAttribute(
      'aria-label',
      holding ? 'Follow API wind' : 'Hold operator wind',
    )
    holdBtn.setAttribute('aria-pressed', holding ? 'true' : 'false')
  }

  function tryPublishFromFields(): void {
    const last = bus.getSnapshot() ?? createDefaultWindFrame()
    const next = parseOperatorWindInput(
      {
        directionFromDegText: fromInput.value,
        speedKtText: speedInput.value,
      },
      last,
    )
    if (next === last) return
    setWindHoldMode('operator')
    bus.publish(next)
  }

  function onHoldClick(): void {
    if (getWindHoldMode() === 'operator') {
      setWindHoldMode('api')
      if (options.onFollowApi) options.onFollowApi()
      else requestOpenMeteoPoll()
      return
    }
    setWindHoldMode('operator')
    const last = bus.getSnapshot() ?? createDefaultWindFrame()
    bus.publish({
      ...last,
      source: 'operator',
      updatedAtMs: Date.now(),
    })
  }

  fromInput.addEventListener('input', tryPublishFromFields)
  fromInput.addEventListener('change', tryPublishFromFields)
  speedInput.addEventListener('input', tryPublishFromFields)
  speedInput.addEventListener('change', tryPublishFromFields)
  holdBtn.addEventListener('click', onHoldClick)

  const unsub = bus.subscribe((frame) => {
    if (document.activeElement !== fromInput && document.activeElement !== speedInput) {
      fillFields(fromInput, speedInput, frame)
    }
    renderHint()
  })
  const unsubHold = subscribeWindHoldMode(() => renderHoldBtn())

  const refreshId = window.setInterval(() => renderHint(), 1000)
  renderHint()
  renderHoldBtn()

  return {
    dispose(): void {
      window.clearInterval(refreshId)
      unsub()
      unsubHold()
      fromInput.removeEventListener('input', tryPublishFromFields)
      fromInput.removeEventListener('change', tryPublishFromFields)
      speedInput.removeEventListener('input', tryPublishFromFields)
      speedInput.removeEventListener('change', tryPublishFromFields)
      holdBtn.removeEventListener('click', onHoldClick)
      row.remove()
    },
  }
}
