import { describe, expect, it } from 'vitest'
import {
  assertBusyExplainsSendGap,
  assertGrabWallTracksSend,
  loadGrabContentionReplayFixture,
} from './grabContentionReplay.ts'

describe('grabContentionReplay20260904', () => {
  const fx = loadGrabContentionReplayFixture()

  it('records baseline unique Send below 30 with busy covering the gap', () => {
    expect(fx.baseline.meanSendNewPts).toBeLessThan(fx.acceptanceSendNewPtsMin)
    expect(fx.baseline.meanUniquePresentN).toBeGreaterThanOrEqual(29)
    const { gap, busy, busyCoversGap } = assertBusyExplainsSendGap(fx)
    expect(gap).toBeGreaterThan(2)
    expect(busy).toBeGreaterThan(4)
    expect(busyCoversGap).toBe(true)
  })

  it('shows high 2dGrab walls correlate with lower unique Send', () => {
    const { highWallMeanSend, lowWallMeanSend } = assertGrabWallTracksSend(fx)
    expect(lowWallMeanSend).toBeGreaterThan(highWallMeanSend)
    expect(lowWallMeanSend).toBeGreaterThanOrEqual(27)
    expect(highWallMeanSend).toBeLessThan(25)
  })
})
