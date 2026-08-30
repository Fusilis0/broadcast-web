/**
 * Assets sidebar section (Phase 11.7 / SCN-03).
 * Lists boats, POVs, and world features with Focus / Show-3D / Show-2D / Details.
 */

import { getOffsets } from '../../calibration/index.ts'
import type { BoatVisibilityMode } from '../boatVisibility.ts'
import {
  DEFAULT_BOAT_VISIBILITY_MODE,
  normalizeBoatVisibilityMode,
} from '../boatVisibility.ts'
import {
  featureEnuCentroid,
  isFeatureVisible2d,
  isFeatureVisible3d,
} from '../features/featureVisibility.ts'
import { layoutFeatures } from '../features/layoutFeatures.ts'
import {
  effectiveRounding,
  isRoundingFeatureType,
  persistRoundingSelection,
  type RoundingSense,
} from '../features/rounding.ts'
import type {
  GpsToEnuAmslFn,
  WorldFeature,
  WorldFeatureType,
} from '../features/types.ts'
import type { FleetBoatRow } from '../fleetLivePanel.ts'
import { promptTextureUrl } from './texturePicker.ts'

export type AssetKind =
  | 'boat'
  | 'pov'
  | 'sponsor'
  | 'billboardChain'
  | 'buoy'
  | 'mark'
  | 'gate'
  | 'startFinish'
  | 'flag'
  | 'other'

export type AssetRowId =
  | { kind: 'boat'; id: string }
  | { kind: 'pov'; id: string }
  | { kind: 'feature'; id: string }

const GROUP_ORDER: readonly { kind: AssetKind; label: string }[] = [
  { kind: 'boat', label: 'Boats' },
  { kind: 'pov', label: 'POVs / drones' },
  { kind: 'sponsor', label: 'Sponsors' },
  { kind: 'billboardChain', label: 'Billboard chains' },
  { kind: 'buoy', label: 'Buoys' },
  { kind: 'mark', label: 'Marks' },
  { kind: 'gate', label: 'Gates' },
  { kind: 'startFinish', label: 'Start / Finish' },
  { kind: 'flag', label: 'Flags' },
  { kind: 'other', label: 'Other' },
]

export function featureAssetKind(type: WorldFeatureType): AssetKind {
  switch (type) {
    case 'sponsor':
      return 'sponsor'
    case 'billboardChain':
      return 'billboardChain'
    case 'buoy':
      return 'buoy'
    case 'mark':
      return 'mark'
    case 'gateLeft':
    case 'gateRight':
      return 'gate'
    case 'start':
    case 'finish':
      return 'startFinish'
    case 'flagP1':
    case 'flagP2':
      return 'flag'
    default:
      return 'other'
  }
}

export type AssetInspectorOptions = {
  container: HTMLElement
  projectsApiBase?: string
  getBoats: () => readonly FleetBoatRow[]
  getBoatIds: () => readonly string[]
  getPovIds: () => readonly string[]
  getFeatures: () => readonly WorldFeature[]
  gpsToEnuAmsl: GpsToEnuAmslFn
  /** Soft boat map visibility (id → false hides). Default true. */
  getBoatMapVisible: (id: string) => boolean
  getPovMapVisible: (id: string) => boolean
  /** Soft POV 3D flag (no mesh today; still toggled/persisted for symmetry). */
  getPovVisible3d: (id: string) => boolean
  onFocus: (target: AssetRowId) => void
  onBoatVisibilityChange: (id: string, mode: BoatVisibilityMode) => void
  onBoatMapVisibleChange: (id: string, visible: boolean) => void
  onPovMapVisibleChange: (id: string, visible: boolean) => void
  onPovVisible3dChange: (id: string, visible: boolean) => void
  onFeaturePatch: (
    id: string,
    patch: Partial<WorldFeature>,
  ) => void | Promise<void>
  /** Deep-link: open Fleet row edit for this boat id. */
  onOpenBoatDetails?: (id: string) => void
  /** Inspector lat/lon — seeds 3D hull + map without telemetry. */
  onBoatPlannedGpsChange?: (
    id: string,
    plannedLat: number,
    plannedLon: number,
  ) => void
}

export type AssetInspectorHandle = {
  readonly root: HTMLElement
  refresh: () => void
  dispose: () => void
}

