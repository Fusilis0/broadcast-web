import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import type { WebGLRenderTarget } from 'three'
import {
  createNdiAsyncReadback,
  NDI_ASYNC_READBACK_FENCE_MAX_MS,
  NDI_ASYNC_READBACK_LATENCY_FRAMES,
  NDI_ASYNC_READBACK_PBO_COUNT,
  NDI_PIXEL_RING_CAPACITY,
  NDI_PUBLIC_FBO_MISSING_NOTE,
  NDI_SYNC_READBACK_NOTE,
  probeNdiPboReadback,
} from './ndiAsyncReadback.ts'
import {
  fallbackHudFlags,
  resetNdiStageTiming,
} from './ndiStageTiming.ts'

afterEach(() => {
  resetNdiStageTiming()
})

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

const dummyTarget = {} as WebGLRenderTarget

type FakePbo = {
  size: number
  data: Uint8Array
}

function makeFakeGl2(opts?: { fenceReady?: boolean; fill?: number }): {
  gl: Record<string, unknown>
  setFenceReady: (ready: boolean) => void
  readPixelCount: () => number
} {
  const PIXEL_PACK_BUFFER = 0x88eb
  let packBinding: FakePbo | null = null
  let fenceReady = opts?.fenceReady ?? false
  let readPixelCount = 0
  const fill = opts?.fill ?? 9

  const gl: Record<string, unknown> = {
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
    COLOR_ATTACHMENT0: 0x8ce0,
    TEXTURE_2D: 0x0de1,
    createFramebuffer: () => ({ id: 'owned-read' }),
    framebufferTexture2D: () => {},
    deleteFramebuffer: () => {},
    createBuffer: () => ({ size: 0, data: new Uint8Array(0) }) as FakePbo,
    bindBuffer: (target: number, buffer: FakePbo | null) => {
      if (target === PIXEL_PACK_BUFFER) packBinding = buffer
    },
    bufferData: (target: number, size: number) => {
      if (target !== PIXEL_PACK_BUFFER || !packBinding) return
      packBinding.size = size
      packBinding.data = new Uint8Array(size)
    },
    readPixels: (
      _x: number,
      _y: number,
      w: number,
      h: number,
      _format: number,
      _type: number,
      offset: number,
    ) => {
      readPixelCount += 1
      if (!packBinding) return
      const n = w * h * 4
      for (let i = 0; i < n; i++) packBinding.data[offset + i] = fill
    },
    fenceSync: () => ({ id: readPixelCount }),
    flush: () => {},
    clientWaitSync: () => (fenceReady ? 0x911c : 0x911b),
    deleteSync: () => {},
    getBufferSubData: (
      target: number,
      srcOffset: number,
      dest: Uint8Array,
    ) => {
      if (target !== PIXEL_PACK_BUFFER || !packBinding) return
      dest.set(packBinding.data.subarray(srcOffset, srcOffset + dest.byteLength))
    },
    deleteBuffer: () => {},
    getParameter: (pname: number) => {
      if (pname === 0x88ed) return packBinding
      if (pname === 0x0d05) return 4
      return null
    },
    pixelStorei: () => {},
    checkFramebufferStatus: () => 0x8cd5,
  }

  return {
    gl,
    setFenceReady: (ready: boolean) => {
      fenceReady = ready
    },
    readPixelCount: () => readPixelCount,
  }
}

