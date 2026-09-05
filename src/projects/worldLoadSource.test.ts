import { describe, expect, it } from 'vitest'
import type { WorldFeature } from './types.ts'
import { resolveWorldLoadSource, yieldPaintFrames } from './worldLoadSource.ts'

const DEMO_URLS = {
  courseUrl: '/fixtures/course/demo-istanbul.json',
  sponsorsUrl: '/fixtures/sponsors/demo-istanbul.json',
  flagsUrl: '/fixtures/flags/demo-istanbul-countdown.json',
}

const oneMark: WorldFeature = {
  id: 'course:Mark-NW',
  name: 'Mark-NW',
  type: 'mark',
  points: [{ lat: 41, lon: 29, altMsl: 0 }],
}

describe('resolveWorldLoadSource', () => {
  it('features: [] plus demo fixture URLs is a complete empty world (remount, not URLs)', () => {
    const source = resolveWorldLoadSource({
      features: [],
      ...DEMO_URLS,
    })
    expect(source).toEqual({ kind: 'features', features: [] })
  })

  it('omitted features uses the fixture URL path', () => {
    expect(resolveWorldLoadSource({ ...DEMO_URLS })).toEqual({ kind: 'urls' })
    expect(resolveWorldLoadSource(null)).toEqual({ kind: 'urls' })
    expect(resolveWorldLoadSource(undefined)).toEqual({ kind: 'urls' })
  })

  it('non-empty embedded features remounts that list', () => {
    const source = resolveWorldLoadSource({
      features: [oneMark],
      ...DEMO_URLS,
    })
    expect(source.kind).toBe('features')
    if (source.kind === 'features') {
      expect(source.features).toEqual([oneMark])
    }
  })
})

describe('yieldPaintFrames', () => {
  it('resolves after two animation frames', async () => {
    const orig = globalThis.requestAnimationFrame
    const queue: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      queue.push(cb)
      return queue.length
    }) as typeof requestAnimationFrame
    try {
      let done = false
      const p = yieldPaintFrames().then(() => {
        done = true
      })
      expect(queue).toHaveLength(1)
      expect(done).toBe(false)
      queue[0]!(0)
      expect(queue).toHaveLength(2)
      expect(done).toBe(false)
      queue[1]!(0)
      await p
      expect(done).toBe(true)
    } finally {
      globalThis.requestAnimationFrame = orig
    }
  })
})