function rowKey(row: AssetRowId): string {
  return row.kind === 'feature'
    ? `feature:${row.id}`
    : `${row.kind}:${row.id}`
}

/**
 * Mount Assets list into a sidebar section body.
 */
export function startAssetInspector(
  options: AssetInspectorOptions,
): AssetInspectorHandle {
  const root = document.createElement('div')
  root.className = 'asset-insp'
  root.setAttribute('data-ops', 'asset-inspector')

  const hint = document.createElement('div')
  hint.className = 'asset-insp__hint'
  hint.textContent =
    'Focus · 3D · 2D · Details. Edits apply immediately; Project Save persists.'
  root.appendChild(hint)

  const list = document.createElement('div')
  list.className = 'asset-insp__list'
  root.appendChild(list)

  const details = document.createElement('div')
  details.className = 'asset-insp__details'
  details.hidden = true
  root.appendChild(details)

  let detailsTarget: AssetRowId | null = null
  options.container.appendChild(root)

  function openDetails(target: AssetRowId): void {
    detailsTarget = target
    renderDetails()
  }

  function closeDetails(): void {
    detailsTarget = null
    details.hidden = true
    details.replaceChildren()
  }

  function renderDetails(): void {
    details.replaceChildren()
    if (!detailsTarget) {
      details.hidden = true
      return
    }
    details.hidden = false
    const header = document.createElement('div')
    header.className = 'asset-insp__details-head'
    const title = document.createElement('strong')
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'asset-insp__btn'
    closeBtn.textContent = 'Close'
    closeBtn.addEventListener('click', () => closeDetails())
    header.append(title, closeBtn)
    details.appendChild(header)

    if (detailsTarget.kind === 'boat') {
      const id = detailsTarget.id
      title.textContent = `Boat ${id}`
      const p = document.createElement('p')
      p.className = 'asset-insp__note'
      p.textContent =
        'Name / category edit lives in Fleet / Live. Planned lat/lon moves the 3D hull when there is no live telemetry.'
      details.appendChild(p)

      const boat = options.getBoats().find((b) => b.id === id)
      const form = document.createElement('div')
      form.className = 'asset-insp__form'
      const latInput = document.createElement('input')
      const lonInput = document.createElement('input')
      const commitGps = (): void => {
        const lat = Number(latInput.value)
        const lon = Number(lonInput.value)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
        options.onBoatPlannedGpsChange?.(id, lat, lon)
      }
      for (const spec of [
        {
          label: 'Lat',
          input: latInput,
          value: boat?.plannedLat,
        },
        {
          label: 'Lon',
          input: lonInput,
          value: boat?.plannedLon,
        },
      ] as const) {
        const row = document.createElement('label')
        row.className = 'asset-insp__field'
        row.appendChild(document.createTextNode(spec.label))
        spec.input.className = 'asset-insp__input'
        spec.input.value =
          spec.value !== undefined ? String(spec.value) : ''
        spec.input.addEventListener('change', commitGps)
        row.appendChild(spec.input)
        form.appendChild(row)
      }
      details.appendChild(form)

      const open = document.createElement('button')
      open.type = 'button'
      open.className = 'asset-insp__btn asset-insp__btn--primary'
      open.textContent = 'Open Fleet'
      open.addEventListener('click', () => {
        options.onOpenBoatDetails?.(id)
      })
      details.appendChild(open)
      return
    }

    if (detailsTarget.kind === 'pov') {
      const id = detailsTarget.id
      title.textContent = `POV ${id}`
      const offs = getOffsets(id)
      const pre = document.createElement('pre')
      pre.className = 'asset-insp__calib'
      pre.textContent = [
        `FOV H°: ${offs.fovHDeg.toFixed(2)}`,
        `yaw°: ${offs.yawDeg.toFixed(2)}`,
        `pitch°: ${offs.pitchDeg.toFixed(2)}`,
        `roll°: ${offs.rollDeg.toFixed(2)}`,
        `alt m: ${offs.altMeters.toFixed(2)}`,
        '',
        '(Read-only — edit via sidebar → Calib)',
      ].join('\n')
      details.appendChild(pre)
      return
    }

    const feature = options.getFeatures().find((row) => row.id === detailsTarget!.id)
    if (!feature) {
      title.textContent = 'Missing feature'
      return
    }
    const f = feature
    title.textContent = `${f.type}: ${f.name}`

    const form = document.createElement('div')
    form.className = 'asset-insp__form'

    function addText(
      label: string,
      value: string,
      onCommit: (v: string) => void,
    ): void {
      const row = document.createElement('label')
      row.className = 'asset-insp__field'
      row.appendChild(document.createTextNode(label))
      const input = document.createElement('input')
      input.className = 'asset-insp__input'
      input.value = value
      input.addEventListener('change', () => onCommit(input.value))
      row.appendChild(input)
      form.appendChild(row)
    }

    function addNumber(
      label: string,
      value: number | undefined,
      onCommit: (v: number) => void,
    ): void {
      const row = document.createElement('label')
      row.className = 'asset-insp__field'
      row.appendChild(document.createTextNode(label))
      const input = document.createElement('input')
      input.type = 'number'
      input.step = 'any'
      input.className = 'asset-insp__input'
      input.value = value !== undefined ? String(value) : ''
      input.addEventListener('change', () => {
        const n = Number(input.value)
        if (Number.isFinite(n)) onCommit(n)
      })
      row.appendChild(input)
      form.appendChild(row)
    }

    function addRoundingSelect(): void {
      const row = document.createElement('label')
      row.className = 'asset-insp__field'
      row.appendChild(document.createTextNode('Rounding'))
      const select = document.createElement('select')
      select.className = 'asset-insp__input'
      const current = effectiveRounding(f.rounding)
      const choices: Array<{ value: RoundingSense; label: string }> = [
        { value: 'none', label: 'Off' },
        { value: 'cw', label: 'CW' },
        { value: 'ccw', label: 'CCW' },
      ]
      for (const opt of choices) {
        const el = document.createElement('option')
        el.value = opt.value
        el.textContent = opt.label
        if (opt.value === current) el.selected = true
        select.appendChild(el)
      }
      select.addEventListener('change', () => {
        const v = select.value as RoundingSense
        void options.onFeaturePatch(f.id, {
          rounding: persistRoundingSelection(v, f.rounding),
        })
      })
      row.appendChild(select)
      form.appendChild(row)
    }

    if (
      f.type === 'sponsor' ||
      f.type === 'billboardChain'
    ) {
      addText('Label', f.label ?? '', (v) => {
        void options.onFeaturePatch(f.id, {
          label: v.trim() === '' ? undefined : v.trim(),
        })
      })
      if (f.type === 'sponsor') {
        addNumber('heightM (depth across water)', f.heightM, (v) => {
          void options.onFeaturePatch(f.id, { heightM: v })
        })
        const note = document.createElement('p')
        note.className = 'asset-insp__note'
        note.textContent =
          'Sponsors lie flat on the sea (like start/finish). A→B is board width; heightM is depth across the water, not wall height. Billboard chains stay upright.'
        form.appendChild(note)
      } else {
        addNumber('Height m', f.heightM, (v) => {
          void options.onFeaturePatch(f.id, { heightM: v })
        })
        addNumber('Spacing m', f.spacingM, (v) => {
          void options.onFeaturePatch(f.id, { spacingM: v })
        })
      }
      const texRow = document.createElement('div')
      texRow.className = 'asset-insp__field'
      const texLabel = document.createElement('span')
      texLabel.textContent = `Texture: ${f.textureUrl ?? '(procedural)'}`
      const texBtn = document.createElement('button')
      texBtn.type = 'button'
      texBtn.className = 'asset-insp__btn'
      texBtn.textContent = 'Pick…'
      texBtn.addEventListener('click', () => {
        void (async () => {
          const url = await promptTextureUrl({
            projectsApiBase: options.projectsApiBase,
            defaultUrl: f.textureUrl,
          })
          if (url === null) return
          await options.onFeaturePatch(f.id, {
            textureUrl: url === '' ? null : url,
          })
          renderDetails()
          refresh()
        })()
      })
      texRow.append(texLabel, texBtn)
      form.appendChild(texRow)
    } else if (f.type === 'buoy') {
      addText('Telemetry id', f.telemetryId ?? '', (v) => {
        void options.onFeaturePatch(f.id, {
          telemetryId: v.trim() === '' ? null : v.trim(),
        })
      })
      const p0 = f.points[0]
      if (p0) {
        addNumber('Lat', p0.lat, (v) => {
          const points = f.points.map((p, i) =>
            i === 0 ? { ...p, lat: v } : { ...p },
          )
          void options.onFeaturePatch(f.id, { points })
        })
        addNumber('Lon', p0.lon, (v) => {
          const points = f.points.map((p, i) =>
            i === 0 ? { ...p, lon: v } : { ...p },
          )
          void options.onFeaturePatch(f.id, { points })
        })
      }
    } else {
      const note = document.createElement('p')
      note.className = 'asset-insp__note'
      note.textContent =
        'Move / reshape this feature with World Map tools. Visibility toggles are on the list row.'
      form.appendChild(note)
      addText('Name', f.name, (v) => {
        const name = v.trim()
        if (name !== '') void options.onFeaturePatch(f.id, { name })
      })
    }

    if (isRoundingFeatureType(f.type)) {
      addRoundingSelect()
    }

    details.appendChild(form)
  }

  function refresh(): void {
    list.replaceChildren()
    const boatsById = new Map(
      options.getBoats().map((b) => [b.id, b] as const),
    )
    const boatIds = options.getBoatIds()
    const povIds = options.getPovIds()
    const features = options.getFeatures()

    type ListItem = {
      group: AssetKind
      label: string
      target: AssetRowId
      sub?: string
    }
    const items: ListItem[] = []

    for (const id of boatIds) {
      const row = boatsById.get(id)
      items.push({
        group: 'boat',
        label: row?.name?.trim() || id,
        sub: id,
        target: { kind: 'boat', id },
      })
    }
    for (const id of povIds) {
      items.push({
        group: 'pov',
        label: `POV ${id}`,
        target: { kind: 'pov', id },
      })
    }
    for (const f of features) {
      items.push({
        group: featureAssetKind(f.type),
        label: f.label?.trim() || f.name,
        sub: f.type,
        target: { kind: 'feature', id: f.id },
      })
    }

    for (const group of GROUP_ORDER) {
      const groupItems = items.filter((i) => i.group === group.kind)
      if (groupItems.length === 0) continue
      const head = document.createElement('div')
      head.className = 'asset-insp__group'
      head.textContent = `${group.label} (${groupItems.length})`
      list.appendChild(head)

      for (const item of groupItems) {
        const row = document.createElement('div')
        row.className = 'asset-insp__row'
        row.dataset.key = rowKey(item.target)

        const name = document.createElement('div')
        name.className = 'asset-insp__name'
        name.textContent = item.label
        if (item.sub && item.sub !== item.label) {
          const sub = document.createElement('span')
          sub.className = 'asset-insp__sub'
          sub.textContent = item.sub
          name.appendChild(sub)
        }
        row.appendChild(name)

        const actions = document.createElement('div')
        actions.className = 'asset-insp__actions'

        const focusBtn = document.createElement('button')
        focusBtn.type = 'button'
        focusBtn.className = 'asset-insp__btn'
        focusBtn.textContent = 'Focus'
        focusBtn.title = 'Free cam + map center'
        focusBtn.addEventListener('click', () => {
          options.onFocus(item.target)
        })
        actions.appendChild(focusBtn)

        if (item.target.kind === 'boat') {
          const id = item.target.id
          const boat = boatsById.get(id)
          const mode = normalizeBoatVisibilityMode(
            boat?.visibility ?? DEFAULT_BOAT_VISIBILITY_MODE,
          )
          const visSel = document.createElement('select')
          visSel.className = 'asset-insp__select'
          visSel.title = '3D: solid / ghost / hidden'
          for (const m of ['solid', 'ghost', 'hidden'] as const) {
            const opt = document.createElement('option')
            opt.value = m
            opt.textContent = m === 'hidden' ? '3D off' : `3D ${m}`
            visSel.appendChild(opt)
          }
          visSel.value = mode
          visSel.addEventListener('change', () => {
            options.onBoatVisibilityChange(
              id,
              normalizeBoatVisibilityMode(visSel.value),
            )
            refresh()
          })
          actions.appendChild(visSel)

          const mapBtn = document.createElement('button')
          mapBtn.type = 'button'
          mapBtn.className = 'asset-insp__btn'
          const mapOn = options.getBoatMapVisible(id)
          mapBtn.textContent = mapOn ? '2D' : '2D off'
          mapBtn.title = 'Show/Hide 2D map icon'
          mapBtn.addEventListener('click', () => {
            options.onBoatMapVisibleChange(id, !mapOn)
            refresh()
          })
          actions.appendChild(mapBtn)
        } else if (item.target.kind === 'pov') {
          const id = item.target.id
          const v3 = options.getPovVisible3d(id)
          const btn3 = document.createElement('button')
          btn3.type = 'button'
          btn3.className = 'asset-insp__btn'
          btn3.textContent = v3 ? '3D' : '3D off'
          btn3.title =
            'POV has no separate 3D mesh; flag is stored for future use'
          btn3.addEventListener('click', () => {
            options.onPovVisible3dChange(id, !v3)
            refresh()
          })
          actions.appendChild(btn3)

          const mapOn = options.getPovMapVisible(id)
          const mapBtn = document.createElement('button')
          mapBtn.type = 'button'
          mapBtn.className = 'asset-insp__btn'
          mapBtn.textContent = mapOn ? '2D' : '2D off'
          mapBtn.addEventListener('click', () => {
            options.onPovMapVisibleChange(id, !mapOn)
            refresh()
          })
          actions.appendChild(mapBtn)
        } else {
          const f = features.find((x) => x.id === item.target.id)
          if (f) {
            const v3 = isFeatureVisible3d(f)
            const btn3 = document.createElement('button')
            btn3.type = 'button'
            btn3.className = 'asset-insp__btn'
            btn3.textContent = v3 ? '3D' : '3D off'
            btn3.addEventListener('click', () => {
              void options.onFeaturePatch(f.id, { visible3d: !v3 })
              refresh()
            })
            actions.appendChild(btn3)

            const v2 = isFeatureVisible2d(f)
            const btn2 = document.createElement('button')
            btn2.type = 'button'
            btn2.className = 'asset-insp__btn'
            btn2.textContent = v2 ? '2D' : '2D off'
            btn2.addEventListener('click', () => {
              void options.onFeaturePatch(f.id, { visible2d: !v2 })
              refresh()
            })
            actions.appendChild(btn2)
          }
        }

        const detBtn = document.createElement('button')
        detBtn.type = 'button'
        detBtn.className = 'asset-insp__btn'
        detBtn.textContent = 'Details'
        detBtn.addEventListener('click', () => openDetails(item.target))
        actions.appendChild(detBtn)

        row.appendChild(actions)
        list.appendChild(row)
      }
    }

    if (detailsTarget) renderDetails()
  }

  refresh()

  return {
    root,
    refresh,
    dispose(): void {
      root.remove()
    },
  }
}

