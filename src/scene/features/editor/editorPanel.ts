import {
  downloadWorldFeaturesJson,
} from './exportJson.ts'
import {
  createArrowFeature,
  createBillboardChainFeature,
  createBuoyFeature,
  createGatePairFeatures,
  createLineSignFeature,
  createPointFeature,
  createSponsorFeature,
  DEFAULT_BILLBOARD_CHAIN_SPACING_M,
  type EnuToGpsAmslFn,
  type FeatureIdCounter,
  pointTypeForTool,
} from './featureFactory.ts'
import {
  formatSegmentReadout,
  segmentReadout,
} from './segmentReadout.ts'
import {
  applySnap,
  DEFAULT_GRID_STEP_M,
  type SnapMode,
} from './snap.ts'
import { promptModal } from '../../../ui/promptModal.ts'
import { openLibraryLogoPicker } from '../../sidebar/libraryLogoPicker.ts'
import { mountAuthoringInspector } from '../../authoringInspector.ts'
import { applySponsorScaleOnEdit } from '../../sponsors/sponsorLayout.ts'
import {
  addFromCoordinates,
  editFromCoordinates,
  placeKindForTool,
  toolForPlaceKind,
  type CoordinatePlaceDraft,
  type FleetPlaceInput,
} from './coordinatePlace.ts'
import {
  EDITOR_TOOL_GROUPS,
  EDITOR_TOOL_LABELS,
  EDITOR_TOOL_ORDER,
  FLEET_PLACE_TOOLS,
  POLYLINE_TOOLS,
  TWO_CLICK_TOOLS,
  type EditorTool,
} from './tools.ts'
import {
  formatValidationSummary,
  validateWorldFeatures,
} from './validateFeatures.ts'
import {
  BILLBOARD_CHAIN_MAX_POINTS,
  type GpsToEnuAmslFn,
  type LayoutFeature,
  type WorldFeature,
} from '../types.ts'
import type { Map2dHandle } from '../../map2d.ts'
import { northFromSceneZ } from '../../../geodesy/index.ts'
import {
  extendPolylineEnd,
} from './polylineInsert.ts'
import {
  downloadWorldFeaturesGeojson,
  geojsonToWorldFeatures,
} from '../geojson.ts'
import { layoutFeatures } from '../layoutFeatures.ts'
import { setLayoutFeatures } from '../layoutStore.ts'

export type MapPlaceFleetKind = 'boat' | 'drone'

export type MapFeatureEditorOptions = {
  /** Parent for the editor chrome (sidebar World Map section or legacy overlay). */
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
  /**
   * When false (air-only LAN role), Save project is disabled.
   * Default true (editor).
   */
  projectWritesEnabled?: boolean
  /** Library catalogue API base (picker). Empty → static `/assets/library/index.json`. */
  projectsApiBase?: string
  /**
   * Place boat/drone on the map → register into fleet (session).
   * Caller seeds map pose + fleet panel.
   */
  onPlaceFleet?: (
    kind: MapPlaceFleetKind,
    east: number,
    north: number,
    id: string,
  ) => void
  /**
   * Coordinate Add/Edit for boats and drones (GPS, not map-click ENU).
   * Drone pose must not be written into the TEL pipeline — planned map
   * seed only.
   */
  onPlaceFleetGps?: (input: FleetPlaceInput) => void
  onEditFleetGps?: (input: FleetPlaceInput) => void
  /**
   * Select-tool drag of a fleet pose on the world map (boats without live telem).
   */
  onMoveFleet?: (
    kind: MapPlaceFleetKind,
    east: number,
    north: number,
    id: string,
  ) => void
  /** False while live packets are fresh — map drag is ignored. */
  canMoveFleetPose?: (id: string, kind: MapPlaceFleetKind) => boolean
  onSelectFleetPose?: (id: string, kind: MapPlaceFleetKind) => void
  /** Live drone GPS from TEL — inspector shows it read-only. */
  getLivePovGps?: (
    id: string,
  ) => { lat: number; lon: number; alt: number } | null
  /**
   * Fired on the same tick as in-memory feature mutation (map + Assets).
   * 3D remount still goes through `onApply` (may be deferred).
   */
  onStoreChange?: (features: readonly WorldFeature[]) => void
  /**
   * Click-to-set world anchor (lat/lon). Alternative to typing origin fields.
   * ENU east/north already converted by caller via enuToGps when needed —
   * this callback receives WGS84.
   */
  onSetAnchor?: (lat: number, lon: number, altMsl: number) => void
  /**
   * Known TEL buoy ids for optional live-bind dropdown (TEL-01).
   * Empty → placement without bind prompt.
   */
  knownBuoyIds?: readonly string[]
  /**
   * Map canvas size while editor/workspace is open (default 560).
   * Prefer `getMapSizeOpen` when size depends on maximize.
   */
  mapSizeOpen?: number
  /** Dynamic open map size (workspace maximize). Overrides `mapSizeOpen`. */
  getMapSizeOpen?: () => number
  /** Map size when closed (default 240). */
  mapSizeClosed?: number
  /** Show legacy “World editor V1” title (false when workspace chrome owns it). */
  showPanelTitle?: boolean
  /** Group tools under Course / Graphics / Fleet / Anchor headings. */
  groupedTools?: boolean
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
  /** Enable/disable Save project (air-only → false). */
  setProjectWritesEnabled: (enabled: boolean) => void
  /** Re-apply map size / interactive chrome for current open state. */
  resyncChrome: () => void
  dispose: () => void
}

