/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  letterboxRect,
  startStreamMapNdiPump,
  STREAM_MAP_NDI_CHANNEL,
  STREAM_MAP_NDI_DEFAULT_NAME,
  type StreamMapNdiPumpHandle,
} from './streamMapNdiPump.ts'
import type { BroadcastStudioBridge } from './studioBridge.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('letterboxRect', () => {
  it('centers a square map in 1920×1080', () => {
    const box = letterboxRect(520, 520, 1920, 1080)
    expect(box.dw).toBe(1080)
    expect(box.dh).toBe(1080)
    expect(box.dx).toBe(Math.floor((1920 - 1080) / 2))
    expect(box.dy).toBe(0)
  })

  it('pillarboxes a wide source', () => {
    const box = letterboxRect(1920, 540, 1920, 1080)
    expect(box.dw).toBe(1920)
    expect(box.dh).toBe(540)
    expect(box.dx).toBe(0)
    expect(box.dy).toBe(Math.floor((1080 - 540) / 2))
  })
})

describe('STREAM_MAP_NDI constants', () => {
  it('targets channel 2d with broadcast-web-2d default name', () => {
    expect(STREAM_MAP_NDI_CHANNEL).toBe('2d')
    expect(STREAM_MAP_NDI_DEFAULT_NAME).toBe('broadcast-web-2d')
  })
})

describe('streamMapNdiPump source invariants', () => {
  it('does not import sidebar / controller / WebGL readback', () => {
    const src = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    expect(src).toMatch(/channel:\s*['"]2d['"]|STREAM_MAP_NDI_CHANNEL/)
    expect(src).toMatch(/letterbox/)
    expect(src).toMatch(/1920/)
    expect(src).toMatch(/bottomUp:\s*false/)
    expect(src).toMatch(/onStudioTick/)
    expect(src).not.toMatch(/ndiControllerPanel/)
    expect(src).not.toMatch(/scene\/sidebar/)
    expect(src).not.toMatch(/stubHud/)
    expect(src).not.toMatch(/readRenderTargetPixels/)
    expect(src).not.toMatch(/WebGLRenderer/)
  })
})

describe('startStreamMapNdiPump enable/disable', () => {
  const tickCbs = new Set<() => void>()
  let lastStopArg: unknown
  let startCalls = 0

  function installBridge(): void {
    const ndi = {
      start: vi.fn(async (opts?: { channel?: string; name?: string }) => {
        startCalls += 1
        return {
          ok: true,
          channel: opts?.channel ?? '2d',
          sourceName: `HOST (${opts?.name ?? STREAM_MAP_NDI_DEFAULT_NAME})`,
          sdkVersion: '6',
        }
      }),
      stop: vi.fn(async (arg?: unknown) => {
        lastStopArg = arg
      }),
      sendFrame: vi.fn(),
      getStatus: vi.fn(async () => ({
        active: false,
        sourceName: null,
        sdkVersion: null,
        error: null,
      })),
      getStatusAll: vi.fn(async () => ({
        ar: {
          active: false,
          sourceName: null,
          sdkVersion: null,
          error: null,
        },
        '3d': {
          active: false,
          sourceName: null,
          sdkVersion: null,
          error: null,
        },
        '2d': {
          active: false,
          sourceName: null,
          sdkVersion: null,
          error: null,
        },
      })),
    }
    const bridge: BroadcastStudioBridge = {
      isStudio: true,
      ndi,
      onStudioTick: (cb) => {
        tickCbs.add(cb)
        return () => {
          tickCbs.delete(cb)
        }
      },
    }
    ;(window as Window & { broadcastStudio?: BroadcastStudioBridge }).broadcastStudio =
      bridge
  }

  afterEach(() => {
    tickCbs.clear()
    startCalls = 0
    lastStopArg = undefined
    delete (window as Window & { broadcastStudio?: BroadcastStudioBridge })
      .broadcastStudio
    vi.restoreAllMocks()
  })

  it('returns null without studio bridge', () => {
    expect(
      startStreamMapNdiPump({
        getSourceCanvas: () => null,
      }),
    ).toBeNull()
  })

  it('starts disabled by default; enabled: true starts sender', async () => {
    installBridge()
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx?.fillRect(0, 0, 64, 64)

    const pumpOff = startStreamMapNdiPump({
      getSourceCanvas: () => canvas,
      ensureDrawn: () => {},
    })
    expect(pumpOff).not.toBeNull()
    expect(pumpOff?.isEnabled()).toBe(false)
    expect(startCalls).toBe(0)
    expect(tickCbs.size).toBe(0)
    pumpOff?.stop()

    const pump = startStreamMapNdiPump({
      getSourceCanvas: () => canvas,
      ensureDrawn: () => {},
      enabled: true,
    })
    expect(pump).not.toBeNull()
    const handle = pump as StreamMapNdiPumpHandle
    expect(handle.isEnabled()).toBe(true)

    await vi.waitFor(() => {
      expect(handle.getSourceName()).toContain('broadcast-web-2d')
    })
    expect(startCalls).toBeGreaterThanOrEqual(1)

    handle.setEnabled(false)
    expect(handle.isEnabled()).toBe(false)
    expect(lastStopArg).toEqual({ channel: '2d' })
    expect(tickCbs.size).toBe(0)

    handle.setEnabled(true)
    expect(handle.isEnabled()).toBe(true)
    await vi.waitFor(() => {
      expect(handle.getSourceName()).toContain('broadcast-web-2d')
    })

    handle.stop()
    expect(handle.isEnabled()).toBe(false)
  })

  it('honors enabled: false at start', () => {
    installBridge()
    const pump = startStreamMapNdiPump({
      getSourceCanvas: () => null,
      enabled: false,
    })
    expect(pump?.isEnabled()).toBe(false)
    expect(startCalls).toBe(0)
    expect(tickCbs.size).toBe(0)
    pump?.stop()
  })

  it('defaults to STREAM_MAP_NDI_DEFAULT_FPS (10)', () => {
    const src = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    expect(src).toMatch(/STREAM_MAP_NDI_DEFAULT_FPS\s*=\s*10/)
    expect(src).toMatch(/options\.enabled === true/)
  })
})
