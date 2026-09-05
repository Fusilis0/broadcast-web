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
    expect(src).toMatch(/setInterval/)
    expect(src).not.toMatch(/onStudioTick/)
    expect(src).toMatch(/isNdiFboReadbackPressured/)
    expect(src).not.toMatch(/ndiControllerPanel/)
    expect(src).not.toMatch(/scene\/sidebar/)
    expect(src).not.toMatch(/stubHud/)
    expect(src).not.toMatch(/readRenderTargetPixels/)
    expect(src).not.toMatch(/WebGLRenderer/)
    expect(src).not.toMatch(/tryClaimNdiHeavyCapture/)
    expect(src).toMatch(/createNdi2dAsyncCapture/)
    expect(src).toMatch(/scheduleCapture/)
    expect(src).toMatch(/capture\.defer/)
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

  it('starts enabled by default; setEnabled(false) stops the sender', async () => {
    installBridge()
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx?.fillRect(0, 0, 64, 64)

    const pump = startStreamMapNdiPump({
      getSourceCanvas: () => canvas,
      ensureDrawn: () => {},
      ndi2dCapture: { forceSync: true, onFallbackNote: () => {} },
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
      ndi2dCapture: { forceSync: true, onFallbackNote: () => {} },
    })
    expect(pump?.isEnabled()).toBe(false)
    expect(startCalls).toBe(0)
    expect(tickCbs.size).toBe(0)
    pump?.stop()
  })

  it('defaults to STREAM_MAP_NDI_DEFAULT_FPS (30) and enabled unless false', () => {
    const src = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    expect(src).toMatch(/STREAM_MAP_NDI_DEFAULT_FPS\s*=\s*30/)
    expect(src).toMatch(/options\.enabled !== false/)
    expect(src).toMatch(/getSendFps/)
    expect(src).toMatch(/createSendFpsCounter/)
    expect(src).toMatch(/createNdi2dAsyncCapture/)
    expect(src).not.toMatch(/tryClaimNdiHeavyCapture/)
  })
})

describe('startStreamMapNdiPump uses independent interval (not studio:tick)', () => {
  const deferred: Array<() => void> = []
  let restoreCtx: (() => void) | undefined

  function installFake2dContext(): () => void {
    const proto = HTMLCanvasElement.prototype
    const orig = proto.getContext
    proto.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      attrs?: unknown,
    ) {
      if (type !== '2d') {
        return orig.call(this, type, attrs as never)
      }
      return {
        fillStyle: '',
        fillRect() {},
        drawImage() {},
        getImageData(_x: number, _y: number, width: number, height: number) {
          return {
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
          }
        },
      } as unknown as CanvasRenderingContext2D
    }
    return () => {
      proto.getContext = orig
    }
  }

  function installBridge(): { sendFrame: ReturnType<typeof vi.fn> } {
    const sendFrame = vi.fn()
    const ndi = {
      start: vi.fn(async (opts?: { channel?: string; name?: string }) => ({
        ok: true,
        channel: opts?.channel ?? '2d',
        sourceName: `HOST (${opts?.name ?? STREAM_MAP_NDI_DEFAULT_NAME})`,
        sdkVersion: '6',
      })),
      stop: vi.fn(async () => {}),
      sendFrame,
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
      onStudioTick: () => () => {},
    }
    ;(window as Window & { broadcastStudio?: BroadcastStudioBridge }).broadcastStudio =
      bridge
    return { sendFrame }
  }

  afterEach(() => {
    restoreCtx?.()
    restoreCtx = undefined
    deferred.length = 0
    delete (window as Window & { broadcastStudio?: BroadcastStudioBridge })
      .broadcastStudio
    vi.restoreAllMocks()
  })

  it('does not run ensureDrawn or sendFrame until the independent defer fires', async () => {
    restoreCtx = installFake2dContext()
    const { sendFrame } = installBridge()
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    canvas.getContext('2d')?.fillRect(0, 0, 8, 8)

    let drawn = 0

    const pump = startStreamMapNdiPump({
      getSourceCanvas: () => canvas,
      ensureDrawn: () => {
        drawn += 1
      },
      outputWidth: 16,
      outputHeight: 8,
      fps: 50,
      ndi2dCapture: {
        forceSync: true,
        onFallbackNote: () => {},
        defer: (fn) => {
          deferred.push(fn)
        },
      },
    })
    expect(pump).not.toBeNull()
    await vi.waitFor(() => {
      expect(pump?.getSourceName()).toContain('broadcast-web-2d')
    })

    await vi.waitFor(() => {
      expect(deferred.length).toBeGreaterThanOrEqual(1)
    })
    expect(drawn).toBe(0)
    expect(sendFrame).not.toHaveBeenCalled()

    const first = deferred.shift()
    first?.()
    await vi.waitFor(() => {
      expect(sendFrame).toHaveBeenCalled()
    })
    expect(drawn).toBe(1)
    const frame = sendFrame.mock.calls[0]?.[0] as {
      channel: string
      width: number
      height: number
      data: ArrayBuffer
      bottomUp: boolean
      pixelFormat?: string
    }
    expect(frame.channel).toBe('2d')
    expect(frame.width).toBe(16)
    expect(frame.height).toBe(8)
    expect(frame.data.byteLength).toBe(16 * 8 * 2)
    expect(frame.bottomUp).toBe(false)
    expect(frame.pixelFormat).toBe('uyvy')
    pump?.stop()
  })
})
