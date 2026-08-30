import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNdiDeferredSend, takeNdiArrayBuffer } from './ndiDeferredSend.ts'

describe('takeNdiArrayBuffer', () => {
  it('steals a whole-buffer view without copying', () => {
    const src = new Uint8Array([1, 2, 3, 4])
    const owned = takeNdiArrayBuffer(src)
    expect(owned).toBe(src.buffer)
  })
})

describe('createNdiDeferredSend', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call send on the enqueue stack (tick returns first)', () => {
    vi.useFakeTimers()
    const sent: ArrayBuffer[] = []
    const q = createNdiDeferredSend({
      send: (frame) => {
        sent.push(frame.data)
      },
    })
    const data = new ArrayBuffer(16)
    q.enqueue({ width: 2, height: 2, data, bottomUp: true })
    expect(sent).toHaveLength(0)
    expect(q.isScheduled()).toBe(true)
    vi.runAllTimers()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toBe(data)
    q.dispose()
  })

  it('keeps newest when a second frame queues before send runs', () => {
    vi.useFakeTimers()
    const sent: ArrayBuffer[] = []
    const released: ArrayBuffer[] = []
    const q = createNdiDeferredSend({
      send: (frame) => {
        sent.push(frame.data)
      },
      release: (data) => {
        released.push(data)
      },
    })
    const older = new ArrayBuffer(8)
    const newer = new ArrayBuffer(8)
    q.enqueue({ width: 1, height: 2, data: older, bottomUp: true })
    q.enqueue({ width: 1, height: 2, data: newer, bottomUp: true })
    expect(released).toEqual([older])
    vi.runAllTimers()
    expect(sent).toEqual([newer])
    expect(released).toEqual([older, newer])
    q.dispose()
  })

  it('reuses the pooled buffer after send returns', () => {
    vi.useFakeTimers()
    const pool: ArrayBuffer[] = []
    const q = createNdiDeferredSend({
      send: () => {},
      release: (data) => {
        pool.push(data)
      },
    })
    const buf = new ArrayBuffer(32)
    q.enqueue({ width: 4, height: 2, data: buf, bottomUp: false })
    expect(pool).toHaveLength(0)
    vi.runAllTimers()
    expect(pool).toEqual([buf])
    q.dispose()
  })
})
