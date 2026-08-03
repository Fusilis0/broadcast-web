import { describe, expect, it } from 'vitest'
import {
  isAirCameraLocked,
  planNdiCapture,
  shouldForceFollowActivePov,
} from './airCameraLock.ts'

describe('isAirCameraLocked / shouldForceFollowActivePov', () => {
  it('locks when Electron studio bridge is present', () => {
    expect(
      isAirCameraLocked({
        outputMode: 'preview',
        studioBridgePresent: true,
      }),
    ).toBe(true)
    expect(
      shouldForceFollowActivePov({
        outputMode: 'preview',
        studioBridgePresent: true,
      }),
    ).toBe(true)
  })

  it('locks transparent plate even in Chrome (no bridge)', () => {
    expect(
      isAirCameraLocked({
        outputMode: 'transparent',
        studioBridgePresent: false,
      }),
    ).toBe(true)
  })

  it('does not lock plain Chrome preview / chroma', () => {
    expect(
      isAirCameraLocked({
        outputMode: 'preview',
        studioBridgePresent: false,
      }),
    ).toBe(false)
    expect(
      isAirCameraLocked({
        outputMode: 'chroma',
        studioBridgePresent: false,
      }),
    ).toBe(false)
  })
})

describe('planNdiCapture', () => {
  const air = { id: 'air' }
  const free = { id: 'free' }

  it('uses framebuffer when screen camera is active POV', () => {
    expect(
      planNdiCapture({ renderCamera: air, airCamera: air }),
    ).toEqual({ mode: 'framebuffer' })
  })

  it('uses air-target when preview camera differs (free cam)', () => {
    expect(
      planNdiCapture({ renderCamera: free, airCamera: air }),
    ).toEqual({ mode: 'air-target' })
  })

  it('falls back to framebuffer when air camera missing', () => {
    expect(
      planNdiCapture({ renderCamera: free, airCamera: null }),
    ).toEqual({ mode: 'framebuffer' })
    expect(
      planNdiCapture({ renderCamera: free, airCamera: undefined }),
    ).toEqual({ mode: 'framebuffer' })
  })
})
