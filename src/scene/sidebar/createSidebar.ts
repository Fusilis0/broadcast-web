import {
  compareSidebarSectionOrder,
  isSidebarCollapseHotkey,
  SIDEBAR_COLLAPSE_HOTKEY,
} from './hotkey.ts'
import {
  parseAccordionState,
  parseStoredCollapsedFlag,
  railForSection,
  resolveSectionExpanded,
  serializeAccordionState,
  SIDEBAR_ACCORDION_STORAGE_KEY,
  SIDEBAR_LEFT_COLLAPSE_STORAGE_KEY,
  SIDEBAR_LEFT_WIDTH_STORAGE_KEY,
  SIDEBAR_RIGHT_COLLAPSE_STORAGE_KEY,
  SIDEBAR_RIGHT_WIDTH_STORAGE_KEY,
  type OpsRailId,
} from './railLayout.ts'
import type {
  CreateSidebarOptions,
  SidebarHandle,
  SidebarSection,
  SidebarSectionMountHandle,
} from './types.ts'

export const SIDEBAR_WIDTH_MIN = 280
export const SIDEBAR_WIDTH_DEFAULT = 340
export const SIDEBAR_WIDTH_MAX = 560

type Registered = {
  section: SidebarSection
  rail: OpsRailId
  block: HTMLElement
  body: HTMLElement
  header: HTMLButtonElement
  chevron: HTMLElement
  mountHandle: SidebarSectionMountHandle
  expanded: boolean
}

type RailChrome = {
  id: OpsRailId
  rail: HTMLElement
  sectionsEl: HTMLElement
  expandTab: HTMLButtonElement
  collapsed: boolean
  widthPx: number
}

/** Clamp ops sidebar rail width (px). */
export function clampSidebarWidth(widthPx: number): number {
  if (!Number.isFinite(widthPx)) return SIDEBAR_WIDTH_DEFAULT
  return Math.min(
    SIDEBAR_WIDTH_MAX,
    Math.max(SIDEBAR_WIDTH_MIN, Math.floor(widthPx)),
  )
}

function readStoredWidth(key: string): number {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw == null || raw === '') return SIDEBAR_WIDTH_DEFAULT
    return clampSidebarWidth(Number.parseFloat(raw))
  } catch {
    return SIDEBAR_WIDTH_DEFAULT
  }
}

function writeStoredWidth(key: string, widthPx: number): void {
  try {
    sessionStorage.setItem(key, String(clampSidebarWidth(widthPx)))
  } catch {
    /* private mode / quota */
  }
}

function readStoredCollapsed(key: string, fallback: boolean): boolean {
  try {
    return parseStoredCollapsedFlag(sessionStorage.getItem(key), fallback)
  } catch {
    return fallback
  }
}

function writeStoredCollapsed(key: string, collapsed: boolean): void {
  try {
    sessionStorage.setItem(key, collapsed ? '1' : '0')
  } catch {
    /* private mode / quota */
  }
}

function readAccordion(): Record<string, boolean> {
  try {
    return parseAccordionState(sessionStorage.getItem(SIDEBAR_ACCORDION_STORAGE_KEY))
  } catch {
    return {}
  }
}

function writeAccordion(state: Record<string, boolean>): void {
  try {
    sessionStorage.setItem(
      SIDEBAR_ACCORDION_STORAGE_KEY,
      serializeAccordionState(state),
    )
  } catch {
    /* private mode / quota */
  }
}

/**
 * Two-rail ops sidebar shell. Sections register via `registerSection` and are
 * routed by `railForSection` (BW grouping). Overlaying the canvas — does not
 * resize/reflow WebGL when open/closed.
 *
 * Collapse only hides chrome; mounted sections stay alive (telemetry/editor).
 * Each rail is independently resizable; widths + collapse + accordion state
 * persist in sessionStorage.
 */
