import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  clampSidebarWidth,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from './createSidebar.ts'
import {
  compareSidebarSectionOrder,
  isSidebarCollapseHotkey,
  SIDEBAR_COLLAPSE_HOTKEY,
} from './hotkey.ts'

const here = dirname(fileURLToPath(import.meta.url))

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

describe('NDI dual-render invariant (sidebar)', () => {
  it('ndiFramePump never imports sidebar / ops panel DOM modules', () => {
    const pumpPath = join(here, '../../output/ndiFramePump.ts')
    const src = readFileSync(pumpPath, 'utf8')
    expect(src).toMatch(/readRenderTargetPixels/)
    expect(src).not.toMatch(/scene\/sidebar/)
    expect(src).not.toMatch(/stubHud/)
    expect(src).not.toMatch(/fleetLivePanel/)
    expect(src).not.toMatch(/editorPanel/)
    expect(src).not.toMatch(/ops-overlay/)
    expect(src).not.toMatch(/ops-sidebar/)
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
  })
})
