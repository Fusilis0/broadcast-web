import { describe, expect, it } from 'vitest'
import {
  createNdiCaptureGate,
  NDI_CAPTURE_GATE_TOLERANCE_MS,
  NDI_CAPTURE_NOMINAL_FPS,
  NDI_STUDIO_TICK_HZ,
  ndiCaptureGateFps,
} from './ndiCaptureClock.ts'

const TICK_MS = 1000 / NDI_STUDIO_TICK_HZ
const KNIFE_MS = 1000 / 30

/**
 * Jittery 60 Hz whose two-tick span is 32.5 ms — a hair under 1000/30.
 * The knife-edge gate waits for the third tick (~20 fps); phase+tolerance admits.
 */
function jitteryTicks(seconds: number): number[] {
  const out: number[] = []
  let t = 0
  let i = 0
  const end = seconds * 1000
  while (t <= end) {
    out.push(t)
    t += i % 2 === 0 ? 16.2 : 16.3
    i += 1
  }
  return out
}

function knifeEdgeCaptures(ticks: number[]): number {
  let last = Number.NEGATIVE_INFINITY
  let n = 0
  for (const now of ticks) {
    if (now - last < KNIFE_MS) continue
    last = now
    n += 1
  }
  return n
}

function gateCaptures(ticks: number[], declaredFps = 30): number {
  const gate = createNdiCaptureGate(declaredFps)
  let n = 0
  for (const now of ticks) {
    if (gate.tryAdmit(now)) n += 1
  }
  return n
}

describe('ndiCaptureGateFps', () => {
  it('raises declared 30 to nominal 32; leaves lower rates alone', () => {
    expect(NDI_CAPTURE_NOMINAL_FPS).toBe(32)
    expect(ndiCaptureGateFps(30)).toBe(32)
    expect(ndiCaptureGateFps(60)).toBe(32)
    expect(ndiCaptureGateFps(10)).toBe(10)
  })
})

describe('createNdiCaptureGate', () => {
  it('admits the first sample and then waits about one interval', () => {
    const gate = createNdiCaptureGate(30)
    expect(gate.tryAdmit(1000)).toBe(true)
    expect(gate.tryAdmit(1000 + TICK_MS)).toBe(false)
    expect(gate.isDue(1000 + TICK_MS)).toBe(false)
    expect(gate.tryAdmit(1000 + gate.intervalMs)).toBe(true)
  })

  it('admits a second tick that lands a hair early of 1000/30 (the knife edge)', () => {
    const gate = createNdiCaptureGate(30)
    expect(gate.tryAdmit(0)).toBe(true)
    // Two ticks ≈ 33.333 ms; 1 ms early fails the old comparison.
    const earlySecond = KNIFE_MS - 1
    expect(earlySecond).toBeLessThan(KNIFE_MS)
    expect(earlySecond).toBeGreaterThan(gate.intervalMs - NDI_CAPTURE_GATE_TOLERANCE_MS)
    expect(gate.tryAdmit(earlySecond)).toBe(true)
  })

  it('resyncs when more than one interval behind instead of bursting', () => {
    const gate = createNdiCaptureGate(30)
    expect(gate.tryAdmit(0)).toBe(true)
    expect(gate.tryAdmit(200)).toBe(true)
    expect(gate.tryAdmit(200 + 1)).toBe(false)
  })

  it('forceAdmit resyncs phase so a fresh present PTS is not rate-dropped', () => {
    const gate = createNdiCaptureGate(30)
    expect(gate.tryAdmit(0)).toBe(true)
    expect(gate.tryAdmit(TICK_MS)).toBe(false)
    gate.forceAdmit(TICK_MS)
    // Immediately after force, still not due (next interval from TICK_MS).
    expect(gate.tryAdmit(TICK_MS + 1)).toBe(false)
    expect(gate.tryAdmit(TICK_MS + gate.intervalMs)).toBe(true)
  })

  it('on a jittery 60 Hz tick stays at target instead of falling to 20', () => {
    const ticks = jitteryTicks(1)
    const knife = knifeEdgeCaptures(ticks)
    const gated = gateCaptures(ticks)
    expect(ticks.length).toBeGreaterThan(50)
    expect(gated).toBeGreaterThanOrEqual(30)
    expect(gated).toBeLessThanOrEqual(34)
    // The knife-edge gate is what pinned live captures at 20.
    expect(knife).toBeLessThan(gated)
    expect(knife).toBeLessThanOrEqual(22)
  })

  it('three independent gates on the same jittery tick each reach target', () => {
    const ticks = jitteryTicks(1)
    const ar = gateCaptures(ticks)
    const d3 = gateCaptures(ticks)
    const d2 = gateCaptures(ticks)
    expect(ar).toBeGreaterThanOrEqual(30)
    expect(d3).toBeGreaterThanOrEqual(30)
    expect(d2).toBeGreaterThanOrEqual(30)
    expect(ar).toBe(d3)
    expect(d3).toBe(d2)
  })
})
