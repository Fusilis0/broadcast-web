/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createNdi2dAsyncCapture,
  deferOffStudioTick,
  NDI_2D_LETTERBOX_FILL,
  NDI_2D_SYNC_CAPTURE_NOTE,
  probeNdi2dWorkerCapture,
} from './ndi2dAsyncCapture.ts'

const here = dirname(fileURLToPath(import.meta.url))

function sourceCanvas(w = 4, h = 4): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx?.fillRect(0, 0, w, h)
  return canvas
}

const box = { dx: 0, dy: 0, dw: 8, dh: 4 }

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

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  lastTransfer: Transferable[] | undefined
  failNext = false

  postMessage(data: unknown, transfer?: Transferable[]): void {
    this.lastTransfer = transfer
    const req = data as {
      id: number
      bitmap?: { close?: () => void }
      outW: number
      outH: number
    }
    req.bitmap?.close?.()
    queueMicrotask(() => {
      if (this.failNext) {
        this.onmessage?.({
          data: { id: req.id, error: 'worker boom' },
        } as MessageEvent)
        return
      }
      const pixels = new ArrayBuffer(req.outW * req.outH * 4)
      this.onmessage?.({
        data: { id: req.id, data: pixels },
      } as MessageEvent)
    })
  }

  terminate(): void {
    this.onmessage = null
    this.onerror = null
  }
}

describe('probeNdi2dWorkerCapture', () => {
  it('rejects missing Worker / OffscreenCanvas / createImageBitmap', () => {
    expect(
      probeNdi2dWorkerCapture({
        WorkerCtor: null,
        OffscreenCanvasCtor: null,
        createImageBitmapFn: null,
      }),
    ).toBe(false)
    expect(
      probeNdi2dWorkerCapture({
        WorkerCtor: class {},
        OffscreenCanvasCtor: class {},
        createImageBitmapFn: null,
      }),
    ).toBe(false)
  })

  it('accepts duck-typed worker + OffscreenCanvas + createImageBitmap', () => {
    expect(
      probeNdi2dWorkerCapture({
        WorkerCtor: class {},
        OffscreenCanvasCtor: class {},
        createImageBitmapFn: async () => ({}) as ImageBitmap,
      }),
    ).toBe(true)
  })
})

describe('createNdi2dAsyncCapture sync fallback', () => {
  let restoreCtx: (() => void) | undefined

  afterEach(() => {
    restoreCtx?.()
    restoreCtx = undefined
    vi.restoreAllMocks()
  })

  it('uses sync getImageData and notes once', async () => {
    restoreCtx = installFake2dContext()
    const notes: string[] = []
    const capture = createNdi2dAsyncCapture({
      forceSync: true,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(capture.mode).toBe('sync')
    expect(notes).toEqual([NDI_2D_SYNC_CAPTURE_NOTE])

    const data = await capture.grab({
      source: sourceCanvas(),
      outW: 8,
      outH: 4,
      box,
    })
    expect(data.byteLength).toBe(8 * 4 * 4)

    await capture.grab({
      source: sourceCanvas(),
      outW: 8,
      outH: 4,
      box,
    })
    expect(notes).toHaveLength(1)
    capture.dispose()
  })

  it('deferOffStudioTick is a macrotask (not the current turn)', async () => {
    const order: string[] = []
    deferOffStudioTick(() => {
      order.push('deferred')
    })
    order.push('sync')
    expect(order).toEqual(['sync'])
    await vi.waitFor(() => {
      expect(order).toEqual(['sync', 'deferred'])
    })
  })
})

describe('createNdi2dAsyncCapture worker path', () => {
  let restoreCtx: (() => void) | undefined

  afterEach(() => {
    restoreCtx?.()
    restoreCtx = undefined
    vi.restoreAllMocks()
  })

  it('returns a transferred buffer without falling back to sync', async () => {
    const fake = new FakeWorker()
    const notes: string[] = []
    const capture = createNdi2dAsyncCapture({
      createWorker: () => fake as unknown as Worker,
      createImageBitmapFn: async () =>
        ({
          width: 4,
          height: 4,
          close: () => {},
        }) as ImageBitmap,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(capture.mode).toBe('worker')
    expect(notes).toEqual([])

    const data = await capture.grab({
      source: sourceCanvas(),
      outW: 8,
      outH: 4,
      box,
    })
    expect(data.byteLength).toBe(8 * 4 * 4)
    expect(fake.lastTransfer).toHaveLength(1)
    expect(notes).toEqual([])
    capture.dispose()
  })

  it('fails closed to sync getImageData when the worker errors', async () => {
    restoreCtx = installFake2dContext()
    const fake = new FakeWorker()
    fake.failNext = true
    const notes: string[] = []
    const capture = createNdi2dAsyncCapture({
      createWorker: () => fake as unknown as Worker,
      createImageBitmapFn: async () =>
        ({
          width: 4,
          height: 4,
          close: () => {},
        }) as ImageBitmap,
      onFallbackNote: (m) => notes.push(m),
    })
    expect(capture.mode).toBe('worker')

    const data = await capture.grab({
      source: sourceCanvas(),
      outW: 8,
      outH: 4,
      box,
    })
    expect(data.byteLength).toBe(8 * 4 * 4)
    expect(capture.mode).toBe('sync')
    expect(notes).toEqual([NDI_2D_SYNC_CAPTURE_NOTE])
    capture.dispose()
  })
})

describe('ndi2dAsyncCapture source invariants', () => {
  it('documents fail-closed note and defers off the tick', () => {
    const src = readFileSync(join(here, 'ndi2dAsyncCapture.ts'), 'utf8')
    expect(src).toMatch(/NDI_2D_SYNC_CAPTURE_NOTE/)
    expect(src).toMatch(/setTimeout\(fn,\s*0\)/)
    expect(src).toMatch(/new URL\(\s*['"]\.\/ndi2dCapture\.worker\.ts['"]/)
    expect(src).toMatch(/postMessage\(request,\s*\[bitmap\]\)/)
    expect(src).not.toMatch(/tryClaimNdiHeavyCapture\(/)
    expect(src).toMatch(/NDI_2D_LETTERBOX_FILL\s*=\s*['"]#0a1018['"]/)
  })

  it('worker transfers getImageData buffer without a forced slice on the whole buffer', () => {
    const worker = readFileSync(join(here, 'ndi2dCapture.worker.ts'), 'utf8')
    expect(worker).toMatch(/OffscreenCanvas/)
    expect(worker).toMatch(/getImageData/)
    expect(worker).toMatch(/postMessage\(\{ id: msg\.id, data \}/)
    expect(worker).toMatch(/\[data\]/)
    expect(worker).toMatch(/willReadFrequently/)
  })
})