function stubRenderer(opts?: {
  gl?: unknown
  fill?: number
}): {
  renderer: {
    getContext: () => unknown
    setRenderTarget?: (target: unknown) => void
    readRenderTargetPixels: (
      target: unknown,
      x: number,
      y: number,
      w: number,
      h: number,
      buffer: Uint8Array,
    ) => void
    properties?: {
      get: (object: unknown) =>
        | { __webglFramebuffer?: unknown; __webglTexture?: unknown }
        | undefined
    }
  }
  syncReads: number
  boundTarget: unknown
  syncReadTarget: unknown
} {
  let syncReads = 0
  const fill = opts?.fill ?? 3
  let boundTarget: unknown = null
  let syncReadTarget: unknown = null
  return {
    renderer: {
      getContext: () => opts?.gl ?? null,
      setRenderTarget: (target: unknown) => {
        boundTarget = target
      },
      readRenderTargetPixels: (
        t,
        _x,
        _y,
        w,
        h,
        buffer: Uint8Array,
      ) => {
        syncReads += 1
        syncReadTarget = t
        const n = Math.min(buffer.byteLength, w * h * 4)
        for (let i = 0; i < n; i++) buffer[i] = fill
      },
    },
    get syncReads() {
      return syncReads
    },
    get boundTarget() {
      return boundTarget
    },
    get syncReadTarget() {
      return syncReadTarget
    },
  }
}

describe('probeNdiPboReadback', () => {
  it('rejects null / incomplete GL', () => {
    expect(probeNdiPboReadback(null)).toBe(false)
    expect(probeNdiPboReadback({})).toBe(false)
    expect(probeNdiPboReadback({ createBuffer: () => null })).toBe(false)
  })

  it('accepts a duck-typed WebGL2 PBO context', () => {
    expect(probeNdiPboReadback(makeFakeGl2().gl)).toBe(true)
  })
})

describe('createNdiAsyncReadback sync fallback', () => {
  it('does not note or mark at construct; begin uses readRenderTargetPixels', () => {
    const notes: string[] = []
    const stub = stubRenderer({ gl: null, fill: 11 })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: null,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(rb.mode).toBe('sync')
    expect(notes).toEqual([])
    expect(fallbackHudFlags().syncReadback).toBe(false)

    expect(rb.begin(dummyTarget, 2, 1)).toBe(true)
    expect(notes).toEqual([NDI_SYNC_READBACK_NOTE])
    expect(fallbackHudFlags().syncReadback).toBe(true)
    expect(stub.syncReads).toBe(1)
    const pixels = rb.poll()
    expect(pixels).not.toBeNull()
    expect(pixels?.width).toBe(2)
    expect(pixels?.height).toBe(1)
    expect(pixels?.data.length).toBe(8)
    expect(pixels?.data[0]).toBe(11)
    expect(rb.poll()).toBeNull()
    rb.dispose()
  })

  it('transfers poll ownership so a later begin does not overwrite sent pixels', () => {
    const notes: string[] = []
    const stub = stubRenderer({ gl: null, fill: 11 })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: null,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(rb.begin(dummyTarget, 2, 1)).toBe(true)
    const first = rb.poll()
    expect(first?.data[0]).toBe(11)
    const held = first!.data
    stub.renderer.readRenderTargetPixels = (
      _t,
      _x,
      _y,
      w,
      h,
      buffer: Uint8Array,
    ) => {
      const n = Math.min(buffer.byteLength, w * h * 4)
      for (let i = 0; i < n; i++) buffer[i] = 99
    }
    expect(rb.begin(dummyTarget, 2, 1)).toBe(true)
    expect(held[0]).toBe(11)
    const second = rb.poll()
    expect(second?.data[0]).toBe(99)
    expect(held[0]).toBe(11)
    rb.release(held)
    rb.release(second!.data)
    rb.dispose()
  })

  it('forceSync skips PBO even when GL looks capable', () => {
    const fake = makeFakeGl2()
    const stub = stubRenderer({ gl: fake.gl, fill: 5 })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      forceSync: true,
      onFallbackNote: () => {},
    })
    expect(rb.mode).toBe('sync')
    expect(rb.begin(dummyTarget, 1, 1)).toBe(true)
    expect(stub.syncReads).toBe(1)
    expect(fake.readPixelCount()).toBe(0)
    expect(rb.poll()?.data[0]).toBe(5)
    rb.dispose()
  })

  it('notes fallback only once, and only when begin actually sync-reads', () => {
    const notes: string[] = []
    const stub = stubRenderer({ gl: null })
    createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: null,
      onFallbackNote: (m) => notes.push(m),
    })
    createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: null,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(notes).toHaveLength(0)
    const one = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: null,
      onFallbackNote: (m) => notes.push(m),
    })
    one.begin(dummyTarget, 1, 1)
    one.begin(dummyTarget, 1, 1)
    expect(notes).toHaveLength(1)
    one.dispose()
  })
})

