import { describe, expect, it, vi } from 'vitest'
import {
  geojsonToWorldFeatures,
  serializeWorldFeaturesGeojson,
  worldFeaturesToGeojson,
} from './geojson.ts'
import type { WorldFeature } from './types.ts'

const mark: WorldFeature = {
  id: 'course:Mark-NW',
  name: 'Mark-NW',
  type: 'mark',
  points: [{ lat: 41.0087, lon: 28.9784, altMsl: 0 }],
  heightM: 5,
  color: 0xffdd33,
}

const markCw: WorldFeature = {
  ...mark,
  id: 'course:Mark-CW',
  name: 'Mark-CW',
  rounding: 'cw',
}

const sponsor: WorldFeature = {
  id: 'sponsor:sp-west',
  name: 'sp-west',
  type: 'sponsor',
  points: [
    { lat: 41.00855, lon: 28.97755, altMsl: 0 },
    { lat: 41.00745, lon: 28.97755, altMsl: 1.5 },
  ],
  heightM: 8,
  color: 0x1e4d8c,
  label: 'Fusilis',
}

describe('worldFeaturesToGeojson / geojsonToWorldFeatures', () => {
  it('round-trips mark + sponsor types and coordinates', () => {
    const collection = worldFeaturesToGeojson([mark, sponsor])
    expect(collection.type).toBe('FeatureCollection')
    expect(collection.features).toHaveLength(2)
    expect(collection.features[0]!.geometry?.type).toBe('Point')
    expect(collection.features[1]!.geometry?.type).toBe('LineString')

    const { features, skipped } = geojsonToWorldFeatures(collection)
    expect(skipped).toBe(0)
    expect(features).toHaveLength(2)

    const m = features.find((f) => f.type === 'mark')!
    expect(m.id).toBe(mark.id)
    expect(m.name).toBe(mark.name)
    expect(m.points[0]!.lat).toBeCloseTo(41.0087)
    expect(m.points[0]!.lon).toBeCloseTo(28.9784)
    expect(m.points[0]!.altMsl).toBeCloseTo(0)
    expect(m.heightM).toBe(5)
    expect(m.color).toBe(0xffdd33)

    const s = features.find((f) => f.type === 'sponsor')!
    expect(s.id).toBe(sponsor.id)
    expect(s.label).toBe('Fusilis')
    expect(s.points).toHaveLength(2)
    expect(s.points[0]!.lat).toBeCloseTo(41.00855)
    expect(s.points[0]!.lon).toBeCloseTo(28.97755)
    expect(s.points[1]!.lat).toBeCloseTo(41.00745)
    expect(s.points[1]!.lon).toBeCloseTo(28.97755)
    expect(s.points[1]!.altMsl).toBeCloseTo(1.5)
    expect(s.heightM).toBe(8)
    expect(s.color).toBe(0x1e4d8c)
  })

  it('round-trips rounding on mark properties', () => {
    const collection = worldFeaturesToGeojson([markCw])
    expect(collection.features[0]!.properties?.rounding).toBe('cw')
    const { features, skipped } = geojsonToWorldFeatures(collection)
    expect(skipped).toBe(0)
    expect(features[0]!.rounding).toBe('cw')
  })

  it('round-trips visibleBuoyMesh / visibleTag on mark properties', () => {
    const tagged: WorldFeature = {
      ...mark,
      visibleBuoyMesh: false,
      visibleTag: true,
    }
    const collection = worldFeaturesToGeojson([tagged])
    expect(collection.features[0]!.properties?.visibleBuoyMesh).toBe(false)
    expect(collection.features[0]!.properties?.visibleTag).toBe(true)
    const { features, skipped } = geojsonToWorldFeatures(collection)
    expect(skipped).toBe(0)
    expect(features[0]!.visibleBuoyMesh).toBe(false)
    expect(features[0]!.visibleTag).toBe(true)
  })

  it('round-trips panelColor / frameColor on sponsor properties', () => {
    const painted: WorldFeature = {
      ...sponsor,
      panelColor: 0xf4f4f2,
      frameColor: 0x2c3338,
    }
    const collection = worldFeaturesToGeojson([painted])
    expect(collection.features[0]!.properties?.panelColor).toBe('#f4f4f2')
    expect(collection.features[0]!.properties?.frameColor).toBe('#2c3338')
    const { features, skipped } = geojsonToWorldFeatures(collection)
    expect(skipped).toBe(0)
    expect(features[0]!.panelColor).toBe(0xf4f4f2)
    expect(features[0]!.frameColor).toBe(0x2c3338)
  })

  it('round-trips panelAlpha / boardAspect on sponsor properties', () => {
    const painted: WorldFeature = {
      ...sponsor,
      panelAlpha: 0.5,
      boardAspect: 2.5,
    }
    const collection = worldFeaturesToGeojson([painted])
    expect(collection.features[0]!.properties?.panelAlpha).toBe(0.5)
    expect(collection.features[0]!.properties?.boardAspect).toBe(2.5)
    const { features, skipped } = geojsonToWorldFeatures(collection)
    expect(skipped).toBe(0)
    expect(features[0]!.panelAlpha).toBe(0.5)
    expect(features[0]!.boardAspect).toBe(2.5)
  })

  it('round-trips billboardChain logos on properties', () => {
    const chain: WorldFeature = {
      id: 'chain:1',
      name: 'chain-1',
      type: 'billboardChain',
      points: [
        { lat: 41.0, lon: 29.0, altMsl: 0 },
        { lat: 41.01, lon: 29.01, altMsl: 0 },
      ],
      logos: [
        { url: '/assets/library/image/rolex-f724a5ba.png', weight: 3 },
        { url: '/assets/library/image/senexus-57797468.png', weight: 2 },
      ],
    }
    const collection = worldFeaturesToGeojson([chain])
    expect(collection.features[0]!.properties?.logos).toEqual(chain.logos)
    const { features, skipped } = geojsonToWorldFeatures(collection)
    expect(skipped).toBe(0)
    expect(features[0]!.logos).toEqual(chain.logos)
  })

  it('exports serializeable .geojson text', () => {
    const text = serializeWorldFeaturesGeojson([mark])
    const parsed = JSON.parse(text) as { type: string; features: unknown[] }
    expect(parsed.type).toBe('FeatureCollection')
    expect(parsed.features).toHaveLength(1)
  })

  it('expands gate/gatePair LineString into gateLeft + gateRight', () => {
    const { features, skipped } = geojsonToWorldFeatures({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'gatePair', name: 'Gate1', heightM: 5 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [28.9778, 41.00795],
              [28.979, 41.00795],
            ],
          },
        },
      ],
    })
    expect(skipped).toBe(0)
    expect(features).toHaveLength(2)
    expect(features[0]!.type).toBe('gateLeft')
    expect(features[1]!.type).toBe('gateRight')
    expect(features[0]!.name).toBe('Gate1-Left')
    expect(features[1]!.name).toBe('Gate1-Right')
    expect(features[0]!.points[0]!.lon).toBeCloseTo(28.9778)
    expect(features[1]!.points[0]!.lon).toBeCloseTo(28.979)
  })

  it('skips invalid features with console.warn and does not throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { features, skipped } = geojsonToWorldFeatures({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'mark', name: 'ok' },
          geometry: { type: 'Point', coordinates: [29, 41] },
        },
        {
          type: 'Feature',
          properties: { type: 'sponsor' },
          geometry: { type: 'Point', coordinates: [29, 41] },
        },
        {
          type: 'Feature',
          properties: { type: 'polygon-zone' },
          geometry: { type: 'Point', coordinates: [29, 41] },
        },
        { type: 'Feature', properties: { type: 'mark' }, geometry: null },
      ],
    })
    expect(features).toHaveLength(1)
    expect(features[0]!.type).toBe('mark')
    expect(skipped).toBe(3)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
