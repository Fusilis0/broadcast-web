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

/** Mock / default drone id — used when `povIds` / `deviceId` omitted. */
export const DEFAULT_CALIB_DEVICE_ID = '1'

export type OffsetField = keyof CalibrationOffsets

export type OffsetSliderSpec = {
  field: OffsetField
  label: string
  min: number
  max: number
  step: number
  /** Operator-facing hint (tooltip). Required for `syncTrimMs` sign. */
  title?: string
}

/**
 * Sign for `syncTrimMs`: `t_ntp = toNtp(pts) + syncTrimMs` (TEL-08).
 * Positive samples later NTP → overlay leads the video.
 */
export const SYNC_TRIM_MS_TITLE =
  'Positive = AR leads video (sample later NTP). Overlay lags the picture → raise; overlay leads → lower. 0 = no trim.'

/**
 * Final ranges for V1 human offset sliders (DSP-CAL-20260723-01) plus
 * `syncTrimMs` (DSP-CAL-20260826-05).
 *
 * Sync range ±500 ms covers unmeasured DJI photon→NAL residual (tens of ms)
 * and the producer-class residuals in ntp-matching §3.4 (150–400 ms) with
 * headroom, without letting a mis-click jump a full second. Step 5 ms is
 * below typical NTP uncertainty (~30 ms) so an operator can split the
 * difference by eye.
 */
export const OFFSET_SLIDER_SPECS: readonly OffsetSliderSpec[] = [
  { field: 'yawDeg', label: 'yaw°', min: -45, max: 45, step: 0.1 },
  { field: 'pitchDeg', label: 'pitch°', min: -45, max: 45, step: 0.1 },
  { field: 'rollDeg', label: 'roll°', min: -45, max: 45, step: 0.1 },
  { field: 'fovHDeg', label: 'fov°', min: 20, max: 120, step: 0.1 },
  { field: 'altMeters', label: 'alt m', min: -50, max: 50, step: 0.1 },
  {
    field: 'syncTrimMs',
    label: 'sync ms',
    min: -500,
    max: 500,
    step: 5,
    title: SYNC_TRIM_MS_TITLE,
  },
] as const

export type OffsetSlidersOptions = {
  container: HTMLElement
  /** Initial active device; defaults to `povIds[0]` or `"1"`. */
  deviceId?: string
  /**
   * POV / device ids for the picker (from `loadConfig().povIds`).
   * Empty / omitted → `[deviceId ?? "1"]`.
   */
  povIds?: readonly string[]
  /** Fired when ops picks a different device (not when `setDeviceId` syncs). */
  onDeviceChange?: (deviceId: string) => void
}

export type OffsetSlidersHandle = {
  /** Active device id the sliders read/write. */
  getDeviceId: () => string
  /** Switch device and reload sliders (no `onDeviceChange`). */
  setDeviceId: (deviceId: string) => void
  /** Replace picker options; keeps active if still listed. */
  setPovIds: (povIds: readonly string[], activeDeviceId?: string) => void
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
  if (field === 'syncTrimMs') {
    return Number(value.toFixed(0)).toString()
  }
  return Number(value.toFixed(1)).toString()
}

function resolveCalibPovIds(
  povIds: readonly string[] | undefined,
  fallbackDeviceId: string,
): string[] {
  if (povIds !== undefined && povIds.length > 0) {
    return [...povIds]
  }
  return [fallbackDeviceId]
}

/**
 * CAL ops panel: yaw / pitch / roll / FOV / alt / sync-trim sliders → offsetsStore.
 * Device picker targets one POV id at a time; live pose picks up spatial
 * changes on the next convert tick. `syncTrimMs` is stored only (TEL-08).
 */
