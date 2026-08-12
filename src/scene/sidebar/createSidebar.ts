import {

  compareSidebarSectionOrder,

  isSidebarCollapseHotkey,

  SIDEBAR_COLLAPSE_HOTKEY,

} from './hotkey.ts'

import type {

  CreateSidebarOptions,

  SidebarHandle,

  SidebarSection,

  SidebarSectionMountHandle,

} from './types.ts'



export const SIDEBAR_WIDTH_MIN = 280

export const SIDEBAR_WIDTH_DEFAULT = 340

export const SIDEBAR_WIDTH_MAX = 560



const SIDEBAR_WIDTH_STORAGE_KEY = 'bw.opsSidebar.widthPx'



type Registered = {

  section: SidebarSection

  block: HTMLElement

  body: HTMLElement

  mountHandle: SidebarSectionMountHandle

  expanded: boolean

}



/** Clamp ops sidebar rail width (px). */

export function clampSidebarWidth(widthPx: number): number {

  if (!Number.isFinite(widthPx)) return SIDEBAR_WIDTH_DEFAULT

  return Math.min(

    SIDEBAR_WIDTH_MAX,

    Math.max(SIDEBAR_WIDTH_MIN, Math.floor(widthPx)),

  )

}



function readStoredSidebarWidth(): number {

  try {

    const raw = sessionStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)

    if (raw == null || raw === '') return SIDEBAR_WIDTH_DEFAULT

    return clampSidebarWidth(Number.parseFloat(raw))

  } catch {

    return SIDEBAR_WIDTH_DEFAULT

  }

}



function writeStoredSidebarWidth(widthPx: number): void {

  try {

    sessionStorage.setItem(

      SIDEBAR_WIDTH_STORAGE_KEY,

      String(clampSidebarWidth(widthPx)),

    )

  } catch {

    /* private mode / quota */

  }

}



/**

 * Collapsible left ops sidebar shell. Sections register via `registerSection`.

 * Overlaying the canvas (same stacking idea as legacy `.ops-overlay`) — does

 * not resize/reflow WebGL when open/closed.

 *

 * Collapse only hides chrome; mounted sections stay alive (telemetry/editor).

 * Rail width is user-resizable (right-edge drag) and persisted in sessionStorage.

 */

