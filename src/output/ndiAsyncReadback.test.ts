import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { WebGLRenderTarget } from 'three'
import {
  createNdiAsyncReadback,
  NDI_ASYNC_READBACK_FENCE_MAX_MS,
  NDI_ASYNC_READBACK_LATENCY_FRAMES,
  NDI_ASYNC_READBACK_PBO_COUNT,
  NDI_PIXEL_RING_CAPACITY,
  NDI_SYNC_READBACK_NOTE,
  probeNdiPboReadback,
} from './ndiAsyncReadback.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

const dummyTarget = {} as WebGLRenderTarget

type FakePbo = {
  size: number
  data: Uint8Array
}

function makeFakeGl2(opts?: {
  fenceReady?: boolean
  fill?: number
  /** Default CONDITION_SATISFIED (0x911c). */
  signaledStatus?: number
}): {
  gl: Record<string, unknown>
  setFenceReady: (ready: boolean) => void
  readPixelCount: () => number
  flushCount: () => number
  waitStatuses: () => number[]
  callsBetween: (start: string, end: string) => string[]
} {
  const PIXEL_PACK_BUFFER = 0x88eb
  let packBinding: FakePbo | null = null
  let fenceReady = opts?.fenceReady ?? false
  let readPixelCount = 0
  let flushCount = 0
  const waitStatuses: number[] = []
  const callLog: string[] = []
  const fill = opts?.fill ?? 9
  const signaledStatus = opts?.signaledStatus ?? 0x911c

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
    fenceSync: () => {
      callLog.push('fenceSync')
      return { id: readPixelCount }
    },
    flush: () => {
      callLog.push('flush')
      flushCount += 1
    },
    clientWaitSync: () => {
      callLog.push('clientWaitSync')
      const status = fenceReady ? signaledStatus : 0x911b
      waitStatuses.push(status)
      return status
    },
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
    flushCount: () => flushCount,
    waitStatuses: () => waitStatuses.slice(),
    callsBetween: (start: string, end: string) => {
      const i = callLog.lastIndexOf(start)
      const j = callLog.indexOf(end, i + 1)
      if (i < 0 || j < 0) return []
      return callLog.slice(i + 1, j)
    },
  }
}

