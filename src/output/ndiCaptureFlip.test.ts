/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { NoColorSpace, SRGBColorSpace, WebGLRenderTarget } from 'three'
import { applyNdiCaptureColorSpace } from './ndiCaptureColorSpace.ts'
import { DEFAULT_CHROMA_KEY, TRANSPARENT_CLEAR_COLOR } from './types.ts'
import {
  createNdiCaptureFlip,
  createNdiFlipTarget,
  NDI_CAPTURE_FLIPPED_BOTTOM_UP,
  ndiCaptureFlipBlitRect,
  probeNdiCaptureFlipBlit,
} from './ndiCaptureFlip.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

type BlitCall = number[]

function makeFakeBlitGl(calls: BlitCall[]): Record<string, unknown> {
  let binding: unknown = null
  let scissor = false
  return {
    READ_FRAMEBUFFER: 0x8ca8,
    DRAW_FRAMEBUFFER: 0x8ca9,
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_BINDING: 0x8ca6,
    COLOR_BUFFER_BIT: 0x4000,
    NEAREST: 0x2600,
    SCISSOR_TEST: 0x0c11,
    blitFramebuffer: (
      srcX0: number,
      srcY0: number,
      srcX1: number,
      srcY1: number,
      dstX0: number,
      dstY0: number,
      dstX1: number,
      dstY1: number,
      mask: number,
      filter: number,
    ) => {
      calls.push([
        srcX0,
        srcY0,
        srcX1,
        srcY1,
        dstX0,
        dstY0,
        dstX1,
        dstY1,
        mask,
        filter,
      ])
    },
    bindFramebuffer: (_target: number, fb: unknown) => {
      binding = fb
    },
    getParameter: (pname: number) => {
      if (pname === 0x8ca6) return binding
      return null
    },
    isEnabled: (cap: number) => (cap === 0x0c11 ? scissor : false),
    enable: (cap: number) => {
      if (cap === 0x0c11) scissor = true
    },
    disable: (cap: number) => {
      if (cap === 0x0c11) scissor = false
    },
  }
}

describe('ndiCaptureFlipBlitRect', () => {
  it('inverts dest Y so packed readPixels is top-down', () => {
    const rect = ndiCaptureFlipBlitRect(1920, 1080)
    expect(rect.srcX0).toBe(0)
    expect(rect.srcY0).toBe(0)
    expect(rect.srcX1).toBe(1920)
    expect(rect.srcY1).toBe(1080)
    expect(rect.dstX0).toBe(0)
    expect(rect.dstY0).toBe(1080)
    expect(rect.dstX1).toBe(1920)
    expect(rect.dstY1).toBe(0)
    expect(rect.dstY0).toBeGreaterThan(rect.dstY1)
  })
})

describe('createNdiFlipTarget', () => {
  it('pins sRGB on create and again after a recreate (resize)', () => {
    let target = createNdiFlipTarget(16, 9)
    expect(target.texture.colorSpace).toBe(SRGBColorSpace)
    expect(target.depthBuffer).toBe(false)
    target.dispose()
    target = createNdiFlipTarget(32, 18)
    expect(target.texture.colorSpace).toBe(SRGBColorSpace)
    target.dispose()
  })

  it('does not rewrite alpha, chroma, or plate clear', () => {
    const src = readFileSync(join(here, 'ndiCaptureFlip.ts'), 'utf8')
    expect(src).toMatch(/applyNdiCaptureColorSpace/)
    expect(src).toMatch(/COLOR_BUFFER_BIT/)
    expect(src).not.toMatch(/setClearColor|clearAlpha|getClearAlpha/)
    expect(src).not.toMatch(/TRANSPARENT_CLEAR_COLOR|DEFAULT_CHROMA_KEY/)
    expect(src).not.toMatch(/for\s*\(\s*let\s+y/)
    expect(src).not.toMatch(/height\s*-\s*1\s*-\s*y/)
    expect(DEFAULT_CHROMA_KEY).toBe(0x00ff00)
    expect(TRANSPARENT_CLEAR_COLOR).toBe(0x000000)
  })
})

describe('createNdiCaptureFlip', () => {
  it('GPU-blits inverted dest Y and leaves dest bound', () => {
    const calls: BlitCall[] = []
    const gl = makeFakeBlitGl(calls)
    let bound: WebGLRenderTarget | null = null
    const renderer = {
      getContext: () => gl,
      getRenderTarget: () => bound,
      setRenderTarget: (next: WebGLRenderTarget | null) => {
        bound = next
        gl.bindFramebuffer(0x8d40, next)
      },
    }
    const source = new WebGLRenderTarget(8, 4)
    applyNdiCaptureColorSpace(source)
    expect(source.texture.colorSpace).not.toBe(NoColorSpace)

    const flip = createNdiCaptureFlip({ renderer, gl })
    expect(probeNdiCaptureFlipBlit(gl)).toBe(true)
    const dest = flip.blit(source, 8, 4)
    expect(dest).not.toBe(source)
    expect(bound).toBe(dest)
    expect(dest.texture.colorSpace).toBe(SRGBColorSpace)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual([0, 0, 8, 4, 0, 4, 8, 0, 0x4000, 0x2600])
    expect(NDI_CAPTURE_FLIPPED_BOTTOM_UP).toBe(false)

    flip.blit(source, 16, 9)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual([0, 0, 16, 9, 0, 9, 16, 0, 0x4000, 0x2600])

    flip.dispose()
    source.dispose()
  })
})

describe('NDI capture flip wiring', () => {
  it('AR and 3D row-flip after PBO; no GPU blit on the hot path', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    expect(ar).toMatch(/flipOwnedRgbaFrame/)
    expect(d3).toMatch(/flipOwnedRgbaFrame/)
    expect(ar).toMatch(/NDI_CAPTURE_FLIPPED_BOTTOM_UP/)
    expect(d3).toMatch(/NDI_CAPTURE_FLIPPED_BOTTOM_UP/)
    expect(ar).not.toMatch(/createNdiCaptureFlip|captureFlip\.blit/)
    expect(d3).not.toMatch(/createNdiCaptureFlip|captureFlip\.blit/)
    expect(ar).not.toMatch(/bottomUp:\s*true/)
    expect(d3).not.toMatch(/bottomUp:\s*true/)
  })

  it('2D channel stays top-down and does not use the flip helper', () => {
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    const worker = readFileSync(join(here, 'ndi2dCapture.worker.ts'), 'utf8')
    const asyncCap = readFileSync(join(here, 'ndi2dAsyncCapture.ts'), 'utf8')
    expect(map).not.toMatch(/ndiCaptureFlip|createNdiCaptureFlip|ndiCaptureFlipBlitRect/)
    expect(worker).not.toMatch(/ndiCaptureFlip|createNdiCaptureFlip/)
    expect(asyncCap).not.toMatch(/ndiCaptureFlip|createNdiCaptureFlip/)
    expect(map).toMatch(/bottomUp:\s*false/)
    expect(map).not.toMatch(/WebGLRenderTarget/)
  })

  it('createScene preview is unchanged (NDI-only flip)', () => {
    const scene = readFileSync(join(repoRoot, 'src/scene/createScene.ts'), 'utf8')
    expect(scene).not.toMatch(/ndiCaptureFlip|createNdiCaptureFlip/)
    expect(scene).toMatch(
      /renderer\.outputColorSpace\s*=\s*THREE\.SRGBColorSpace/,
    )
  })
})
