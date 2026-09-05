import { describe, expect, it } from 'vitest'
import {
  assertTwoDNotPrimary,
  loadFrameIdentityReplayFixture,
} from './frameIdentityReplay.ts'

describe('frameIdentityReplay fixture (round 4)', () => {
  it('records baseline duplicate-runs with high 2dGrab overlap', () => {
    const fx = loadFrameIdentityReplayFixture()
    const baseline = fx.conditions.find((c) => c.id === 'baseline')!
    expect(baseline.healthySecs).toBeGreaterThan(100)
    expect(baseline.captureDupRuns.perSec).toBeGreaterThan(5)
    expect(baseline.captureDupRuns.overlapPct).toBeGreaterThan(60)
    expect(baseline.sendSamePct).toBeGreaterThan(15)
    expect(baseline.capturePerSec).toBeGreaterThan(baseline.uniquePresentPerSec)
  })

  it('shows 2D-off is not a full cure (falsifiable)', () => {
    const fx = loadFrameIdentityReplayFixture()
    const { baseline, twoDOff, reductionPct } = assertTwoDNotPrimary(fx)
    expect(baseline).toBeCloseTo(6.66, 1)
    expect(twoDOff).toBeCloseTo(5.26, 1)
    expect(reductionPct).toBeLessThan(40)
    expect(twoDOff).toBeGreaterThan(4)
    const threeD = fx.conditions.find((c) => c.id === '3d-off')!
    expect(threeD.captureDupRuns.perSec).toBeGreaterThan(4)
    expect(threeD.captureDupRuns.perSec).toBeLessThan(baseline)
  })

  it('records post-fix live verify: zero duplicate-runs', () => {
    const fx = loadFrameIdentityReplayFixture()
    expect(fx.postFix).toBeDefined()
    expect(fx.postFix!.captureDupPerSec).toBe(0)
    expect(fx.postFix!.sendDupPerSec).toBe(0)
    expect(fx.postFix!.sendSamePct).toBe(0)
    expect(fx.postFix!.captureDupMaxLen).toBe(0)
    expect(fx.postFix!.freshnessSkipPerSec).toBeGreaterThan(10)
    expect(fx.postFix!.capturePerSec).toBeLessThanOrEqual(
      fx.postFix!.uniquePresentPerSec + 1,
    )
  })
})
