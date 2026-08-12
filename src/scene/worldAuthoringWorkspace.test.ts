import { readFileSync } from 'node:fs'

import { dirname, join } from 'node:path'

import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {

  clampAuthoringMapSize,

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



describe('resolveAuthoringInitiallyOpen', () => {

  it('forces open/closed via ?editor=', () => {

    expect(resolveAuthoringInitiallyOpen(false, '?editor=1')).toBe(true)

    expect(resolveAuthoringInitiallyOpen(true, '?editor=0')).toBe(false)

  })



  it('defaults open for editor role and closed for air', () => {

    expect(resolveAuthoringInitiallyOpen(true, '')).toBe(true)

    expect(resolveAuthoringInitiallyOpen(false, '')).toBe(false)

    expect(resolveAuthoringInitiallyOpen(true, '?race=demo')).toBe(true)

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