const EDITOR_MAP_SIZE = 560
const NORMAL_MAP_SIZE = 240
const HIT_PX = 12
const BOAT_HIT_PX = 16
/** Screen-space vertex snap radius (px on editor map). */
const VERTEX_SNAP_PX = 14

/**
 * V1 ops map feature editor: tool palette, place/select/delete, export JSON.
 * Phase 8.2: snap (vertex default / optional grid), bearing readout, validation.
 * Phase 11 follow-up: hosts inside World Authoring workspace (large map + groups).
 * Toggle via returned handle or workspace / HUD mirror wired by caller.
 */
export function startMapFeatureEditor(
  options: MapFeatureEditorOptions,
): MapFeatureEditorHandle {
  let features = options.initialFeatures.map(cloneFeature)
  let tool: EditorTool = 'select'
  let selectedId: string | null = null
  let pendingA: { east: number; north: number } | null = null
  /** Accumulated polyline vertices for billboardChain. */
  let pendingPoly: Array<{ east: number; north: number }> = []
  let open = options.initiallyOpen ?? false
  let applyTimer: number | null = null
  let vertexSnap = true
  let gridSnap = false
  /** Last ENU under cursor (for Enter-to-confirm on two-click tools). */
  let lastCursor: { east: number; north: number } | null = null
  /** Active vertex drag while `select` tool owns the pointer gesture. */
  let vertexDrag: {
    featureId: string
    pointIndex: number
    pointerId: number
  } | null = null
  /** Active fleet-boat drag (no live telem). */
  let boatDrag: {
    id: string
    pointerId: number
  } | null = null
  const idCounter: FeatureIdCounter = { n: maxNumericSuffix(features) }

  const knownBuoyIds = [...(options.knownBuoyIds ?? [])]

  const mapSizeClosed = options.mapSizeClosed ?? NORMAL_MAP_SIZE
  const showPanelTitle = options.showPanelTitle !== false
  const groupedTools = options.groupedTools === true

  function resolveOpenMapSize(): number {
    const dynamic = options.getMapSizeOpen?.()
    if (typeof dynamic === 'number' && Number.isFinite(dynamic) && dynamic > 0) {
      return Math.floor(dynamic)
    }
    return options.mapSizeOpen ?? EDITOR_MAP_SIZE
  }

  const panel = document.createElement('div')
  panel.className = 'ops-editor'
  if (groupedTools) panel.classList.add('ops-editor--grouped')
  panel.hidden = !open

  if (showPanelTitle) {
    const title = document.createElement('div')
    title.className = 'ops-editor__title'
    title.textContent = 'World editor V1'
    panel.appendChild(title)
  }

  const toolsRow = document.createElement('div')
  toolsRow.className = groupedTools
    ? 'ops-editor__tools-host'
    : 'ops-editor__tools'
  panel.appendChild(toolsRow)

  const toolButtons = new Map<EditorTool, HTMLButtonElement>()

  function addToolButton(parent: HTMLElement, t: EditorTool): void {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'ops-hud__btn ops-editor__tool'
    btn.textContent = EDITOR_TOOL_LABELS[t]
    btn.dataset.tool = t
    btn.title = EDITOR_TOOL_LABELS[t]
    btn.addEventListener('click', () => {
      setTool(t)
    })
    parent.appendChild(btn)
    toolButtons.set(t, btn)
  }

  if (groupedTools) {
    for (const group of EDITOR_TOOL_GROUPS) {
      const groupEl = document.createElement('div')
      groupEl.className = 'ops-editor__tool-group'
      groupEl.dataset.group = group.id

      const groupLabel = document.createElement('div')
      groupLabel.className = 'ops-editor__tool-group-label'
      groupLabel.textContent = group.label
      groupEl.appendChild(groupLabel)

      const row = document.createElement('div')
      row.className = 'ops-editor__tools'
      for (const t of group.tools) {
        addToolButton(row, t)
      }
      groupEl.appendChild(row)
      toolsRow.appendChild(groupEl)
    }
  } else {
    for (const t of EDITOR_TOOL_ORDER) {
      addToolButton(toolsRow, t)
    }
  }

  const snapRow = document.createElement('div')
  snapRow.className = 'ops-editor__snap'
  panel.appendChild(snapRow)

  const vertexSnapLabel = document.createElement('label')
  vertexSnapLabel.className = 'ops-editor__check'
  const vertexSnapInput = document.createElement('input')
  vertexSnapInput.type = 'checkbox'
  vertexSnapInput.checked = vertexSnap
  vertexSnapInput.addEventListener('change', () => {
    vertexSnap = vertexSnapInput.checked
  })
  vertexSnapLabel.appendChild(vertexSnapInput)
  vertexSnapLabel.appendChild(
    document.createTextNode(` vertex snap (${VERTEX_SNAP_PX}px)`),
  )
  snapRow.appendChild(vertexSnapLabel)

  const gridSnapLabel = document.createElement('label')
  gridSnapLabel.className = 'ops-editor__check'
  const gridSnapInput = document.createElement('input')
  gridSnapInput.type = 'checkbox'
  gridSnapInput.checked = gridSnap
  gridSnapInput.addEventListener('change', () => {
    gridSnap = gridSnapInput.checked
  })
  gridSnapLabel.appendChild(gridSnapInput)
  gridSnapLabel.appendChild(
    document.createTextNode(` grid ${DEFAULT_GRID_STEP_M}m`),
  )
  snapRow.appendChild(gridSnapLabel)

  const polyActions = document.createElement('div')
  polyActions.className = 'ops-editor__actions'
  polyActions.hidden = true
  panel.appendChild(polyActions)

  const finishPolyBtn = document.createElement('button')
  finishPolyBtn.type = 'button'
  finishPolyBtn.className = 'ops-hud__btn'
  finishPolyBtn.textContent = 'Finish chain'
  finishPolyBtn.title = 'Complete billboard chain (≥2 points)'
  finishPolyBtn.addEventListener('click', () => {
    void finishBillboardChain()
  })
  polyActions.appendChild(finishPolyBtn)

  const hint = document.createElement('div')
  hint.className = 'ops-editor__hint'
  panel.appendChild(hint)

  const readout = document.createElement('div')
  readout.className = 'ops-editor__readout'
  readout.hidden = true
  panel.appendChild(readout)

  const props = document.createElement('div')
  props.className = 'ops-editor__props'
  panel.appendChild(props)

  const inspector = mountAuthoringInspector({
    container: props,
    projectsApiBase: options.projectsApiBase,
    getLivePovGps: options.getLivePovGps,
    onPlaceKindChange(kind) {
      const nextTool = toolForPlaceKind(kind)
      if (nextTool !== 'select') setTool(nextTool)
    },
    onAdd(draft) {
      commitCoordinateDraft(draft, 'add')
    },
    onEdit(draft) {
      commitCoordinateDraft(draft, 'edit')
    },
    onAddChainPoint() {
      if (!selectedId) return
      const ok = appendBillboardChainPoint(selectedId)
      hint.textContent = ok
        ? 'Added chain point — drag it on the map'
        : 'Cannot add a chain point (need a chain with room for more vertices)'
    },
  })

  const projectMeta = document.createElement('div')
  projectMeta.className = 'ops-editor__props'
  projectMeta.hidden = true
  projectMeta.setAttribute('data-ops', 'authoring-project-meta')
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
    deleteSelectedFeature()
  })

  actions.appendChild(deleteBtn)

  const exportBtn = document.createElement('button')
  exportBtn.type = 'button'
  exportBtn.className = 'ops-hud__btn'
  exportBtn.textContent = 'Export JSON'
  exportBtn.title = 'Download world-features.json (features only)'
  exportBtn.addEventListener('click', () => {
    if (!guardExportOrSave('Export JSON')) return
    downloadWorldFeaturesJson(features)
  })
  actions.appendChild(exportBtn)

  const exportGeoBtn = document.createElement('button')
  exportGeoBtn.type = 'button'
  exportGeoBtn.className = 'ops-hud__btn'
  exportGeoBtn.textContent = 'Export GeoJSON'
  exportGeoBtn.title =
    'Download world-features.geojson (geojson.io FeatureCollection)'
  exportGeoBtn.addEventListener('click', () => {
    if (!guardExportOrSave('Export GeoJSON')) return
    downloadWorldFeaturesGeojson(features)
  })
  actions.appendChild(exportGeoBtn)

  const importGeoInput = document.createElement('input')
  importGeoInput.type = 'file'
  importGeoInput.accept = '.geojson,.json,application/geo+json,application/json'
  importGeoInput.hidden = true
  importGeoInput.addEventListener('change', () => {
    const file = importGeoInput.files?.[0]
    importGeoInput.value = ''
    if (!file) return
    void file.text().then((text) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(text) as unknown
      } catch (err) {
        console.warn('[geojson] import: invalid JSON', err)
        hint.textContent = 'Import failed: invalid JSON'
        return
      }
      const { features: imported, skipped } = geojsonToWorldFeatures(parsed)
      if (imported.length === 0) {
        hint.textContent =
          skipped > 0
            ? `Import: no valid features (${skipped} skipped)`
            : 'Import: empty FeatureCollection'
        return
      }
      const replace = window.confirm(
        `Import ${imported.length} feature(s)` +
          (skipped > 0 ? ` (${skipped} skipped)` : '') +
          '.\n\nOK = replace current features\nCancel = merge with current',
      )
      features = replace
        ? imported.map(cloneFeature)
        : [...features, ...imported.map(cloneFeature)]
      idCounter.n = maxNumericSuffix(features)
      selectedId = null
      pendingA = null
      pushLayout()
      scheduleApply()
      refreshProps()
      hint.textContent = replace
        ? `Replaced with ${imported.length} GeoJSON feature(s)`
        : `Merged ${imported.length} GeoJSON feature(s)`
    })
  })
  actions.appendChild(importGeoInput)

  const importGeoBtn = document.createElement('button')
  importGeoBtn.type = 'button'
  importGeoBtn.className = 'ops-hud__btn'
  importGeoBtn.textContent = 'Import GeoJSON'
  importGeoBtn.title =
    'Load FeatureCollection (.geojson). OK=replace, Cancel=merge.'
  importGeoBtn.addEventListener('click', () => {
    importGeoInput.click()
  })
  actions.appendChild(importGeoBtn)

  const saveProjectBtn = document.createElement('button')
  saveProjectBtn.type = 'button'
  saveProjectBtn.className = 'ops-hud__btn'
  saveProjectBtn.textContent = 'Save project'
  saveProjectBtn.title =
    'Save as: download project.json with id/name below (+ API POST when projectsApiBase is set). Drop under public/races/<id>/ for git.'
  let projectWritesEnabled = options.projectWritesEnabled !== false

  function applyProjectWritesEnabled(): void {
    saveProjectBtn.disabled = !projectWritesEnabled
    saveProjectBtn.title = projectWritesEnabled
      ? 'Save as: download project.json with id/name below (+ API POST when projectsApiBase is set). Drop under public/races/<id>/ for git.'
      : 'Air-only role — Save project disabled (read/load only)'
  }
  applyProjectWritesEnabled()

  saveProjectBtn.addEventListener('click', () => {
    if (!projectWritesEnabled) return
    if (!guardExportOrSave('Save project')) return
    options.onSaveProject?.({
      id: projectIdInput.value.trim(),
      name: projectNameInput.value.trim(),
    })
  })
  actions.appendChild(saveProjectBtn)

  options.container.appendChild(panel)

  function isTextInputTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    return (
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    )
  }

  function deleteSelectedFeature(): void {
    if (!selectedId) return
    features = features.filter((f) => f.id !== selectedId)
    selectedId = null
    pendingA = null
    pendingPoly = []
    clearDraftGuides()
    syncPolyActions()
    pushLayout()
    scheduleApply()
    refreshProps()
    hint.textContent = 'Feature deleted'
  }

  function cancelPendingPlacement(): void {
    pendingA = null
    pendingPoly = []
    clearDraftGuides()
    syncPolyActions()
    hint.classList.remove('ops-editor__hint--error')
    if (tool === 'select') {
      hint.textContent =
        'Select: drag boats, drag vertices, or click a chain segment to add a point'
    } else if (POLYLINE_TOOLS.has(tool)) {
      hint.textContent =
        'Click points for the chain path; Finish chain / Enter (≥2)'
    } else if (TWO_CLICK_TOOLS.has(tool)) {
      hint.textContent =
        tool === 'sponsor'
          ? 'Click A, then B — board lies flat; stretching A–B scales uniformly'
          : 'Click A, then B (or Enter at cursor)'
    } else {
      hint.textContent = 'Placement cancelled'
    }
  }

  /**
   * Commit two-click tool B at the given ENU (already snapped by caller).
   * Same path as the second map click.
   */
  function commitTwoClickB(east: number, north: number): void {
    if (!pendingA || !TWO_CLICK_TOOLS.has(tool)) return
    let createdId: string | null = null
    if (tool === 'sponsor') {
      const created = createSponsorFeature(
        pendingA.east,
        pendingA.north,
        east,
        north,
        options.enuToGpsAmsl,
        idCounter,
      )
      features = [...features, created]
      createdId = created.id
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
      createdId = left.id
    } else if (tool === 'arrow') {
      const created = createArrowFeature(
        pendingA.east,
        pendingA.north,
        east,
        north,
        options.enuToGpsAmsl,
        idCounter,
      )
      features = [...features, created]
      createdId = created.id
    } else if (tool === 'start' || tool === 'finish') {
      const created = createLineSignFeature(
        tool,
        pendingA.east,
        pendingA.north,
        east,
        north,
        options.enuToGpsAmsl,
        idCounter,
      )
      features = [...features, created]
      createdId = created.id
    }
    pendingA = null
    clearDraftGuides()
    if (createdId) selectFeature(createdId)
    pushLayout()
    scheduleApply()
    setTool(tool)
  }

  function moveFeatureVertex(
    featureId: string,
    pointIndex: number,
    east: number,
    north: number,
  ): void {
    const idx = features.findIndex((f) => f.id === featureId)
    if (idx < 0) return
    const f = cloneFeature(features[idx]!)
    if (pointIndex < 0 || pointIndex >= f.points.length) return
    const g = options.enuToGpsAmsl(east, 0, north)
    const prev = f.points[pointIndex]!
    f.points[pointIndex] = {
      lat: g.lat,
      lon: g.lon,
      altMsl: prev.altMsl,
    }
    if (f.type === 'sponsor') {
      const scaled = applySponsorScaleOnEdit(
        features[idx]!,
        f,
        options.gpsToEnuAmsl,
      )
      f.heightM = scaled.heightM
      f.boardAspect = scaled.boardAspect
    }
    features = features.map((x, i) => (i === idx ? f : x))
    pushLayout()
    scheduleApply()
  }

  function layoutPointToEnu(p: { x: number; z: number }): {
    east: number
    north: number
  } {
    return { east: p.x, north: northFromSceneZ(p.z) }
  }

  function insertBillboardChainPoint(
    featureId: string,
    insertIndex: number,
    east: number,
    north: number,
  ): number | null {
    const idx = features.findIndex((f) => f.id === featureId)
    if (idx < 0) return null
    const f = cloneFeature(features[idx]!)
    if (f.type !== 'billboardChain') return null
    if (f.points.length >= BILLBOARD_CHAIN_MAX_POINTS) return null
    const spliceAt = Math.max(1, Math.min(f.points.length, insertIndex))
    const g = options.enuToGpsAmsl(east, 0, north)
    const neighbor = f.points[Math.max(0, spliceAt - 1)]!
    f.points.splice(spliceAt, 0, {
      lat: g.lat,
      lon: g.lon,
      altMsl: neighbor.altMsl,
    })
    features = features.map((x, i) => (i === idx ? f : x))
    selectFeature(f.id)
    pushLayout()
    scheduleApply()
    return spliceAt
  }

  function appendBillboardChainPoint(featureId: string): boolean {
    const f = features.find((x) => x.id === featureId)
    if (!f || f.type !== 'billboardChain' || f.points.length < 2) return false
    if (f.points.length >= BILLBOARD_CHAIN_MAX_POINTS) return false
    const layout = layoutFeatures([f], options.gpsToEnuAmsl)
    const pts = (layout[0]?.points ?? []).map(layoutPointToEnu)
    const extra = extendPolylineEnd(pts)
    return insertBillboardChainPoint(featureId, f.points.length, extra.east, extra.north) !== null
  }

  function clearDraftGuides(): void {

    options.map.setSnapGuide(null)
    options.map.setDraftSegment(null)
    options.map.setDraftPolyline(null)
    readout.hidden = true
    readout.textContent = ''
  }

  function syncPolyActions(): void {
    const show = tool === 'billboardChain' && pendingPoly.length >= 1
    polyActions.hidden = !show
    finishPolyBtn.disabled = pendingPoly.length < 2
  }

  async function finishBillboardChain(): Promise<void> {
    if (pendingPoly.length < 2) {
      hint.textContent = 'Need ≥2 points for a billboard chain'
      return
    }
    const textureRaw = await openLibraryLogoPicker({
      projectsApiBase: options.projectsApiBase,
      title: 'Chain logos (optional)',
      allowEmpty: true,
    })
    if (textureRaw === null) {
      hint.textContent = 'Chain cancelled'
      return
    }
    const spacingRaw = await promptModal(
      'Billboard spacing (meters)',
      String(DEFAULT_BILLBOARD_CHAIN_SPACING_M),
    )
    if (spacingRaw === null) {
      hint.textContent = 'Chain cancelled'
      return
    }
    const spacingM = Number.parseFloat(spacingRaw)
    const created = createBillboardChainFeature(
      pendingPoly,
      options.enuToGpsAmsl,
      idCounter,
      {
        spacingM:
          Number.isFinite(spacingM) && spacingM > 0
            ? spacingM
            : DEFAULT_BILLBOARD_CHAIN_SPACING_M,
        textureUrl: textureRaw === '' ? null : textureRaw,
        logos:
          textureRaw === ''
            ? []
            : [{ url: textureRaw, weight: 1 }],
      },
    )
    pendingPoly = []
    clearDraftGuides()
    syncPolyActions()
    if (!created) return
    features = [...features, created]
    selectFeature(created.id)
    pushLayout()
    scheduleApply()
    hint.textContent = `Placed ${created.name} (${created.points.length} pts)`
  }

  /**
   * Errors block; warnings ask confirm.
   * Returns false when the action should abort.
   */
  function guardExportOrSave(actionLabel: string): boolean {
    const result = validateWorldFeatures(features)
    if (!result.ok) {
      hint.textContent = formatValidationSummary(result)
      hint.classList.add('ops-editor__hint--error')
      return false
    }
    hint.classList.remove('ops-editor__hint--error')
    if (result.warnings.length > 0) {
      const lines = result.warnings.map((w) => w.message).join('\n')
      const proceed = window.confirm(
        `${actionLabel}: ${result.warnings.length} warning(s)\n\n${lines}\n\nContinue anyway?`,
      )
      if (!proceed) {
        hint.textContent = formatValidationSummary(result)
        return false
      }
    }
    hint.textContent = `${actionLabel}: ${formatValidationSummary(result)}`
    return true
  }

  function snapPoint(
    east: number,
    north: number,
  ): { east: number; north: number; mode: SnapMode } {
    let e = east
    let n = north
    let mode: SnapMode = 'none'

    if (vertexSnap) {
      const hit = options.map.nearestVertex(e, n, VERTEX_SNAP_PX)
      if (hit) {
        return { east: hit.east, north: hit.north, mode: 'vertex' }
      }
    }

    if (gridSnap) {
      const g = applySnap(e, n, [], {
        vertexEnabled: false,
        gridEnabled: true,
        gridStepM: DEFAULT_GRID_STEP_M,
      })
      e = g.east
      n = g.north
      mode = g.mode
    }

    return { east: e, north: n, mode }
  }

  function setTool(next: EditorTool): void {
    tool = next
    pendingA = null
    pendingPoly = []
    clearDraftGuides()
    syncPolyActions()
    for (const [t, btn] of toolButtons) {
      btn.classList.toggle('ops-editor__tool--active', t === tool)
    }
    hint.classList.remove('ops-editor__hint--error')
    if (tool === 'select') {
      hint.textContent =
        'Select: drag boats, drag vertices, or click a chain segment to add a point'
    } else if (POLYLINE_TOOLS.has(tool)) {
      hint.textContent =
        'Click points for the chain path; Finish chain / Enter (≥2)'
    } else if (TWO_CLICK_TOOLS.has(tool)) {
      hint.textContent =
        tool === 'arrow'
          ? 'Click position A, then heading tip B (or Enter)'
          : tool === 'start' || tool === 'finish'
            ? 'Click line end A, then B (or Enter at cursor)'
            : tool === 'sponsor'
              ? 'Click A, then B — board lies flat; stretching A–B scales uniformly'
              : 'Click A, then B (or Enter at cursor)'
    } else if (tool === 'placeBoat') {

      hint.textContent = 'Click map to place a boat (prompts for id)'
    } else if (tool === 'placeDrone') {
      hint.textContent = 'Click map to place a drone/POV (prompts for id)'
    } else if (tool === 'setAnchor') {
      hint.textContent = 'Click map to set world anchor (lat/lon)'
    } else if (tool === 'buoy') {
      hint.textContent = knownBuoyIds.length
        ? 'Click map to place buoy (optional live-id bind)'
        : 'Click map to place buoy (static; no TEL buoy ids configured)'
    } else {
      hint.textContent = 'Click map to place'
    }
    refreshProps()
  }

  function cloneFeature(f: WorldFeature): WorldFeature {
    return {
      ...f,
      points: f.points.map((p) => ({ ...p })),
      textureUrl: f.textureUrl,
      logos: f.logos?.map((l) => ({ url: l.url, weight: l.weight })),
      spacingM: f.spacingM,
      telemetryId: f.telemetryId,
    }
  }

  function pushLayout(): LayoutFeature[] {
    const layout = layoutFeatures(features, options.gpsToEnuAmsl)
    setLayoutFeatures(layout)
    options.map.setLayoutFeatures(layout)
    options.map.setSelectedFeatureIds(selectedId ? [selectedId] : [])
    options.onStoreChange?.(features)
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
    deleteBtn.disabled = !f
    inspector.refresh({
      selected: f,
      toolKind: placeKindForTool(tool),
    })
  }

  function selectFeature(id: string | null): void {
    selectedId = id
    options.map.setSelectedFeatureIds(id ? [id] : [])
    refreshProps()
  }

  function commitCoordinateDraft(
    draft: CoordinatePlaceDraft,
    mode: 'add' | 'edit',
  ): void {
    const geo = {
      gpsToEnuAmsl: options.gpsToEnuAmsl,
      enuToGpsAmsl: options.enuToGpsAmsl,
    }
    if (draft.kind === 'boat' || draft.kind === 'drone') {
      const id = (draft.telemetryId?.trim() || draft.name.trim())
      if (id === '') {
        hint.textContent = 'Telemetry id required'
        return
      }
      const input: FleetPlaceInput = {
        kind: draft.kind,
        id,
        lat: draft.lat,
        lon: draft.lon,
        altMsl: Number.isFinite(draft.altMsl) ? draft.altMsl : 0,
        name: draft.name.trim() || undefined,
        label: draft.label.trim() || undefined,
        heightM: draft.heightM,
        visibility: draft.visibility,
      }
      if (mode === 'edit') options.onEditFleetGps?.(input)
      else options.onPlaceFleetGps?.(input)
      hint.textContent =
        mode === 'edit'
          ? `Edited ${draft.kind} ${id}`
          : `Placed ${draft.kind} ${id}`
      refreshProps()
      return
    }

    const result =
      mode === 'edit' && selectedId
        ? editFromCoordinates(features, selectedId, draft, geo)
        : addFromCoordinates(features, draft, geo, idCounter)
    if (!result.ok) {
      hint.textContent = result.error
      hint.classList.add('ops-editor__hint--error')
      return
    }
    hint.classList.remove('ops-editor__hint--error')
    if (result.mode !== 'features') return
    features = result.features
    const createdId = result.createdIds[0] ?? null
    selectFeature(createdId)
    pushLayout()
    scheduleApply()
    hint.textContent =
      mode === 'edit'
        ? `Edited ${result.createdIds.join(', ')}`
        : `Placed ${result.createdIds.join(', ')}`
  }

  async function onMapClick(
    rawEast: number,
    rawNorth: number,
  ): Promise<void> {
    if (!open) return
    lastCursor = { east: rawEast, north: rawNorth }

    if (tool === 'select') {
      const hit = options.map.hitTestFeature(rawEast, rawNorth, HIT_PX)
      selectFeature(hit?.id ?? null)
      clearDraftGuides()
      hint.textContent =
        'Select: drag boats, drag vertices, or click a chain segment to add a point'
      return
    }


    const snapped = snapPoint(rawEast, rawNorth)
    const east = snapped.east
    const north = snapped.north
    lastCursor = { east, north }

    if (FLEET_PLACE_TOOLS.has(tool)) {
      if (tool === 'setAnchor') {
        const g = options.enuToGpsAmsl(east, 0, north)
        options.onSetAnchor?.(g.lat, g.lon, g.alt)
        hint.textContent = `Anchor → ${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}`
        return
      }
      const kind = tool === 'placeBoat' ? 'boat' : 'drone'
      const id = await promptModal(
        kind === 'boat' ? 'Boat id' : 'Drone / POV id',
        '',
      )
      if (id === null) return
      const trimmed = id.trim()
      if (trimmed === '') {
        hint.textContent = 'Id required'
        return
      }
      options.onPlaceFleet?.(kind, east, north, trimmed)
      hint.textContent = `Placed ${kind} ${trimmed} on map`
      return
    }

    if (POLYLINE_TOOLS.has(tool)) {
      pendingPoly = [...pendingPoly, { east, north }]
      options.map.setDraftPolyline({
        points: pendingPoly,
        cursor: null,
      })
      syncPolyActions()
      hint.textContent =
        pendingPoly.length < 2
          ? `Chain: ${pendingPoly.length} pt — click next (need ≥2)`
          : `Chain: ${pendingPoly.length} pts — Finish chain (Enter) or click more`
      return
    }

    if (TWO_CLICK_TOOLS.has(tool)) {
      if (!pendingA) {
        pendingA = { east, north }
        lastCursor = { east, north }
        hint.textContent =
          snapped.mode === 'none'
            ? 'Click B… (or Enter at cursor)'
            : `Click B… (snapped ${snapped.mode}; Enter confirms)`
        options.map.setSnapGuide({ east, north })
        return
      }
      commitTwoClickB(east, north)
      return
    }


    if (tool === 'buoy') {
      let telemetryId: string | null | undefined
      if (knownBuoyIds.length > 0) {
        const choice = await promptModal(
          `Optional live buoy id (TEL):\n${knownBuoyIds.join(', ')}\n\nLeave blank for static placement`,
          knownBuoyIds[0] ?? '',
        )
        if (choice === null) return
        const t = choice.trim()
        telemetryId = t === '' ? null : t
      }
      const created = createBuoyFeature(
        east,
        north,
        options.enuToGpsAmsl,
        idCounter,
        { telemetryId },
      )
      features = [...features, created]
      selectFeature(created.id)
      clearDraftGuides()
      pushLayout()
      scheduleApply()
      hint.textContent = telemetryId
        ? `Placed buoy (bound ${telemetryId})`
        : 'Placed buoy (static)'
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
      clearDraftGuides()
      pushLayout()
      scheduleApply()
      if (snapped.mode !== 'none') {
        hint.textContent = `Placed (snapped ${snapped.mode})`
      }
    }
  }

  function onMapPointerMove(rawEast: number, rawNorth: number): void {
    if (!open) return

    if (vertexDrag) {
      const snapped = snapPoint(rawEast, rawNorth)
      lastCursor = { east: snapped.east, north: snapped.north }
      moveFeatureVertex(
        vertexDrag.featureId,
        vertexDrag.pointIndex,
        snapped.east,
        snapped.north,
      )
      options.map.setSnapGuide({ east: snapped.east, north: snapped.north })
      return
    }

    if (boatDrag) {
      const snapped = snapPoint(rawEast, rawNorth)
      lastCursor = { east: snapped.east, north: snapped.north }
      options.onMoveFleet?.(
        'boat',
        snapped.east,
        snapped.north,
        boatDrag.id,
      )
      options.map.setSnapGuide({ east: snapped.east, north: snapped.north })
      return
    }


    if (tool === 'select') {
      return
    }

    const snapped = snapPoint(rawEast, rawNorth)
    lastCursor = { east: snapped.east, north: snapped.north }
    options.map.setSnapGuide(
      snapped.mode !== 'none'
        ? { east: snapped.east, north: snapped.north }
        : null,
    )

    if (POLYLINE_TOOLS.has(tool) && pendingPoly.length > 0) {
      options.map.setDraftPolyline({
        points: pendingPoly,
        cursor: { east: snapped.east, north: snapped.north },
      })
      options.map.setDraftSegment(null)
      readout.hidden = true
      return
    }

    if (!pendingA || !TWO_CLICK_TOOLS.has(tool)) {
      options.map.setDraftSegment(null)
      readout.hidden = true
      return
    }

    const r = segmentReadout(
      pendingA.east,
      pendingA.north,
      snapped.east,
      snapped.north,
    )
    readout.hidden = false
    const snapNote =
      snapped.mode === 'none' ? '' : ` · snap ${snapped.mode}`
    readout.textContent = `${formatSegmentReadout(r)}${snapNote}`
    options.map.setDraftSegment({
      a: pendingA,
      b: { east: snapped.east, north: snapped.north },
    })
  }

  function onMapPointerDownClaim(
    rawEast: number,
    rawNorth: number,
    ev: PointerEvent,
  ): boolean {
    if (!open || tool !== 'select' || vertexDrag || boatDrag) return false

    const boatHit = options.map.hitTestPose(
      rawEast,
      rawNorth,
      BOAT_HIT_PX,
      ['boat'],
    )
    if (boatHit) {
      const movable =
        options.canMoveFleetPose?.(boatHit.id, 'boat') ?? true
      if (!movable) {
        hint.textContent = `Boat ${boatHit.id} is live — cannot move`
        return false
      }
      options.onSelectFleetPose?.(boatHit.id, 'boat')
      boatDrag = { id: boatHit.id, pointerId: ev.pointerId }
      hint.textContent = `Dragging boat ${boatHit.id}…`
      window.addEventListener('pointerup', onBoatDragUp)
      window.addEventListener('pointercancel', onBoatDragUp)
      return true
    }

    const prefer = selectedId ? [selectedId] : undefined
    const hit = options.map.hitTestVertex(rawEast, rawNorth, HIT_PX, prefer)
    if (hit) {
      selectFeature(hit.featureId)
      vertexDrag = {
        featureId: hit.featureId,
        pointIndex: hit.pointIndex,
        pointerId: ev.pointerId,
      }
      hint.textContent = 'Dragging point…'
      window.addEventListener('pointerup', onVertexDragUp)
      window.addEventListener('pointercancel', onVertexDragUp)
      return true
    }

    const insertHit = options.map.hitTestPolylineInsert(
      rawEast,
      rawNorth,
      HIT_PX + 6,
      ['billboardChain'],
    )
    if (insertHit) {
      const newIndex = insertBillboardChainPoint(
        insertHit.featureId,
        insertHit.insertIndex,
        insertHit.east,
        insertHit.north,
      )
      if (newIndex !== null) {
        vertexDrag = {
          featureId: insertHit.featureId,
          pointIndex: newIndex,
          pointerId: ev.pointerId,
        }
        hint.textContent = 'Added chain point — drag to place'
        window.addEventListener('pointerup', onVertexDragUp)
        window.addEventListener('pointercancel', onVertexDragUp)
        return true
      }
    }

    return false
  }

  function onVertexDragUp(ev: PointerEvent): void {
    if (!vertexDrag || ev.pointerId !== vertexDrag.pointerId) return
    const drag = vertexDrag
    vertexDrag = null
    window.removeEventListener('pointerup', onVertexDragUp)
    window.removeEventListener('pointercancel', onVertexDragUp)
    // Exact final apply (clear any pending throttle jitter).
    if (applyTimer !== null) {
      window.clearTimeout(applyTimer)
      applyTimer = null
    }
    pushLayout()
    void options.onApply(features)
    options.map.setSnapGuide(null)
    hint.textContent =
      'Select: drag boats, drag vertices, or click a chain segment to add a point'
    void drag
  }

  function onBoatDragUp(ev: PointerEvent): void {
    if (!boatDrag || ev.pointerId !== boatDrag.pointerId) return
    boatDrag = null
    window.removeEventListener('pointerup', onBoatDragUp)
    window.removeEventListener('pointercancel', onBoatDragUp)
    options.map.setSnapGuide(null)
    hint.textContent =
      'Select: drag boats, drag vertices, or click a chain segment to add a point'
  }

  function onEditorKeyDown(ev: KeyboardEvent): void {
    if (!open) return
    if (isTextInputTarget(ev.target)) return

    if (ev.key === 'Escape') {
      if (pendingA || pendingPoly.length > 0) {
        ev.preventDefault()
        cancelPendingPlacement()
      }
      return
    }

    if (ev.key === 'Enter') {
      if (POLYLINE_TOOLS.has(tool) && pendingPoly.length >= 2) {
        ev.preventDefault()
        void finishBillboardChain()
        return
      }
      if (TWO_CLICK_TOOLS.has(tool) && pendingA && lastCursor) {
        ev.preventDefault()
        const snapped = snapPoint(lastCursor.east, lastCursor.north)
        commitTwoClickB(snapped.east, snapped.north)
        return
      }
      return
    }

    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (!selectedId) return
      ev.preventDefault()
      deleteSelectedFeature()
    }
  }

  const unsubClick = options.map.onMapClick(onMapClick)
  const unsubMove = options.map.onMapPointerMove(onMapPointerMove)
  const unsubPointerDown = options.map.onMapPointerDown(onMapPointerDownClaim)
  window.addEventListener('keydown', onEditorKeyDown)


  function applyOpenState(): void {
    panel.hidden = !open
    options.map.setInteractive(open)
    options.map.setSizePx(open ? resolveOpenMapSize() : mapSizeClosed)
    options.map.root.classList.toggle('ops-map--editor', open)
    if (!open) {
      pendingA = null
      clearDraftGuides()
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
      pendingPoly = []
      clearDraftGuides()
      syncPolyActions()
      pushLayout()
      if (apply3d) scheduleApply()
      refreshProps()
    },
    setProjectMeta(id: string, name: string): void {
      projectIdInput.value = id
      projectNameInput.value = name
    },
    setProjectWritesEnabled(enabled: boolean): void {
      projectWritesEnabled = enabled
      applyProjectWritesEnabled()
    },
    resyncChrome(): void {
      applyOpenState()
    },
    dispose(): void {
      if (applyTimer !== null) window.clearTimeout(applyTimer)
      vertexDrag = null
      boatDrag = null
      window.removeEventListener('keydown', onEditorKeyDown)
      window.removeEventListener('pointerup', onVertexDragUp)
      window.removeEventListener('pointercancel', onVertexDragUp)
      window.removeEventListener('pointerup', onBoatDragUp)
      window.removeEventListener('pointercancel', onBoatDragUp)
      unsubClick()
      unsubMove()
      unsubPointerDown()
      clearDraftGuides()
      inspector.dispose()
      panel.remove()
      options.map.setInteractive(false)
      options.map.setSizePx(mapSizeClosed)
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
