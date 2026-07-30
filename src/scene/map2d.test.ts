import { describe, expect, it } from 'vitest'
import type { LayoutFeature } from './features/types.ts'
import { boundsFromPoints, enuToMapPx, type MapPoint } from './map2d.ts'

describe('map2d projection', () => {
  it('maps East→right and North→top (north-up)', () => {
    const bounds = { minE: 0, maxE: 100, minN: 0, maxN: 100 }
    const sw = enuToMapPx(0, 0, bounds, 200, 200, 0)
    const ne = enuToMapPx(100, 100, bounds, 200, 200, 0)
    expect(sw.x).toBeCloseTo(0)
    expect(sw.y).toBeCloseTo(200)
    expect(ne.x).toBeCloseTo(200)
    expect(ne.y).toBeCloseTo(0)
  })

  it('auto-fits bounds with padding around fleet points', () => {
    const points: MapPoint[] = [
      { id: '1', kind: 'drone', east: 10, north: 20, up: 5 },
      { id: '21', kind: 'boat', east: 30, north: 40, up: 0 },
    ]
    const b = boundsFromPoints(points)
    expect(b.minE).toBeLessThan(10)
    expect(b.maxE).toBeGreaterThan(30)
    expect(b.minN).toBeLessThan(20)
    expect(b.maxN).toBeGreaterThan(40)
  })

  it('includes shared layout features in auto-fit bounds', () => {
    const layout: LayoutFeature[] = [
      {
        id: 'sponsor:sp',
        name: 'sp',
        type: 'sponsor',
        points: [
          { x: -50, y: 0, z: -10 },
          { x: 50, y: 0, z: 10 },
        ],
        rawPoints: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 0, altMsl: 0 },
        ],
      },
    ]
    const b = boundsFromPoints([], [], layout)
    expect(b.minE).toBeLessThan(-50)
    expect(b.maxE).toBeGreaterThan(50)
    expect(b.minN).toBeLessThan(-10)
    expect(b.maxN).toBeGreaterThan(10)
  })
})
