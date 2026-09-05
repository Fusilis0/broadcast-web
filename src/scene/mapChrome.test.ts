import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { knotsToMs, windTravelSceneXZ } from '../telemetry/windDirection.ts'
import {
  drawMapLayoutFeatures,
  drawMapRoundingGlyph,
  drawStreamTitleStrip,
  formatMapWindLabel,
  mapChromeMetrics,
  parseArrowBearingDeg,
  parseStreamBoatIconScale,
  clampStreamBoatIconScale,
  roundingCanvasYawRad,
  scaleStreamBoatChrome,
  STREAM_BOAT_ICON_SCALE_DEFAULT,
  STREAM_BOAT_ICON_SCALE_STORAGE_KEY,
  STREAM_ROUNDING_ANIM_HZ,
  streamBuoyName,
  streamCompassRadius,
  streamRoundingRadiusPx,
  windTravelToMapCanvasDelta,
  yawDegToCanvasRad,
} from './mapChrome.ts'
import { ROUNDING_REVOLUTION_SEC, roundingYawRad } from './features/rounding.ts'
import type { LayoutFeature } from './features/types.ts'
import { filterFeaturesFor2d, filterFeaturesForStreamMap } from './features/featureVisibility.ts'

describe('yawDegToCanvasRad', () => {
  it('maps compass 0° (N) to 0 rad and 90° (E) to +π/2 (CW canvas)', () => {
    expect(yawDegToCanvasRad(0)).toBeCloseTo(0)
    expect(yawDegToCanvasRad(90)).toBeCloseTo(Math.PI / 2)
    expect(yawDegToCanvasRad(180)).toBeCloseTo(Math.PI)
  })

  it('treats non-finite yaw as 0', () => {
    expect(yawDegToCanvasRad(Number.NaN)).toBe(0)
  })
})

describe('parseArrowBearingDeg', () => {
  it('parses editor brg labels', () => {
    expect(parseArrowBearingDeg('brg 045°')).toBe(45)
    expect(parseArrowBearingDeg('brg 270°')).toBe(270)
    expect(parseArrowBearingDeg('brg 0°')).toBe(0)
  })

  it('returns null when missing', () => {
    expect(parseArrowBearingDeg(undefined)).toBeNull()
    expect(parseArrowBearingDeg('arrow')).toBeNull()
  })
})

