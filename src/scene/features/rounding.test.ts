import { describe, expect, it } from 'vitest'
import {
  effectiveRounding,
  parseRounding,
  persistRoundingSelection,
  roundingYawRad,
  ROUNDING_REVOLUTION_SEC,
} from './rounding.ts'

describe('parseRounding', () => {
  it('omits missing; maps known strings; unknown → none', () => {
    expect(parseRounding(undefined)).toBeUndefined()
    expect(parseRounding('cw')).toBe('cw')
    expect(parseRounding('CCW')).toBe('ccw')
    expect(parseRounding(' none ')).toBe('none')
    expect(parseRounding('clockwise')).toBe('none')
    expect(parseRounding(1)).toBe('none')
  })
})

describe('effectiveRounding', () => {
  it('omit / null → cw; explicit none hides; cw/ccw pass through', () => {
    expect(effectiveRounding(undefined)).toBe('cw')
    expect(effectiveRounding(null)).toBe('cw')
    expect(effectiveRounding('cw')).toBe('cw')
    expect(effectiveRounding('ccw')).toBe('ccw')
    expect(effectiveRounding('none')).toBe('none')
  })
})

describe('persistRoundingSelection', () => {
  it('keeps CW omitted; persists ccw/none and explicit cw', () => {
    expect(persistRoundingSelection('cw', undefined)).toBeUndefined()
    expect(persistRoundingSelection('cw', 'cw')).toBe('cw')
    expect(persistRoundingSelection('cw', 'none')).toBe('cw')
    expect(persistRoundingSelection('ccw', undefined)).toBe('ccw')
    expect(persistRoundingSelection('none', undefined)).toBe('none')
    expect(persistRoundingSelection('none', 'cw')).toBe('none')
  })
})

describe('roundingYawRad', () => {
  it('CW is negative yaw (clock from above); CCW is positive; none is 0', () => {
    const quarter = ROUNDING_REVOLUTION_SEC / 4
    expect(roundingYawRad('cw', quarter)).toBeCloseTo(-Math.PI / 2)
    expect(roundingYawRad('ccw', quarter)).toBeCloseTo(Math.PI / 2)
    expect(roundingYawRad('none', quarter)).toBe(0)
  })
})