describe('createNdiAsyncReadback PBO path', () => {
  it('does not call sync readback; poll waits until the fence signals', () => {
    const fake = makeFakeGl2({ fenceReady: false, fill: 42 })
    const stub = stubRenderer({ gl: fake.gl, fill: 1 })
    const notes: string[] = []
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(rb.mode).toBe('pbo')
    expect(notes).toEqual([])
    expect(NDI_ASYNC_READBACK_LATENCY_FRAMES).toBe(1)
    expect(NDI_ASYNC_READBACK_PBO_COUNT).toBe(2)

    expect(rb.begin(dummyTarget, 2, 2)).toBe(true)
    expect(stub.boundTarget).toBe(dummyTarget)
    expect(stub.syncReads).toBe(0)
    expect(fake.readPixelCount()).toBe(1)
    expect(rb.isPending()).toBe(true)
    expect(rb.poll(0)).toBeNull()

    fake.setFenceReady(true)
    const pixels = rb.poll(16)
    expect(pixels).not.toBeNull()
    expect(pixels?.width).toBe(2)
    expect(pixels?.height).toBe(2)
    expect(pixels?.data.length).toBe(16)
    expect(pixels?.data[0]).toBe(42)
    expect(rb.isPending()).toBe(false)
    expect(stub.syncReads).toBe(0)
    rb.dispose()
  })

  it('double-buffers two in-flight packs and drops a third', () => {
    const fake = makeFakeGl2({ fenceReady: false, fill: 7 })
    const stub = stubRenderer({ gl: fake.gl })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(rb.begin(dummyTarget, 1, 1)).toBe(true)
    expect(rb.begin(dummyTarget, 1, 1)).toBe(true)
    expect(rb.begin(dummyTarget, 1, 1)).toBe(false)
    expect(fake.readPixelCount()).toBe(2)
    rb.dispose()
  })

  it('canBegin is false when both PBO slots are in flight', () => {
    const fake = makeFakeGl2({ fenceReady: false, fill: 7 })
    const stub = stubRenderer({ gl: fake.gl })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(NDI_PIXEL_RING_CAPACITY).toBe(4)
    expect(rb.canBegin()).toBe(true)
    expect(rb.begin(dummyTarget, 1, 1)).toBe(true)
    expect(rb.canBegin()).toBe(true)
    expect(rb.begin(dummyTarget, 1, 1)).toBe(true)
    expect(rb.canBegin()).toBe(false)
    expect(rb.begin(dummyTarget, 1, 1)).toBe(false)
    rb.dispose()
  })

  it('poll does not reuse the CPU buffer until release (PBO path)', () => {
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    const stub = stubRenderer({ gl: fake.gl })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(rb.begin(dummyTarget, 2, 2, 0)).toBe(true)
    const first = rb.poll(16)
    expect(first?.data[0]).toBe(42)
    const held = first!.data
    expect(rb.begin(dummyTarget, 2, 2, 32)).toBe(true)
    const second = rb.poll(48)
    expect(second).not.toBeNull()
    expect(second!.data.buffer).not.toBe(held.buffer)
    expect(held[0]).toBe(42)
    rb.release(held)
    rb.release(second!.data)
    rb.dispose()
  })

  it('abandons a stuck fence after NDI_ASYNC_READBACK_FENCE_MAX_MS', () => {
    const fake = makeFakeGl2({ fenceReady: false, fill: 4 })
    const stub = stubRenderer({ gl: fake.gl })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(rb.begin(dummyTarget, 1, 1, 10)).toBe(true)
    expect(rb.poll(10)).toBeNull()
    expect(rb.isPending()).toBe(true)
    expect(rb.poll(10 + NDI_ASYNC_READBACK_FENCE_MAX_MS + 1)).toBeNull()
    expect(rb.isPending()).toBe(false)
    rb.dispose()
  })

  it('binds READ_FRAMEBUFFER to the begin(target) RT FBO, not DRAW', () => {
    const packedFb = { id: 'packed-uyvy' }
    const sceneFb = { id: 'scene-rgba' }
    const packedTarget = { __webglFramebuffer: packedFb } as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let drawFb: unknown = sceneFb
    let readFb: unknown = sceneFb
    let readAtPixels: unknown = null
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER = 0x8ca9
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
      if (target === 0x8ca9 || target === 0x8d40) drawFb = fb
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return drawFb
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }

    const stub = stubRenderer({ gl: fake.gl })
    stub.renderer.setRenderTarget = (_target: unknown) => {
      // Three setRenderTarget: DRAW only; READ stays on the scene FBO.
      // DRAW may also stay stale (scene) — READ must still use the RT FBO.
    }
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(rb.begin(packedTarget, 960, 1080)).toBe(true)
    expect(readAtPixels).toBe(packedFb)
    expect(readFb).toBe(sceneFb)
    expect(drawFb).toBe(sceneFb)
    expect(rb.mode).toBe('pbo')
    expect(stub.syncReads).toBe(0)
    rb.dispose()
  })

  it('binds READ to the passed target FBO when DRAW query is null', () => {
    const packedFb = { id: 'packed-uyvy' }
    const packedTarget = { __webglFramebuffer: packedFb } as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let readFb: unknown = { id: 'scene-rgba' }
    let readAtPixels: unknown = null
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return null
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }
    const stub = stubRenderer({ gl: fake.gl })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(rb.begin(packedTarget, 960, 1080)).toBe(true)
    expect(readAtPixels).toBe(packedFb)
    expect(fake.readPixelCount()).toBe(1)
    expect(stub.syncReads).toBe(0)
    expect(rb.mode).toBe('pbo')
    rb.dispose()
  })

  it('resolves the FBO from renderer.properties.get(target)', () => {
    const packedFb = { id: 'from-properties' }
    const packedTarget = {} as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let readFb: unknown = { id: 'scene-rgba' }
    let readAtPixels: unknown = null
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return null
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }
    const stub = stubRenderer({ gl: fake.gl })
    stub.renderer.properties = {
      get: (object: unknown) =>
        object === packedTarget ? { __webglFramebuffer: packedFb } : {},
    }
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(rb.begin(packedTarget, 960, 1080)).toBe(true)
    expect(readAtPixels).toBe(packedFb)
    expect(stub.syncReads).toBe(0)
    expect(rb.mode).toBe('pbo')
    expect(fallbackHudFlags().syncReadback).toBe(false)
    rb.dispose()
  })

  it('PBO begin stays true when properties.get FBO exists even if DRAW is null and READ status is incomplete', () => {
    const packedFb = { id: 'from-properties-incomplete' }
    const packedTarget = {} as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let readFb: unknown = { id: 'scene-rgba' }
    let readAtPixels: unknown = null
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.FRAMEBUFFER_COMPLETE = 0x8cd5
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return null
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.checkFramebufferStatus = () => 0x8cd6
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }
    const stub = stubRenderer({ gl: fake.gl })
    stub.renderer.properties = {
      get: (object: unknown) =>
        object === packedTarget ? { __webglFramebuffer: packedFb } : {},
    }
    const notes: string[] = []
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(rb.begin(packedTarget, 1920, 1080)).toBe(true)
    expect(readAtPixels).toBe(packedFb)
    expect(fake.readPixelCount()).toBe(1)
    expect(stub.syncReads).toBe(0)
    expect(rb.mode).toBe('pbo')
    expect(notes).toEqual([])
    expect(fallbackHudFlags().syncReadback).toBe(false)
    rb.dispose()
  })

  it('Electron-like stub (null public FBO / null DRAW) PBO-packs from RT texture via owned READ FBO', () => {
    const webglTex = { id: 'rt-color' }
    const electronTarget = {
      texture: { __webglTexture: webglTex },
    } as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let readFb: unknown = null
    let attachedTex: unknown = null
    let readAtPixels: unknown = null
    const created: unknown[] = []
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER = 0x8ca9
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.createFramebuffer = () => {
      const fb = { id: `owned-read-${created.length}` }
      created.push(fb)
      return fb
    }
    fake.gl.framebufferTexture2D = (
      _target: number,
      _attach: number,
      _texTarget: number,
      texture: unknown,
    ) => {
      attachedTex = texture
    }
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return null
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }
    const stub = stubRenderer({ gl: fake.gl, fill: 17 })
    const notes: string[] = []
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(rb.begin(electronTarget, 960, 1080)).toBe(true)
    expect(created).toHaveLength(1)
    expect(attachedTex).toBe(webglTex)
    expect(readAtPixels).toBe(created[0])
    expect(fake.readPixelCount()).toBe(1)
    expect(stub.syncReads).toBe(0)
    expect(notes).toEqual([])
    expect(rb.mode).toBe('pbo')
    expect(fallbackHudFlags().syncReadback).toBe(false)
    fake.setFenceReady(true)
    expect(rb.poll(16)?.data[0]).toBe(42)
    expect(rb.begin(electronTarget, 960, 1080)).toBe(true)
    expect(created).toHaveLength(1)
    expect(stub.syncReads).toBe(0)
    rb.dispose()
  })

  it('PBO-packs from properties.get(texture).__webglTexture when RT FBO and DRAW are null', () => {
    const webglTex = { id: 'from-properties-texture' }
    const colorTex = {}
    const packedTarget = { texture: colorTex } as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let readFb: unknown = { id: 'scene-rgba' }
    let attachedTex: unknown = null
    let readAtPixels: unknown = null
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
    }
    fake.gl.framebufferTexture2D = (
      _target: number,
      _attach: number,
      _texTarget: number,
      texture: unknown,
    ) => {
      attachedTex = texture
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return null
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }
    const stub = stubRenderer({ gl: fake.gl })
    stub.renderer.properties = {
      get: (object: unknown) => {
        if (object === packedTarget) return {}
        if (object === colorTex) return { __webglTexture: webglTex }
        return {}
      },
    }
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(rb.begin(packedTarget, 1920, 1080)).toBe(true)
    expect(attachedTex).toBe(webglTex)
    expect(readAtPixels).not.toBeNull()
    expect(readAtPixels).not.toEqual({ id: 'scene-rgba' })
    expect(fake.readPixelCount()).toBe(1)
    expect(stub.syncReads).toBe(0)
    expect(rb.mode).toBe('pbo')
    expect(fallbackHudFlags().syncReadback).toBe(false)
    rb.dispose()
  })

  it('skips when there is no FBO and no RT texture (never packs default canvas FB)', () => {
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER = 0x8ca9
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.bindFramebuffer = () => {}
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6 || pname === 0x8caa) return null
      return origGet(pname)
    }
    const stub = stubRenderer({ gl: fake.gl, fill: 17 })
    const notes: string[] = []
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: (m) => notes.push(m),
    })
    const emptyTarget = {} as WebGLRenderTarget
    expect(rb.begin(emptyTarget, 960, 1080)).toBe(false)
    expect(fake.readPixelCount()).toBe(0)
    expect(stub.syncReads).toBe(0)
    expect(rb.poll()).toBeNull()
    expect(notes).toContain(NDI_PUBLIC_FBO_MISSING_NOTE)
    expect(rb.mode).toBe('pbo')
    expect(fallbackHudFlags().syncReadback).toBe(false)
    rb.dispose()
  })

  it('copies FRAMEBUFFER_BINDING onto READ after setRenderTarget without properties or RT hang', () => {
    const packedFb = { id: 'from-gl-binding' }
    const packedTarget = {} as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let drawFb: unknown = null
    let readFb: unknown = { id: 'scene-rgba' }
    let readAtPixels: unknown = null
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER = 0x8ca9
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
      if (target === 0x8ca9 || target === 0x8d40) drawFb = fb
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return drawFb
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }
    const stub = stubRenderer({ gl: fake.gl })
    stub.renderer.setRenderTarget = (target: unknown) => {
      if (target === packedTarget) drawFb = packedFb
    }
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    expect(rb.begin(packedTarget, 960, 1080)).toBe(true)
    expect(readAtPixels).toBe(packedFb)
    expect(fake.readPixelCount()).toBe(1)
    expect(stub.syncReads).toBe(0)
    expect(rb.mode).toBe('pbo')
    rb.dispose()
  })

  it('PBO-packs from a spy DRAW FBO when getParameter is null and Three hides public FBO/texture', () => {
    const secretFb = { id: 'three-hidden-draw' }
    const liveTarget = { texture: {} } as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let drawBound: unknown = null
    let readFb: unknown = { id: 'scene-rgba' }
    let readAtPixels: unknown = null
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER = 0x8ca9
    fake.gl.FRAMEBUFFER = 0x8d40
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
      if (target === 0x8ca9 || target === 0x8d40) drawBound = fb
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return null
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }
    const stub = stubRenderer({ gl: fake.gl, fill: 17 })
    stub.renderer.setRenderTarget = () => {
      const bind = fake.gl.bindFramebuffer as (
        target: number,
        framebuffer: unknown,
      ) => void
      bind(0x8ca9, secretFb)
    }
    const notes: string[] = []
    const origBind = fake.gl.bindFramebuffer
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(rb.begin(liveTarget, 1920, 1080)).toBe(true)
    expect(readAtPixels).toBe(secretFb)
    expect(drawBound).toBe(secretFb)
    expect(fake.readPixelCount()).toBe(1)
    expect(stub.syncReads).toBe(0)
    expect(notes).toEqual([])
    expect(rb.mode).toBe('pbo')
    expect(fallbackHudFlags().syncReadback).toBe(false)
    rb.dispose()
    expect(fake.gl.bindFramebuffer).toBe(origBind)
  })

  it('PBO-packs last spy DRAW FBO when setRenderTarget is a cache hit (no bind this tick)', () => {
    const secretFb = { id: 'already-bound-draw' }
    const liveTarget = {} as WebGLRenderTarget
    const fake = makeFakeGl2({ fenceReady: true, fill: 42 })
    let readFb: unknown = { id: 'scene-rgba' }
    let readAtPixels: unknown = null
    const origGet = fake.gl.getParameter as (pname: number) => unknown
    const origRead = fake.gl.readPixels as (
      x: number,
      y: number,
      w: number,
      h: number,
      format: number,
      type: number,
      offset: number,
    ) => void
    fake.gl.READ_FRAMEBUFFER = 0x8ca8
    fake.gl.DRAW_FRAMEBUFFER = 0x8ca9
    fake.gl.FRAMEBUFFER = 0x8d40
    fake.gl.FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.DRAW_FRAMEBUFFER_BINDING = 0x8ca6
    fake.gl.READ_FRAMEBUFFER_BINDING = 0x8caa
    fake.gl.bindFramebuffer = (target: number, fb: unknown) => {
      if (target === 0x8ca8) readFb = fb
    }
    fake.gl.getParameter = (pname: number) => {
      if (pname === 0x8ca6) return null
      if (pname === 0x8caa) return readFb
      return origGet(pname)
    }
    fake.gl.readPixels = (x, y, w, h, format, type, offset) => {
      readAtPixels = readFb
      origRead(x, y, w, h, format, type, offset)
    }
    const stub = stubRenderer({ gl: fake.gl })
    stub.renderer.setRenderTarget = () => {
      // Three r178 WebGLState: skip gl.bindFramebuffer when already bound.
    }
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      onFallbackNote: () => {},
    })
    const bind = fake.gl.bindFramebuffer as (
      target: number,
      framebuffer: unknown,
    ) => void
    bind(0x8ca9, secretFb)
    expect(rb.begin(liveTarget, 1920, 1080)).toBe(true)
    expect(readAtPixels).toBe(secretFb)
    expect(fake.readPixelCount()).toBe(1)
    expect(stub.syncReads).toBe(0)
    expect(rb.mode).toBe('pbo')
    expect(fallbackHudFlags().syncReadback).toBe(false)
    rb.dispose()
  })
})

