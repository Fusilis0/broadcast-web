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
  isBuoyMarkerFeatureType,
  isBuoyMeshVisible,
  isBuoyTagVisible,
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
import { openLibraryLogoPicker } from './libraryLogoPicker.ts'
import { appendPlateColourAlphaFields } from './plateColourFields.ts'
import {
  resolveChainLogos,
  resolveChainPanelColor,
  type BillboardLogo,
} from '../billboardLogos.ts'
import {
  resolvePanelAlpha,
  resolveSponsorPanelColor,
  resolveWaterPlanePanelAlpha,
} from '../sponsors/boardCompose.ts'
import {
  applySponsorScaleOnEdit,
} from '../sponsors/sponsorLayout.ts'
import {
  heightFieldCaption,
  spacingFieldCaption,
} from '../features/editor/coordinatePlace.ts'

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
  /** Inspector lat/lon/alt — seeds 3D hull + map without telemetry. */
  onBoatPlannedGpsChange?: (
    id: string,
    plannedLat: number,
    plannedLon: number,
    plannedAlt?: number,
  ) => void
  onBoatHeightMChange?: (id: string, heightM: number) => void
  /** Live drone GPS from TEL (read-only in Details). */
  getPovLiveGps?: (
    id: string,
  ) => { lat: number; lon: number; alt: number } | null
  getPovLabel?: (id: string) => string
  onPovIdChange?: (oldId: string, newId: string) => void
  onPovLabelChange?: (id: string, label: string) => void
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
        'Telemetry id is the boat id. Planned lat/lon/alt move the 3D hull when there is no live telemetry. Height is uniform scale (session). Visibility: hidden = hull off, tag on.'
      details.appendChild(p)

      const boat = options.getBoats().find((b) => b.id === id)
      const form = document.createElement('div')
      form.className = 'asset-insp__form'
      const idInput = document.createElement('input')
      const latInput = document.createElement('input')
      const lonInput = document.createElement('input')
      const altInput = document.createElement('input')
      const heightInput = document.createElement('input')
      const commitGps = (): void => {
        const lat = Number(latInput.value)
        const lon = Number(lonInput.value)
        const alt = Number(altInput.value)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
        options.onBoatPlannedGpsChange?.(
          id,
          lat,
          lon,
          Number.isFinite(alt) ? alt : 0,
        )
      }
      const addBoatField = (
        caption: string,
        input: HTMLInputElement,
        value: string | number | undefined,
        onChange?: () => void,
      ): void => {
        const row = document.createElement('label')
        row.className = 'asset-insp__field'
        row.appendChild(document.createTextNode(caption))
        input.className = 'asset-insp__input'
        input.value = value !== undefined && value !== '' ? String(value) : ''
        if (onChange) input.addEventListener('change', onChange)
        row.appendChild(input)
        form.appendChild(row)
      }
      addBoatField('Telemetry id', idInput, id)
      idInput.readOnly = true
      addBoatField('Lat', latInput, boat?.plannedLat, commitGps)
      addBoatField('Lon', lonInput, boat?.plannedLon, commitGps)
      addBoatField('Alt MSL', altInput, boat?.plannedAlt ?? 0, commitGps)
      addBoatField(
        heightFieldCaption('boat'),
        heightInput,
        boat?.heightM,
        () => {
          const n = Number(heightInput.value)
          if (Number.isFinite(n)) options.onBoatHeightMChange?.(id, n)
        },
      )
      const visRow = document.createElement('label')
      visRow.className = 'asset-insp__field'
      visRow.appendChild(document.createTextNode('visibility'))
      const visSel = document.createElement('select')
      visSel.className = 'asset-insp__input'
      const mode = normalizeBoatVisibilityMode(
        boat?.visibility ?? DEFAULT_BOAT_VISIBILITY_MODE,
      )
      for (const m of ['solid', 'ghost', 'hidden'] as const) {
        const opt = document.createElement('option')
        opt.value = m
        opt.textContent = m === 'hidden' ? '3D off (tag on)' : m
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
      visRow.appendChild(visSel)
      form.appendChild(visRow)
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
      const form = document.createElement('div')
      form.className = 'asset-insp__form'
      const idInput = document.createElement('input')
      const nameInput = document.createElement('input')
      const addPovField = (
        caption: string,
        input: HTMLInputElement,
        value: string,
        onChange?: () => void,
        readOnly = false,
      ): void => {
        const row = document.createElement('label')
        row.className = 'asset-insp__field'
        row.appendChild(document.createTextNode(caption))
        input.className = 'asset-insp__input'
        input.value = value
        input.readOnly = readOnly
        if (onChange) input.addEventListener('change', onChange)
        row.appendChild(input)
        form.appendChild(row)
      }
      addPovField('Telemetry id', idInput, id, () => {
        const next = idInput.value.trim()
        if (next === '' || next === id) return
        options.onPovIdChange?.(id, next)
        detailsTarget = { kind: 'pov', id: next }
        renderDetails()
        refresh()
      })
      addPovField(
        'Name / label',
        nameInput,
        options.getPovLabel?.(id) ?? '',
        () => {
          options.onPovLabelChange?.(id, nameInput.value.trim())
        },
      )
      const live = options.getPovLiveGps?.(id)
      const latIn = document.createElement('input')
      const lonIn = document.createElement('input')
      const altIn = document.createElement('input')
      addPovField(
        'Lat (TEL, read-only)',
        latIn,
        live ? String(live.lat) : '',
        undefined,
        true,
      )
      addPovField(
        'Lon (TEL, read-only)',
        lonIn,
        live ? String(live.lon) : '',
        undefined,
        true,
      )
      addPovField(
        'Alt MSL (TEL, read-only)',
        altIn,
        live ? String(live.alt) : '',
        undefined,
        true,
      )
      details.appendChild(form)

      const offs = getOffsets(id)
      const pre = document.createElement('pre')
      pre.className = 'asset-insp__calib'
      pre.textContent = [
        `FOV H°: ${offs.fovHDeg.toFixed(2)}`,
        `yaw°: ${offs.yawDeg.toFixed(2)}`,
        `pitch°: ${offs.pitchDeg.toFixed(2)}`,
        `roll°: ${offs.rollDeg.toFixed(2)}`,
        `alt m (CAL offset): ${offs.altMeters.toFixed(2)}`,
        '',
        'Pose GPS is live TEL — not written from this inspector. Calib offsets: sidebar → Calib.',
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

    async function patchChainLogos(
      id: string,
      next: BillboardLogo[],
    ): Promise<void> {
      await options.onFeaturePatch(id, {
        logos: next.map((l) => ({ url: l.url, weight: l.weight })),
        textureUrl: next[0]?.url ?? null,
      })
      renderDetails()
      refresh()
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

    function patchFeature(patch: Partial<WorldFeature>): void {
      if (f.type !== 'sponsor') {
        void options.onFeaturePatch(f.id, patch)
        return
      }
      const next: WorldFeature = {
        ...f,
        ...patch,
        points: patch.points ?? f.points,
      }
      const scaled = applySponsorScaleOnEdit(f, next, options.gpsToEnuAmsl)
      void options.onFeaturePatch(f.id, {
        ...patch,
        heightM: scaled.heightM,
        boardAspect: scaled.boardAspect,
      })
    }

    function addGpsPoint(
      index: number,
      suffix: string,
    ): void {
      const p = f.points[index]
      if (!p) return
      addNumber(`Lat${suffix}`, p.lat, (v) => {
        const points = f.points.map((pt, i) =>
          i === index ? { ...pt, lat: v } : { ...pt },
        )
        patchFeature({ points })
      })
      addNumber(`Lon${suffix}`, p.lon, (v) => {
        const points = f.points.map((pt, i) =>
          i === index ? { ...pt, lon: v } : { ...pt },
        )
        patchFeature({ points })
      })
      addNumber(`Alt MSL${suffix}`, p.altMsl, (v) => {
        const points = f.points.map((pt, i) =>
          i === index ? { ...pt, altMsl: v } : { ...pt },
        )
        patchFeature({ points })
      })
    }

    addText('Name', f.name, (v) => {
      const name = v.trim()
      if (name !== '') void options.onFeaturePatch(f.id, { name })
    })
    addText('Label', f.label ?? '', (v) => {
      void options.onFeaturePatch(f.id, {
        label: v.trim() === '' ? undefined : v.trim(),
      })
    })
    if (f.type === 'start' || f.type === 'finish' || f.type === 'sponsor') {
      addGpsPoint(0, ' A')
      addGpsPoint(1, ' B')
    } else {
      addGpsPoint(0, '')
      if (f.points.length > 1 && f.type !== 'billboardChain') {
        addGpsPoint(1, ' B')
      }
    }
    addNumber(heightFieldCaption(f.type), f.heightM, (v) => {
      patchFeature({ heightM: v })
    })

    if (f.type === 'buoy' || f.type === 'mark') {
      addText('Telemetry id', f.telemetryId ?? '', (v) => {
        void options.onFeaturePatch(f.id, {
          telemetryId: v.trim() === '' ? null : v.trim(),
        })
      })
    }

    if (f.type === 'sponsor') {
      const note = document.createElement('p')
      note.className = 'asset-insp__note'
      note.textContent =
        'Sponsors lie flat on the sea. GPS A–B is the canvas; across-water follows board aspect (not heightM metres). heightM scales the glyph inside that canvas (clamped — it cannot grow a slab). Chosen Library logo is contain-fit; the name stays in this list, not on the mesh.'
      form.appendChild(note)
      const texRow = document.createElement('div')
      texRow.className = 'asset-insp__field'
      const texLabel = document.createElement('span')
      texLabel.textContent = `Logo: ${f.textureUrl ?? '(none)'}`
      const texBtn = document.createElement('button')
      texBtn.type = 'button'
      texBtn.className = 'asset-insp__btn'
      texBtn.textContent = 'Library…'
      texBtn.addEventListener('click', () => {
        void (async () => {
          const url = await openLibraryLogoPicker({
            projectsApiBase: options.projectsApiBase,
            title: 'Sponsor logo',
            allowEmpty: true,
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

      appendPlateColourAlphaFields({
        parent: form,
        fieldClass: 'asset-insp__field',
        inputClass: 'asset-insp__input',
        panelColor: resolveSponsorPanelColor(f.panelColor),
        panelAlpha: resolveWaterPlanePanelAlpha(f.panelAlpha),
        onColorChange: (color) => {
          void options.onFeaturePatch(f.id, { panelColor: color })
        },
        onAlphaChange: (alpha) => {
          void options.onFeaturePatch(f.id, { panelAlpha: alpha })
        },
      })
    } else if (f.type === 'billboardChain') {
      addNumber(spacingFieldCaption(), f.spacingM, (v) => {
        void options.onFeaturePatch(f.id, { spacingM: v })
      })
      const heightNote = document.createElement('p')
      heightNote.className = 'asset-insp__note'
      heightNote.textContent =
        'Height is vertical only; logos keep their ratio (contain-fit). spacingM is logo pitch on the ribbon, not panel gaps.'
      form.appendChild(heightNote)

      appendPlateColourAlphaFields({
        parent: form,
        fieldClass: 'asset-insp__field',
        inputClass: 'asset-insp__input',
        panelColor: resolveChainPanelColor(f.panelColor),
        panelAlpha: resolvePanelAlpha(f.panelAlpha),
        onColorChange: (color) => {
          void options.onFeaturePatch(f.id, { panelColor: color })
        },
        onAlphaChange: (alpha) => {
          void options.onFeaturePatch(f.id, { panelAlpha: alpha })
        },
      })

      const logosHead = document.createElement('div')
      logosHead.className = 'asset-insp__logos-head'
      logosHead.textContent = 'Logos (integer weights → fair AABAB, not AAA BB)'
      form.appendChild(logosHead)

      const logos = resolveChainLogos(f)
      const logosList = document.createElement('div')
      logosList.className = 'asset-insp__logos'
      if (logos.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'asset-insp__note'
        empty.textContent = 'Empty — solid framed plate'
        logosList.appendChild(empty)
      }
      logos.forEach((logo, index) => {
        const row = document.createElement('div')
        row.className = 'asset-insp__logo-row'

        const thumb = document.createElement('img')
        thumb.className = 'asset-insp__logo-thumb'
        thumb.src = logo.url
        thumb.alt = ''

        const urlSpan = document.createElement('span')
        urlSpan.className = 'asset-insp__logo-url'
        urlSpan.textContent = logo.url

        const weightLabel = document.createElement('label')
        weightLabel.className = 'asset-insp__weight'
        weightLabel.appendChild(document.createTextNode('w'))
        const weightInput = document.createElement('input')
        weightInput.type = 'number'
        weightInput.min = '1'
        weightInput.step = '1'
        weightInput.className = 'asset-insp__input'
        weightInput.value = String(logo.weight)
        weightInput.addEventListener('change', () => {
          const n = Math.max(1, Math.trunc(Number(weightInput.value)))
          if (!Number.isFinite(n)) return
          const next = logos.map((l, i) =>
            i === index ? { url: l.url, weight: n } : { ...l },
          )
          void patchChainLogos(f.id, next)
        })
        weightLabel.appendChild(weightInput)

        const removeBtn = document.createElement('button')
        removeBtn.type = 'button'
        removeBtn.className = 'asset-insp__btn'
        removeBtn.textContent = 'Remove'
        removeBtn.addEventListener('click', () => {
          const next = logos.filter((_, i) => i !== index)
          void patchChainLogos(f.id, next)
        })

        row.append(thumb, urlSpan, weightLabel, removeBtn)
        logosList.appendChild(row)
      })
      form.appendChild(logosList)

      const addBtn = document.createElement('button')
      addBtn.type = 'button'
      addBtn.className = 'asset-insp__btn'
      addBtn.textContent = 'Add logo…'
      addBtn.addEventListener('click', () => {
        void (async () => {
          const url = await openLibraryLogoPicker({
            projectsApiBase: options.projectsApiBase,
            title: 'Add chain logo',
            allowEmpty: false,
          })
          if (url === null || url === '') return
          const next: BillboardLogo[] = [
            ...logos,
            { url, weight: 1 },
          ]
          await patchChainLogos(f.id, next)
        })()
      })
      form.appendChild(addBtn)
    } else if (f.type !== 'buoy' && f.type !== 'mark') {
      const note = document.createElement('p')
      note.className = 'asset-insp__note'
      note.textContent =
        'Reshape extra vertices with World Authoring tools. Visibility toggles are on the list row.'
      form.appendChild(note)
    }

    function addCheckbox(
      label: string,
      checked: boolean,
      onCommit: (v: boolean) => void,
    ): void {
      const row = document.createElement('label')
      row.className = 'asset-insp__field'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = checked
      input.addEventListener('change', () => onCommit(input.checked))
      row.append(input, document.createTextNode(` ${label}`))
      form.appendChild(row)
    }

    if (isBuoyMarkerFeatureType(f.type)) {
      addCheckbox('Full 3D', isFeatureVisible3d(f), (v) => {
        void options.onFeaturePatch(f.id, { visible3d: v })
        refresh()
      })
      addCheckbox('Buoy mesh', isBuoyMeshVisible(f), (v) => {
        void options.onFeaturePatch(f.id, { visibleBuoyMesh: v })
        refresh()
      })
      addCheckbox('Tag', isBuoyTagVisible(f), (v) => {
        void options.onFeaturePatch(f.id, { visibleTag: v })
        refresh()
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
