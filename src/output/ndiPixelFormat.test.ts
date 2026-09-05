import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { packedFrameBytes } from './ndiUyvy.ts'
import { ndiGpuUyvySize } from './ndiGpuUyvy.ts'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const {
  resolvePixelFormat,
  pixelBytes,
  lineStrideBytes,
  resolveFourccLabel,
} = require(join(here, '../../desktop/ndiPixelFormat.cjs')) as {
  resolvePixelFormat: (
    raw: unknown,
    byteLength: number,
    width: number,
    height: number,
  ) => 'rgba' | 'uyvy' | 'uyva'
  pixelBytes: (
    format: 'rgba' | 'uyvy' | 'uyva',
    width: number,
    height: number,
  ) => number
  lineStrideBytes: (
    format: 'rgba' | 'uyvy' | 'uyva',
    width: number,
  ) => number
  resolveFourccLabel: (
    format: 'rgba' | 'uyvy' | 'uyva',
    native: { uyvy?: boolean; uyva?: boolean; rgba?: boolean },
  ) => 'UYVY' | 'UYVA' | 'RGBA' | 'BGRA' | null
}

describe('NDI FourCC vs packed bytes (DSP-OUT-20260901-01)', () => {
  it('sizes 1080p UYVY at 2 bpp and UYVA at 3 with stride width*2', () => {
    expect(pixelBytes('uyvy', 1920, 1080)).toBe(1920 * 1080 * 2)
    expect(pixelBytes('uyva', 1920, 1080)).toBe(1920 * 1080 * 3)
    expect(pixelBytes('uyvy', 1920, 1080)).toBe(packedFrameBytes('uyvy', 1920, 1080))
    expect(pixelBytes('uyva', 1920, 1080)).toBe(packedFrameBytes('uyva', 1920, 1080))
    expect(lineStrideBytes('uyvy', 1920)).toBe(3840)
    expect(lineStrideBytes('uyva', 1920)).toBe(3840)
    expect(lineStrideBytes('rgba', 1920)).toBe(1920 * 4)
    expect(lineStrideBytes('uyvy', 1920) * 1080).toBe(pixelBytes('uyvy', 1920, 1080))
    expect(
      lineStrideBytes('uyva', 1920) * 1080 + (lineStrideBytes('uyva', 1920) / 2) * 1080,
    ).toBe(pixelBytes('uyva', 1920, 1080))
  })

  it('GPU pack RT RGBA8 byte count equals UYVY payload', () => {
    const size = ndiGpuUyvySize(1920, 1080)
    expect(size.width * size.height * 4).toBe(pixelBytes('uyvy', 1920, 1080))
  })

  it('honours advertised format even when byte length could be RGBA', () => {
    expect(resolvePixelFormat('uyvy', 1920 * 1080 * 2, 1920, 1080)).toBe('uyvy')
    expect(resolvePixelFormat('uyva', 1920 * 1080 * 3, 1920, 1080)).toBe('uyva')
    expect(resolvePixelFormat(undefined, 1920 * 1080 * 2, 1920, 1080)).toBe('uyvy')
    expect(resolvePixelFormat(undefined, 1920 * 1080 * 3, 1920, 1080)).toBe('uyva')
    expect(resolvePixelFormat(undefined, 1920 * 1080 * 4, 1920, 1080)).toBe('rgba')
    expect(resolvePixelFormat('uyvy', 960 * 1080 * 4, 1920, 1080)).toBe('uyvy')
  })

  it('does not advertise RGBA for packed UYVY/UYVA', () => {
    expect(resolveFourccLabel('uyvy', { uyvy: true, rgba: true })).toBe('UYVY')
    expect(resolveFourccLabel('uyva', { uyva: true, rgba: true })).toBe('UYVA')
    expect(resolveFourccLabel('uyvy', { uyvy: false, rgba: true })).toBeNull()
    expect(resolveFourccLabel('uyva', { uyva: false, rgba: true })).toBeNull()
    expect(resolveFourccLabel('rgba', { rgba: true })).toBe('RGBA')
    expect(resolveFourccLabel('rgba', { rgba: false })).toBe('BGRA')
  })

  it('sender refuses RGBA FourCC for packed UYVY/UYVA', () => {
    const sender = readFileSync(
      join(here, '../../desktop/ndiSender.cjs'),
      'utf8',
    )
    expect(sender).toMatch(/refusing RGBA fallback/)
    expect(sender).toMatch(/ndiPixelFormat\.cjs/)
    expect(sender).toMatch(/lineStrideBytes\(format, width\)/)
  })
})
