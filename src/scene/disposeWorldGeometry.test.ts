import { describe, expect, it, vi } from 'vitest'
import {
  disposeWorldGeometryHandles,
  WORLD_GEOMETRY_DISPOSE_ORDER,
} from './disposeWorldGeometry.ts'

describe('disposeWorldGeometryHandles', () => {
  it('disposes billboard chains and other 3D in order, including empty remount', () => {
    const order: string[] = []
    const handles = {
      course: { dispose: () => order.push('course') },
      sponsors: { dispose: () => order.push('sponsors') },
      countdownFlags: { dispose: () => order.push('countdownFlags') },
      lineSigns: { dispose: () => order.push('lineSigns') },
      worldBuoys: { dispose: () => order.push('worldBuoys') },
      billboardChains: { dispose: () => order.push('billboardChains') },
      positionMarkers: { dispose: () => order.push('positionMarkers') },
    }
    disposeWorldGeometryHandles(handles)
    expect(order).toEqual([...WORLD_GEOMETRY_DISPOSE_ORDER])
    expect(order).toContain('billboardChains')
  })

  it('skips null handles so remount([]) is safe with no prior world', () => {
    expect(() =>
      disposeWorldGeometryHandles({
        course: null,
        sponsors: undefined,
        billboardChains: null,
      }),
    ).not.toThrow()
  })

  it('calls chain dispose even when other handles are missing', () => {
    const dispose = vi.fn()
    disposeWorldGeometryHandles({ billboardChains: { dispose } })
    expect(dispose).toHaveBeenCalledTimes(1)
  })
})
