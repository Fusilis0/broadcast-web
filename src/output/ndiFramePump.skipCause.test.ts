/**
 * @vitest-environment happy-dom
 *
 * Readback-blocked AR/3D skips must be `busy`, not silent (then counted as
 * rateCap by omission). Capture still returns at the same gate — attribution
 * only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Camera, Object3D, WebGLRenderer } from 'three'
import { startNdiFramePump } from './ndiFramePump.ts'
import { startNdi3dChannelPump } from './ndi3dChannelPump.ts'
import {
  formatNdiStageDump,
  resetNdiStageTiming,
} from './ndiStageTiming.ts'
import type { BroadcastStudioBridge } from './studioBridge.ts'

vi.mock('./ndiAsyncReadback.ts', () => ({
  createNdiAsyncReadback: () => ({
    mode: 'async' as const,
    isPending: () => true,
    canBegin: () => false,
    begin: () => false,
    poll: () => null,
    release: () => {},
    dispose: () => {},
  }),
}))

function stubRenderer(): WebGLRenderer {
  return {
    render: vi.fn(),
    getClearColor: () => {},
    getClearAlpha: () => 0,
    setClearColor: () => {},
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    xr: { enabled: false },
    domElement: { width: 4, height: 2 },
    getContext: () => null,
    readRenderTargetPixels: () => {},
  } as unknown as WebGLRenderer
}

describe('NDI skip cause: readback canBegin false is busy', () => {
  const tickCbs = new Set<() => void>()

  function installBridge(): void {
    const ndi = {
      start: vi.fn(async (opts?: { channel?: string; name?: string }) => ({
        ok: true,
        channel: opts?.channel ?? 'ar',
        sourceName: `HOST (${opts?.name ?? 'broadcast-web'})`,
        sdkVersion: '6',
      })),
      stop: vi.fn(async () => {}),
      sendFrame: vi.fn(),
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
  }

  afterEach(() => {
    tickCbs.clear()
    delete (window as Window & { broadcastStudio?: BroadcastStudioBridge })
      .broadcastStudio
    resetNdiStageTiming()
    vi.restoreAllMocks()
  })

  it('records AR skip as busy when canBegin() is false, not rateCap', () => {
    resetNdiStageTiming()
    installBridge()
    const renderer = stubRenderer()
    const render = renderer.render as ReturnType<typeof vi.fn>
    const pump = startNdiFramePump({
      renderer,
      scene: {} as Object3D,
      getAirCamera: () => ({}) as Camera,
    })
    expect(pump).not.toBeNull()
    for (const cb of tickCbs) cb()
    const dump = formatNdiStageDump()
    expect(dump).toMatch(/ar rateCap=0 stagger=0 busy=1/)
    expect(dump).not.toMatch(/ar rateCap=[1-9]/)
    expect(render).not.toHaveBeenCalled()
    pump?.stop()
  })

  it('records 3D skip as busy when canBegin() is false', () => {
    resetNdiStageTiming()
    installBridge()
    const renderer = stubRenderer()
    let opaque = false
    const pump = startNdi3dChannelPump({
      renderer,
      scene: {} as Object3D,
      getAirCamera: () => ({}) as Camera,
      setEnvironmentOpaqueClearSafe: (safe) => {
        opaque = safe
      },
      getEnvironmentOpaqueClearSafe: () => opaque,
    })
    expect(pump).not.toBeNull()
    for (const cb of tickCbs) cb()
    const dump = formatNdiStageDump()
    expect(dump).toMatch(/3d rateCap=0 stagger=0 busy=1/)
    pump?.stop()
  })
})
