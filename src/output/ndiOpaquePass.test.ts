import { describe, expect, it, vi } from 'vitest'
import { PREVIEW_CLEAR_COLOR, TRANSPARENT_CLEAR_COLOR } from './types.ts'
import {
  applyOpaque3dPassState,
  NDI_3D_OPAQUE_CLEAR_COLOR,
  restoreClearPass,
  snapshotClearPass,
  withOpaque3dPass,
} from './ndiOpaquePass.ts'

describe('ndiOpaquePass helpers', () => {
  it('snapshots clear + opaque-safe gate', () => {
    const snap = snapshotClearPass({
      getClearColorHex: () => TRANSPARENT_CLEAR_COLOR,
      getClearAlpha: () => 0,
      getOpaqueClearSafe: () => false,
    })
    expect(snap).toEqual({
      color: TRANSPARENT_CLEAR_COLOR,
      alpha: 0,
      opaqueClearSafe: false,
    })
  })

  it('applies opaque 3d state then restores AR transparent', () => {
    let color = TRANSPARENT_CLEAR_COLOR
    let alpha = 0
    let safe = false
    const writer = {
      setClearColor: (c: number, a: number) => {
        color = c
        alpha = a
      },
      setOpaqueClearSafe: (s: boolean) => {
        safe = s
      },
    }
    const reader = {
      getClearColorHex: () => color,
      getClearAlpha: () => alpha,
      getOpaqueClearSafe: () => safe,
    }

    const snap = snapshotClearPass(reader)
    applyOpaque3dPassState(writer)
    expect(color).toBe(NDI_3D_OPAQUE_CLEAR_COLOR)
    expect(alpha).toBe(1)
    expect(safe).toBe(true)

    restoreClearPass(writer, snap)
    expect(color).toBe(TRANSPARENT_CLEAR_COLOR)
    expect(alpha).toBe(0)
    expect(safe).toBe(false)
  })

  it('withOpaque3dPass restores even when fn throws', () => {
    let color = PREVIEW_CLEAR_COLOR
    let alpha = 1
    let safe = true
    const writer = {
      setClearColor: (c: number, a: number) => {
        color = c
        alpha = a
      },
      setOpaqueClearSafe: (s: boolean) => {
        safe = s
      },
    }
    const reader = {
      getClearColorHex: () => color,
      getClearAlpha: () => alpha,
      getOpaqueClearSafe: () => safe,
    }

    expect(() =>
      withOpaque3dPass(reader, writer, () => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(color).toBe(PREVIEW_CLEAR_COLOR)
    expect(alpha).toBe(1)
    expect(safe).toBe(true)
  })

  it('withOpaque3dPass returns fn result', () => {
    const writer = {
      setClearColor: vi.fn(),
      setOpaqueClearSafe: vi.fn(),
    }
    const reader = {
      getClearColorHex: () => 0,
      getClearAlpha: () => 0,
      getOpaqueClearSafe: () => false,
    }
    const { result } = withOpaque3dPass(reader, writer, () => 42)
    expect(result).toBe(42)
    expect(writer.setOpaqueClearSafe).toHaveBeenCalledWith(true)
    expect(writer.setOpaqueClearSafe).toHaveBeenLastCalledWith(false)
  })
})
