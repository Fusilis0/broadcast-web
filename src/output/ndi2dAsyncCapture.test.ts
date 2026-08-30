/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  blitRgbaLetterbox,
  fillRgbaBuffer,
  letterboxRect,
  parseCssHexRgba,
  transferableRgbaBuffer,
} from './letterboxRect.ts'
import {
  createNdi2dAsyncCapture,
  deferOffStudioTick,
  NDI_2D_LETTERBOX_FILL,
  NDI_2D_SYNC_CAPTURE_NOTE,
  probeNdi2dWorkerCapture,
} from './ndi2dAsyncCapture.ts'
import { letterboxRect as pumpLetterboxRect } from './streamMapNdiPump.ts'

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

function pixelAt(
  buf: ArrayBuffer | Uint8Array,
  width: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const i = (y * width + x) * 4
  return [view[i], view[i + 1], view[i + 2], view[i + 3]]
}

function installNativeRedFake(srcW: number, srcH: number): () => void {
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
        const data = new Uint8ClampedArray(width * height * 4)
        if (width === srcW && height === srcH) {
          for (let i = 0; i < width * height; i++) {
            data[i * 4] = 255
            data[i * 4 + 3] = 255
          }
        }
        return { data, width, height }
      },
    } as unknown as CanvasRenderingContext2D
  }
  return () => {
    proto.getContext = orig
  }
}

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

describe('letterboxRect extract', () => {
  it('matches the pump geometry (no second formula)', () => {
    const cases: Array<[number, number, number, number]> = [
      [520, 520, 1920, 1080],
      [1920, 540, 1920, 1080],
      [960, 540, 1920, 1080],
      [4, 8, 16, 16],
      [8, 4, 16, 16],
    ]
    for (const [sw, sh, dw, dh] of cases) {
      expect(letterboxRect(sw, sh, dw, dh)).toEqual(
        pumpLetterboxRect(sw, sh, dw, dh),
      )
    }
  })
})

