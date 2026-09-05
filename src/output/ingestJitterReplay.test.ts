import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

type IngestJitterFixture = {
  presentSecs: number
  ipc: { queuedHighWaterMax: number; ipcDrops: number }
  pace: { advHistPct: { gte60: number }; advMaxGe100: number }
  latency: { mean: number; first15: number[] }
  retained: { mean: number; max: number }
}

function load(): IngestJitterFixture {
  const here = dirname(fileURLToPath(import.meta.url))
  return JSON.parse(
    readFileSync(join(here, 'fixtures/ingestJitterReplay20260904.json'), 'utf8'),
  ) as IngestJitterFixture
}

describe('ingestJitterReplay fixture (post-a jitter)', () => {
  it('records IPC shallow + present-side deep latency parking', () => {
    const fx = load()
    expect(fx.presentSecs).toBeGreaterThan(200)
    // H1 rejected: IPC never approached MAX_QUEUED_CHUNKS=32.
    expect(fx.ipc.queuedHighWaterMax).toBeLessThanOrEqual(4)
    expect(fx.ipc.ipcDrops).toBe(0)
    // Connect→steady: latency parks near queueCap/30s, not 100ms policy.
    expect(fx.latency.mean).toBeGreaterThan(500)
    expect(fx.latency.first15[0]!).toBeLessThan(400)
    expect(Math.max(...fx.latency.first15)).toBeGreaterThan(600)
    expect(fx.retained.max).toBeGreaterThanOrEqual(24)
    // No ≥1s unique freezes; judder is ≥60ms share + deep latency.
    expect(fx.pace.advMaxGe100).toBe(0)
    expect(fx.pace.advHistPct.gte60).toBeGreaterThan(3)
  })
})
