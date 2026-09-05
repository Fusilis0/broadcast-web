import { describe, expect, it } from 'vitest'
import {
  filterFeaturesFor2d,
  filterFeaturesForStreamMap,
  isOnAirMapFeatureType,
} from './featureVisibility.ts'

describe('isOnAirMapFeatureType', () => {
  it('allow-lists start/finish, buoys, and gates; drops marks', () => {
    expect(isOnAirMapFeatureType('start')).toBe(true)
    expect(isOnAirMapFeatureType('finish')).toBe(true)
    expect(isOnAirMapFeatureType('mark')).toBe(false)
    expect(isOnAirMapFeatureType('buoy')).toBe(true)
    expect(isOnAirMapFeatureType('gateLeft')).toBe(true)
    expect(isOnAirMapFeatureType('gateRight')).toBe(true)
  })

  it('drops sponsors, chains, flags, arrows, and rotation', () => {
    expect(isOnAirMapFeatureType('sponsor')).toBe(false)
    expect(isOnAirMapFeatureType('billboardChain')).toBe(false)
    expect(isOnAirMapFeatureType('flagP1')).toBe(false)
    expect(isOnAirMapFeatureType('flagP2')).toBe(false)
    expect(isOnAirMapFeatureType('arrow')).toBe(false)
    expect(isOnAirMapFeatureType('rotation')).toBe(false)
  })
})

describe('filterFeaturesForStreamMap', () => {
  it('omits chain and sponsor even when visible2d; ops filter keeps them', () => {
    const rows = [
      { id: 'sf', type: 'start', visible2d: true },
      { id: 'mk', type: 'mark' },
      { id: 'by', type: 'buoy' },
      { id: 'sp', type: 'sponsor' },
      { id: 'ch', type: 'billboardChain', visible2d: true },
      { id: 'hid', type: 'buoy', visible2d: false },
    ]
    expect(filterFeaturesForStreamMap(rows).map((f) => f.id)).toEqual([
      'sf',
      'by',
    ])
    expect(filterFeaturesFor2d(rows).map((f) => f.id)).toEqual([
      'sf',
      'mk',
      'by',
      'sp',
      'ch',
    ])
  })
})
