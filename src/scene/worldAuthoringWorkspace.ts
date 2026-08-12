/**

 * Dedicated World Authoring workspace — large DOM overlay with 2D map + tool hosts.

 * Never WebGL (NDI invariant). Design: docs/architecture/world-authoring-workspace.md

 *

 * Close uses the `hidden` attribute; CSS must include `.world-authoring[hidden] { display: none }`

 * because the panel's author `display: flex` otherwise wins over the UA `[hidden]` rule.

 * Map size is user-resizable (drag handle) with sessionStorage persistence; callers should

 * re-layout the map canvas backing store via `getMapSizePx` / `onMapSizeChange`.

 */



export const WORLD_AUTHORING_MAP_SIZE_MIN = 420

export const WORLD_AUTHORING_MAP_SIZE = 560

export const WORLD_AUTHORING_MAP_SIZE_MAX = 900



const MAP_SIZE_STORAGE_KEY = 'bw.worldAuthoring.mapSizePx'



export type WorldAuthoringWorkspaceOptions = {

  /** Overlay host (`sidebar.getOverlayHost()` / app). */

  container: HTMLElement

  /** Start open (editor role default; air closed). */

  initiallyOpen?: boolean

  initiallyMaximized?: boolean

  /** Fired after open state changes (editor + launcher sync). */

  onOpenChange?: (open: boolean) => void

}



export type WorldAuthoringWorkspaceHandle = {

  root: HTMLElement

  getMapHost: () => HTMLElement

  getToolsHost: () => HTMLElement

  setOpen: (open: boolean) => void

  isOpen: () => boolean

  setMaximized: (maximized: boolean) => void

  isMaximized: () => boolean

  /** Current map canvas size (px); maximized may bump to max. */

  getMapSizePx: () => number

  /** Subscribe to user (or maximize) map size changes; returns unsubscribe. */

  onMapSizeChange: (cb: (sizePx: number) => void) => () => void

  /** Status line under the header (e.g. feature count). */

  setStatus: (text: string) => void

  /** Subscribe to open changes; returns unsubscribe. */

  onOpenChange: (cb: (open: boolean) => void) => () => void

  dispose: () => void

}



export type WorldMapAuthoringLauncherHandle = {

  /** Sync Open/Close button + status from workspace. */

  sync: () => void

  dispose: () => void

}



/** Clamp authoring map canvas size to the supported range. */

export function clampAuthoringMapSize(sizePx: number): number {

  if (!Number.isFinite(sizePx)) return WORLD_AUTHORING_MAP_SIZE

  return Math.min(

    WORLD_AUTHORING_MAP_SIZE_MAX,

    Math.max(WORLD_AUTHORING_MAP_SIZE_MIN, Math.floor(sizePx)),

  )

}



function readStoredMapSize(): number {

  try {

    const raw = sessionStorage.getItem(MAP_SIZE_STORAGE_KEY)

    if (raw == null || raw === '') return WORLD_AUTHORING_MAP_SIZE

    return clampAuthoringMapSize(Number.parseFloat(raw))

  } catch {

    return WORLD_AUTHORING_MAP_SIZE

  }

}



function writeStoredMapSize(sizePx: number): void {

  try {

    sessionStorage.setItem(MAP_SIZE_STORAGE_KEY, String(clampAuthoringMapSize(sizePx)))

  } catch {

    /* private mode / quota */

  }

}



/**

 * Resolve initial authoring open state.

 * `?editor=1` / `?editor=0` force; else editor role (writes) → open, air → closed.

 */

export function resolveAuthoringInitiallyOpen(

  projectWritesEnabled: boolean,

  search: string = typeof window !== 'undefined' ? window.location.search : '',

): boolean {

  try {

    const q = new URLSearchParams(search).get('editor')

    if (q === '1') return true

    if (q === '0') return false

  } catch {

    /* ignore */

  }

  return projectWritesEnabled

}



/**

 * Floating/docked World Authoring window over the canvas (right of the sidebar rail).

 */