function stubRenderer(opts?: {
  gl?: unknown
  fill?: number
}): {
  renderer: {
    getContext: () => unknown
    readRenderTargetPixels: (
      target: unknown,
      x: number,
      y: number,
      w: number,
      h: number,
      buffer: Uint8Array,
    ) => void
  }
  syncReads: number
} {
  let syncReads = 0
  const fill = opts?.fill ?? 3
  return {
    renderer: {
      getContext: () => opts?.gl ?? null,
      readRenderTargetPixels: (
        _t,
        _x,
        _y,
        w,
        h,
        buffer: Uint8Array,
      ) => {
        syncReads += 1
        const n = Math.min(buffer.byteLength, w * h * 4)
        for (let i = 0; i < n; i++) buffer[i] = fill
      },
    },
    get syncReads() {
      return syncReads
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
  it('uses readRenderTargetPixels and poll returns same tick', () => {
    const notes: string[] = []
    const stub = stubRenderer({ gl: null, fill: 11 })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: null,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(rb.mode).toBe('sync')
    expect(notes).toEqual([NDI_SYNC_READBACK_NOTE])

    expect(rb.begin(dummyTarget, 2, 1)).toBe(true)
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

  it('notes fallback only once', () => {
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
    expect(notes).toHaveLength(2)
    const one = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: null,
      onFallbackNote: (m) => notes.push(m),
    })
    one.begin(dummyTarget, 1, 1)
    one.begin(dummyTarget, 1, 1)
    expect(notes).toHaveLength(3)
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
    expect(stub.syncReads).toBe(0)
    expect(fake.readPixelCount()).toBe(1)
    expect(fake.flushCount()).toBe(1)
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

  it('flushAfterPack false skips gl.flush; poll still sees a signaled fence with no GL in between', () => {
    const fake = makeFakeGl2({ fenceReady: true, fill: 17 })
    const stub = stubRenderer({ gl: fake.gl })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      flushAfterPack: false,
      onFallbackNote: () => {},
    })
    expect(rb.begin(dummyTarget, 2, 1, 0)).toBe(true)
    expect(fake.flushCount()).toBe(0)
    expect(fake.readPixelCount()).toBe(1)
    const pixels = rb.poll(0)
    expect(fake.flushCount()).toBe(0)
    expect(fake.callsBetween('fenceSync', 'clientWaitSync')).toEqual([])
    expect(fake.waitStatuses()).toEqual([0x911c])
    expect(pixels).not.toBeNull()
    expect(pixels?.data[0]).toBe(17)
    expect(rb.isPending()).toBe(false)
    rb.dispose()
  })

  it('flushAfterPack false accepts ALREADY_SIGNALED the same as CONDITION_SATISFIED', () => {
    const fake = makeFakeGl2({
      fenceReady: true,
      fill: 19,
      signaledStatus: 0x911a,
    })
    const stub = stubRenderer({ gl: fake.gl })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      flushAfterPack: false,
      onFallbackNote: () => {},
    })
    expect(rb.begin(dummyTarget, 1, 1, 0)).toBe(true)
    expect(fake.flushCount()).toBe(0)
    const pixels = rb.poll(0)
    expect(fake.callsBetween('fenceSync', 'clientWaitSync')).toEqual([])
    expect(fake.waitStatuses()).toEqual([0x911a])
    expect(pixels?.data[0]).toBe(19)
    rb.dispose()
  })

  it('flushAfterPack false still reports TIMEOUT_EXPIRED then CONDITION_SATISFIED across polls', () => {
    const fake = makeFakeGl2({ fenceReady: false, fill: 21 })
    const stub = stubRenderer({ gl: fake.gl })
    const rb = createNdiAsyncReadback({
      renderer: stub.renderer,
      gl: fake.gl,
      flushAfterPack: false,
      onFallbackNote: () => {},
    })
    expect(rb.begin(dummyTarget, 1, 1, 0)).toBe(true)
    expect(fake.flushCount()).toBe(0)
    expect(rb.poll(0)).toBeNull()
    expect(fake.waitStatuses()).toEqual([0x911b])
    fake.setFenceReady(true)
    const pixels = rb.poll(16)
    expect(fake.waitStatuses()).toEqual([0x911b, 0x911c])
    expect(pixels?.data[0]).toBe(21)
    expect(fake.flushCount()).toBe(0)
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
    expect(spa).toMatch(/streamMapNdiWanted\s*=\s*true/)
    expect(ar).toMatch(/tryClaimNdiHeavyCapture/)
    expect(d3).toMatch(/tryClaimNdiHeavyCapture/)
  })

  it('AR and 3D pumps use the async helper', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    expect(ar).toMatch(/createNdiAsyncReadback/)
    expect(d3).toMatch(/createNdiAsyncReadback/)
  })

  it('AR skips packPbo flush; 3D keeps the default flush', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    const d3 = readFileSync(join(here, 'ndi3dChannelPump.ts'), 'utf8')
    const helper = readFileSync(join(here, 'ndiAsyncReadback.ts'), 'utf8')
    expect(ar).toMatch(
      /createNdiAsyncReadback\(\{\s*renderer,\s*flushAfterPack:\s*false\s*\}\)/,
    )
    expect(d3).toMatch(/createNdiAsyncReadback\(\{\s*renderer\s*\}\)/)
    expect(d3).not.toMatch(/flushAfterPack/)
    expect(helper).toMatch(/if \(flushAfterPack\) gl\.flush\(\)/)
    expect(helper).toMatch(/flushAfterPack !== false/)
  })
})
