import { describe, expect, it } from 'vitest'
import {
  defaultSectionExpanded,
  OPS_RAIL_SECTIONS,
  parseAccordionState,
  parseStoredCollapsedFlag,
  railForSection,
  resolveSectionExpanded,
  sectionsForRail,
  serializeAccordionState,
} from './railLayout.ts'

describe('OPS_RAIL_SECTIONS grouping (BW-locked)', () => {
  it('puts race setup on the left and broadcast on the right', () => {
    expect(sectionsForRail('left').map((s) => s.id)).toEqual([
      'project',
      'live',
      'assets',
      'heroes',
      'library',
      'ops',
    ])
    expect(sectionsForRail('right').map((s) => s.id)).toEqual([
      'ndi',
      'flow',
      'calib',
      'environment',
      'cinematics',
      'wind',
    ])
  })

  it('keeps stable section ids (data-ops-section)', () => {
    expect(railForSection('project')).toBe('left')
    expect(railForSection('live')).toBe('left')
    expect(railForSection('assets')).toBe('left')
    expect(railForSection('heroes')).toBe('left')
    expect(railForSection('library')).toBe('left')
    expect(railForSection('ndi')).toBe('right')
    expect(railForSection('flow')).toBe('right')
    expect(railForSection('calib')).toBe('right')
    expect(railForSection('environment')).toBe('right')
    expect(railForSection('cinematics')).toBe('right')
    expect(railForSection('wind')).toBe('right')
    expect(OPS_RAIL_SECTIONS.map((s) => s.id)).not.toContain('world-map')
  })

  it('defaults Project + Fleet open on the left and Output open on the right', () => {
    expect(defaultSectionExpanded('project')).toBe(true)
    expect(defaultSectionExpanded('live')).toBe(true)
    expect(defaultSectionExpanded('ndi')).toBe(true)
    expect(defaultSectionExpanded('cinematics')).toBe(true)
    for (const s of OPS_RAIL_SECTIONS) {
      if (
        s.id === 'project' ||
        s.id === 'live' ||
        s.id === 'ndi' ||
        s.id === 'cinematics'
      ) {
        continue
      }
      expect(defaultSectionExpanded(s.id)).toBe(false)
    }
  })

  it('unknown ids fall back to left / expanded', () => {
    expect(railForSection('custom-panel')).toBe('left')
    expect(defaultSectionExpanded('custom-panel')).toBe(true)
  })
})

describe('accordion sessionStorage helpers', () => {
  it('parses boolean maps and ignores junk', () => {
    expect(parseAccordionState(null)).toEqual({})
    expect(parseAccordionState('')).toEqual({})
    expect(parseAccordionState('not-json')).toEqual({})
    expect(parseAccordionState('[]')).toEqual({})
    expect(parseAccordionState('{"project":true,"live":false,"x":1}')).toEqual({
      project: true,
      live: false,
    })
  })

  it('round-trips serialize + stored override vs default', () => {
    const raw = serializeAccordionState({ project: false, wind: true })
    const stored = parseAccordionState(raw)
    expect(resolveSectionExpanded('project', stored)).toBe(false)
    expect(resolveSectionExpanded('live', stored)).toBe(true)
    expect(resolveSectionExpanded('wind', stored)).toBe(true)
    expect(resolveSectionExpanded('environment', stored)).toBe(false)
  })

  it('parses collapse flags', () => {
    expect(parseStoredCollapsedFlag('1', false)).toBe(true)
    expect(parseStoredCollapsedFlag('0', true)).toBe(false)
    expect(parseStoredCollapsedFlag(null, true)).toBe(true)
    expect(parseStoredCollapsedFlag('nope', false)).toBe(false)
  })
})
