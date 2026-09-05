import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shouldSkipCpuUyvyPack } from './ndi3dChannelPump.ts'
import { createNdiPackPool, packedFrameBytes } from './ndiUyvy.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('shouldSkipCpuUyvyPack (DSP-OUT-20260901-06)', () => {
  it('does not skip CPU pack for half-width + lastPackSrcW without verified READ', () => {
    expect(
      shouldSkipCpuUyvyPack({
        readW: 960,
        readH: 1080,
        lastPackSrcW: 1920,
        lastPackSrcH: 1080,
        verifiedGpuPackRead: false,
      }),
    ).toBe(false)
  })

  it('skips only when READ was verified on the packed dest', () => {
    expect(
      shouldSkipCpuUyvyPack({
        readW: 960,
        readH: 1080,
        lastPackSrcW: 1920,
        lastPackSrcH: 1080,
        verifiedGpuPackRead: true,
      }),
    ).toBe(true)
  })
})

describe('3D UYVY pack from full RGBA', () => {
  it('packs full-size RGBA to width*height*2 UYVY', () => {
    const w = 1920
    const h = 1080
    const rgba = new ArrayBuffer(w * h * 4)
    const pool = createNdiPackPool('uyvy')
    const packed = pool.pack(rgba, w, h)
    expect(packed).not.toBeNull()
    expect(packed!.byteLength).toBe(packedFrameBytes('uyvy', w, h))
    expect(packed!.byteLength).toBe(w * h * 2)
  })
})

describe('3D live send path (source)', () => {
  it('reads full-size FBO and CPU-packs UYVY; no GPU size heuristic skip', () => {
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    expect(d3).toMatch(/readback\.begin\(fbo/)
    expect(d3).toMatch(/createNdiPackPool\('uyvy'\)/)
    expect(d3).toMatch(/createNdiUyvyWorker/)
    expect(d3).toMatch(/verifiedGpuPackRead:\s*false/)
    expect(d3).not.toMatch(/createNdiGpuUyvyPack/)
    expect(d3).not.toMatch(/gpuPack\.pack/)
    expect(d3).toMatch(/pixelFormat:\s*['"]uyvy['"]/)
    expect(ar).toMatch(/createNdiPackPool\('uyva'\)/)
    expect(ar).toMatch(/pixelFormat:\s*['"]uyva['"]/)
  })
})
