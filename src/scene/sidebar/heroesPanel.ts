/**
 * Left-rail Hero buildings (DSP-SCN-20260908-04).
 * Focus + ENU XYZ / yaw-pitch-roll. Texture chip from the mounted mesh.
 */

import { LANDMARK_CATALOGUE } from '../landmarks/catalogue.ts'
import { ZERO_LANDMARK_POSE } from '../landmarks/projectLandmarks.ts'
import type {
  LandmarkPoseOffset,
  LandmarkTextureKind,
  LandmarkTextureReport,
} from '../landmarks/types.ts'

export type HeroesPanelHandle = {
  readonly root: HTMLElement
  refresh: () => void
  dispose: () => void
}

export type HeroesPanelOptions = {
  container: HTMLElement
  getOffsets: () => Record<string, LandmarkPoseOffset>
  getTextureReport: () => LandmarkTextureReport[]
  onFocus: (id: string) => void
  onOffsetChange: (id: string, pose: LandmarkPoseOffset) => void
}

const METRE_FIELDS = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'z', label: 'Z' },
] as const

const DEG_FIELDS = [
  { key: 'yawDeg', label: 'yaw' },
  { key: 'pitchDeg', label: 'pitch' },
  { key: 'rollDeg', label: 'roll' },
] as const

function chipLabel(kind: LandmarkTextureKind): string {
  return kind
}

function appendNumberField(
  host: HTMLElement,
  label: string,
  value: number,
  step: string,
  onValue: (n: number) => void,
): void {
  const wrap = document.createElement('label')
  wrap.className = 'heroes-panel__field'
  const lab = document.createElement('span')
  lab.className = 'heroes-panel__field-lab'
  lab.textContent = label
  const input = document.createElement('input')
  input.type = 'number'
  input.step = step
  input.value = String(value)
  input.className = 'heroes-panel__input'
  input.addEventListener('input', () => {
    const n = Number(input.value)
    if (!Number.isFinite(n)) return
    onValue(n)
  })
  wrap.append(lab, input)
  host.appendChild(wrap)
}

/**
 * Mount Hero buildings list into a sidebar section body.
 */
export function startHeroesPanel(
  options: HeroesPanelOptions,
): HeroesPanelHandle {
  const root = document.createElement('div')
  root.className = 'heroes-panel'
  root.setAttribute('data-ops', 'heroes-panel')

  const hint = document.createElement('div')
  hint.className = 'heroes-panel__hint'
  hint.textContent =
    'Focus frames free cam. XYZ metres (E / up / −N), yaw/pitch/roll, and uniform scale auto-save for every hero (studio-wide). Pack Save still writes Electron/API when available.'
  root.appendChild(hint)

  const list = document.createElement('div')
  list.className = 'heroes-panel__list'
  root.appendChild(list)

  options.container.appendChild(root)

  function render(): void {
    const offsets = options.getOffsets()
    const report = new Map(
      options.getTextureReport().map((r) => [r.id, r.kind]),
    )
    list.replaceChildren()
    for (const entry of LANDMARK_CATALOGUE) {
      const pose = offsets[entry.id] ?? ZERO_LANDMARK_POSE
      const kind = report.get(entry.id) ?? (entry.kind === 'proxy' ? 'proxy' : 'no image')

      const row = document.createElement('div')
      row.className = 'heroes-panel__row'
      row.setAttribute('data-landmark-id', entry.id)

      const top = document.createElement('div')
      top.className = 'heroes-panel__top'

      const name = document.createElement('span')
      name.className = 'heroes-panel__name'
      name.textContent = entry.displayName

      const chip = document.createElement('span')
      chip.className = `heroes-panel__chip heroes-panel__chip--${kind === 'no image' ? 'no-image' : kind}`
      chip.textContent = chipLabel(kind)

      const focusBtn = document.createElement('button')
      focusBtn.type = 'button'
      focusBtn.className = 'heroes-panel__btn heroes-panel__btn--primary'
      focusBtn.textContent = 'Focus'
      focusBtn.addEventListener('click', () => {
        options.onFocus(entry.id)
      })

      top.append(name, chip, focusBtn)
      row.appendChild(top)

      const metres = document.createElement('div')
      metres.className = 'heroes-panel__fields'
      for (const field of METRE_FIELDS) {
        appendNumberField(metres, field.label, pose[field.key], '0.1', (n) => {
          const current = options.getOffsets()[entry.id] ?? ZERO_LANDMARK_POSE
          options.onOffsetChange(entry.id, { ...current, [field.key]: n })
        })
      }
      row.appendChild(metres)

      const degs = document.createElement('div')
      degs.className = 'heroes-panel__fields'
      for (const field of DEG_FIELDS) {
        appendNumberField(degs, field.label, pose[field.key], '0.5', (n) => {
          const current = options.getOffsets()[entry.id] ?? ZERO_LANDMARK_POSE
          options.onOffsetChange(entry.id, { ...current, [field.key]: n })
        })
      }
      row.appendChild(degs)

      const scaleRow = document.createElement('div')
      scaleRow.className = 'heroes-panel__fields'
      appendNumberField(scaleRow, 'scale', pose.scale ?? 1, '0.1', (n) => {
        const current = options.getOffsets()[entry.id] ?? ZERO_LANDMARK_POSE
        options.onOffsetChange(entry.id, { ...current, scale: n })
      })
      row.appendChild(scaleRow)

      list.appendChild(row)
    }
  }

  render()

  return {
    root,
    refresh: render,
    dispose(): void {
      root.remove()
    },
  }
}
