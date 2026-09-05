import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePositionMarkers } from './normalizePositionMarkers.ts'
import { buildPositionMarkerLayout } from './positionMarkerLayout.ts'
import type { GpsToEnuAmslFn } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('normalizePositionMarkers', () => {
  it('keeps valid markers and fills defaults', () => {
    const data = normalizePositionMarkers({
      name: 'demo',
      markers: [
        {
          id: 'd100',
          label: '100',
          point: { lat: 41.0, lon: 28.97 },
        },
        { id: '', label: 'bad', lat: 1, lon: 2 },
        {
          id: 'd200',
          label: '200',
          lat: 41.1,
          lon: 29.0,
          sizeM: 22,
          color: '#aabbcc',
        },
      ],
    })
    expect(data.name).toBe('demo')
    expect(data.markers).toHaveLength(2)
    expect(data.markers[0]).toMatchObject({
      id: 'd100',
      label: '100',
      sizeM: 18,
      point: { lat: 41.0, lon: 28.97, altMsl: 0 },
    })
    expect(data.markers[1]).toMatchObject({
      id: 'd200',
      sizeM: 22,
      color: 0xaabbcc,
    })
  })

  it('returns empty for junk', () => {
    expect(normalizePositionMarkers(null).markers).toEqual([])
  })
})

describe('buildPositionMarkerLayout', () => {
  const mockEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
    x: lon * 1000,
    y: alt,
    z: lat * 1000,
  })

  it('converts GPS to ENU x/z', () => {
    const data = normalizePositionMarkers({
      markers: [{ id: 'a', label: '100', lat: 0.02, lon: 0.03 }],
    })
    const layout = buildPositionMarkerLayout(data, mockEnu)
    expect(layout).toHaveLength(1)
    expect(layout[0]!.x).toBeCloseTo(30)
    expect(layout[0]!.z).toBeCloseTo(20)
  })
})

describe('createPositionMarkerTexture (source)', () => {
  it('crops the water-plane number to glyph AABB (no full 256² slab)', () => {
    const src = readFileSync(resolve(__dirname, 'positionMarkerMesh.ts'), 'utf8')
    expect(src).toContain('cropCanvasToOpaqueGlyph')
    expect(src).toContain('fog: false')
    expect(src).toContain('generateMipmaps = false')
  })
})
