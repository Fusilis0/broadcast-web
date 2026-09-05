/**
 * World Authoring inspector form (Phase 19.7).
 * Name / label / type fields + lat/lon/alt/height. Add → Edit on select.
 * Pack id/name stay off this overlay. Logo pick uses openLibraryLogoPicker.
 */

import {
  DEFAULT_BOAT_VISIBILITY_MODE,
  normalizeBoatVisibilityMode,
  type BoatVisibilityMode,
} from './boatVisibility.ts'
import {
  resolveChainLogos,
  resolveChainPanelColor,
  type BillboardLogo,
} from './billboardLogos.ts'
import {
  effectiveRounding,
  isRoundingFeatureType,
  type RoundingSense,
} from './features/rounding.ts'
import {
  isBuoyMarkerFeatureType,
  isBuoyMeshVisible,
  isBuoyTagVisible,
  isFeatureVisible3d,
} from './features/featureVisibility.ts'
import type { WorldFeature } from './features/types.ts'
import {
  resolvePanelAlpha,
  resolveSponsorPanelColor,
  resolveWaterPlanePanelAlpha,
} from './sponsors/boardCompose.ts'
import { openLibraryLogoPicker } from './sidebar/libraryLogoPicker.ts'
import { appendPlateColourAlphaFields } from './sidebar/plateColourFields.ts'
import {
  heightFieldCaption,
  isFleetPlaceKind,
  isTwoPointPlaceKind,
  PLACE_KIND_LABELS,
  PLACE_KIND_ORDER,
  spacingFieldCaption,
  type CoordinatePlaceDraft,
  type PlaceKind,
} from './features/editor/coordinatePlace.ts'

export type AuthoringInspectorFleetSnapshot = {
  kind: 'boat' | 'drone'
  id: string
  name?: string
  label?: string
  lat?: number
  lon?: number
  altMsl?: number
  heightM?: number
  visibility?: BoatVisibilityMode
  /** Live TEL pose (drones). When set, lat/lon/alt inputs are read-only. */
  liveGps?: { lat: number; lon: number; alt: number } | null
  poseReadOnly: boolean
}

export type AuthoringInspectorOptions = {
  container: HTMLElement
  projectsApiBase?: string
  onAdd: (draft: CoordinatePlaceDraft) => void
  onEdit: (draft: CoordinatePlaceDraft) => void
  onPlaceKindChange?: (kind: PlaceKind) => void
  /** Append a vertex on the selected billboard chain. */
  onAddChainPoint?: () => void
  /** Live drone GPS from TEL (read-only in the inspector). */
  getLivePovGps?: (
    id: string,
  ) => { lat: number; lon: number; alt: number } | null
}

export type AuthoringInspectorHandle = {
  refresh: (input: {
    selected: WorldFeature | null
    fleet?: AuthoringInspectorFleetSnapshot | null
    toolKind?: PlaceKind | null
  }) => void
  getDraft: () => CoordinatePlaceDraft
  dispose: () => void
}

function numValue(input: HTMLInputElement, fallback = Number.NaN): number {
  const n = Number.parseFloat(input.value)
  return Number.isFinite(n) ? n : fallback
}

function setNum(input: HTMLInputElement, value: number | undefined): void {
  input.value =
    value !== undefined && Number.isFinite(value) ? String(value) : ''
}

/**
 * Mount the authoring inspector into the editor chrome (no pack metadata).
 */
