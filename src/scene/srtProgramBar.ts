/**
 * Studio bottom bar: per-channel SRT layer toggles + 3D program takeover
 * + 2D program follow (Phase 22.4c–e). Contents follow local AR / 3D / 2D.
 */

import type { LocalChannelFocus } from '../output/localChannelSwitcher.ts'
import {
  SRT_CHANNEL_LAYER_KEYS,
  SRT_CHANNEL_LAYER_LABELS,
  type SrtChannelLayerKey,
  type SrtChannelLayerPreset,
  type SrtVisibilityChannel,
} from './srtChannelVisibility.ts'
import type { Map2dProgramCamState } from './map2dProgramCam.ts'
import {
  DEFAULT_MAP2D_METRES_ACROSS,
  MIN_MAP2D_METRES_ACROSS,
  MAX_MAP2D_METRES_ACROSS,
} from './map2dProgramCam.ts'

export type SrtProgramBarFollowBoat = {
  id: string
  label: string
}

export type SrtProgramBarOptions = {
  container: HTMLElement
  getFocus: () => LocalChannelFocus
  getPreset: (channel: SrtVisibilityChannel) => SrtChannelLayerPreset
  onPresetChange: (
    channel: SrtVisibilityChannel,
    key: SrtChannelLayerKey,
    value: boolean,
  ) => void
  getControl3dProgram?: () => boolean
  onControl3dProgram?: (on: boolean) => void
  onFrameBoats?: () => void
  getMap2dProgram?: () => Map2dProgramCamState
  getFollowBoats?: () => readonly SrtProgramBarFollowBoat[]
  onFollowCentroid?: () => void
  onFollowBoat?: (id: string) => void
  onMap2dOffsetEast?: (m: number) => void
  onMap2dOffsetNorth?: (m: number) => void
  onMap2dMetresAcross?: (m: number) => void
}

export type SrtProgramBarHandle = {
  setFocus: (focus: LocalChannelFocus) => void
  sync: () => void
  stop: () => void
}

function checkboxRow(
  key: SrtChannelLayerKey,
  checked: boolean,
  onChange: (value: boolean) => void,
): HTMLLabelElement {
  const label = document.createElement('label')
  label.className = 'srt-program-bar__toggle'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.dataset.layer = key
  input.addEventListener('change', () => {
    onChange(input.checked)
  })
  const text = document.createElement('span')
  text.textContent = SRT_CHANNEL_LAYER_LABELS[key]
  label.append(input, text)
  return label
}

function stubButton(text: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'srt-program-bar__stub'
  btn.textContent = text
  btn.title = title
  btn.disabled = true
  return btn
}

function numField(
  labelText: string,
  attrs: {
    field: string
    value: number
    step: number
    min?: number
    max?: number
    title: string
    onChange: (value: number) => void
  },
): HTMLLabelElement {
  const label = document.createElement('label')
  label.className = 'srt-program-bar__num'
  const span = document.createElement('span')
  span.textContent = labelText
  const input = document.createElement('input')
  input.type = 'number'
  input.dataset.field = attrs.field
  input.value = String(attrs.value)
  input.step = String(attrs.step)
  if (attrs.min != null) input.min = String(attrs.min)
  if (attrs.max != null) input.max = String(attrs.max)
  input.title = attrs.title
  input.addEventListener('change', () => {
    const n = Number(input.value)
    if (!Number.isFinite(n)) return
    attrs.onChange(n)
  })
  label.append(span, input)
  return label
}

/**
 * Bottom-of-window program controls. Mount on the overlay host — not a rail.
 */
