import { describe, expect, it } from 'vitest'
import {
  closestPointOnSegment2d,
  extendPolylineEnd,
} from './polylineInsert.ts'

describe('closestPointOnSegment2d', () => {
  it('projects onto the mid of a horizontal segment', () => {
    const hit = closestPointOnSegment2d(5, 2, 0, 0, 10, 0)
    expect(hit.t).toBeCloseTo(0.5)
    expect(hit.east).toBeCloseTo(5)
    expect(hit.north).toBeCloseTo(0)
    expect(hit.dist).toBeCloseTo(2)
  })

  it('clamps past the end to B', () => {
    const hit = closestPointOnSegment2d(20, 0, 0, 0, 10, 0)
    expect(hit.t).toBe(1)
    expect(hit.east).toBeCloseTo(10)
  })
})

describe('extendPolylineEnd', () => {
  it('continues the last segment by step metres', () => {
    const extra = extendPolylineEnd(
      [
        { east: 0, north: 0 },
        { east: 10, north: 0 },
      ],
      5,
    )
    expect(extra.east).toBeCloseTo(15)
    expect(extra.north).toBeCloseTo(0)
  })

  it('steps east when there is only one point', () => {
    const extra = extendPolylineEnd([{ east: 3, north: 4 }], 20)
    expect(extra.east).toBeCloseTo(23)
    expect(extra.north).toBeCloseTo(4)
  })
})
