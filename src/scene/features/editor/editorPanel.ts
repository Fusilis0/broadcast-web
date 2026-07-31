import {
  downloadWorldFeaturesJson,
} from './exportJson.ts'
import {
  createGatePairFeatures,
  createPointFeature,
  createSponsorFeature,
  type EnuToGpsAmslFn,
  type FeatureIdCounter,
  pointTypeForTool,
} from './featureFactory.ts'
import {
  EDITOR_TOOL_LABELS,
  EDITOR_TOOL_ORDER,
  TWO_CLICK_TOOLS,
  type EditorTool,
} from './tools.ts'
import type { GpsToEnuAmslFn, LayoutFeature, WorldFeature } from '../types.ts'
import type { Map2dHandle } from '../../map2d.ts'
import { layoutFeatures } from '../layoutFeatures.ts'
import { setLayoutFeatures } from '../layoutStore.ts'

export type MapFeatureEditorOptions = {
  /** Parent for the editor chrome (typically ops-overlay). */
  container: HTMLElement
  map: Map2dHandle
  initialFeatures: readonly WorldFeature[]
  gpsToEnuAmsl: GpsToEnuAmslFn
  enuToGpsAmsl: EnuToGpsAmslFn
  /**
   * After every edit: layout already pushed to store + map.
   * Rebuild 3D from the GPS feature list.
   */
  onApply: (features: readonly WorldFeature[]) => void | Promise<void>
  /** Start with editor chrome open. */
  initiallyOpen?: boolean
  /**
   * Save full RaceProject download (Phase 6.2).
   * Caller builds from features + config; id/name from panel fields.
   */
  onSaveProject?: (meta: { id: string; name: string }) => void
  /** Defaults for Save project id / name fields. */
  initialProjectId?: string
  initialProjectName?: string
}

export type MapFeatureEditorHandle = {
  setOpen: (open: boolean) => void
  isOpen: () => boolean
  getFeatures: () => readonly WorldFeature[]
  /**
   * Replace editable GPS list (race pack switch); re-layouts map.
   * When `apply3d` is true (default), also schedules `onApply` remount.
   */
  replaceFeatures: (
    features: readonly WorldFeature[],
    apply3d?: boolean,
  ) => void
  /** Sync Save project id/name fields (no download). */
  setProjectMeta: (id: string, name: string) => void
  dispose: () => void
}

const EDITOR_MAP_SIZE = 420
const NORMAL_MAP_SIZE = 240
const HIT_PX = 12

/**
 * V1 ops map feature editor: tool palette, place/select/delete, export JSON.
 * Toggle via returned handle or HUD checkbox wired by caller.
 */