describe('blitRgbaLetterbox', () => {
  const fill = parseCssHexRgba(NDI_2D_LETTERBOX_FILL)

  it('parses the 2D letterbox fill', () => {
    expect(fill).toEqual([0x0a, 0x10, 0x18, 255])
  })

  it('native-size blit produces a 1920×1080 buffer with pixels in the rect', () => {
    const srcW = 4
    const srcH = 4
    const outW = 1920
    const outH = 1080
    const src = new Uint8Array(srcW * srcH * 4)
    for (let i = 0; i < srcW * srcH; i++) {
      src[i * 4] = 255
      src[i * 4 + 1] = 0
      src[i * 4 + 2] = 0
      src[i * 4 + 3] = 255
    }
    src[0] = 0
    src[1] = 255
    src[2] = 0
    const last = (srcW * srcH - 1) * 4
    src[last] = 0
    src[last + 1] = 0
    src[last + 2] = 255
    src[last + 3] = 255

    const dest = new Uint8Array(outW * outH * 4)
    fillRgbaBuffer(dest, fill[0], fill[1], fill[2], fill[3])
    const box = letterboxRect(srcW, srcH, outW, outH)
    blitRgbaLetterbox(src, srcW, srcH, dest, outW, outH, box)

    expect(dest.byteLength).toBe(1920 * 1080 * 4)
    expect(box.dw).toBe(1080)
    expect(box.dh).toBe(1080)
    expect(pixelAt(dest, outW, 0, 0)).toEqual(fill)
    expect(pixelAt(dest, outW, outW - 1, 0)).toEqual(fill)
    expect(pixelAt(dest, outW, box.dx, box.dy)).toEqual([0, 255, 0, 255])
    expect(
      pixelAt(dest, outW, box.dx + box.dw - 1, box.dy + box.dh - 1),
    ).toEqual([0, 0, 255, 255])
  })

  it('pillarboxes a wide source and letterboxes a tall one', () => {
    const outW = 16
    const outH = 16
    const wide = new Uint8Array(8 * 4 * 4)
    wide.fill(255)
    const destWide = new Uint8Array(outW * outH * 4)
    fillRgbaBuffer(destWide, fill[0], fill[1], fill[2], fill[3])
    const wideBox = letterboxRect(8, 4, outW, outH)
    blitRgbaLetterbox(wide, 8, 4, destWide, outW, outH, wideBox)
    expect(wideBox.dx).toBe(0)
    expect(wideBox.dy).toBeGreaterThan(0)
    expect(pixelAt(destWide, outW, 0, 0)).toEqual(fill)
    expect(pixelAt(destWide, outW, wideBox.dx, wideBox.dy)).toEqual([
      255, 255, 255, 255,
    ])

    const tall = new Uint8Array(4 * 8 * 4)
    tall.fill(255)
    const destTall = new Uint8Array(outW * outH * 4)
    fillRgbaBuffer(destTall, fill[0], fill[1], fill[2], fill[3])
    const tallBox = letterboxRect(4, 8, outW, outH)
    blitRgbaLetterbox(tall, 4, 8, destTall, outW, outH, tallBox)
    expect(tallBox.dy).toBe(0)
    expect(tallBox.dx).toBeGreaterThan(0)
    expect(pixelAt(destTall, outW, 0, 0)).toEqual(fill)
    expect(pixelAt(destTall, outW, tallBox.dx, tallBox.dy)).toEqual([
      255, 255, 255, 255,
    ])
  })

  it('does not slice when the view owns the whole ArrayBuffer', () => {
    const buf = new ArrayBuffer(16)
    const view = new Uint8Array(buf)
    expect(transferableRgbaBuffer(view)).toBe(buf)
    const sub = new Uint8Array(buf, 4, 8)
    const sliced = transferableRgbaBuffer(sub)
    expect(sliced).not.toBe(buf)
    expect(sliced.byteLength).toBe(8)
  })

  it('blits a 520² source into 1920×1080 well under 8 ms', () => {
    const srcW = 520
    const srcH = 520
    const outW = 1920
    const outH = 1080
    const src = new Uint8Array(srcW * srcH * 4)
    src.fill(255)
    const dest = new Uint8Array(outW * outH * 4)
    const box = letterboxRect(srcW, srcH, outW, outH)
    fillRgbaBuffer(dest, fill[0], fill[1], fill[2], fill[3])
    blitRgbaLetterbox(src, srcW, srcH, dest, outW, outH, box)
    const samples: number[] = []
    for (let i = 0; i < 8; i++) {
      const t0 = performance.now()
      blitRgbaLetterbox(src, srcW, srcH, dest, outW, outH, box)
      samples.push(performance.now() - t0)
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(mean).toBeLessThan(8)
  })
})

describe('createNdi2dAsyncCapture sync fallback', () => {
  let restoreCtx: (() => void) | undefined

  afterEach(() => {
    restoreCtx?.()
    restoreCtx = undefined
    vi.restoreAllMocks()
  })

  it('uses sync native blit and notes once', async () => {
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

  it('grab() letterboxes native pixels into 1920×1080 with the matte fill', async () => {
    const srcW = 4
    const srcH = 4
    const outW = 1920
    const outH = 1080
    restoreCtx = installNativeRedFake(srcW, srcH)
    const canvas = document.createElement('canvas')
    canvas.width = srcW
    canvas.height = srcH
    const capture = createNdi2dAsyncCapture({
      forceSync: true,
      onFallbackNote: () => {},
    })
    const rect = letterboxRect(srcW, srcH, outW, outH)
    const data = await capture.grab({
      source: canvas,
      outW,
      outH,
      box: rect,
    })
    expect(data.byteLength).toBe(1920 * 1080 * 4)
    const fill = parseCssHexRgba(NDI_2D_LETTERBOX_FILL)
    expect(pixelAt(data, outW, 0, 0)).toEqual(fill)
    expect(pixelAt(data, outW, rect.dx, rect.dy)[0]).toBe(255)
    expect(pixelAt(data, outW, rect.dx, rect.dy)[3]).toBe(255)
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

  it('uses the worker even when the source canvas has a 2d context', async () => {
    restoreCtx = installFake2dContext()
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
    expect(src).not.toMatch(
      /getImageData\(\s*0\s*,\s*0\s*,\s*(outW|input\.outW)/,
    )
    expect(src).not.toMatch(/2d-context fast path/)
  })

  it('worker reads native size and transfers the pooled buffer without a forced slice', () => {
    const worker = readFileSync(join(here, 'ndi2dCapture.worker.ts'), 'utf8')
    expect(worker).toMatch(/OffscreenCanvas/)
    expect(worker).toMatch(/getImageData\(\s*0,\s*0,\s*srcW,\s*srcH\s*\)/)
    expect(worker).not.toMatch(/getImageData\(\s*0,\s*0,\s*msg\.outW/)
    expect(worker).toMatch(/postMessage\(\{ id: msg\.id, data \}/)
    expect(worker).toMatch(/\[data\]/)
    expect(worker).toMatch(/willReadFrequently/)
    expect(worker).toMatch(/blitUyvyNearest/)
    expect(worker).toMatch(/fillUyvyFromCssHex/)
    expect(worker).toMatch(/rgbaToUyvy/)
    expect(worker).toMatch(/packedFrameBytes/)
    expect(worker).not.toMatch(/blitRgbaLetterbox/)
  })
})
