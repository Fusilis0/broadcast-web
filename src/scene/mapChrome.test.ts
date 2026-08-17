import { describe, expect, it } from 'vitest'
import { knotsToMs, windTravelSceneXZ } from '../telemetry/windDirection.ts'
import {
  formatMapWindLabel,
  mapChromeMetrics,
  parseArrowBearingDeg,
  windTravelToMapCanvasDelta,
  yawDegToCanvasRad,
} from './mapChrome.ts'

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
  it('keeps ops metrics dense and stream markedly larger (broadcast graphic)', () => {
    const ops = mapChromeMetrics('ops')
    const stream = mapChromeMetrics('stream')
    expect(ops.boatLen).toBe(9)
    expect(ops.boatBeam).toBe(4.5)
    expect(ops.droneR).toBe(5)
    expect(ops.labelH).toBe(12)
    expect(ops.labelPadX).toBe(3)
    expect(stream.boatLen).toBeGreaterThan(ops.boatLen)
    expect(stream.boatBeam).toBeGreaterThan(ops.boatBeam)
    expect(stream.droneR).toBeGreaterThan(ops.droneR)
    expect(stream.labelH).toBeGreaterThan(ops.labelH)
    expect(stream.courseLine).toBeGreaterThan(ops.courseLine)
    expect(stream.windArrowLen).toBeGreaterThan(ops.windArrowLen)
    expect(ops.variant).toBe('ops')
    expect(stream.variant).toBe('stream')
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