export function startOffsetSliders(
  options: OffsetSlidersOptions,
): OffsetSlidersHandle {
  let povIds = resolveCalibPovIds(
    options.povIds,
    options.deviceId ?? DEFAULT_CALIB_DEVICE_ID,
  )
  let deviceId =
    options.deviceId !== undefined && povIds.includes(options.deviceId)
      ? options.deviceId
      : (povIds[0] ?? DEFAULT_CALIB_DEVICE_ID)

  const root = document.createElement('div')
  root.className = 'calib-panel'
  root.setAttribute('data-calib-device', deviceId)

  const header = document.createElement('div')
  header.className = 'calib-panel__header'
  header.textContent = 'calib'
  root.appendChild(header)

  const deviceRow = document.createElement('div')
  deviceRow.className = 'calib-panel__device-row'

  const deviceLabel = document.createElement('label')
  deviceLabel.className = 'calib-panel__device-label'
  deviceLabel.htmlFor = 'calib-device-id'
  deviceLabel.textContent = 'device'
  deviceRow.appendChild(deviceLabel)

  const deviceSelect = document.createElement('select')
  deviceSelect.id = 'calib-device-id'
  deviceSelect.className = 'calib-panel__device-select'
  deviceSelect.title = 'POV / device id for offset edits'
  deviceRow.appendChild(deviceSelect)

  root.appendChild(deviceRow)

  const actions = document.createElement('div')
  actions.className = 'calib-panel__actions'

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.className = 'calib-panel__reset'
  resetBtn.textContent = 'Reset'
  resetBtn.addEventListener('click', () => {
    syncUi(resetOffsets(deviceId))
  })
  actions.appendChild(resetBtn)

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

  function updateDeviceChrome(): void {
    root.setAttribute('data-calib-device', deviceId)
    deviceSelect.value = deviceId
    deviceSelect.disabled = povIds.length <= 1
    resetBtn.title = `Reset offsets for device ${deviceId} (zeros + FOV ${DEFAULT_HFOV_DEG})`
  }

  function applyDevice(id: string, notify: boolean): void {
    if (!povIds.includes(id)) return
    const changed = id !== deviceId
    deviceId = id
    updateDeviceChrome()
    syncUi(getOffsets(deviceId))
    if (notify && changed) options.onDeviceChange?.(id)
  }

  function rebuildDeviceSelect(): void {
    deviceSelect.replaceChildren()
    for (const id of povIds) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = id
      deviceSelect.appendChild(opt)
    }
    if (!povIds.includes(deviceId)) {
      deviceId = povIds[0] ?? DEFAULT_CALIB_DEVICE_ID
    }
    updateDeviceChrome()
    syncUi(getOffsets(deviceId))
  }

  for (const spec of OFFSET_SLIDER_SPECS) {
    const rowEl = document.createElement('div')
    rowEl.className = 'calib-panel__row'

    const label = document.createElement('label')
    label.className = 'calib-panel__label'
    label.textContent = spec.label
    const id = `calib-${spec.field}`
    label.htmlFor = id
    if (spec.title) label.title = spec.title
    rowEl.appendChild(label)

    const range = document.createElement('input')
    range.type = 'range'
    range.id = id
    range.className = 'calib-panel__range'
    range.min = String(spec.min)
    range.max = String(spec.max)
    range.step = String(spec.step)
    if (spec.title) range.title = spec.title
    rowEl.appendChild(range)

    const number = document.createElement('input')
    number.type = 'number'
    number.className = 'calib-panel__number'
    number.min = String(spec.min)
    number.max = String(spec.max)
    number.step = String(spec.step)
    number.setAttribute('aria-label', `${spec.label} value`)
    if (spec.title) number.title = spec.title
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

  root.appendChild(actions)

  deviceSelect.addEventListener('change', () => {
    applyDevice(deviceSelect.value, true)
  })

  options.container.appendChild(root)
  rebuildDeviceSelect()

  return {
    getDeviceId(): string {
      return deviceId
    },
    setDeviceId(nextId: string): void {
      applyDevice(nextId, false)
    },
    setPovIds(nextIds, nextActive): void {
      povIds = resolveCalibPovIds(nextIds, deviceId)
      if (nextActive !== undefined && povIds.includes(nextActive)) {
        deviceId = nextActive
      }
      rebuildDeviceSelect()
    },
    stop(): void {
      root.remove()
    },
  }
}
