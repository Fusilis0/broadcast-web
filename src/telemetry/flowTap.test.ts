import { describe, expect, it } from 'vitest'
import {
  createFlowTap,
  DEFAULT_FLOW_TAP_PER_ID,
  redactSrtish,
} from './flowTap.ts'

const SECRET = 'super-secret-relay-token'
const SRT_QUERY = `srt://127.0.0.1:9000?streamid=read:cam5:pub5:${SECRET}`
const SRT_PATH = `srt://127.0.0.1:9000/read:cam5:pub5:${SECRET}`

describe('redactSrtish', () => {
  it('redacts streamid last segment and passphrase', () => {
    const q = redactSrtish(`${SRT_QUERY}&passphrase=hunter2`)
    expect(q).not.toContain(SECRET)
    expect(q).not.toContain('hunter2')
    expect(q).toMatch(/streamid=read:cam5:pub5:\*\*\*/)
    expect(q).toMatch(/passphrase=\*\*\*/)
  })

  it('redacts path-style streamid', () => {
    const p = redactSrtish(SRT_PATH)
    expect(p).not.toContain(SECRET)
    expect(p).toMatch(/read:cam5:pub5:\*\*\*/)
  })
})

describe('createFlowTap', () => {
  it('keeps last N events per id and snapshot is JSON-serialisable', () => {
    const tap = createFlowTap({ perId: 3, nowMs: () => 1_000 })
    tap.push({ kind: 'drone', id: '5', body: { seq: 1 }, receivedAtMs: 1 })
    tap.push({ kind: 'drone', id: '5', body: { seq: 2 }, receivedAtMs: 2 })
    tap.push({ kind: 'anchor', id: '5', body: { kind: 'periodic' }, receivedAtMs: 3 })
    tap.push({ kind: 'drone', id: '5', body: { seq: 4 }, receivedAtMs: 4 })
    tap.push({ kind: 'boat', id: '31', body: { time: 9 }, receivedAtMs: 5 })

    const snap = tap.snapshot()
    expect(snap.filter((e) => e.id === '5')).toHaveLength(3)
    expect(snap.filter((e) => e.id === '5').map((e) => e.kind)).toEqual([
      'drone',
      'anchor',
      'drone',
    ])
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap)
    expect(DEFAULT_FLOW_TAP_PER_ID).toBe(12)
  })

  it('never stores raw SRT tokens in body', () => {
    const tap = createFlowTap()
    tap.push({
      kind: 'srt',
      id: '5',
      body: {
        url: SRT_QUERY,
        nested: { href: SRT_PATH, passphrase: 'x' },
      },
    })
    const raw = JSON.stringify(tap.snapshot())
    expect(raw).not.toContain(SECRET)
    expect(raw).toMatch(/read:cam5:pub5:\*\*\*/)
  })

  it('copies JSON-safe fields only (drops functions)', () => {
    const tap = createFlowTap()
    tap.push({
      kind: 'drone',
      id: '5',
      body: { ts: 10, id: '5', fn: () => 1 },
    })
    const body = tap.snapshot()[0]!.body as Record<string, unknown>
    expect(body.ts).toBe(10)
    expect(body.fn).toBeUndefined()
  })

  it('ignores empty id and unknown kind', () => {
    const tap = createFlowTap()
    tap.push({ kind: 'drone', id: '  ', body: { a: 1 } })
    tap.push({ kind: 'drone', id: '', body: { a: 1 } })
    tap.push({ kind: 'nope' as 'drone', id: '5', body: { a: 1 } })
    expect(tap.snapshot()).toEqual([])
  })

  it('reset clears rings', () => {
    const tap = createFlowTap()
    tap.push({ kind: 'buoy', id: '91', body: { id: '91' } })
    tap.reset()
    expect(tap.snapshot()).toEqual([])
  })

  it('remove drops one id and leaves others', () => {
    const tap = createFlowTap()
    tap.push({ kind: 'drone', id: '1', body: { id: '1' } })
    tap.push({ kind: 'drone', id: '2', body: { id: '2' } })
    tap.remove('2')
    tap.remove('  ')
    expect(tap.snapshot().map((e) => e.id)).toEqual(['1'])
  })

  it('retain keeps only the given ids', () => {
    const tap = createFlowTap()
    tap.push({ kind: 'drone', id: '1', body: { id: '1' } })
    tap.push({ kind: 'drone', id: '2', body: { id: '2' } })
    tap.push({ kind: 'boat', id: '21', body: { id: '21' } })
    tap.retain(['1', '21', '  '])
    expect(tap.snapshot().map((e) => e.id).sort()).toEqual(['1', '21'])
  })
})
