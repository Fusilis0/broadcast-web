import {
  getOffsets,
  resetOffsets,
  setOffsets,
} from './offsetsStore.ts'
import {
  DEFAULT_HFOV_DEG,
  type CalibrationOffsets,
  zeroOffsets,
} from './types.ts'

/** Mock / default drone id — V1 panel targets this device only. */
export const DEFAULT_CALIB_DEVICE_ID = '1'

export type OffsetField = keyof CalibrationOffsets

export type OffsetSliderSpec = {
  field: OffsetField
  label: string
  min: number
  max: number
  step: number
}

/** Final ranges for V1 human offset sliders (DSP-CAL-20260723-01). */
export const OFFSET_SLIDER_SPECS: readonly OffsetSliderSpec[] = [
  { field: 'yawDeg', label: 'yaw°', min: -45, max: 45, step: 0.1 },
  { field: 'pitchDeg', label: 'pitch°', min: -45, max: 45, step: 0.1 },
  { field: 'rollDeg', label: 'roll°', min: -45, max: 45, step: 0.1 },
  { field: 'fovHDeg', label: 'fov°', min: 20, max: 120, step: 0.1 },
  { field: 'altMeters', label: 'alt m', min: -50, max: 50, step: 0.1 },
] as const

export type OffsetSlidersOptions = {
  container: HTMLElement
  /** Defaults to mock drone `"1"`. */
  deviceId?: string
}

export type OffsetSlidersHandle = {
  stop: () => void
}

function defaultForField(field: OffsetField): number {
  return zeroOffsets()[field]
}

/** Clamp a numeric value to the V1 slider range for that field. */
export function clampOffsetField(field: OffsetField, value: number): number {
  const spec = OFFSET_SLIDER_SPECS.find((s) => s.field === field)
  if (!spec || !Number.isFinite(value)) return defaultForField(field)
  return Math.min(spec.max, Math.max(spec.min, value))
}

/**
 * Parse + clamp + write one offset field via the store (no apply math here).
 * Returns the stored offsets after merge.
 */
export function writeOffsetField(
  deviceId: string,
  field: OffsetField,
  raw: number,
): CalibrationOffsets {
  const clamped = clampOffsetField(field, raw)
  return setOffsets(deviceId, { [field]: clamped })
}

function formatValue(field: OffsetField, value: number): string {
  if (field === 'fovHDeg') {
    // Keep enough precision for DEFAULT_HFOV_DEG = 66.8832
    return Number(value.toFixed(4)).toString()
  }
  return Number(value.toFixed(1)).toString()
}

/**
 * CAL ops panel: yaw / pitch / roll / FOV / alt sliders → offsetsStore.
 * Live pose picks up changes on the next convert tick.
 */
export function startOffsetSliders(
  options: OffsetSlidersOptions,
): OffsetSlidersHandle {
  const deviceId = options.deviceId ?? DEFAULT_CALIB_DEVICE_ID

  const root = document.createElement('div')
  root.className = 'calib-panel'
  root.setAttribute('data-calib-device', deviceId)

  const header = document.createElement('div')
  header.className = 'calib-panel__header'
  header.textContent = 'calib'
  root.appendChild(header)

  const deviceEl = document.createElement('div')
  deviceEl.className = 'calib-panel__device'
  deviceEl.textContent = `device ${deviceId}`
  root.appendChild(deviceEl)

  type Row = {
    field: OffsetField
    range: HTMLInputElement
    number: HTMLInputElement
  }
  const rows: Row[] = []

  function syncUi(offsets: CalibrationOffsets): void {
    for (const row of rows) {
      const v = offsets[row.field]
      const text = formatValue(row.field, v)
      row.range.value = String(v)
      row.number.value = text
    }
  }

  for (const spec of OFFSET_SLIDER_SPECS) {
    const rowEl = document.createElement('div')
    rowEl.className = 'calib-panel__row'

    const label = document.createElement('label')
    label.className = 'calib-panel__label'
    label.textContent = spec.label
    const id = `calib-${spec.field}`
    label.htmlFor = id
    rowEl.appendChild(label)

    const range = document.createElement('input')
    range.type = 'range'
    range.id = id
    range.className = 'calib-panel__range'
    range.min = String(spec.min)
    range.max = String(spec.max)
    range.step = String(spec.step)
    rowEl.appendChild(range)

    const number = document.createElement('input')
    number.type = 'number'
    number.className = 'calib-panel__number'
    number.min = String(spec.min)
    number.max = String(spec.max)
    number.step = String(spec.step)
    number.setAttribute('aria-label', `${spec.label} value`)
    rowEl.appendChild(number)

    const onRange = (): void => {
      const next = writeOffsetField(deviceId, spec.field, range.valueAsNumber)
      syncUi(next)
    }
    const onNumber = (): void => {
      const next = writeOffsetField(deviceId, spec.field, number.valueAsNumber)
      syncUi(next)
    }
    range.addEventListener('input', onRange)
    number.addEventListener('change', onNumber)

    rows.push({ field: spec.field, range, number })
    root.appendChild(rowEl)
  }

  const actions = document.createElement('div')
  actions.className = 'calib-panel__actions'

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.className = 'calib-panel__reset'
  resetBtn.textContent = 'Reset'
  resetBtn.title = `Reset offsets for device ${deviceId} (zeros + FOV ${DEFAULT_HFOV_DEG})`
  resetBtn.addEventListener('click', () => {
    syncUi(resetOffsets(deviceId))
  })
  actions.appendChild(resetBtn)
  root.appendChild(actions)

  options.container.appendChild(root)
  syncUi(getOffsets(deviceId))

  return {
    stop(): void {
      root.remove()
    },
  }
}
