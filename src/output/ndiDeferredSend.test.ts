import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createNdiDeferredSend,
  diagMark2dGrabWall,
  parseNdiDefer,
  parseNdiQueueDepth,
  resetDeferredSendDiag,
  takeDeferredSendDiagWindow,
  takeNdiArrayBuffer,
} from './ndiDeferredSend.ts'

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
    resetDeferredSendDiag()
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

  it('classifies keep-newest eviction while the macrotask is still waiting', () => {
    vi.useFakeTimers()
    resetDeferredSendDiag()
    let held: (() => void) | undefined
    const q = createNdiDeferredSend({
      channel: 'ar',
      send: () => {},
      defer: (fn) => {
        held = fn
      },
    })
    q.enqueue({ width: 1, height: 1, data: new ArrayBuffer(8), bottomUp: true })
    vi.advanceTimersByTime(5)
    q.enqueue({ width: 1, height: 1, data: new ArrayBuffer(8), bottomUp: true })
    const snap = takeDeferredSendDiagWindow()
    expect(snap.channels.ar.evictN).toBe(1)
    expect(snap.channels.ar.evictAwaitingMacrotask).toBe(1)
    expect(snap.channels.ar.evictDuringSend).toBe(0)
    expect(snap.channels.ar.evictWaitMax).toBeGreaterThanOrEqual(5)
    held?.()
    q.dispose()
  })

  it('classifies eviction that lands while send is in flight', () => {
    vi.useFakeTimers()
    resetDeferredSendDiag()
    let sends = 0
    const q = createNdiDeferredSend({
      channel: 'ar',
      send: () => {
        sends += 1
        if (sends !== 1) return
        q.enqueue({
          width: 1,
          height: 1,
          data: new ArrayBuffer(8),
          bottomUp: true,
        })
        q.enqueue({
          width: 1,
          height: 1,
          data: new ArrayBuffer(8),
          bottomUp: true,
        })
      },
    })
    q.enqueue({ width: 1, height: 1, data: new ArrayBuffer(8), bottomUp: true })
    vi.advanceTimersByTime(0)
    const snap = takeDeferredSendDiagWindow()
    expect(snap.channels.ar.evictDuringSend).toBe(1)
    expect(snap.channels.ar.evictAwaitingMacrotask).toBe(0)
    q.dispose()
  })

  it('counts evicts that fall inside a 2dGrab wall window', () => {
    vi.useFakeTimers()
    resetDeferredSendDiag()
    const q = createNdiDeferredSend({
      channel: 'ar',
      send: () => {},
    })
    diagMark2dGrabWall(true)
    q.enqueue({ width: 1, height: 1, data: new ArrayBuffer(8), bottomUp: true })
    q.enqueue({ width: 1, height: 1, data: new ArrayBuffer(8), bottomUp: true })
    diagMark2dGrabWall(false)
    const snap = takeDeferredSendDiagWindow()
    expect(snap.channels.ar.evictDuringGrabWall).toBe(1)
    expect(snap.grab.wallEnterN).toBe(1)
    expect(snap.grab.wallOccupiedMs).toBeGreaterThanOrEqual(0)
    q.dispose()
  })

  it('parses ?ndiDefer= as timeout | immediate | microtask', () => {
    expect(parseNdiDefer('')).toBe('timeout')
    expect(parseNdiDefer('?ndiDefer=immediate')).toBe('immediate')
    expect(parseNdiDefer('?ndiDefer=messageChannel')).toBe('immediate')
    expect(parseNdiDefer('?ndiDefer=microtask')).toBe('microtask')
    expect(parseNdiDefer('?ndiDefer=1')).toBe('timeout')
  })

  it('parses ?ndiQueueDepth=1 as the single-slot killswitch', () => {
    expect(parseNdiQueueDepth('')).toBe(null)
    expect(parseNdiQueueDepth('?ndiQueueDepth=1')).toBe(1)
    expect(parseNdiQueueDepth('?ndiQueueDepth=2')).toBe(null)
  })

  it('depth 2 drains both held frames in arrival order, not latest-wins', () => {
    vi.useFakeTimers()
    const sent: ArrayBuffer[] = []
    const released: ArrayBuffer[] = []
    const q = createNdiDeferredSend({
      maxPending: 2,
      send: (frame) => {
        sent.push(frame.data)
      },
      release: (data) => {
        released.push(data)
      },
    })
    const first = new ArrayBuffer(8)
    const second = new ArrayBuffer(8)
    q.enqueue({ width: 1, height: 2, data: first, bottomUp: true })
    q.enqueue({ width: 1, height: 2, data: second, bottomUp: true })
    expect(released).toEqual([])
    expect(sent).toEqual([])
    vi.runAllTimers()
    expect(sent).toEqual([first, second])
    expect(released).toEqual([first, second])
    q.dispose()
  })

  it('depth 2 overflow drops the oldest and sends the newest two in order', () => {
    vi.useFakeTimers()
    const sent: ArrayBuffer[] = []
    const released: ArrayBuffer[] = []
    const q = createNdiDeferredSend({
      maxPending: 2,
      send: (frame) => {
        sent.push(frame.data)
      },
      release: (data) => {
        released.push(data)
      },
    })
    const one = new ArrayBuffer(8)
    const two = new ArrayBuffer(8)
    const three = new ArrayBuffer(8)
    q.enqueue({ width: 1, height: 2, data: one, bottomUp: true })
    q.enqueue({ width: 1, height: 2, data: two, bottomUp: true })
    q.enqueue({ width: 1, height: 2, data: three, bottomUp: true })
    expect(released).toEqual([one])
    vi.runAllTimers()
    expect(sent).toEqual([two, three])
    expect(released).toEqual([one, two, three])
    q.dispose()
  })
})