export function createSidebar(options: CreateSidebarOptions): SidebarHandle {
  const registry = new Map<string, Registered>()
  const accordionState = readAccordion()
  const windowCleanups: Array<() => void> = []

  const root = document.createElement('div')
  root.className = 'ops-sidebar-root'
  root.setAttribute('data-ops', 'sidebar-root')

  /** Full-viewport layer for PiP / non-rail overlays (stream map). */
  const overlayHost = document.createElement('div')
  overlayHost.className = 'ops-overlay ops-sidebar-overlay-host'
  overlayHost.setAttribute('data-ops', 'sidebar-overlay-host')
  root.appendChild(overlayHost)

  const left = createRail({
    id: 'left',
    title: 'Race setup',
    ariaLabel: 'Race setup sidebar',
    collapseLabel: 'Collapse race setup sidebar',
    expandLabel: 'Show race setup sidebar',
    expandTabText: 'Setup ›',
    widthKey: SIDEBAR_LEFT_WIDTH_STORAGE_KEY,
    initiallyCollapsed: readStoredCollapsed(
      SIDEBAR_LEFT_COLLAPSE_STORAGE_KEY,
      options.initiallyCollapsed === true,
    ),
    dataOps: 'sidebar',
  })

  const right = createRail({
    id: 'right',
    title: 'Broadcast',
    ariaLabel: 'Broadcast sidebar',
    collapseLabel: 'Collapse broadcast sidebar',
    expandLabel: 'Show broadcast sidebar',
    expandTabText: '‹ Broadcast',
    widthKey: SIDEBAR_RIGHT_WIDTH_STORAGE_KEY,
    initiallyCollapsed: readStoredCollapsed(
      SIDEBAR_RIGHT_COLLAPSE_STORAGE_KEY,
      options.initiallyRightCollapsed === true,
    ),
    dataOps: 'sidebar-right',
  })

  const rails: Record<OpsRailId, RailChrome> = { left, right }

  options.container.appendChild(root)

  function applyInsets(): void {
    const leftW = left.collapsed ? 0 : left.widthPx
    const rightW = right.collapsed ? 0 : right.widthPx
    root.style.setProperty('--ops-sidebar-width', `${left.widthPx}px`)
    root.style.setProperty('--ops-sidebar-right-width', `${right.widthPx}px`)
    root.style.setProperty('--ops-sidebar-inset-left', `${leftW}px`)
    root.style.setProperty('--ops-sidebar-inset-right', `${rightW}px`)
    root.classList.toggle('ops-sidebar-root--collapsed', left.collapsed)
    root.classList.toggle('ops-sidebar-root--left-collapsed', left.collapsed)
    root.classList.toggle('ops-sidebar-root--right-collapsed', right.collapsed)
    root.dataset.collapsed = left.collapsed && right.collapsed ? '1' : '0'
  }

  function applyRail(chrome: RailChrome): void {
    const w = clampSidebarWidth(chrome.widthPx)
    chrome.widthPx = w
    chrome.rail.style.width = `${w}px`
    chrome.rail.hidden = chrome.collapsed
    chrome.expandTab.hidden = !chrome.collapsed
    applyInsets()
  }

  function setRailCollapsed(rail: OpsRailId, next: boolean): void {
    const chrome = rails[rail]
    chrome.collapsed = next
    writeStoredCollapsed(
      rail === 'left'
        ? SIDEBAR_LEFT_COLLAPSE_STORAGE_KEY
        : SIDEBAR_RIGHT_COLLAPSE_STORAGE_KEY,
      next,
    )
    applyRail(chrome)
  }

  function createRail(spec: {
    id: OpsRailId
    title: string
    ariaLabel: string
    collapseLabel: string
    expandLabel: string
    expandTabText: string
    widthKey: string
    initiallyCollapsed: boolean
    dataOps: string
  }): RailChrome {
    const rail = document.createElement('aside')
    rail.className =
      spec.id === 'right' ? 'ops-sidebar ops-sidebar--right' : 'ops-sidebar'
    rail.setAttribute('data-ops', spec.dataOps)
    rail.setAttribute('aria-label', spec.ariaLabel)
    root.appendChild(rail)

    const resizeHandle = document.createElement('div')
    resizeHandle.className = 'ops-sidebar__resize'
    resizeHandle.title = 'Drag to resize sidebar'
    resizeHandle.setAttribute('role', 'separator')
    resizeHandle.setAttribute('aria-orientation', 'vertical')
    resizeHandle.setAttribute(
      'aria-label',
      spec.id === 'right' ? 'Resize broadcast sidebar' : 'Resize ops sidebar',
    )
    rail.appendChild(resizeHandle)

    const chrome = document.createElement('div')
    chrome.className = 'ops-sidebar__chrome'
    rail.appendChild(chrome)

    const title = document.createElement('div')
    title.className = 'ops-sidebar__title'
    title.textContent = spec.title
    chrome.appendChild(title)

    const collapseBtn = document.createElement('button')
    collapseBtn.type = 'button'
    collapseBtn.className = 'ops-sidebar__collapse-btn'
    collapseBtn.title = `Collapse sidebar (${SIDEBAR_COLLAPSE_HOTKEY})`
    collapseBtn.setAttribute('aria-label', spec.collapseLabel)
    collapseBtn.textContent = spec.id === 'right' ? '»' : '«'
    chrome.appendChild(collapseBtn)

    const sectionsEl = document.createElement('div')
    sectionsEl.className = 'ops-sidebar__sections'
    rail.appendChild(sectionsEl)

    const expandTab = document.createElement('button')
    expandTab.type = 'button'
    expandTab.className =
      spec.id === 'right'
        ? 'ops-sidebar__expand-tab ops-sidebar__expand-tab--right'
        : 'ops-sidebar__expand-tab'
    expandTab.title = `Show sidebar (${SIDEBAR_COLLAPSE_HOTKEY})`
    expandTab.setAttribute('aria-label', spec.expandLabel)
    expandTab.textContent = spec.expandTabText
    root.appendChild(expandTab)

    const state: RailChrome = {
      id: spec.id,
      rail,
      sectionsEl,
      expandTab,
      collapsed: spec.initiallyCollapsed,
      widthPx: readStoredWidth(spec.widthKey),
    }

    collapseBtn.addEventListener('click', () => {
      setRailCollapsed(spec.id, true)
    })
    expandTab.addEventListener('click', () => {
      setRailCollapsed(spec.id, false)
    })

    let resizePointerId: number | null = null
    let resizeStartX = 0
    let resizeStartWidth = state.widthPx

    function onResizeMove(ev: PointerEvent): void {
      if (resizePointerId === null || ev.pointerId !== resizePointerId) return
      const delta =
        spec.id === 'right'
          ? resizeStartX - ev.clientX
          : ev.clientX - resizeStartX
      state.widthPx = clampSidebarWidth(resizeStartWidth + delta)
      applyRail(state)
    }

    function onResizeUp(ev: PointerEvent): void {
      if (resizePointerId === null || ev.pointerId !== resizePointerId) return
      stopResize()
      writeStoredWidth(spec.widthKey, state.widthPx)
    }

    function stopResize(): void {
      if (resizePointerId === null) return
      resizePointerId = null
      window.removeEventListener('pointermove', onResizeMove)
      window.removeEventListener('pointerup', onResizeUp)
      window.removeEventListener('pointercancel', onResizeUp)
    }

    resizeHandle.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || state.collapsed) return
      ev.preventDefault()
      ev.stopPropagation()
      resizePointerId = ev.pointerId
      resizeStartX = ev.clientX
      resizeStartWidth = state.widthPx
      window.addEventListener('pointermove', onResizeMove)
      window.addEventListener('pointerup', onResizeUp)
      window.addEventListener('pointercancel', onResizeUp)
    })

    windowCleanups.push(stopResize)

    return state
  }

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
    // Air/show: if either rail is open, hide both; if both hidden, restore both.
    const anyOpen = !left.collapsed || !right.collapsed
    setRailCollapsed('left', anyOpen)
    setRailCollapsed('right', anyOpen)
  }
  window.addEventListener('keydown', onKeyDown)

  function rebuildRail(railId: OpsRailId): void {
    const host = rails[railId].sectionsEl
    const ordered = [...registry.values()]
      .filter((entry) => entry.rail === railId)
      .sort((a, b) => compareSidebarSectionOrder(a.section, b.section))
    for (const entry of ordered) {
      host.appendChild(entry.block)
    }
  }

  function applyExpanded(entry: Registered): void {
    entry.body.hidden = !entry.expanded
    entry.header.setAttribute('aria-expanded', entry.expanded ? 'true' : 'false')
    entry.chevron.textContent = entry.expanded ? '▾' : '▸'
  }

  function persistAccordion(): void {
    const next: Record<string, boolean> = {}
    for (const [id, entry] of registry) {
      next[id] = entry.expanded
    }
    Object.assign(accordionState, next)
    writeAccordion(accordionState)
  }

  function registerSection(section: SidebarSection): void {
    const id = section.id.trim()
    if (!id) throw new Error('sidebar section id required')
    if (registry.has(id)) {
      throw new Error(`sidebar section already registered: ${id}`)
    }

    const railId = railForSection(id)
    const block = document.createElement('section')
    block.className = 'ops-sidebar__section'
    block.dataset.sectionId = id

    const header = document.createElement('button')
    header.type = 'button'
    header.className = 'ops-sidebar__section-header'

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
    rails[railId].sectionsEl.appendChild(block)

    const mountHandle = section.mount(body)
    const entry: Registered = {
      section: { ...section, id },
      rail: railId,
      block,
      body,
      header,
      chevron,
      mountHandle,
      expanded: resolveSectionExpanded(id, accordionState),
    }
    registry.set(id, entry)
    applyExpanded(entry)

    header.addEventListener('click', () => {
      entry.expanded = !entry.expanded
      applyExpanded(entry)
      persistAccordion()
    })

    rebuildRail(railId)
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

  applyRail(left)
  applyRail(right)

  return {
    root,
    registerSection,
    unregisterSection,
    setCollapsed: (collapsed) => {
      setRailCollapsed('left', collapsed)
    },
    isCollapsed: () => left.collapsed,
    setRailCollapsed,
    isRailCollapsed: (rail) => rails[rail].collapsed,
    getOverlayHost: () => overlayHost,
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown)
      for (const stop of windowCleanups) stop()
      for (const id of [...registry.keys()]) {
        unregisterSection(id)
      }
      root.remove()
    },
  }
}