export function createWorldAuthoringWorkspace(

  options: WorldAuthoringWorkspaceOptions,

): WorldAuthoringWorkspaceHandle {

  let open = options.initiallyOpen === true

  let maximized = options.initiallyMaximized === true

  let userMapSizePx = readStoredMapSize()

  const openListeners = new Set<(open: boolean) => void>()

  const mapSizeListeners = new Set<(sizePx: number) => void>()



  const root = document.createElement('div')

  root.className = 'world-authoring'

  root.setAttribute('data-ops', 'world-authoring')

  root.setAttribute('role', 'dialog')

  root.setAttribute('aria-label', 'World authoring')

  root.hidden = !open



  const header = document.createElement('div')

  header.className = 'world-authoring__header'

  root.appendChild(header)



  const title = document.createElement('div')

  title.className = 'world-authoring__title'

  title.textContent = 'World authoring'

  header.appendChild(title)



  const headerActions = document.createElement('div')

  headerActions.className = 'world-authoring__header-actions'

  header.appendChild(headerActions)



  const maximizeBtn = document.createElement('button')

  maximizeBtn.type = 'button'

  maximizeBtn.className = 'ops-hud__btn world-authoring__max-btn'

  maximizeBtn.addEventListener('click', () => {

    setMaximized(!maximized)

  })

  headerActions.appendChild(maximizeBtn)



  const closeBtn = document.createElement('button')

  closeBtn.type = 'button'

  closeBtn.className = 'ops-hud__btn world-authoring__close-btn'

  closeBtn.textContent = 'Close'

  closeBtn.title = 'Close authoring workspace (features retained)'

  closeBtn.addEventListener('click', () => {

    setOpen(false)

  })

  headerActions.appendChild(closeBtn)



  const statusEl = document.createElement('div')

  statusEl.className = 'world-authoring__status'

  statusEl.textContent = open ? 'Authoring: open' : 'Authoring: closed'

  root.appendChild(statusEl)



  const body = document.createElement('div')

  body.className = 'world-authoring__body'

  root.appendChild(body)



  const toolsHost = document.createElement('div')

  toolsHost.className = 'world-authoring__tools'

  toolsHost.setAttribute('data-ops', 'world-authoring-tools')

  body.appendChild(toolsHost)



  const mapWrap = document.createElement('div')

  mapWrap.className = 'world-authoring__map-wrap'

  body.appendChild(mapWrap)



  const mapHost = document.createElement('div')

  mapHost.className = 'world-authoring__map'

  mapHost.setAttribute('data-ops', 'world-authoring-map')

  mapWrap.appendChild(mapHost)



  const mapResize = document.createElement('div')

  mapResize.className = 'world-authoring__map-resize'

  mapResize.title = 'Drag to resize map'

  mapResize.setAttribute('role', 'separator')

  mapResize.setAttribute('aria-orientation', 'horizontal')

  mapResize.setAttribute('aria-label', 'Resize authoring map')

  mapWrap.appendChild(mapResize)



  options.container.appendChild(root)



  function resolveMapSizePx(): number {

    if (maximized) {

      return Math.max(userMapSizePx, WORLD_AUTHORING_MAP_SIZE_MAX)

    }

    return userMapSizePx

  }



  function notifyMapSize(): void {

    const size = resolveMapSizePx()

    for (const cb of mapSizeListeners) cb(size)

  }



  function setUserMapSize(next: number, persist: boolean): void {

    const clamped = clampAuthoringMapSize(next)

    if (clamped === userMapSizePx) {

      notifyMapSize()

      return

    }

    userMapSizePx = clamped

    if (persist) writeStoredMapSize(userMapSizePx)

    notifyMapSize()

  }



  function applyMaximizedChrome(): void {

    root.classList.toggle('world-authoring--maximized', maximized)

    maximizeBtn.textContent = maximized ? 'Restore' : 'Maximize'

    maximizeBtn.title = maximized

      ? 'Restore workspace size'

      : 'Maximize workspace'

  }



  function notifyOpen(): void {

    options.onOpenChange?.(open)

    for (const cb of openListeners) cb(open)

  }



  function setOpen(next: boolean): void {

    if (open === next) {

      root.hidden = !open

      statusEl.textContent = open ? 'Authoring: open' : 'Authoring: closed'

      return

    }

    open = next

    root.hidden = !open

    statusEl.textContent = open ? 'Authoring: open' : 'Authoring: closed'

    notifyOpen()

  }



  function setMaximized(next: boolean): void {

    if (maximized === next) return

    maximized = next

    applyMaximizedChrome()

    notifyMapSize()

  }



  // Drag-resize map canvas (backing store re-layout is caller's job via onMapSizeChange).

  let resizePointerId: number | null = null

  let resizeStartX = 0

  let resizeStartY = 0

  let resizeStartSize = userMapSizePx



  function onMapResizeMove(ev: PointerEvent): void {

    if (resizePointerId === null || ev.pointerId !== resizePointerId) return

    const delta = Math.max(ev.clientX - resizeStartX, ev.clientY - resizeStartY)

    setUserMapSize(resizeStartSize + delta, false)

  }



  function onMapResizeUp(ev: PointerEvent): void {

    if (resizePointerId === null || ev.pointerId !== resizePointerId) return

    resizePointerId = null

    writeStoredMapSize(userMapSizePx)

    window.removeEventListener('pointermove', onMapResizeMove)

    window.removeEventListener('pointerup', onMapResizeUp)

    window.removeEventListener('pointercancel', onMapResizeUp)

  }



  mapResize.addEventListener('pointerdown', (ev) => {

    if (ev.button !== 0) return

    ev.preventDefault()

    ev.stopPropagation()

    if (maximized) setMaximized(false)

    resizePointerId = ev.pointerId

    resizeStartX = ev.clientX

    resizeStartY = ev.clientY

    resizeStartSize = userMapSizePx

    window.addEventListener('pointermove', onMapResizeMove)

    window.addEventListener('pointerup', onMapResizeUp)

    window.addEventListener('pointercancel', onMapResizeUp)

  })



  applyMaximizedChrome()



  return {

    root,

    getMapHost: () => mapHost,

    getToolsHost: () => toolsHost,

    setOpen,

    isOpen: () => open,

    setMaximized,

    isMaximized: () => maximized,

    getMapSizePx: () => resolveMapSizePx(),

    onMapSizeChange(cb): () => void {

      mapSizeListeners.add(cb)

      return () => {

        mapSizeListeners.delete(cb)

      }

    },

    setStatus(text: string): void {

      statusEl.textContent = text

    },

    onOpenChange(cb): () => void {

      openListeners.add(cb)

      return () => {

        openListeners.delete(cb)

      }

    },

    dispose(): void {

      openListeners.clear()

      mapSizeListeners.clear()

      window.removeEventListener('pointermove', onMapResizeMove)

      window.removeEventListener('pointerup', onMapResizeUp)

      window.removeEventListener('pointercancel', onMapResizeUp)

      root.remove()

    },

  }

}