export function createSidebar(options: CreateSidebarOptions): SidebarHandle {

  let collapsed = options.initiallyCollapsed === true

  let widthPx = readStoredSidebarWidth()

  const registry = new Map<string, Registered>()



  const root = document.createElement('div')

  root.className = 'ops-sidebar-root'

  root.setAttribute('data-ops', 'sidebar-root')



  /** Full-viewport layer for PiP / non-rail overlays (stream map). */

  const overlayHost = document.createElement('div')

  overlayHost.className = 'ops-overlay ops-sidebar-overlay-host'

  overlayHost.setAttribute('data-ops', 'sidebar-overlay-host')

  root.appendChild(overlayHost)



  const rail = document.createElement('aside')

  rail.className = 'ops-sidebar'

  rail.setAttribute('data-ops', 'sidebar')

  rail.setAttribute('aria-label', 'Ops sidebar')

  root.appendChild(rail)



  const resizeHandle = document.createElement('div')

  resizeHandle.className = 'ops-sidebar__resize'

  resizeHandle.title = 'Drag to resize sidebar'

  resizeHandle.setAttribute('role', 'separator')

  resizeHandle.setAttribute('aria-orientation', 'vertical')

  resizeHandle.setAttribute('aria-label', 'Resize ops sidebar')

  rail.appendChild(resizeHandle)



  const chrome = document.createElement('div')

  chrome.className = 'ops-sidebar__chrome'

  rail.appendChild(chrome)



  const title = document.createElement('div')

  title.className = 'ops-sidebar__title'

  title.textContent = 'Ops'

  chrome.appendChild(title)



  const collapseBtn = document.createElement('button')

  collapseBtn.type = 'button'

  collapseBtn.className = 'ops-sidebar__collapse-btn'

  collapseBtn.title = `Collapse sidebar (${SIDEBAR_COLLAPSE_HOTKEY})`

  collapseBtn.setAttribute('aria-label', 'Collapse ops sidebar')

  collapseBtn.textContent = '«'

  chrome.appendChild(collapseBtn)



  const sectionsEl = document.createElement('div')

  sectionsEl.className = 'ops-sidebar__sections'

  rail.appendChild(sectionsEl)



  /** Always-visible edge tab when the rail is collapsed (air/show). */

  const expandTab = document.createElement('button')

  expandTab.type = 'button'

  expandTab.className = 'ops-sidebar__expand-tab'

  expandTab.title = `Show ops sidebar (${SIDEBAR_COLLAPSE_HOTKEY})`

  expandTab.setAttribute('aria-label', 'Show ops sidebar')

  expandTab.textContent = 'Ops ›'

  root.appendChild(expandTab)



  options.container.appendChild(root)



  function applyWidth(): void {

    const w = clampSidebarWidth(widthPx)

    widthPx = w

    root.style.setProperty('--ops-sidebar-width', `${w}px`)

    rail.style.width = `${w}px`

  }



  function applyCollapsed(): void {

    rail.hidden = collapsed

    expandTab.hidden = !collapsed

    root.classList.toggle('ops-sidebar-root--collapsed', collapsed)

    root.dataset.collapsed = collapsed ? '1' : '0'

  }



  function setCollapsed(next: boolean): void {

    collapsed = next

    applyCollapsed()

  }



  collapseBtn.addEventListener('click', () => {

    setCollapsed(true)

  })

  expandTab.addEventListener('click', () => {

    setCollapsed(false)

  })



  // Drag-resize rail width (CSS var also shifts world-authoring / stream-map left).

  let resizePointerId: number | null = null

  let resizeStartX = 0

  let resizeStartWidth = widthPx



  function onResizeMove(ev: PointerEvent): void {

    if (resizePointerId === null || ev.pointerId !== resizePointerId) return

    widthPx = clampSidebarWidth(resizeStartWidth + (ev.clientX - resizeStartX))

    applyWidth()

  }



  function onResizeUp(ev: PointerEvent): void {

    if (resizePointerId === null || ev.pointerId !== resizePointerId) return

    resizePointerId = null

    writeStoredSidebarWidth(widthPx)

    window.removeEventListener('pointermove', onResizeMove)

    window.removeEventListener('pointerup', onResizeUp)

    window.removeEventListener('pointercancel', onResizeUp)

  }



  resizeHandle.addEventListener('pointerdown', (ev) => {

    if (ev.button !== 0 || collapsed) return

    ev.preventDefault()

    ev.stopPropagation()

    resizePointerId = ev.pointerId

    resizeStartX = ev.clientX

    resizeStartWidth = widthPx

    window.addEventListener('pointermove', onResizeMove)

    window.addEventListener('pointerup', onResizeUp)

    window.addEventListener('pointercancel', onResizeUp)

  })



  function onKeyDown(ev: KeyboardEvent): void {

    if (!isSidebarCollapseHotkey(ev)) return

    const target = ev.target as HTMLElement | null

    if (

      target &&

      (target.tagName === 'INPUT' ||

        target.tagName === 'SELECT' ||

        target.tagName === 'TEXTAREA' ||

        target.isContentEditable)

    ) {

      return

    }

    ev.preventDefault()

    setCollapsed(!collapsed)

  }

  window.addEventListener('keydown', onKeyDown)



  function rebuildSectionOrder(): void {

    const ordered = [...registry.values()].sort((a, b) =>

      compareSidebarSectionOrder(a.section, b.section),

    )

    for (const entry of ordered) {

      sectionsEl.appendChild(entry.block)

    }

  }



  function registerSection(section: SidebarSection): void {

    const id = section.id.trim()

    if (!id) throw new Error('sidebar section id required')

    if (registry.has(id)) {

      throw new Error(`sidebar section already registered: ${id}`)

    }



    const block = document.createElement('section')

    block.className = 'ops-sidebar__section'

    block.dataset.sectionId = id



    const header = document.createElement('button')

    header.type = 'button'

    header.className = 'ops-sidebar__section-header'

    header.setAttribute('aria-expanded', 'true')



    const labelEl = document.createElement('span')

    labelEl.className = 'ops-sidebar__section-label'

    labelEl.textContent = section.label

    header.appendChild(labelEl)



    const chevron = document.createElement('span')

    chevron.className = 'ops-sidebar__section-chevron'

    chevron.textContent = '▾'

    header.appendChild(chevron)



    const body = document.createElement('div')

    body.className = 'ops-sidebar__section-body'

    body.setAttribute('data-ops-section', id)



    block.append(header, body)

    sectionsEl.appendChild(block)



    const mountHandle = section.mount(body)

    const entry: Registered = {

      section: { ...section, id },

      block,

      body,

      mountHandle,

      expanded: true,

    }

    registry.set(id, entry)



    header.addEventListener('click', () => {

      entry.expanded = !entry.expanded

      body.hidden = !entry.expanded

      header.setAttribute('aria-expanded', entry.expanded ? 'true' : 'false')

      chevron.textContent = entry.expanded ? '▾' : '▸'

    })



    rebuildSectionOrder()

  }



  function unregisterSection(id: string): void {

    const entry = registry.get(id)

    if (!entry) return

    try {

      entry.mountHandle.dispose()

    } catch {

      /* panel dispose best-effort */

    }

    entry.block.remove()

    registry.delete(id)

  }



  applyWidth()

  applyCollapsed()



  return {

    root,

    registerSection,

    unregisterSection,

    setCollapsed,

    isCollapsed: () => collapsed,

    getOverlayHost: () => overlayHost,

    dispose(): void {

      window.removeEventListener('keydown', onKeyDown)

      window.removeEventListener('pointermove', onResizeMove)

      window.removeEventListener('pointerup', onResizeUp)

      window.removeEventListener('pointercancel', onResizeUp)

      for (const id of [...registry.keys()]) {

        unregisterSection(id)

      }

      root.remove()

    },

  }

}


