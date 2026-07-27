import { describe, expect, it } from 'vitest'
import { normalizeSponsors } from './normalizeSponsors.ts'
import {
  buildSponsorLayout,
  horizontalSpanFromEnu,
  SPONSOR_WATER_Y,
} from './sponsorLayout.ts'
import { facingBasisFromSpan } from './sponsorBillboard.ts'
import type { GpsToEnuAmslFn } from './types.ts'

describe('normalizeSponsors', () => {
  it('keeps valid entries and fills defaults', () => {
    const data = normalizeSponsors({
      name: 'demo',
      sponsors: [
        {
          id: 'sp1',
          label: 'Sponsor A',
          a: { lat: 41.0, lon: 28.97 },
          b: { lat: 41.0, lon: 28.98 },
        },
        {
          id: '',
          label: 'bad',
          a: { lat: 1, lon: 2 },
          b: { lat: 3, lon: 4 },
        },
        {
          id: 'sp2',
          label: 'B',
          a: { lat: 41.1, lon: 29.0, altMsl: 2 },
          b: { lat: 41.2, lon: 29.1 },
          heightM: 12,
          textureUrl: '/sponsors/x.png',
          color: '#aabbcc',
        },
      ],
    })
    expect(data.name).toBe('demo')
    expect(data.sponsors).toHaveLength(2)
    expect(data.sponsors[0]).toMatchObject({
      id: 'sp1',
      label: 'Sponsor A',
      heightM: 8,
      textureUrl: null,
      a: { lat: 41.0, lon: 28.97, altMsl: 0 },
    })
    expect(data.sponsors[1]).toMatchObject({
      id: 'sp2',
      heightM: 12,
      textureUrl: '/sponsors/x.png',
      color: 0xaabbcc,
      a: { altMsl: 2 },
    })
  })

  it('returns empty for junk', () => {
    expect(normalizeSponsors(null).sponsors).toEqual([])
    expect(normalizeSponsors({ sponsors: 'nope' }).sponsors).toEqual([])
  })
})

describe('horizontalSpanFromEnu', () => {
  it('computes width and midpoint', () => {
    const span = horizontalSpanFromEnu(0, 0, 30, 40)
    expect(span.widthM).toBe(50)
    expect(span.midX).toBe(15)
    expect(span.midZ).toBe(20)
  })
})

describe('buildSponsorLayout', () => {
  const mockEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
    x: lon * 1000,
    y: alt + 35,
    z: lat * 1000,
  })

  it('forces water-plane midpoints and drops degenerate spans', () => {
    const data = normalizeSponsors({
      sponsors: [
        {
          id: 'ok',
          label: 'Ok',
          a: { lat: 0.01, lon: 0.02 },
          b: { lat: 0.01, lon: 0.05 },
        },
        {
          id: 'degen',
          label: 'Same',
          a: { lat: 1, lon: 1 },
          b: { lat: 1, lon: 1 },
        },
      ],
    })
    const layout = buildSponsorLayout(data, mockEnu)
    expect(layout).toHaveLength(1)
    expect(layout[0]!.id).toBe('ok')
    expect(layout[0]!.widthM).toBeCloseTo(30)
    expect(layout[0]!.midX).toBeCloseTo(35)
    expect(layout[0]!.midZ).toBeCloseTo(10)
    expect(SPONSOR_WATER_Y).toBe(0)
  })
})

describe('facingBasisFromSpan', () => {
  it('faces left of A→B (along × up)', () => {
    // A→B south (−Z): left is +East (+X)
    const basis = facingBasisFromSpan(0, 10, 0, 0)
    expect(basis).not.toBeNull()
    expect(basis!.along.z).toBeCloseTo(-1)
    expect(basis!.normal.x).toBeCloseTo(1)
    expect(basis!.normal.y).toBeCloseTo(0)
  })
})