export function startSrtProgramBar(
  options: SrtProgramBarOptions,
): SrtProgramBarHandle {
  const root = document.createElement('div')
  root.className = 'srt-program-bar'
  root.setAttribute('data-ops', 'srt-program-bar')
  root.title =
    'Per SRT channel. Local AR/3D only shows that preset — does not copy 3D onto AR.'

  const panes = new Map<LocalChannelFocus, HTMLElement>()
  const layerInputs = new Map<
    SrtVisibilityChannel,
    Map<SrtChannelLayerKey, HTMLInputElement>
  >()

  function fillLayerPane(channel: SrtVisibilityChannel, host: HTMLElement): void {
    const group = document.createElement('div')
    group.className = 'srt-program-bar__layers'
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', `${channel.toUpperCase()} layers`)
    const inputs = new Map<SrtChannelLayerKey, HTMLInputElement>()
    const preset = options.getPreset(channel)
    for (const key of SRT_CHANNEL_LAYER_KEYS) {
      const row = checkboxRow(key, preset[key], (value) => {
        options.onPresetChange(channel, key, value)
      })
      const input = row.querySelector('input')
      if (input) inputs.set(key, input)
      group.appendChild(row)
    }
    layerInputs.set(channel, inputs)
    host.appendChild(group)
  }

  {
    const pane = document.createElement('div')
    pane.className = 'srt-program-bar__pane'
    pane.dataset.pane = '3d'
    const cam = document.createElement('div')
    cam.className = 'srt-program-bar__cam'
    const control = document.createElement('label')
    control.className = 'srt-program-bar__toggle'
    control.title =
      'Off: WASD/orbit is ops look only. On: drive the 3D SRT program rig (damped); studio 3D shows that view.'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.dataset.control = '3d-program'
    box.checked = options.getControl3dProgram?.() === true
    box.addEventListener('change', () => {
      options.onControl3dProgram?.(box.checked)
    })
    const span = document.createElement('span')
    span.textContent = 'Control 3D program'
    control.append(box, span)
    const frame = document.createElement('button')
    frame.type = 'button'
    frame.className = 'srt-program-bar__action'
    frame.dataset.action = 'frame-boats'
    frame.textContent = 'Frame boats'
    frame.title = 'Snap the 3D program rig to boats with live telemetry'
    frame.addEventListener('click', () => {
      options.onFrameBoats?.()
    })
    cam.append(control, frame)
    pane.appendChild(cam)
    fillLayerPane('3d', pane)
    panes.set('3d', pane)
    root.appendChild(pane)
  }

  {
    const pane = document.createElement('div')
    pane.className = 'srt-program-bar__pane'
    pane.dataset.pane = 'ar'
    const cam = document.createElement('div')
    cam.className = 'srt-program-bar__cam'
    cam.append(
      stubButton('Follow', 'DSP-01 freeze-until-GPS; Free is DSP-03/later'),
      stubButton('Free', 'AR free aim — later'),
    )
    pane.appendChild(cam)
    fillLayerPane('ar', pane)
    panes.set('ar', pane)
    root.appendChild(pane)
  }

  {
    const pane = document.createElement('div')
    pane.className = 'srt-program-bar__pane'
    pane.dataset.pane = '2d'
    const cam = document.createElement('div')
    cam.className = 'srt-program-bar__cam'
    const centroid = document.createElement('button')
    centroid.type = 'button'
    centroid.className = 'srt-program-bar__action'
    centroid.dataset.action = 'follow-centroid'
    centroid.textContent = 'Follow centroid'
    centroid.title =
      'Top-down look at the centroid of boats with live GPS (not planned-only)'
    centroid.addEventListener('click', () => {
      options.onFollowCentroid?.()
    })
    const boatsHost = document.createElement('div')
    boatsHost.className = 'srt-program-bar__boats'
    boatsHost.dataset.role = 'follow-boats'
    cam.append(centroid, boatsHost)

    const initial = options.getMap2dProgram?.()
    cam.append(
      numField('E (m)', {
        field: 'offset-east',
        value: initial?.offsetEastM ?? 0,
        step: 1,
        title: 'East offset metres from the follow target',
        onChange: (m) => options.onMap2dOffsetEast?.(m),
      }),
      numField('N (m)', {
        field: 'offset-north',
        value: initial?.offsetNorthM ?? 0,
        step: 1,
        title: 'North offset metres from the follow target',
        onChange: (m) => options.onMap2dOffsetNorth?.(m),
      }),
      numField('Across (m)', {
        field: 'metres-across',
        value: initial?.metresAcross ?? DEFAULT_MAP2D_METRES_ACROSS,
        step: 10,
        min: MIN_MAP2D_METRES_ACROSS,
        max: MAX_MAP2D_METRES_ACROSS,
        title: 'Zoom: metres visible across the 16:9 frame',
        onChange: (m) => options.onMap2dMetresAcross?.(m),
      }),
    )
    const note = document.createElement('span')
    note.className = 'srt-program-bar__hint'
    note.textContent = '2D uses stream-map icons'
    pane.append(cam, note)
    panes.set('2d', pane)
    root.appendChild(pane)
  }

  function sync(): void {
    const focus = options.getFocus()
    root.dataset.focus = focus
    for (const [id, pane] of panes) {
      pane.hidden = id !== focus
    }
    for (const channel of ['ar', '3d'] as const) {
      const preset = options.getPreset(channel)
      const inputs = layerInputs.get(channel)
      if (!inputs) continue
      for (const key of SRT_CHANNEL_LAYER_KEYS) {
        const input = inputs.get(key)
        if (input) input.checked = preset[key]
      }
    }
    const control = root.querySelector(
      '[data-control="3d-program"]',
    ) as HTMLInputElement | null
    if (control && options.getControl3dProgram) {
      control.checked = options.getControl3dProgram() === true
    }

    const map2d = options.getMap2dProgram?.()
    const centroidBtn = root.querySelector(
      '[data-action="follow-centroid"]',
    ) as HTMLButtonElement | null
    if (centroidBtn && map2d) {
      centroidBtn.setAttribute(
        'aria-pressed',
        map2d.follow === 'centroid' ? 'true' : 'false',
      )
      centroidBtn.classList.toggle('is-on', map2d.follow === 'centroid')
    }
    const boatsHost = root.querySelector(
      '[data-role="follow-boats"]',
    ) as HTMLElement | null
    if (boatsHost) {
      const live = [...(options.getFollowBoats?.() ?? [])]
      if (
        map2d?.follow === 'boat' &&
        map2d.boatId &&
        !live.some((b) => b.id === map2d.boatId)
      ) {
        live.push({ id: map2d.boatId, label: map2d.boatId })
      }
      const ids = live.map((b) => b.id).join('|')
      const selected = map2d?.follow === 'boat' ? (map2d.boatId ?? '') : ''
      const key = `${ids}::${selected}`
      if (boatsHost.dataset.key !== key) {
        boatsHost.dataset.key = key
        boatsHost.replaceChildren()
        for (const boat of live) {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'srt-program-bar__action'
          btn.dataset.action = 'follow-boat'
          btn.dataset.boatId = boat.id
          btn.textContent = boat.label
          btn.title = `Follow boat ${boat.label}`
          const on = map2d?.follow === 'boat' && map2d.boatId === boat.id
          btn.setAttribute('aria-pressed', on ? 'true' : 'false')
          btn.classList.toggle('is-on', on)
          btn.addEventListener('click', () => {
            options.onFollowBoat?.(boat.id)
          })
          boatsHost.appendChild(btn)
        }
      } else {
        for (const btn of boatsHost.querySelectorAll(
          '[data-action="follow-boat"]',
        ) as NodeListOf<HTMLButtonElement>) {
          const on =
            map2d?.follow === 'boat' && map2d.boatId === btn.dataset.boatId
          btn.setAttribute('aria-pressed', on ? 'true' : 'false')
          btn.classList.toggle('is-on', on)
        }
      }
    }
    if (map2d) {
      const east = root.querySelector(
        '[data-field="offset-east"]',
      ) as HTMLInputElement | null
      const north = root.querySelector(
        '[data-field="offset-north"]',
      ) as HTMLInputElement | null
      const across = root.querySelector(
        '[data-field="metres-across"]',
      ) as HTMLInputElement | null
      if (east && document.activeElement !== east) {
        east.value = String(map2d.offsetEastM)
      }
      if (north && document.activeElement !== north) {
        north.value = String(map2d.offsetNorthM)
      }
      if (across && document.activeElement !== across) {
        across.value = String(map2d.metresAcross)
      }
    }
  }

  sync()
  options.container.appendChild(root)

  return {
    setFocus() {
      sync()
    },
    sync,
    stop() {
      root.remove()
    },
  }
}
