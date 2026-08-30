import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createSendFpsCounter,
  createStageAccumulator,
  createIntHistogram,
  formatIntHistogram,
  formatGpuHudLabel,
  formatNdiSendFps,
  readWebGlGpuInfo,
  shortenUnmaskedRenderer,
  tickIntervalBucketMs,
} from './perfCounters.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('createSendFpsCounter', () => {
  it('returns 0 until a send is recorded', () => {
    const c = createSendFpsCounter(1000)
    expect(c.getFps(0)).toBe(0)
  })

  it('counts successful records in a 1 s window (not staggered skips)', () => {
    const c = createSendFpsCounter(1000)
    for (let i = 0; i < 10; i++) c.record(i * 100)
    expect(c.getFps(900)).toBe(10)
  })

  it('drops stamps older than the window', () => {
    const c = createSendFpsCounter(1000)
    c.record(0)
    c.record(100)
    expect(c.getFps(100)).toBe(2)
    expect(c.getFps(1101)).toBe(0)
  })
})

describe('formatNdiSendFps', () => {
  it('shows em-dash when off / unavailable, rounded fps when live', () => {
    expect(formatNdiSendFps(12, false)).toBe('—')
    expect(formatNdiSendFps(0, true)).toBe('—')
    expect(formatNdiSendFps(12.4, true)).toBe('12 fps')
  })
})

describe('formatGpuHudLabel', () => {
  it('shows unknown when the extension string is missing', () => {
    expect(formatGpuHudLabel(null)).toBe('GPU · unknown')
    expect(formatGpuHudLabel('')).toBe('GPU · unknown')
  })

  it('shortens ANGLE NVIDIA / Intel renderer strings', () => {
    expect(
      formatGpuHudLabel(
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ),
    ).toBe('GPU · NVIDIA GeForce RTX 4070')
    expect(
      formatGpuHudLabel(
        'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ),
    ).toBe('GPU · Intel(R) UHD Graphics 770')
  })
})

describe('shortenUnmaskedRenderer', () => {
  it('keeps a short Apple / Mesa string', () => {
    expect(shortenUnmaskedRenderer('Apple M1')).toBe('Apple M1')
  })
})

describe('readWebGlGpuInfo', () => {
  it('returns unknown when the debug extension is missing', () => {
    const gl = {
      getExtension: () => null,
      getParameter: () => '',
    }
    expect(readWebGlGpuInfo(gl)).toEqual({
      display: 'GPU · unknown',
      raw: null,
    })
  })

  it('reads UNMASKED_RENDERER_WEBGL when the extension exists', () => {
    const raw =
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    const gl = {
      getExtension: (name: string) =>
        name === 'WEBGL_debug_renderer_info'
          ? { UNMASKED_RENDERER_WEBGL: 0x9246, UNMASKED_VENDOR_WEBGL: 0x9245 }
          : null,
      getParameter: (pname: number) => (pname === 0x9246 ? raw : ''),
    }
    expect(readWebGlGpuInfo(gl)).toEqual({
      display: 'GPU · NVIDIA GeForce RTX 4070',
      raw,
    })
  })
})

describe('perfCounters source (no GPU fps asserts)', () => {
  it('does not change NDI send-rate caps (AR/3D/2D fps stay 30)', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    expect(ar).toMatch(/NDI_AR_DEFAULT_FPS\s*=\s*30/)
    expect(d3).toMatch(/NDI_3D_DEFAULT_FPS\s*=\s*30/)
    expect(map).toMatch(/STREAM_MAP_NDI_DEFAULT_FPS\s*=\s*30/)
  })
})

describe('createStageAccumulator', () => {
  it('reports mean and max without storing each sample', () => {
    const a = createStageAccumulator()
    a.add(2)
    a.add(4)
    a.add(6)
    expect(a.snapshot()).toEqual({
      count: 3,
      sumMs: 12,
      maxMs: 6,
      meanMs: 4,
    })
    a.reset()
    expect(a.snapshot().count).toBe(0)
  })
})

describe('createIntHistogram', () => {
  it('keeps a 2-vs-3 split instead of a mean', () => {
    const h = createIntHistogram(6)
    for (let i = 0; i < 8; i++) h.record(2)
    for (let i = 0; i < 4; i++) h.record(3)
    expect(h.snapshot()).toEqual({ '2': 8, '3': 4 })
    expect(formatIntHistogram(h.snapshot())).toBe('2:8 3:4')
    expect(formatIntHistogram(h.snapshot())).not.toMatch(/2\.5/)
  })

  it('overflows at maxExact as N+', () => {
    const h = createIntHistogram(6)
    h.record(6)
    h.record(9)
    expect(h.snapshot()).toEqual({ '6+': 2 })
  })
})

describe('tickIntervalBucketMs', () => {
  it('puts a 16.7 ms tick in 16, not a 17 mean', () => {
    expect(tickIntervalBucketMs(16.7)).toBe('16')
    expect(tickIntervalBucketMs(16.1)).toBe('16')
    expect(tickIntervalBucketMs(17.2)).toBe('17')
    expect(tickIntervalBucketMs(21.4)).toBe('21-24')
    expect(tickIntervalBucketMs(33.3)).toBe('25-33')
  })
})
