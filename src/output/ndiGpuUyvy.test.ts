import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ndiGpuUyvySize } from './ndiGpuUyvy.ts'
import { packedFrameBytes, rgbaToUyvy } from './ndiUyvy.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('ndiGpuUyvy', () => {
  it('half-width RGBA equals UYVY byte count', () => {
    const size = ndiGpuUyvySize(1920, 1080)
    expect(size).toEqual({ width: 960, height: 1080 })
    expect(size.width * size.height * 4).toBe(packedFrameBytes('uyvy', 1920, 1080))
  })

  it('solid sky-ish RGB first macropixel is UYVY, not raw RGBA', () => {
    const src = new Uint8Array([80, 160, 220, 255, 80, 160, 220, 255])
    const dest = new Uint8Array(4)
    expect(rgbaToUyvy(src, 2, 1, dest)).toBe(4)
    expect([...dest]).not.toEqual([80, 160, 220, 255])
    expect(dest[0]).toBe(162)
    expect(dest[1]).toBe(142)
    expect(dest[2]).toBe(88)
    expect(dest[3]).toBe(142)
  })

  it('shader flips Y and writes U Y0 V Y1', () => {
    const src = readFileSync(join(here, 'ndiGpuUyvy.ts'), 'utf8')
    expect(src).toMatch(/1\.0 - uv\.y/)
    expect(src).toMatch(/yuv709/)
    expect(src).toMatch(/createNdiGpuUyvyPack/)
    expect(src).toMatch(/NoColorSpace/)
    expect(src).toMatch(/WebGLRenderer\.prototype\.render/)
    expect(src).not.toMatch(/applyNdiCaptureColorSpace/)
  })

  it('3D live send reads full-size FBO then CPU-packs UYVY', () => {
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    expect(d3).not.toMatch(/createNdiGpuUyvyPack/)
    expect(d3).not.toMatch(/gpuPack\.pack/)
    expect(d3).toMatch(/readback\.begin\(fbo/)
    expect(d3).toMatch(/createNdiPackPool\('uyvy'\)/)
    expect(d3).toMatch(/createNdiUyvyWorker/)
    expect(d3).toMatch(/pixelFormat:\s*['"]uyvy['"]/)
  })

  it('AR packs UYVA on a worker; 3D packs UYVY on the same worker; 2D worker packs UYVY', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    const worker = readFileSync(join(here, 'ndi2dCapture.worker.ts'), 'utf8')
    expect(ar).toMatch(/createNdiUyvyWorker/)
    expect(ar).toMatch(/pixelFormat:\s*['"]uyva['"]/)
    expect(d3).toMatch(/createNdiUyvyWorker/)
    expect(d3).toMatch(/pixelFormat:\s*['"]uyvy['"]/)
    expect(map).toMatch(/packedFrameBytes\('uyvy'/)
    expect(worker).toMatch(/rgbaToUyvy/)
  })
})
