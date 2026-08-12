import { describe, expect, it } from 'vitest'
import {
  mapChromeMetrics,
  parseArrowBearingDeg,
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
    expect(ops.variant).toBe('ops')
    expect(stream.variant).toBe('stream')
  })
})
