/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color } from 'three'
import { startNdiFramePump } from './ndiFramePump.ts'
import { startNdi3dChannelPump } from './ndi3dChannelPump.ts'
import { startStreamMapNdiPump } from './streamMapNdiPump.ts'
import type { BroadcastStudioBridge } from './studioBridge.ts'

const here = dirname(fileURLToPath(import.meta.url))

type FakePbo = { size: number; data: Uint8Array }

function makeFakeGl2(): Record<string, unknown> {
  const PIXEL_PACK_BUFFER = 0x88eb
  let packBinding: FakePbo | null = null
  return {
    PIXEL_PACK_BUFFER,
    PIXEL_PACK_BUFFER_BINDING: 0x88ed,
    STREAM_READ: 0x88e1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    PACK_ALIGNMENT: 0x0d05,
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
    CONDITION_SATISFIED: 0x911c,
    ALREADY_SIGNALED: 0x911a,
    TIMEOUT_EXPIRED: 0x911b,
    WAIT_FAILED: 0x911d,
    createBuffer: () => ({ size: 0, data: new Uint8Array(0) }) as FakePbo,
    bindBuffer: (target: number, buffer: FakePbo | null) => {
      if (target === PIXEL_PACK_BUFFER) packBinding = buffer
    },
    bufferData: (target: number, size: number) => {
      if (target !== PIXEL_PACK_BUFFER || !packBinding) return
      packBinding.size = size
      packBinding.data = new Uint8Array(size)
    },
    readPixels: () => {},
    fenceSync: () => ({}),
    flush: () => {},
    clientWaitSync: () => 0x911b,
    deleteSync: () => {},
    getBufferSubData: () => {},
    deleteBuffer: () => {},
    getParameter: (pname: number) => {
      if (pname === 0x88ed) return packBinding
      if (pname === 0x0d05) return 4
      return null
    },
    pixelStorei: () => {},
    checkFramebufferStatus: () => 0x8cd5,
  }
}

function stubRenderer(gl: unknown, render: ReturnType<typeof vi.fn>): WebGLRenderer {
  const clear = new Color(0)
  let alpha = 1
  let target: unknown = null
  return {
    render,
    getClearColor: (c: Color) => {
      c.copy(clear)
      return c
    },
    getClearAlpha: () => alpha,
    setClearColor: (color: number, a?: number) => {
      clear.setHex(color)
      if (typeof a === 'number') alpha = a
    },
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next
    },
    xr: { enabled: false },
    domElement: { width: 4, height: 2 },
    getContext: () => gl,
    readRenderTargetPixels: (
      _t: unknown,
      _x: number,
      _y: number,
      w: number,
      h: number,
      buffer: Uint8Array,
    ) => {
      buffer.fill(1, 0, Math.min(buffer.byteLength, w * h * 4))
    },
  } as unknown as WebGLRenderer
}