describe('NDI caps stay 30/30/30 and STUDIO_TICK_FPS 60 (source)', () => {
  it('tick 60 is NDI stagger only; AR/3D/2D default 30; 2D stays on', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    const main = readFileSync(join(repoRoot, 'desktop/main.cjs'), 'utf8')
    const spa = readFileSync(join(repoRoot, 'src/main.ts'), 'utf8')
    expect(ar).toMatch(/NDI_AR_DEFAULT_FPS\s*=\s*30/)
    expect(d3).toMatch(/NDI_3D_DEFAULT_FPS\s*=\s*30/)
    expect(map).toMatch(/STREAM_MAP_NDI_DEFAULT_FPS\s*=\s*30/)
    expect(map).toMatch(/createNdi2dAsyncCapture/)
    expect(main).toMatch(/STUDIO_TICK_FPS\s*=\s*60/)
    expect(main).not.toMatch(/STUDIO_TICK_FPS\s*=\s*30/)
    expect(spa).toMatch(/ndiChannelWanted/)
    expect(spa).toMatch(/loadNdiChannelWanted/)
    expect(spa).toMatch(/enabled:\s*ndiChannelWanted/)
    expect(ar).toMatch(/tryClaimNdiHeavyCapture/)
    expect(d3).toMatch(/tryClaimNdiHeavyCapture/)
  })

  it('AR and 3D pumps use the async helper; 2D does not', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const map = readFileSync(join(here, 'streamMapNdiPump.ts'), 'utf8')
    const twoD = readFileSync(join(here, 'ndi2dAsyncCapture.ts'), 'utf8')
    const readback = readFileSync(join(here, 'ndiAsyncReadback.ts'), 'utf8')
    const readme = readFileSync(join(here, 'README.md'), 'utf8')
    expect(ar).toMatch(/createNdiAsyncReadback/)
    expect(d3).toMatch(/createNdiAsyncReadback/)
    expect(d3).toMatch(/readback\.begin\(fbo/)
    expect(map).toMatch(/createNdi2dAsyncCapture/)
    expect(map).not.toMatch(/createNdiAsyncReadback/)
    expect(twoD).not.toMatch(/createNdiAsyncReadback/)
    expect(twoD).toMatch(/createImageBitmap/)
    expect(readme).toMatch(/Send checked/)
    expect(readme).toMatch(/this slice is not 30×3/)
    expect(readme).not.toMatch(/one channel is enough/)
    expect(readback).toMatch(/READ_FRAMEBUFFER/)
    expect(readback).toMatch(/bindFramebuffer/)
    expect(readback).toMatch(/FRAMEBUFFER_BINDING/)
    expect(readback).toMatch(/NDI_PUBLIC_FBO_MISSING_NOTE/)
    expect(readback).toMatch(/bindReadFramebufferToTarget/)
    expect(readback).toMatch(/ensureOwnedReadFramebuffer/)
    expect(readback).toMatch(/framebufferTexture2D/)
    expect(readback).toMatch(/__webglTexture/)
    expect(readback).toMatch(/rendererPropertiesGet/)
    expect(readback).toMatch(/spyDrawBindsDuring/)
    expect(readback).toMatch(/installDrawBindSpy/)
    expect(readback).toMatch(/lastNonNullDrawFramebuffer/)
    expect(readback).not.toMatch(/bindReadFramebufferToDraw/)
    expect(readback).not.toMatch(/function fallToSync/)
    expect(readback).toMatch(/skip capture this tick/)
    expect(readme).toMatch(/Spy `gl\.bindFramebuffer`/)
  })
})