export function startMapFeatureEditor(
  options: MapFeatureEditorOptions,
): MapFeatureEditorHandle {
  let features = options.initialFeatures.map(cloneFeature)
  let tool: EditorTool = 'select'
  let selectedId: string | null = null
  let pendingA: { east: number; north: number } | null = null
  let open = options.initiallyOpen ?? false
  let applyTimer: number | null = null
  const idCounter: FeatureIdCounter = { n: maxNumericSuffix(features) }

  const panel = document.createElement('div')
  panel.className = 'ops-editor'
  panel.hidden = !open

  const title = document.createElement('div')
  title.className = 'ops-editor__title'
  title.textContent = 'World editor V1'
  panel.appendChild(title)

  const toolsRow = document.createElement('div')
  toolsRow.className = 'ops-editor__tools'
  panel.appendChild(toolsRow)

  const toolButtons = new Map<EditorTool, HTMLButtonElement>()
  for (const t of EDITOR_TOOL_ORDER) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'ops-hud__btn ops-editor__tool'
    btn.textContent = EDITOR_TOOL_LABELS[t]
    btn.dataset.tool = t
    btn.addEventListener('click', () => {
      setTool(t)
    })
    toolsRow.appendChild(btn)
    toolButtons.set(t, btn)
  }

  const hint = document.createElement('div')
  hint.className = 'ops-editor__hint'
  panel.appendChild(hint)

  const props = document.createElement('div')
  props.className = 'ops-editor__props'
  panel.appendChild(props)

  const nameLabel = document.createElement('label')
  nameLabel.className = 'ops-editor__field'
  nameLabel.textContent = 'name'
  const nameInput = document.createElement('input')
  nameInput.className = 'ops-editor__input'
  nameInput.type = 'text'
  nameLabel.appendChild(nameInput)
  props.appendChild(nameLabel)

  const labelLabel = document.createElement('label')
  labelLabel.className = 'ops-editor__field'
  labelLabel.textContent = 'label'
  const labelInput = document.createElement('input')
  labelInput.className = 'ops-editor__input'
  labelInput.type = 'text'
  labelLabel.appendChild(labelInput)
  props.appendChild(labelLabel)

  const heightLabel = document.createElement('label')
  heightLabel.className = 'ops-editor__field'
  heightLabel.textContent = 'heightM'
  const heightInput = document.createElement('input')
  heightInput.className = 'ops-editor__input'
  heightInput.type = 'number'
  heightInput.step = '0.5'
  heightInput.min = '0.5'
  heightLabel.appendChild(heightInput)
  props.appendChild(heightLabel)

  const colorLabel = document.createElement('label')
  colorLabel.className = 'ops-editor__field'
  colorLabel.textContent = 'color #'
  const colorInput = document.createElement('input')
  colorInput.className = 'ops-editor__input'
  colorInput.type = 'text'
  colorInput.placeholder = 'rrggbb'
  colorLabel.appendChild(colorInput)
  props.appendChild(colorLabel)

  const projectMeta = document.createElement('div')
  projectMeta.className = 'ops-editor__props'
  panel.appendChild(projectMeta)

  const projectIdLabel = document.createElement('label')
  projectIdLabel.className = 'ops-editor__field'
  projectIdLabel.textContent = 'project id'
  const projectIdInput = document.createElement('input')
  projectIdInput.className = 'ops-editor__input'
  projectIdInput.type = 'text'
  projectIdInput.spellcheck = false
  projectIdInput.value = options.initialProjectId ?? ''
  projectIdInput.placeholder = 'edited-…'
  projectIdLabel.appendChild(projectIdInput)
  projectMeta.appendChild(projectIdLabel)

  const projectNameLabel = document.createElement('label')
  projectNameLabel.className = 'ops-editor__field'
  projectNameLabel.textContent = 'project name'
  const projectNameInput = document.createElement('input')
  projectNameInput.className = 'ops-editor__input'
  projectNameInput.type = 'text'
  projectNameInput.value = options.initialProjectName ?? ''
  projectNameInput.placeholder = 'Display name'
  projectNameLabel.appendChild(projectNameInput)
  projectMeta.appendChild(projectNameLabel)

  const actions = document.createElement('div')
  actions.className = 'ops-editor__actions'
  panel.appendChild(actions)

  const deleteBtn = document.createElement('button')
  deleteBtn.type = 'button'
  deleteBtn.className = 'ops-hud__btn'
  deleteBtn.textContent = 'Delete'
  deleteBtn.addEventListener('click', () => {
    if (!selectedId) return
    features = features.filter((f) => f.id !== selectedId)
    selectedId = null
    pendingA = null
    pushLayout()
    scheduleApply()
    refreshProps()
  })
  actions.appendChild(deleteBtn)

  const exportBtn = document.createElement('button')
  exportBtn.type = 'button'
  exportBtn.className = 'ops-hud__btn'
  exportBtn.textContent = 'Export JSON'
  exportBtn.title = 'Download world-features.json (features only)'
  exportBtn.addEventListener('click', () => {
    downloadWorldFeaturesJson(features)
  })
  actions.appendChild(exportBtn)

  const saveProjectBtn = document.createElement('button')
  saveProjectBtn.type = 'button'
  saveProjectBtn.className = 'ops-hud__btn'
  saveProjectBtn.textContent = 'Save project'
  saveProjectBtn.title =
    'Download project.json (RaceProject). Put under public/races/<id>/ to persist in git.'
  saveProjectBtn.addEventListener('click', () => {
    options.onSaveProject?.({
      id: projectIdInput.value.trim(),
      name: projectNameInput.value.trim(),
    })
  })
  actions.appendChild(saveProjectBtn)

  options.container.appendChild(panel)

  function setTool(next: EditorTool): void {
    tool = next
    pendingA = null
    for (const [t, btn] of toolButtons) {
      btn.classList.toggle('ops-editor__tool--active', t === tool)
    }
    hint.textContent =
      tool === 'select'
        ? 'Click a feature to select'
        : TWO_CLICK_TOOLS.has(tool)
          ? 'Click A, then B'
          : 'Click map to place'
  }

  function cloneFeature(f: WorldFeature): WorldFeature {
    return {
      ...f,
      points: f.points.map((p) => ({ ...p })),
    }
  }

  function pushLayout(): LayoutFeature[] {
    const layout = layoutFeatures(features, options.gpsToEnuAmsl)
    setLayoutFeatures(layout)
    options.map.setLayoutFeatures(layout)
    options.map.setSelectedFeatureIds(selectedId ? [selectedId] : [])
    return layout
  }

  function scheduleApply(): void {
    if (applyTimer !== null) window.clearTimeout(applyTimer)
    applyTimer = window.setTimeout(() => {
      applyTimer = null
      void options.onApply(features)
    }, 80)
  }

  function refreshProps(): void {
    const f = features.find((x) => x.id === selectedId) ?? null
    const enabled = !!f
    nameInput.disabled = !enabled
    labelInput.disabled = !enabled
    heightInput.disabled = !enabled
    colorInput.disabled = !enabled
    deleteBtn.disabled = !enabled
    if (!f) {
      nameInput.value = ''
      labelInput.value = ''
      heightInput.value = ''
      colorInput.value = ''
      return
    }
    nameInput.value = f.name
    labelInput.value = f.label ?? ''
    heightInput.value = f.heightM !== undefined ? String(f.heightM) : ''
    colorInput.value =
      f.color !== undefined
        ? f.color.toString(16).padStart(6, '0')
        : ''
  }

  function selectFeature(id: string | null): void {
    selectedId = id
    options.map.setSelectedFeatureIds(id ? [id] : [])
    refreshProps()
  }

  function applyPropEdits(): void {
    if (!selectedId) return
    const idx = features.findIndex((f) => f.id === selectedId)
    if (idx < 0) return
    const f = cloneFeature(features[idx]!)
    f.name = nameInput.value.trim() || f.name
    const lab = labelInput.value.trim()
    f.label = lab === '' ? undefined : lab
    const h = Number.parseFloat(heightInput.value)
    if (Number.isFinite(h) && h >= 0.5) f.heightM = h
    const hex = colorInput.value.trim().replace(/^#/, '')
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      f.color = Number.parseInt(hex, 16)
    }
    features = features.map((x, i) => (i === idx ? f : x))
    pushLayout()
    scheduleApply()
  }

  for (const input of [nameInput, labelInput, heightInput, colorInput]) {
    input.addEventListener('change', applyPropEdits)
  }

  function onMapClick(east: number, north: number): void {
    if (!open) return

    if (tool === 'select') {
      const hit = options.map.hitTestFeature(east, north, HIT_PX)
      selectFeature(hit?.id ?? null)
      return
    }

    if (TWO_CLICK_TOOLS.has(tool)) {
      if (!pendingA) {
        pendingA = { east, north }
        hint.textContent = 'Click B…'
        return
      }
      if (tool === 'sponsor') {
        features = [
          ...features,
          createSponsorFeature(
            pendingA.east,
            pendingA.north,
            east,
            north,
            options.enuToGpsAmsl,
            idCounter,
          ),
        ]
      } else if (tool === 'gatePair') {
        const [left, right] = createGatePairFeatures(
          pendingA.east,
          pendingA.north,
          east,
          north,
          options.enuToGpsAmsl,
          idCounter,
        )
        features = [...features, left, right]
      }
      pendingA = null
      pushLayout()
      scheduleApply()
      setTool(tool)
      return
    }

    if (pointTypeForTool(tool)) {
      const created = createPointFeature(
        tool,
        east,
        north,
        options.enuToGpsAmsl,
        idCounter,
      )
      if (!created) return
      features = [...features, created]
      selectFeature(created.id)
      pushLayout()
      scheduleApply()
    }
  }

  const unsubClick = options.map.onMapClick(onMapClick)

  function applyOpenState(): void {
    panel.hidden = !open
    options.map.setInteractive(open)
    options.map.setSizePx(open ? EDITOR_MAP_SIZE : NORMAL_MAP_SIZE)
    options.map.root.classList.toggle('ops-map--editor', open)
    if (!open) {
      pendingA = null
      selectFeature(null)
    } else {
      pushLayout()
      setTool(tool)
      refreshProps()
    }
  }

  setTool('select')
  applyOpenState()
  if (open) pushLayout()

  return {
    setOpen(next: boolean): void {
      open = next
      applyOpenState()
    },
    isOpen: () => open,
    getFeatures: () => features,
    replaceFeatures(next: readonly WorldFeature[], apply3d = true): void {
      features = next.map(cloneFeature)
      idCounter.n = maxNumericSuffix(features)
      selectedId = null
      pendingA = null
      pushLayout()
      if (apply3d) scheduleApply()
      refreshProps()
    },
    setProjectMeta(id: string, name: string): void {
      projectIdInput.value = id
      projectNameInput.value = name
    },
    dispose(): void {
      if (applyTimer !== null) window.clearTimeout(applyTimer)
      unsubClick()
      panel.remove()
      options.map.setInteractive(false)
      options.map.setSizePx(NORMAL_MAP_SIZE)
      options.map.root.classList.remove('ops-map--editor')
      options.map.setSelectedFeatureIds([])
    },
  }
}

function maxNumericSuffix(features: readonly WorldFeature[]): number {
  let max = 0
  for (const f of features) {
    const m = /(\d+)\s*$/.exec(f.name) ?? /(\d+)\s*$/.exec(f.id)
    if (m) max = Math.max(max, Number.parseInt(m[1]!, 10))
  }
  return max
}
