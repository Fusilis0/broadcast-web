import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNdiReadbackProbe } from './diagNdiReadbackProbe.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('parseNdiReadbackProbe', () => {
  it('is off on the default auto-connect URL', () => {
    expect(
      parseNdiReadbackProbe(
        '?race=demo-istanbul&outputMode=transparent&arBackground=video&autoConnectLive=1&livePov=1&autoConnectSrt=1&srtPov=1',
      ),
    ).toBe('off')
  })

  it('accepts idle and early', () => {
    expect(parseNdiReadbackProbe('?ndiReadbackProbe=idle')).toBe('idle')
    expect(parseNdiReadbackProbe('?ndiReadbackProbe=EARLY')).toBe('early')
  })

  it('ignores unknown values', () => {
    expect(parseNdiReadbackProbe('?ndiReadbackProbe=1')).toBe('off')
    expect(parseNdiReadbackProbe('?ndiReadbackProbe=flush')).toBe('off')
  })
})

describe('ndiReadbackProbe wiring (source)', () => {
  it('AR pump keeps production pack-after-render unless the probe query is on', () => {
    const pump = readFileSync(join(here, 'ndiFramePump.ts'), 'utf8')
    expect(pump).toMatch(/if \(readbackProbe === 'idle'\) probeIdleBegin\(\)/)
    expect(pump).toMatch(/if \(earlyPacked\) return/)
    expect(pump).toMatch(/readbackProbe \?\? 'off'/)
  })
})