describe('independent AR/3D/2D clocks (DSP-OUT-20260829-04)', () => {
  const tickCbs = new Set<() => void>()

  function installBridge(): { sendFrame: ReturnType<typeof vi.fn> } {
    const sendFrame = vi.fn()
    const ndi = {
      start: vi.fn(async (opts?: { channel?: string; name?: string }) => ({
        ok: true,
        channel: opts?.channel ?? 'ar',
        sourceName: `HOST (${opts?.name ?? 'broadcast-web'})`,
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
        ar: { active: false, sourceName: null, sdkVersion: null, error: null },
        '3d': { active: false, sourceName: null, sdkVersion: null, error: null },
        '2d': { active: false, sourceName: null, sdkVersion: null, error: null },
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
    return { sendFrame }
  }

  afterEach(() => {
    tickCbs.clear()
    delete (window as Window & { broadcastStudio?: BroadcastStudioBridge })
      .broadcastStudio
    vi.restoreAllMocks()
  })

  it('AR and 3D both FBO-render on the same PBO tick', () => {
    installBridge()
    const render = vi.fn()
    const renderer = stubRenderer(makeFakeGl2(), render)
    const scene = {} as Object3D
    const camera = {} as Camera
    let opaque = false

    const ar = startNdiFramePump({
      renderer,
      scene,
      getAirCamera: () => camera,
    })
    const d3 = startNdi3dChannelPump({
      renderer,
      scene,
      getAirCamera: () => camera,
      setEnvironmentOpaqueClearSafe: (safe) => {
        opaque = safe
      },
      getEnvironmentOpaqueClearSafe: () => opaque,
    })
    expect(ar).not.toBeNull()
    expect(d3).not.toBeNull()

    for (const cb of tickCbs) cb()
    // AR FBO + 3D FBO + 3D GPU UYVY pack (stub has no WebGLRenderer.prototype.render).
    expect(render).toHaveBeenCalledTimes(3)

    ar?.stop()
    d3?.stop()
  })

  it('sync fallback still arbitrates: only one FBO render per tick', () => {
    installBridge()
    const render = vi.fn()
    const renderer = stubRenderer(null, render)
    const scene = {} as Object3D
    const camera = {} as Camera
    let opaque = false

    const ar = startNdiFramePump({
      renderer,
      scene,
      getAirCamera: () => camera,
    })
    const d3 = startNdi3dChannelPump({
      renderer,
      scene,
      getAirCamera: () => camera,
      setEnvironmentOpaqueClearSafe: (safe) => {
        opaque = safe
      },
      getEnvironmentOpaqueClearSafe: () => opaque,
    })

    for (const cb of tickCbs) cb()
    expect(render).toHaveBeenCalledTimes(1)

    ar?.stop()
    d3?.stop()
  })

  it('does not call sendFrame inside the studio:tick stack (PBO drain is later)', () => {
    const { sendFrame } = installBridge()
    const render = vi.fn()
    const renderer = stubRenderer(makeFakeGl2(), render)
    const scene = {} as Object3D
    const camera = {} as Camera
    let opaque = false
    const ar = startNdiFramePump({
      renderer,
      scene,
      getAirCamera: () => camera,
    })
    const d3 = startNdi3dChannelPump({
      renderer,
      scene,
      getAirCamera: () => camera,
      setEnvironmentOpaqueClearSafe: (safe) => {
        opaque = safe
      },
      getEnvironmentOpaqueClearSafe: () => opaque,
    })
    for (const cb of tickCbs) cb()
    expect(sendFrame).not.toHaveBeenCalled()
    ar?.stop()
    d3?.stop()
  })

  it('2D schedule does not wait on AR/3D stagger (source + live pumps)', async () => {
    const { sendFrame } = installBridge()
    const render = vi.fn()
    const renderer = stubRenderer(makeFakeGl2(), render)
    const scene = {} as Object3D
    const camera = {} as Camera
    let opaque = false
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8

    const ar = startNdiFramePump({
      renderer,
      scene,
      getAirCamera: () => camera,
    })
    const d3 = startNdi3dChannelPump({
      renderer,
      scene,
      getAirCamera: () => camera,
      setEnvironmentOpaqueClearSafe: (safe) => {
        opaque = safe
      },
      getEnvironmentOpaqueClearSafe: () => opaque,
    })
    const map = startStreamMapNdiPump({
      getSourceCanvas: () => canvas,
      ensureDrawn: () => {},
      outputWidth: 8,
      outputHeight: 4,
      ndi2dCapture: {
        forceSync: true,
        onFallbackNote: () => {},
        // Do not run sync grab while AR/3D FBO probes are registered.
        defer: () => {},
      },
    })
    await vi.waitFor(() => {
      expect(map?.getSourceName()).toContain('broadcast-web-2d')
    })
    // 2D uses setInterval — only AR+3D subscribe to studio:tick.
    expect(tickCbs.size).toBe(2)
    ar?.stop()
    d3?.stop()
    map?.stop()
    expect(sendFrame).toBeDefined()
  })

  it('AR/3D pumps drop ArrayBuffer.slice and defer IPC (source)', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    expect(ar).toMatch(/createNdiCaptureGate/)
    expect(d3).toMatch(/createNdiCaptureGate/)
    expect(map).toMatch(/createNdiCaptureGate/)
    expect(ar).toMatch(/createNdiDeferredSend/)
    expect(d3).toMatch(/createNdiDeferredSend/)
    expect(map).toMatch(/createNdiDeferredSend/)
    expect(ar).toMatch(/takeNdiArrayBuffer/)
    expect(d3).toMatch(/takeNdiArrayBuffer/)
    expect(ar).toMatch(/readback\.canBegin/)
    expect(d3).toMatch(/readback\.canBegin/)
    expect(ar).toMatch(
      /if \(!readback\.canBegin\(\)\)[\s\S]{0,160}noteNdiSkip\('ar', 'busy'\)/,
    )
    expect(d3).toMatch(
      /if \(!readback\.canBegin\(\)\)[\s\S]{0,160}noteNdiSkip\('3d', 'busy'\)/,
    )
    expect(ar).not.toMatch(/\.slice\(/)
    expect(d3).not.toMatch(/\.slice\(/)
    expect(ar).toMatch(/readback\.mode === ['"]sync['"]/)
    expect(d3).toMatch(/readback\.mode === ['"]sync['"]/)
    expect(ar).toMatch(/blocking:\s*true/)
    expect(d3).toMatch(/blocking:\s*true/)
  })
})