/**

 * World Map sidebar section: Open/Close launcher + short hint (not the tool home).

 */

export function mountWorldMapAuthoringLauncher(

  container: HTMLElement,

  workspace: WorldAuthoringWorkspaceHandle,

): WorldMapAuthoringLauncherHandle {

  const wrap = document.createElement('div')

  wrap.className = 'world-map-launcher'

  wrap.setAttribute('data-ops', 'world-map-launcher')



  const hint = document.createElement('p')

  hint.className = 'world-map-launcher__hint'

  hint.textContent =

    'Place start, finish, flags, billboard chains, buoys on the 2D map — 3D updates live.'

  wrap.appendChild(hint)



  const row = document.createElement('div')

  row.className = 'world-map-launcher__row'

  wrap.appendChild(row)



  const toggleBtn = document.createElement('button')

  toggleBtn.type = 'button'

  toggleBtn.className = 'ops-hud__btn world-map-launcher__toggle'

  toggleBtn.addEventListener('click', () => {

    workspace.setOpen(!workspace.isOpen())

  })

  row.appendChild(toggleBtn)



  const status = document.createElement('span')

  status.className = 'world-map-launcher__status'

  row.appendChild(status)



  const note = document.createElement('p')

  note.className = 'world-map-launcher__note'

  note.textContent =

    'OSM / Fit live on the map toolbar inside the authoring window.'

  wrap.appendChild(note)



  container.appendChild(wrap)



  function sync(): void {

    const open = workspace.isOpen()

    toggleBtn.textContent = open ? 'Close authoring' : 'Open authoring'

    toggleBtn.title = open

      ? 'Hide the World Authoring window (features kept)'

      : 'Open the World Authoring window (large map + tools)'

    status.textContent = open ? 'Authoring: open' : 'Authoring: closed'

    wrap.dataset.open = open ? '1' : '0'

  }



  const unsub = workspace.onOpenChange(() => {

    sync()

  })

  sync()



  return {

    sync,

    dispose(): void {

      unsub()

      wrap.remove()

    },

  }

}


