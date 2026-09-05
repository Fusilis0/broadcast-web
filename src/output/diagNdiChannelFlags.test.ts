import { describe, expect, it } from 'vitest'
import {
  parseNdi2dEnabled,
  parseNdi3dEnabled,
} from './diagNdiChannelFlags.ts'

describe('diagNdiChannelFlags', () => {
  it('defaults both channels on', () => {
    expect(parseNdi2dEnabled('')).toBe(true)
    expect(parseNdi3dEnabled('?race=demo')).toBe(true)
  })

  it('parses ndi2d=off / ndi3d=off', () => {
    expect(parseNdi2dEnabled('?ndi2d=off')).toBe(false)
    expect(parseNdi3dEnabled('?ndi3d=off&ndi2d=1')).toBe(false)
    expect(parseNdi2dEnabled('?ndi2d=off&ndi3d=off')).toBe(false)
    expect(parseNdi3dEnabled('?ndi2d=off&ndi3d=off')).toBe(false)
  })
})