describe('mapChromeMetrics', () => {
  it('keeps ops metrics dense; stream uses compact 04-10 on-air pills', () => {
    const ops = mapChromeMetrics('ops')
    const stream = mapChromeMetrics('stream')
    expect(ops.boatLen).toBe(9)
    expect(ops.boatBeam).toBe(4.5)
    expect(ops.droneR).toBe(5)
    expect(ops.labelH).toBe(12)
    expect(ops.labelPadX).toBe(3)
    expect(ops.courseLine).toBe(3)
    expect(ops.sponsorLine).toBe(3)
    expect(ops.markR).toBe(3.5)
    expect(ops.sfEndR).toBe(3.5)
    expect(ops.windArrowLen).toBe(10)
    expect(ops.labelFont).toBe(
      '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    )
    expect(stream.boatLen).toBe(16)
    expect(stream.boatBeam).toBe(8)
    expect(stream.droneR).toBe(6)
    expect(stream.labelH).toBe(14)
    expect(stream.labelPadX).toBe(4)
    expect(stream.courseLine).toBe(4)
    expect(stream.sponsorLine).toBe(4)
    expect(stream.markR).toBe(5)
    expect(stream.sfEndR).toBe(3.5)
    expect(stream.windArrowLen).toBe(16)
    expect(stream.labelFont).toBe(
      'bold 11px ui-sans-serif, system-ui, Segoe UI, sans-serif',
    )
    expect(stream.sfFont).toBe(
      'bold 12px ui-sans-serif, system-ui, Segoe UI, sans-serif',
    )
    expect(ops.variant).toBe('ops')
    expect(stream.variant).toBe('stream')
  })
})

describe('stream boat icon scale', () => {
  it('clamps to 0.25–2; invalid / missing → 0.5', () => {
    expect(STREAM_BOAT_ICON_SCALE_DEFAULT).toBe(0.5)
    expect(STREAM_BOAT_ICON_SCALE_STORAGE_KEY).toBe('bw.streamMap.boatScale')
    expect(clampStreamBoatIconScale(0.1)).toBe(0.25)
    expect(clampStreamBoatIconScale(2.5)).toBe(2)
    expect(clampStreamBoatIconScale(1)).toBe(1)
    expect(clampStreamBoatIconScale(Number.NaN)).toBe(0.5)
    expect(parseStreamBoatIconScale(null)).toBe(0.5)
    expect(parseStreamBoatIconScale('')).toBe(0.5)
    expect(parseStreamBoatIconScale('nope')).toBe(0.5)
    expect(parseStreamBoatIconScale('0.75')).toBe(0.75)
  })

  it('scales hull, pills, and course chrome; leaves wind / compass metrics', () => {
    const base = mapChromeMetrics('stream')
    const half = scaleStreamBoatChrome(base, 0.5)
    expect(half.boatLen).toBe(8)
    expect(half.boatBeam).toBe(4)
    expect(half.labelH).toBe(7)
    expect(half.labelPadX).toBe(2)
    expect(half.labelFont).toBe(
      'bold 5.5px ui-sans-serif, system-ui, Segoe UI, sans-serif',
    )
    expect(half.sfFont).toBe(
      'bold 6px ui-sans-serif, system-ui, Segoe UI, sans-serif',
    )
    expect(half.courseLine).toBe(2)
    expect(half.gateLine).toBe(1.5)
    expect(half.markR).toBe(2.5)
    expect(half.gateEndR).toBe(2)
    expect(half.sfEndR).toBe(1.75)
    expect(half.windArrowLen).toBe(base.windArrowLen)
    expect(mapChromeMetrics('ops').boatLen).toBe(9)
    const big = scaleStreamBoatChrome(base, 1.5)
    expect(big.markR).toBeGreaterThan(half.markR)
    expect(big.sfFont).not.toBe(half.sfFont)
    expect(big.boatLen).toBeGreaterThan(half.boatLen)
    expect(streamRoundingRadiusPx(big)).toBeGreaterThan(
      streamRoundingRadiusPx(half),
    )
  })
})

describe('streamCompassRadius', () => {
  it('uses max(28, height*0.06) — 16:9 height, not min(w,h)', () => {
    expect(streamCompassRadius(540)).toBeCloseTo(32.4)
    expect(streamCompassRadius(1080)).toBeCloseTo(64.8)
    expect(streamCompassRadius(200)).toBe(28)
    expect(streamCompassRadius(0)).toBe(28)
  })
})

describe('drawStreamTitleStrip', () => {
  it('burns uppercase race title as canvas pixels', () => {
    const texts: string[] = []
    const ctx = {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      save: () => {},
      restore: () => {},
      fillText: (t: string) => {
        texts.push(t)
      },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
    } as unknown as CanvasRenderingContext2D
    drawStreamTitleStrip(ctx, 960, 540, 'Istanbul Race')
    expect(texts).toContain('ISTANBUL RACE')
  })
})

function layoutStubCtx(texts: string[], extras?: {
  fillRects?: Array<[number, number, number, number]>
  rotates?: number[]
}) {
  return {
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillRect: (x: number, y: number, w: number, h: number) => {
      extras?.fillRects?.push([x, y, w, h])
    },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: (a: number) => {
      extras?.rotates?.push(a)
    },
    setLineDash: () => {},
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    fillText: (t: string) => {
      texts.push(t)
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D
}

const MIXED_LAYOUT: LayoutFeature[] = [
  {
    id: 'start:1',
    name: 'Start',
    type: 'start',
    label: 'START',
    points: [
      { x: -20, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
    ],
    rawPoints: [
      { lat: 0, lon: 0, altMsl: 0 },
      { lat: 0, lon: 0, altMsl: 0 },
    ],
  },
  {
    id: 'sponsor:sp',
    name: 'Rolex',
    type: 'sponsor',
    label: 'Rolex',
    points: [
      { x: 0, y: 0, z: 10 },
      { x: 30, y: 0, z: 10 },
    ],
    rawPoints: [
      { lat: 0, lon: 0, altMsl: 0 },
      { lat: 0, lon: 0, altMsl: 0 },
    ],
  },
  {
    id: 'chain:4',
    name: 'Chain 4',
    type: 'billboardChain',
    label: 'Chain 4',
    points: [
      { x: -10, y: 0, z: -20 },
      { x: 10, y: 0, z: -20 },
    ],
    rawPoints: [
      { lat: 0, lon: 0, altMsl: 0 },
      { lat: 0, lon: 0, altMsl: 0 },
    ],
  },
]

describe('drawMapLayoutFeatures stream vs ops', () => {
  const project = (east: number, north: number) => ({ x: east + 80, y: 80 - north })

  it('ops still draws Chain/sponsor labels; stream allow-list omits them', () => {
    const opsTexts: string[] = []
    drawMapLayoutFeatures(layoutStubCtx(opsTexts), filterFeaturesFor2d(MIXED_LAYOUT), {
      project,
      metrics: mapChromeMetrics('ops'),
      selectedIds: new Set(),
    })
    expect(opsTexts.some((t) => t.includes('Chain 4'))).toBe(true)
    expect(opsTexts.some((t) => t.includes('Rolex'))).toBe(true)
    expect(opsTexts.some((t) => t.includes('START'))).toBe(true)

    const streamTexts: string[] = []
    drawMapLayoutFeatures(
      layoutStubCtx(streamTexts),
      filterFeaturesForStreamMap(MIXED_LAYOUT),
      {
        project,
        metrics: mapChromeMetrics('stream'),
        selectedIds: new Set(),
      },
    )
    expect(streamTexts.some((t) => t.includes('Chain 4'))).toBe(false)
    expect(streamTexts.some((t) => t.includes('Rolex'))).toBe(false)
    expect(streamTexts.some((t) => t.includes('START'))).toBe(true)
  })

  it('centers START/FINISH pills on the segment midpoint', () => {
    const fillRects: Array<[number, number, number, number]> = []
    const texts: string[] = []
    drawMapLayoutFeatures(
      layoutStubCtx(texts, { fillRects }),
      filterFeaturesForStreamMap(MIXED_LAYOUT),
      {
        project,
        metrics: mapChromeMetrics('stream'),
        selectedIds: new Set(),
      },
    )
    expect(texts).toContain('START')
    const metrics = mapChromeMetrics('stream')
    const textW = 'START'.length * 6
    const boxW = textW + metrics.labelPadX * 2
    const mx = 80
    const my = 80
    expect(fillRects).toContainEqual([
      mx - boxW / 2,
      my - metrics.labelH / 2,
      boxW,
      metrics.labelH,
    ])
  })

  it('stream buoy pills use name, not type-echo label', () => {
    const buoy: LayoutFeature = {
      id: 'buoy:5',
      name: 'Cıragan',
      type: 'buoy',
      label: 'buoy',
      points: [{ x: 0, y: 0, z: 0 }],
      rawPoints: [{ lat: 0, lon: 0, altMsl: 0 }],
    }
    const streamTexts: string[] = []
    const streamRotates: number[] = []
    drawMapLayoutFeatures(
      layoutStubCtx(streamTexts, { rotates: streamRotates }),
      [buoy],
      {
        project,
        metrics: mapChromeMetrics('stream'),
        selectedIds: new Set(),
        nowSec: ROUNDING_REVOLUTION_SEC / 4,
      },
    )
    expect(streamTexts).toContain('Cıragan')
    expect(streamTexts.some((t) => t.toLowerCase() === 'buoy')).toBe(false)
    expect(streamRotates[0]).toBeCloseTo(Math.PI / 2)

    const opsTexts: string[] = []
    const opsRotates: number[] = []
    drawMapLayoutFeatures(
      layoutStubCtx(opsTexts, { rotates: opsRotates }),
      [buoy],
      {
        project,
        metrics: mapChromeMetrics('ops'),
        selectedIds: new Set(),
      },
    )
    expect(opsTexts).not.toContain('Cıragan')
    expect(opsRotates).toHaveLength(0)
  })

  it('stream rounding Off hides the glyph; CCW is opposite of CW', () => {
    const offBuoy: LayoutFeature = {
      id: 'buoy:off',
      name: 'X',
      type: 'buoy',
      rounding: 'none',
      points: [{ x: 0, y: 0, z: 0 }],
      rawPoints: [{ lat: 0, lon: 0, altMsl: 0 }],
    }
    const ccwBuoy: LayoutFeature = {
      ...offBuoy,
      id: 'buoy:ccw',
      rounding: 'ccw',
    }
    const offRotates: number[] = []
    drawMapLayoutFeatures(
      layoutStubCtx([], { rotates: offRotates }),
      [offBuoy],
      {
        project,
        metrics: mapChromeMetrics('stream'),
        selectedIds: new Set(),
        nowSec: 1,
      },
    )
    expect(offRotates).toHaveLength(0)

    const ccwRotates: number[] = []
    drawMapLayoutFeatures(
      layoutStubCtx([], { rotates: ccwRotates }),
      [ccwBuoy],
      {
        project,
        metrics: mapChromeMetrics('stream'),
        selectedIds: new Set(),
        nowSec: ROUNDING_REVOLUTION_SEC / 4,
      },
    )
    expect(ccwRotates[0]).toBeCloseTo(-Math.PI / 2)
  })
})

describe('streamBuoyName', () => {
  it('prefers name; skips label type echo', () => {
    expect(streamBuoyName({ name: 'Cıragan', label: 'buoy' })).toBe('Cıragan')
    expect(streamBuoyName({ name: '  ', label: 'buoy' })).toBeNull()
    expect(streamBuoyName({ name: '', label: 'mark' })).toBeNull()
    expect(streamBuoyName({ name: '', label: 'ARNAVUTKÖY' })).toBe('ARNAVUTKÖY')
    expect(streamBuoyName({ name: '  REDBULL  ', label: 'buoy' })).toBe('REDBULL')
  })
})

describe('rounding canvas sense', () => {
  it('CW from above is clockwise canvas rotate (opposite 3D Y sign)', () => {
    expect(STREAM_ROUNDING_ANIM_HZ).toBe(10)
    const quarter = ROUNDING_REVOLUTION_SEC / 4
    expect(roundingYawRad('cw', quarter)).toBeCloseTo(-Math.PI / 2)
    expect(roundingCanvasYawRad('cw', quarter)).toBeCloseTo(Math.PI / 2)
    expect(roundingCanvasYawRad('ccw', quarter)).toBeCloseTo(-Math.PI / 2)
    expect(roundingCanvasYawRad('none', quarter)).toBe(0)
  })

  it('draws CW/CCW glyphs; Off is a no-op; not attached to hulls', () => {
    const rotatesCw: number[] = []
    drawMapRoundingGlyph(
      layoutStubCtx([], { rotates: rotatesCw }),
      10,
      20,
      12,
      'cw',
      ROUNDING_REVOLUTION_SEC / 4,
    )
    expect(rotatesCw[0]).toBeCloseTo(Math.PI / 2)

    const rotatesCcw: number[] = []
    drawMapRoundingGlyph(
      layoutStubCtx([], { rotates: rotatesCcw }),
      10,
      20,
      12,
      'ccw',
      ROUNDING_REVOLUTION_SEC / 4,
    )
    expect(rotatesCcw[0]).toBeCloseTo(-Math.PI / 2)

    const rotatesOff: number[] = []
    drawMapRoundingGlyph(
      layoutStubCtx([], { rotates: rotatesOff }),
      10,
      20,
      12,
      'none',
      1,
    )
    expect(rotatesOff).toHaveLength(0)
  })
})

describe('drawTintedSprite hull box', () => {
  it('does not stroke the sprite AABB', () => {
    const src = readFileSync(join(process.cwd(), 'src/scene/mapChrome.ts'), 'utf8')
    expect(src).not.toContain('ctx.strokeRect(-w / 2, -h / 2, w, h)')
  })
})

describe('map wind readout (14.3d)', () => {
  it('from 000° (N) travels screen-down on the north-up map', () => {
    const d = windTravelToMapCanvasDelta(windTravelSceneXZ(0))
    expect(d.dx).toBeCloseTo(0, 10)
    expect(d.dy).toBeGreaterThan(0.9)
  })

  it('from 090° (E) travels screen-left on the north-up map', () => {
    const d = windTravelToMapCanvasDelta(windTravelSceneXZ(90))
    expect(d.dx).toBeLessThan(-0.9)
    expect(d.dy).toBeCloseTo(0, 10)
  })

  it('from 180° (S) travels screen-up; from 270° (W) travels screen-right', () => {
    const south = windTravelToMapCanvasDelta(windTravelSceneXZ(180))
    expect(south.dx).toBeCloseTo(0, 10)
    expect(south.dy).toBeLessThan(-0.9)
    const west = windTravelToMapCanvasDelta(windTravelSceneXZ(270))
    expect(west.dx).toBeGreaterThan(0.9)
    expect(west.dy).toBeCloseTo(0, 10)
  })

  it('label is meteorological from-deg + kt (not travel)', () => {
    expect(
      formatMapWindLabel({
        directionFromDeg: 0,
        speedMs: knotsToMs(6),
        source: 'default',
        updatedAtMs: 1,
      }),
    ).toBe('from 000° · 6 kt')
    expect(
      formatMapWindLabel({
        directionFromDeg: 90,
        speedMs: knotsToMs(12),
        source: 'operator',
        updatedAtMs: 1,
      }),
    ).toBe('from 090° · 12 kt')
  })
})
