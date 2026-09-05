import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  NDI_AR_AIR_TARGET_COUNT,
  createNdiAirTargetPingPong,
} from './ndiAirTargetPingPong.ts'

const here = dirname(fileURLToPath(import.meta.url))

function makeRing() {
  let id = 0
  const disposed: string[] = []
  const created: { id: string; w: number; h: number }[] = []
  const ring = createNdiAirTargetPingPong({
    create: (w, h) => {
      const target = { id: `t${id++}`, w, h }
      created.push(target)
      return target
    },
    dispose: (t) => {
      disposed.push(t.id)
    },
  })
  return { ring, created, disposed }
}

describe('createNdiAirTargetPingPong', () => {
  it('allocates two targets and packs null on the first tick', () => {
    const { ring, created } = makeRing()
    const a = ring.acquire(1920, 1080)
    expect(NDI_AR_AIR_TARGET_COUNT).toBe(2)
    expect(created).toHaveLength(2)
    expect(created.every((t) => t.w === 1920 && t.h === 1080)).toBe(true)
    expect(a.pack).toBeNull()
    expect(a.render).toBe(created[0])
    expect(a.render).not.toBe(created[1])
    ring.dispose()
  })

  it('packs the previous tick’s FBO, not the one just acquired to render', () => {
    const { ring } = makeRing()
    const t0 = ring.acquire(8, 4)
    ring.advance()
    const t1 = ring.acquire(8, 4)
    expect(t1.pack).toBe(t0.render)
    expect(t1.render).not.toBe(t0.render)
    expect(t1.pack).not.toBe(t1.render)
    ring.advance()
    const t2 = ring.acquire(8, 4)
    expect(t2.pack).toBe(t1.render)
    expect(t2.render).toBe(t0.render)
    ring.dispose()
  })

  it('resizes both slots together and drops the previous pack plate', () => {
    const { ring, disposed, created } = makeRing()
    const t0 = ring.acquire(8, 4)
    ring.advance()
    const firstIds = created.map((t) => t.id)
    const t1 = ring.acquire(16, 9)
    expect(t1.pack).toBeNull()
    expect(disposed.sort()).toEqual([...firstIds].sort())
    expect(created).toHaveLength(4)
    expect(created.slice(2).every((t) => t.w === 16 && t.h === 9)).toBe(true)
    expect(t1.render).not.toBe(t0.render)
    ring.dispose()
  })

  it('dispose releases both allocated targets, not only the write index', () => {
    const { ring, created, disposed } = makeRing()
    ring.acquire(4, 2)
    ring.advance()
    ring.acquire(4, 2)
    expect(created).toHaveLength(2)
    ring.dispose()
    expect(disposed.sort()).toEqual(created.map((t) => t.id).sort())
    const spy = vi.fn()
    const ring2 = createNdiAirTargetPingPong({
      create: () => ({ n: spy.mock.calls.length }),
      dispose: spy,
    })
    ring2.dispose()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('AR pump wires ping-pong (source)', () => {
  it('renders one FBO and packs the previous, disposes the ring', () => {
    const ar = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    expect(ar).toMatch(/createNdiAirTargetPingPong/)
    expect(ar).toMatch(/airTargets\.advance\(\)/)
    expect(ar).toMatch(/if \(pack\) captureAirTarget\(pack/)
    expect(ar).not.toMatch(/captureAirTarget\(render/)
    expect(ar).toMatch(/airTargets\.dispose\(\)/)
    expect(ar).not.toMatch(/ensureAirTarget/)
  })
})
