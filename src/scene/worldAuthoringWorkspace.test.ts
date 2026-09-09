/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import {
  clampAuthoringMapSize,
  createWorldAuthoringWorkspace,
  mountWorldMapAuthoringLauncher,
  resolveAuthoringInitiallyOpen,
  WORLD_AUTHORING_MAP_SIZE,
  WORLD_AUTHORING_MAP_SIZE_MAX,
  WORLD_AUTHORING_MAP_SIZE_MIN,
} from './worldAuthoringWorkspace.ts'
import {
  EDITOR_TOOL_GROUPS,
  EDITOR_TOOL_LABELS,
  EDITOR_TOOL_ORDER,
} from './features/editor/tools.ts'

const here = dirname(fileURLToPath(import.meta.url))

afterEach(() => {
  document.body.replaceChildren()
})

describe('resolveAuthoringInitiallyOpen', () => {
  it('forces open/closed via ?editor=', () => {
    expect(resolveAuthoringInitiallyOpen(false, '?editor=1')).toBe(true)
    expect(resolveAuthoringInitiallyOpen(true, '?editor=0')).toBe(false)
  })

  it('defaults closed unless ?editor=1', () => {
    expect(resolveAuthoringInitiallyOpen(true, '')).toBe(false)
    expect(resolveAuthoringInitiallyOpen(false, '')).toBe(false)
    expect(resolveAuthoringInitiallyOpen(true, '?race=demo')).toBe(false)
  })
})

describe('WORLD_AUTHORING_MAP_SIZE', () => {
  it('meets the ≥520px default and 420–900 clamp range', () => {
    expect(WORLD_AUTHORING_MAP_SIZE).toBeGreaterThanOrEqual(520)
    expect(WORLD_AUTHORING_MAP_SIZE_MIN).toBe(420)
    expect(WORLD_AUTHORING_MAP_SIZE_MAX).toBe(900)
    expect(WORLD_AUTHORING_MAP_SIZE_MAX).toBeGreaterThanOrEqual(
      WORLD_AUTHORING_MAP_SIZE,
    )
  })

  it('clamps map size to the supported range', () => {
    expect(clampAuthoringMapSize(100)).toBe(WORLD_AUTHORING_MAP_SIZE_MIN)
    expect(clampAuthoringMapSize(2000)).toBe(WORLD_AUTHORING_MAP_SIZE_MAX)
    expect(clampAuthoringMapSize(560.9)).toBe(560)
    expect(clampAuthoringMapSize(Number.NaN)).toBe(WORLD_AUTHORING_MAP_SIZE)
  })
})

describe('world-authoring Close / [hidden]', () => {
  it('CSS overrides author display:flex so hidden actually hides', () => {
    const css = readFileSync(join(here, '../style.css'), 'utf8')
    expect(css).toMatch(/\.world-authoring\s*\{[^}]*display:\s*flex/s)
    expect(css).toMatch(/\.world-authoring\[hidden\]\s*\{[^}]*display:\s*none/s)
    expect(css).toMatch(/\.ops-sidebar\[hidden\]\s*\{[^}]*display:\s*none/s)
  })

  it('overlay has no Close button; Maximize remains', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const ws = createWorldAuthoringWorkspace({
      container: host,
      initiallyOpen: true,
    })
    expect(ws.root.querySelector('.world-authoring__close-btn')).toBeNull()
    expect(ws.root.textContent).not.toMatch(/\bClose\b/)
    expect(ws.root.querySelector('.world-authoring__max-btn')).toBeTruthy()
    ws.dispose()
  })

  it('header toggle round-trip sets root.hidden', () => {
    const overlay = document.createElement('div')
    const header = document.createElement('div')
    document.body.append(overlay, header)
    const ws = createWorldAuthoringWorkspace({
      container: overlay,
      initiallyOpen: false,
    })
    expect(ws.root.hidden).toBe(true)
    const launcher = mountWorldMapAuthoringLauncher(header, ws)
    const btn = header.querySelector(
      '[data-ops="world-authoring-toggle"]',
    ) as HTMLButtonElement
    expect(btn).toBeTruthy()
    expect(btn.textContent).toBe('World')
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    btn.click()
    expect(ws.isOpen()).toBe(true)
    expect(ws.root.hidden).toBe(false)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    btn.click()
    expect(ws.isOpen()).toBe(false)
    expect(ws.root.hidden).toBe(true)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    launcher.dispose()
    ws.dispose()
  })
})

describe('EDITOR_TOOL_GROUPS', () => {
  it('covers required authoring tools with readable labels', () => {
    const flat = new Set(EDITOR_TOOL_GROUPS.flatMap((g) => [...g.tools]))
    for (const t of EDITOR_TOOL_ORDER) {
      expect(flat.has(t)).toBe(true)
    }
    const labels = EDITOR_TOOL_ORDER.map((t) => EDITOR_TOOL_LABELS[t])
    expect(labels).toEqual(
      expect.arrayContaining([
        'Billboard chain',
        'Start',
        'Finish',
        'Flag P1',
        'Flag P2',
        'Buoy',
        'Sponsor',
        'Gate pair',
        'Place boat',
        'Place drone',
        'Set anchor',
      ]),
    )
    const groupIds = EDITOR_TOOL_GROUPS.map((g) => g.id)
    expect(groupIds).toEqual(
      expect.arrayContaining(['course', 'graphics', 'fleet', 'anchor']),
    )
  })
})
