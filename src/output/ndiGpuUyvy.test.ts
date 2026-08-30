import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ndiGpuUyvySize } from './ndiGpuUyvy.ts'
import { packedFrameBytes } from './ndiUyvy.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('ndiGpuUyvy', () => {
  it('half-width RGBA equals UYVY byte count', () => {
    const size = ndiGpuUyvySize(1920, 1080)
    expect(size).toEqual({ width: 960, height: 1080 })
    expect(size.width * size.height * 4).toBe(packedFrameBytes('uyvy', 1920, 1080))
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

  it('3D pump packs on the GPU before PBO', () => {
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    expect(d3).toMatch(/createNdiGpuUyvyPack/)
    expect(d3).toMatch(/gpuPack\.pack/)
  })

  it('AR packs UYVA on a worker; 2D worker packs UYVY', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    const worker = readFileSync(join(here, 'ndi2dCapture.worker.ts'), 'utf8')
    expect(ar).toMatch(/createNdiUyvyWorker/)
    expect(ar).toMatch(/pixelFormat:\s*['"]uyva['"]/)
    expect(map).toMatch(/packedFrameBytes\('uyvy'/)
    expect(worker).toMatch(/rgbaToUyvy/)
  })
})