export function mountAuthoringInspector(
  options: AuthoringInspectorOptions,
): AuthoringInspectorHandle {
  const root = document.createElement('div')
  root.className = 'ops-editor__inspector'
  root.setAttribute('data-ops', 'authoring-inspector')
  options.container.appendChild(root)

  const typeLabel = document.createElement('label')
  typeLabel.className = 'ops-editor__field'
  typeLabel.appendChild(document.createTextNode('type'))
  const typeSelect = document.createElement('select')
  typeSelect.className = 'ops-editor__input'
  typeSelect.setAttribute('data-ops', 'authoring-type')
  for (const kind of PLACE_KIND_ORDER) {
    const opt = document.createElement('option')
    opt.value = kind
    opt.textContent = PLACE_KIND_LABELS[kind]
    typeSelect.appendChild(opt)
  }
  typeLabel.appendChild(typeSelect)
  root.appendChild(typeLabel)

  const nameInput = addTextField(root, 'name')
  const labelInput = addTextField(root, 'label')
  const telemInput = addTextField(root, 'telemetry id')
  telemInput.setAttribute('data-ops', 'authoring-telem-id')

  const latInput = addNumberField(root, 'lat')
  const lonInput = addNumberField(root, 'lon')
  const altInput = addNumberField(root, 'alt MSL')
  latInput.setAttribute('data-ops', 'authoring-lat')
  lonInput.setAttribute('data-ops', 'authoring-lon')
  altInput.setAttribute('data-ops', 'authoring-alt')

  const latBInput = addNumberField(root, 'lat B')
  const lonBInput = addNumberField(root, 'lon B')
  const altBInput = addNumberField(root, 'alt B MSL')
  latBInput.setAttribute('data-ops', 'authoring-lat-b')
  lonBInput.setAttribute('data-ops', 'authoring-lon-b')
  altBInput.setAttribute('data-ops', 'authoring-alt-b')

  const heightCaption = document.createElement('span')
  heightCaption.textContent = 'heightM'
  const heightInput = addNumberField(root, heightCaption)
  heightInput.step = '0.5'
  heightInput.min = '0.5'
  heightInput.setAttribute('data-ops', 'authoring-height')

  const extras = document.createElement('div')
  extras.className = 'ops-editor__extras'
  extras.setAttribute('data-ops', 'authoring-extras')
  root.appendChild(extras)

  const commitBtn = document.createElement('button')
  commitBtn.type = 'button'
  commitBtn.className = 'ops-hud__btn ops-editor__commit'
  commitBtn.setAttribute('data-ops', 'authoring-commit')
  commitBtn.textContent = 'Add'
  root.appendChild(commitBtn)

  let selectedFeature: WorldFeature | null = null
  let fleetSnap: AuthoringInspectorFleetSnapshot | null = null
  let logosDraft: BillboardLogo[] = []
  let textureUrlDraft: string | null | undefined
  let panelColorDraft: number | undefined
  let panelAlphaDraft: number | undefined
  let visibilityDraft: BoatVisibilityMode = DEFAULT_BOAT_VISIBILITY_MODE
  let roundingDraft: RoundingSense = 'cw'
  let visible3dDraft = true
  let visibleBuoyMeshDraft = true
  let visibleTagDraft = true
  let spacingDraft: number | undefined
  let poseReadOnly = false

  typeSelect.addEventListener('change', () => {
    if (selectedFeature) return
    const kind = typeSelect.value as PlaceKind
    options.onPlaceKindChange?.(kind)
    renderExtras()
    syncPointBVisibility()
    syncHeightCaption()
    syncTelemVisibility()
    syncPoseReadOnly()
  })

  commitBtn.addEventListener('click', () => {
    const draft = getDraft()
    if (isAddMode()) options.onAdd(draft)
    else options.onEdit(draft)
  })

  telemInput.addEventListener('change', () => {
    syncPoseReadOnly()
  })

  function isAddMode(): boolean {
    return selectedFeature === null
  }

  function currentKind(): PlaceKind {
    if (selectedFeature) return selectedFeature.type
    if (fleetSnap) return fleetSnap.kind
    return typeSelect.value as PlaceKind
  }

  function syncPointBVisibility(): void {
    const show = isTwoPointPlaceKind(currentKind())
    latBInput.parentElement!.hidden = !show
    lonBInput.parentElement!.hidden = !show
    altBInput.parentElement!.hidden = !show
  }

  function syncTelemVisibility(): void {
    const kind = currentKind()
    const show =
      kind === 'buoy' ||
      kind === 'mark' ||
      kind === 'boat' ||
      kind === 'drone'
    telemInput.parentElement!.hidden = !show
  }

  function syncHeightCaption(): void {
    heightCaption.textContent = heightFieldCaption(currentKind())
  }

  function syncPoseReadOnly(): void {
    const kind = currentKind()
    const live =
      kind === 'drone'
        ? options.getLivePovGps?.(telemInput.value.trim())
        : null
    poseReadOnly = kind === 'drone' && live != null
    if (live) {
      setNum(latInput, live.lat)
      setNum(lonInput, live.lon)
      setNum(altInput, live.alt)
    }
    for (const input of [
      latInput,
      lonInput,
      altInput,
      latBInput,
      lonBInput,
      altBInput,
    ]) {
      input.readOnly = poseReadOnly
      input.disabled = poseReadOnly
    }
    const droneLock = kind === 'drone' && (poseReadOnly || !isAddMode())
    heightInput.readOnly = droneLock
    heightInput.disabled = droneLock
  }

  function syncCommitLabel(): void {
    commitBtn.textContent = isAddMode() ? 'Add' : 'Edit'
  }

  function renderExtras(): void {
    extras.replaceChildren()
    const kind = currentKind()
    logosDraft = selectedFeature
      ? resolveChainLogos(selectedFeature).map((l) => ({
          url: l.url,
          weight: l.weight,
        }))
      : logosDraft
    textureUrlDraft =
      selectedFeature?.textureUrl ?? textureUrlDraft
    panelColorDraft = selectedFeature?.panelColor ?? panelColorDraft
    panelAlphaDraft = selectedFeature?.panelAlpha ?? panelAlphaDraft
    spacingDraft = selectedFeature?.spacingM ?? spacingDraft

    if (kind === 'boat') {
      const row = document.createElement('label')
      row.className = 'ops-editor__field'
      row.appendChild(document.createTextNode('visibility'))
      const sel = document.createElement('select')
      sel.className = 'ops-editor__input'
      sel.setAttribute('data-ops', 'authoring-visibility')
      for (const m of ['solid', 'ghost', 'hidden'] as const) {
        const opt = document.createElement('option')
        opt.value = m
        opt.textContent = m === 'hidden' ? '3D off (tag on)' : m
        sel.appendChild(opt)
      }
      sel.value = visibilityDraft
      sel.addEventListener('change', () => {
        visibilityDraft = normalizeBoatVisibilityMode(sel.value)
      })
      row.appendChild(sel)
      extras.appendChild(row)
    }

    if (kind === 'sponsor') {
      const texRow = document.createElement('div')
      texRow.className = 'ops-editor__field'
      const texLabel = document.createElement('span')
      texLabel.textContent = `logo: ${textureUrlDraft ?? '(none)'}`
      const texBtn = document.createElement('button')
      texBtn.type = 'button'
      texBtn.className = 'ops-hud__btn'
      texBtn.textContent = 'Library…'
      texBtn.addEventListener('click', () => {
        void (async () => {
          const url = await openLibraryLogoPicker({
            projectsApiBase: options.projectsApiBase,
            title: 'Sponsor logo',
            allowEmpty: true,
          })
          if (url === null) return
          textureUrlDraft = url === '' ? null : url
          renderExtras()
        })()
      })
      texRow.append(texLabel, texBtn)
      extras.appendChild(texRow)

      appendPlateColourAlphaFields({
        parent: extras,
        fieldClass: 'ops-editor__field',
        inputClass: 'ops-editor__input',
        colourLabel: 'plate colour',
        alphaLabel: 'plate alpha',
        panelColor: resolveSponsorPanelColor(
          selectedFeature?.panelColor ?? panelColorDraft,
        ),
        panelAlpha: resolveWaterPlanePanelAlpha(
          selectedFeature?.panelAlpha ?? panelAlphaDraft,
        ),
        onColorChange: (color) => {
          panelColorDraft = color
        },
        onAlphaChange: (alpha) => {
          panelAlphaDraft = alpha
        },
      })
    }

    if (kind === 'billboardChain') {
      const spacingRow = document.createElement('label')
      spacingRow.className = 'ops-editor__field'
      spacingRow.appendChild(document.createTextNode(spacingFieldCaption()))
      const spacingInput = document.createElement('input')
      spacingInput.type = 'number'
      spacingInput.step = 'any'
      spacingInput.className = 'ops-editor__input'
      spacingInput.setAttribute('data-ops', 'authoring-spacing')
      setNum(spacingInput, spacingDraft)
      spacingInput.addEventListener('change', () => {
        const n = Number.parseFloat(spacingInput.value)
        spacingDraft = Number.isFinite(n) && n > 0 ? n : spacingDraft
      })
      spacingRow.appendChild(spacingInput)
      extras.appendChild(spacingRow)

      appendPlateColourAlphaFields({
        parent: extras,
        fieldClass: 'ops-editor__field',
        inputClass: 'ops-editor__input',
        colourLabel: 'plate colour',
        alphaLabel: 'plate alpha',
        panelColor: resolveChainPanelColor(
          selectedFeature?.panelColor ?? panelColorDraft,
        ),
        panelAlpha: resolvePanelAlpha(
          selectedFeature?.panelAlpha ?? panelAlphaDraft,
        ),
        onColorChange: (color) => {
          panelColorDraft = color
        },
        onAlphaChange: (alpha) => {
          panelAlphaDraft = alpha
        },
      })

      const logosHead = document.createElement('div')
      logosHead.className = 'ops-editor__logos-head'
      logosHead.textContent = 'Logos (weights → fair AABAB)'
      extras.appendChild(logosHead)

      if (logosDraft.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'ops-editor__hint'
        empty.textContent = 'Empty — solid framed plate'
        extras.appendChild(empty)
      }
      logosDraft.forEach((logo, index) => {
        const row = document.createElement('div')
        row.className = 'ops-editor__logo-row'
        const urlSpan = document.createElement('span')
        urlSpan.textContent = logo.url
        const weightInput = document.createElement('input')
        weightInput.type = 'number'
        weightInput.min = '1'
        weightInput.step = '1'
        weightInput.className = 'ops-editor__input'
        weightInput.value = String(logo.weight)
        weightInput.addEventListener('change', () => {
          const n = Math.max(1, Math.trunc(Number(weightInput.value)))
          if (!Number.isFinite(n)) return
          logosDraft = logosDraft.map((l, i) =>
            i === index ? { url: l.url, weight: n } : l,
          )
        })
        const removeBtn = document.createElement('button')
        removeBtn.type = 'button'
        removeBtn.className = 'ops-hud__btn'
        removeBtn.textContent = 'Remove'
        removeBtn.addEventListener('click', () => {
          logosDraft = logosDraft.filter((_, i) => i !== index)
          renderExtras()
        })
        row.append(urlSpan, weightInput, removeBtn)
        extras.appendChild(row)
      })

      const addLogo = document.createElement('button')
      addLogo.type = 'button'
      addLogo.className = 'ops-hud__btn'
      addLogo.textContent = 'Add logo…'
      addLogo.addEventListener('click', () => {
        void (async () => {
          const url = await openLibraryLogoPicker({
            projectsApiBase: options.projectsApiBase,
            title: 'Chain logo',
            allowEmpty: false,
          })
          if (url === null || url === '') return
          logosDraft = [...logosDraft, { url, weight: 1 }]
          textureUrlDraft = logosDraft[0]?.url ?? null
          renderExtras()
        })()
      })
      extras.appendChild(addLogo)

      const addPoint = document.createElement('button')
      addPoint.type = 'button'
      addPoint.className = 'ops-hud__btn'
      addPoint.setAttribute('data-ops', 'authoring-add-chain-point')
      addPoint.textContent = 'Add point'
      addPoint.addEventListener('click', () => {
        options.onAddChainPoint?.()
      })
      extras.appendChild(addPoint)
    }

    const featureType = selectedFeature?.type ?? kind
    if (
      !isFleetPlaceKind(kind) &&
      isBuoyMarkerFeatureType(String(featureType))
    ) {
      extras.appendChild(
        makeCheckboxRow('full 3D', visible3dDraft, (v) => {
          visible3dDraft = v
        }),
      )
      extras.appendChild(
        makeCheckboxRow('buoy mesh', visibleBuoyMeshDraft, (v) => {
          visibleBuoyMeshDraft = v
        }),
      )
      extras.appendChild(
        makeCheckboxRow('tag', visibleTagDraft, (v) => {
          visibleTagDraft = v
        }),
      )
    }
    if (
      !isFleetPlaceKind(kind) &&
      isRoundingFeatureType(String(featureType))
    ) {
      const row = document.createElement('label')
      row.className = 'ops-editor__field'
      row.appendChild(document.createTextNode('rounding'))
      const sel = document.createElement('select')
      sel.className = 'ops-editor__input'
      const current = effectiveRounding(
        selectedFeature?.rounding ?? roundingDraft,
      )
      roundingDraft = current
      for (const opt of [
        { value: 'none', label: 'Off' },
        { value: 'cw', label: 'CW' },
        { value: 'ccw', label: 'CCW' },
      ] as const) {
        const el = document.createElement('option')
        el.value = opt.value
        el.textContent = opt.label
        if (opt.value === current) el.selected = true
        sel.appendChild(el)
      }
      sel.addEventListener('change', () => {
        roundingDraft = sel.value as RoundingSense
      })
      row.appendChild(sel)
      extras.appendChild(row)
    }
  }

  function fillFromFeature(f: WorldFeature | null): void {
    if (!f) {
      nameInput.value = ''
      labelInput.value = ''
      telemInput.value = ''
      latInput.value = ''
      lonInput.value = ''
      altInput.value = '0'
      latBInput.value = ''
      lonBInput.value = ''
      altBInput.value = ''
      heightInput.value = ''
      logosDraft = []
      textureUrlDraft = undefined
      panelColorDraft = undefined
      panelAlphaDraft = undefined
      spacingDraft = undefined
      roundingDraft = 'cw'
      visible3dDraft = true
      visibleBuoyMeshDraft = true
      visibleTagDraft = true
      return
    }
    typeSelect.value = f.type
    nameInput.value = f.name
    labelInput.value = f.label ?? ''
    telemInput.value = f.telemetryId ?? ''
    const a = f.points[0]
    const b = f.points[1]
    setNum(latInput, a?.lat)
    setNum(lonInput, a?.lon)
    setNum(altInput, a?.altMsl ?? 0)
    setNum(latBInput, b?.lat)
    setNum(lonBInput, b?.lon)
    setNum(altBInput, b?.altMsl)
    setNum(heightInput, f.heightM)
    logosDraft = resolveChainLogos(f).map((l) => ({
      url: l.url,
      weight: l.weight,
    }))
    textureUrlDraft = f.textureUrl
    panelColorDraft = f.panelColor
    panelAlphaDraft = f.panelAlpha
    spacingDraft = f.spacingM
    roundingDraft = effectiveRounding(f.rounding)
    visible3dDraft = isFeatureVisible3d(f)
    visibleBuoyMeshDraft = isBuoyMeshVisible(f)
    visibleTagDraft = isBuoyTagVisible(f)
  }

  function fillFromFleet(snap: AuthoringInspectorFleetSnapshot): void {
    typeSelect.value = snap.kind
    nameInput.value = snap.name ?? ''
    labelInput.value = snap.label ?? ''
    telemInput.value = snap.id
    const gps = snap.liveGps
    setNum(latInput, gps?.lat ?? snap.lat)
    setNum(lonInput, gps?.lon ?? snap.lon)
    setNum(altInput, gps?.alt ?? snap.altMsl)
    setNum(heightInput, snap.heightM)
    visibilityDraft = snap.visibility ?? DEFAULT_BOAT_VISIBILITY_MODE
  }

  function getDraft(): CoordinatePlaceDraft {
    const kind = currentKind()
    const telem = telemInput.value.trim()
    const draft: CoordinatePlaceDraft = {
      kind,
      name: nameInput.value,
      label: labelInput.value,
      lat: numValue(latInput),
      lon: numValue(lonInput),
      altMsl: numValue(altInput, 0),
      heightM: numValue(heightInput),
      telemetryId: telem,
      textureUrl: textureUrlDraft,
      logos: kind === 'billboardChain' ? logosDraft : undefined,
      panelColor: panelColorDraft,
      panelAlpha: panelAlphaDraft,
      spacingM: spacingDraft,
      rounding: roundingDraft,
      visibility: kind === 'boat' ? visibilityDraft : undefined,
    }
    if (isBuoyMarkerFeatureType(String(kind))) {
      draft.visible3d = visible3dDraft
      draft.visibleBuoyMesh = visibleBuoyMeshDraft
      draft.visibleTag = visibleTagDraft
    }
    if (isTwoPointPlaceKind(kind)) {
      draft.latB = numValue(latBInput)
      draft.lonB = numValue(lonBInput)
      draft.altBMsl = numValue(altBInput, draft.altMsl)
    }
    return draft
  }

  function refresh(input: {
    selected: WorldFeature | null
    fleet?: AuthoringInspectorFleetSnapshot | null
    toolKind?: PlaceKind | null
  }): void {
    const prevSelected = selectedFeature
    selectedFeature = input.selected
    fleetSnap = input.fleet ?? null
    typeSelect.disabled = selectedFeature !== null
    if (selectedFeature) {
      fillFromFeature(selectedFeature)
    } else if (fleetSnap) {
      fillFromFleet(fleetSnap)
    } else if (prevSelected) {
      fillFromFeature(null)
      if (input.toolKind) typeSelect.value = input.toolKind
    } else if (input.toolKind) {
      typeSelect.value = input.toolKind
    }
    syncPointBVisibility()
    syncTelemVisibility()
    syncHeightCaption()
    syncPoseReadOnly()
    syncCommitLabel()
    renderExtras()
  }

  refresh({ selected: null })

  return {
    refresh,
    getDraft,
    dispose(): void {
      root.remove()
    },
  }
}

function addTextField(parent: HTMLElement, caption: string): HTMLInputElement {
  const row = document.createElement('label')
  row.className = 'ops-editor__field'
  row.appendChild(document.createTextNode(caption))
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'ops-editor__input'
  row.appendChild(input)
  parent.appendChild(row)
  return input
}

function addNumberField(
  parent: HTMLElement,
  caption: string | HTMLElement,
): HTMLInputElement {
  const row = document.createElement('label')
  row.className = 'ops-editor__field'
  if (typeof caption === 'string') {
    row.appendChild(document.createTextNode(caption))
  } else {
    row.appendChild(caption)
  }
  const input = document.createElement('input')
  input.type = 'number'
  input.step = 'any'
  input.className = 'ops-editor__input'
  row.appendChild(input)
  parent.appendChild(row)
  return input
}

function makeCheckboxRow(
  caption: string,
  checked: boolean,
  onChange: (v: boolean) => void,
): HTMLLabelElement {
  const row = document.createElement('label')
  row.className = 'ops-editor__field'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  row.append(input, document.createTextNode(` ${caption}`))
  return row
}
