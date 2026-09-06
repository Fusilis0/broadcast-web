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

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

describe('applyNdiCaptureColorSpace', () => {
  it('sets the capture texture to SRGBColorSpace', () => {
    const target = new WebGLRenderTarget(16, 9)
    expect(target.texture.colorSpace).toBe(NoColorSpace)
    applyNdiCaptureColorSpace(target)
    expect(target.texture.colorSpace).toBe(SRGBColorSpace)
    target.dispose()
  })

  it('re-pins after a recreate (resize path)', () => {
    let target = new WebGLRenderTarget(16, 9)
    applyNdiCaptureColorSpace(target)
    expect(target.texture.colorSpace).toBe(SRGBColorSpace)
    target.dispose()
    target = new WebGLRenderTarget(32, 18)
    expect(target.texture.colorSpace).toBe(NoColorSpace)
    applyNdiCaptureColorSpace(target)
    expect(target.texture.colorSpace).toBe(SRGBColorSpace)
    target.dispose()
  })

  it('does not write alpha, chroma key, or plate clear constants', () => {
    const src = readFileSync(join(here, 'ndiCaptureColorSpace.ts'), 'utf8')
    expect(src).toMatch(/texture\.colorSpace\s*=\s*SRGBColorSpace/)
    expect(src).not.toMatch(/setClearColor|clearAlpha|getClearAlpha/)
    expect(src).not.toMatch(/TRANSPARENT_CLEAR_COLOR|DEFAULT_CHROMA_KEY/)
    expect(DEFAULT_CHROMA_KEY).toBe(0x00ff00)
    expect(TRANSPARENT_CLEAR_COLOR).toBe(0x000000)
  })
})

describe('NDI capture colour-space wiring', () => {
  it('AR and 3D pumps apply the helper on target create', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    expect(ar).toMatch(/applyNdiCaptureColorSpace/)
    expect(d3).toMatch(/applyNdiCaptureColorSpace/)
    expect(ar).toMatch(
      /new WebGLRenderTarget[\s\S]*?applyNdiCaptureColorSpace\(target\)/,
    )
    expect(d3).toMatch(
      /new WebGLRenderTarget[\s\S]*?applyNdiCaptureColorSpace\(target\)/,
    )
  })

  it('2D channel does not go through the FBO helper (already canvas sRGB)', () => {
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    const worker = readFileSync(join(here, 'ndi2dCapture.worker.ts'), 'utf8')
    const asyncCap = readFileSync(join(here, 'ndi2dAsyncCapture.ts'), 'utf8')
    expect(map).not.toMatch(/applyNdiCaptureColorSpace/)
    expect(map).not.toMatch(/WebGLRenderTarget/)
    expect(worker).not.toMatch(/applyNdiCaptureColorSpace/)
    expect(asyncCap).not.toMatch(/applyNdiCaptureColorSpace/)
  })

  it('createScene pins renderer.outputColorSpace to SRGBColorSpace', () => {
    const scene = readFileSync(join(repoRoot, 'src/scene/createScene.ts'), 'utf8')
    expect(scene).toMatch(
      /renderer\.outputColorSpace\s*=\s*THREE\.SRGBColorSpace/,
    )
  })
})