/** Resolve ENU focus point for a list row (pure helper for tests + wiring). */
export function resolveAssetFocusEnu(
  target: AssetRowId,
  input: {
    getBoatEnu: (id: string) => { x: number; y: number; z: number } | null
    getBoatPlanned?: (
      id: string,
    ) => { lat: number; lon: number } | null
    getPovPlanned?: (
      id: string,
    ) => { lat: number; lon: number } | null
    getPovEnu?: (id: string) => { x: number; y: number; z: number } | null
    features: readonly WorldFeature[]
    gpsToEnuAmsl: GpsToEnuAmslFn
  },
): { x: number; y: number; z: number } | null {
  if (target.kind === 'boat') {
    const live = input.getBoatEnu(target.id)
    if (live) return live
    const planned = input.getBoatPlanned?.(target.id)
    if (planned) {
      const enu = input.gpsToEnuAmsl(planned.lat, planned.lon, 0)
      return { x: enu.x, y: enu.y, z: enu.z }
    }
    return null
  }
  if (target.kind === 'pov') {
    const live = input.getPovEnu?.(target.id)
    if (live) return live
    const planned = input.getPovPlanned?.(target.id)
    if (planned) {
      const enu = input.gpsToEnuAmsl(planned.lat, planned.lon, 0)
      return { x: enu.x, y: enu.y, z: enu.z }
    }
    return null
  }
  const feature = input.features.find((f) => f.id === target.id)
  if (!feature) return null
  const layout = layoutFeatures([feature], input.gpsToEnuAmsl)
  return featureEnuCentroid(layout[0]?.points ?? [])
}
