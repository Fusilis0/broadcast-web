/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clampSidebarWidth,
  createSidebar,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from './createSidebar.ts'
import {
  compareSidebarSectionOrder,
  isSidebarCollapseHotkey,
  SIDEBAR_COLLAPSE_HOTKEY,
} from './hotkey.ts'
import {
  SIDEBAR_ACCORDION_STORAGE_KEY,
  SIDEBAR_LEFT_COLLAPSE_STORAGE_KEY,
  SIDEBAR_RIGHT_COLLAPSE_STORAGE_KEY,
} from './railLayout.ts'

const here = dirname(fileURLToPath(import.meta.url))

afterEach(() => {
  sessionStorage.clear()
  document.body.replaceChildren()
})

describe('isSidebarCollapseHotkey', () => {
  it('matches backtick / Backquote without modifiers', () => {
    expect(SIDEBAR_COLLAPSE_HOTKEY).toBe('`')
    expect(
      isSidebarCollapseHotkey({
        key: '`',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe(true)
    expect(
      isSidebarCollapseHotkey({
        key: 'Backquote',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe(true)
  })

  it('ignores modifiers and digit POV keys', () => {
    expect(
      isSidebarCollapseHotkey({
        key: '`',
        altKey: false,
        ctrlKey: true,
        metaKey: false,
      }),
    ).toBe(false)
    expect(
      isSidebarCollapseHotkey({
        key: '1',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe(false)
    expect(
      isSidebarCollapseHotkey({
        key: 'Tab',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBe(false)
  })
})

describe('compareSidebarSectionOrder', () => {
  it('sorts by order then id', () => {
    const rows = [
      { id: 'ops', order: 60 },
      { id: 'project', order: 10 },
      { id: 'ndi', order: 55 },
      { id: 'live', order: 50 },
      { id: 'world-map', order: 20 },
    ]
    rows.sort(compareSidebarSectionOrder)
    expect(rows.map((r) => r.id)).toEqual([
      'project',
      'world-map',
      'live',
      'ndi',
      'ops',
    ])
  })
})

describe('clampSidebarWidth', () => {
  it('clamps to 280–560 and defaults non-finite', () => {
    expect(SIDEBAR_WIDTH_MIN).toBe(280)
    expect(SIDEBAR_WIDTH_DEFAULT).toBe(340)
    expect(SIDEBAR_WIDTH_MAX).toBe(560)
    expect(clampSidebarWidth(100)).toBe(280)
    expect(clampSidebarWidth(900)).toBe(560)
    expect(clampSidebarWidth(400.7)).toBe(400)
    expect(clampSidebarWidth(Number.NaN)).toBe(SIDEBAR_WIDTH_DEFAULT)
  })
})

describe('createSidebar two-rail shell', () => {
  function mountEmpty(id: string) {
    return {
      id,
      label: id,
      order: 10,
      mount(container: HTMLElement) {
        const el = document.createElement('div')
        el.textContent = id
        container.appendChild(el)
        return { dispose() {} }
      },
    }
  }

  it('routes BW grouping into left vs right rails and keeps section ids', () => {
    const host = document.createElement('div')
    const sidebar = createSidebar({ container: host })
    for (const id of [
      'project',
      'live',
      'assets',
      'world-map',
      'library',
      'ops',
      'ndi',
      'flow',
      'calib',
      'environment',
      'wind',
    ]) {
      sidebar.registerSection(mountEmpty(id))
    }
    const left = host.querySelector('[data-ops="sidebar"]')
    const right = host.querySelector('[data-ops="sidebar-right"]')
    expect(left).toBeTruthy()
    expect(right).toBeTruthy()
    expect(left?.querySelector('[data-ops-section="project"]')).toBeTruthy()
    expect(left?.querySelector('[data-ops-section="live"]')).toBeTruthy()
    expect(left?.querySelector('[data-ops-section="assets"]')).toBeTruthy()
    expect(left?.querySelector('[data-ops-section="world-map"]')).toBeTruthy()
    expect(right?.querySelector('[data-ops-section="ndi"]')).toBeTruthy()
    expect(right?.querySelector('[data-ops-section="flow"]')).toBeTruthy()
    expect(right?.querySelector('[data-ops-section="calib"]')).toBeTruthy()
    expect(right?.querySelector('[data-ops-section="environment"]')).toBeTruthy()
    expect(right?.querySelector('[data-ops-section="wind"]')).toBeTruthy()
    expect(left?.querySelector('[data-ops-section="ndi"]')).toBeNull()
    expect(right?.querySelector('[data-ops-section="project"]')).toBeNull()
    sidebar.dispose()
  })

  it('defaults Project + Fleet + Output expanded; others collapsed', () => {
    const host = document.createElement('div')
    const sidebar = createSidebar({ container: host })
    sidebar.registerSection(mountEmpty('project'))
    sidebar.registerSection(mountEmpty('live'))
    sidebar.registerSection(mountEmpty('assets'))
    sidebar.registerSection(mountEmpty('ndi'))
    sidebar.registerSection(mountEmpty('environment'))
    expect(
      host.querySelector('[data-ops-section="project"]')?.hasAttribute('hidden'),
    ).toBe(false)
    expect(
      host.querySelector('[data-ops-section="live"]')?.hasAttribute('hidden'),
    ).toBe(false)
    expect(
      host.querySelector('[data-ops-section="ndi"]')?.hasAttribute('hidden'),
    ).toBe(false)
    expect(
      host.querySelector('[data-ops-section="assets"]')?.hasAttribute('hidden'),
    ).toBe(true)
    expect(
      host.querySelector('[data-ops-section="environment"]')?.hasAttribute('hidden'),
    ).toBe(true)
    sidebar.dispose()
  })

  it('persists accordion open/closed in sessionStorage', () => {
    const host = document.createElement('div')
    const sidebar = createSidebar({ container: host })
    sidebar.registerSection(mountEmpty('project'))
    sidebar.registerSection(mountEmpty('environment'))
    const header = host.querySelector(
      '[data-section-id="project"] .ops-sidebar__section-header',
    ) as HTMLButtonElement
    header.click()
    expect(
      host.querySelector('[data-ops-section="project"]')?.hasAttribute('hidden'),
    ).toBe(true)
    const stored = JSON.parse(
      sessionStorage.getItem(SIDEBAR_ACCORDION_STORAGE_KEY) ?? '{}',
    ) as Record<string, boolean>
    expect(stored.project).toBe(false)
    sidebar.dispose()

    const host2 = document.createElement('div')
    const sidebar2 = createSidebar({ container: host2 })
    sidebar2.registerSection(mountEmpty('project'))
    expect(
      host2.querySelector('[data-ops-section="project"]')?.hasAttribute('hidden'),
    ).toBe(true)
    sidebar2.dispose()
  })

  it('collapses rails independently and persists both', () => {
    const host = document.createElement('div')
    const sidebar = createSidebar({ container: host })
    expect(sidebar.isRailCollapsed('left')).toBe(false)
    expect(sidebar.isRailCollapsed('right')).toBe(false)
    sidebar.setRailCollapsed('right', true)
    expect(sidebar.isRailCollapsed('right')).toBe(true)
    expect(sidebar.isRailCollapsed('left')).toBe(false)
    expect(sessionStorage.getItem(SIDEBAR_RIGHT_COLLAPSE_STORAGE_KEY)).toBe('1')
    expect(rootInset(host, '--ops-sidebar-inset-right')).toBe('0px')
    expect(rootInset(host, '--ops-sidebar-inset-left')).not.toBe('0px')
    sidebar.dispose()

    const host2 = document.createElement('div')
    const sidebar2 = createSidebar({ container: host2 })
    expect(sidebar2.isRailCollapsed('right')).toBe(true)
    expect(sidebar2.isRailCollapsed('left')).toBe(false)
    sidebar2.dispose()
  })

  it('sets inset vars to 0 when both rails are collapsed', () => {
    const host = document.createElement('div')
    const sidebar = createSidebar({ container: host })
    sidebar.setRailCollapsed('left', true)
    sidebar.setRailCollapsed('right', true)
    expect(sessionStorage.getItem(SIDEBAR_LEFT_COLLAPSE_STORAGE_KEY)).toBe('1')
    expect(rootInset(host, '--ops-sidebar-inset-left')).toBe('0px')
    expect(rootInset(host, '--ops-sidebar-inset-right')).toBe('0px')
    sidebar.dispose()
  })
})

function rootInset(host: HTMLElement, name: string): string {
  const root = host.querySelector('[data-ops="sidebar-root"]') as HTMLElement
  return root.style.getPropertyValue(name)
}

describe('NDI dual-render invariant (sidebar)', () => {
  it('ndiFramePump never imports sidebar / ops panel DOM modules', () => {
    const pumpPath = join(here, '../../output/ndiFramePump.ts')
    const src = readFileSync(pumpPath, 'utf8')
    expect(src).toMatch(/createNdiAsyncReadback/)
    expect(src).not.toMatch(/scene\/sidebar/)
    expect(src).not.toMatch(/stubHud/)
    expect(src).not.toMatch(/fleetLivePanel/)
    expect(src).not.toMatch(/editorPanel/)
    expect(src).not.toMatch(/ops-overlay/)
    expect(src).not.toMatch(/ops-sidebar/)
    expect(src).not.toMatch(/flowPanel/)
    expect(src).not.toMatch(/document\./)
  })

  it('streamMapNdiPump never imports sidebar / ops panel DOM modules', () => {
    const pumpPath = join(here, '../../output/streamMapNdiPump.ts')
    const src = readFileSync(pumpPath, 'utf8')
    expect(src).toMatch(/getSourceCanvas/)
    expect(src).not.toMatch(/scene\/sidebar/)
    expect(src).not.toMatch(/stubHud/)
    expect(src).not.toMatch(/fleetLivePanel/)
    expect(src).not.toMatch(/editorPanel/)
    expect(src).not.toMatch(/ops-overlay/)
    expect(src).not.toMatch(/ops-sidebar/)
    expect(src).not.toMatch(/flowPanel/)
  })
})
