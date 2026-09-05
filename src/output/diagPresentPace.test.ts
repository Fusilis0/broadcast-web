import { describe, expect, it } from 'vitest'
import {
  diagNotePaceAdvance,
  diagNotePaceTick,
  resetDiagPresentPace,
  takeDiagPresentPaceWindow,
} from './diagPresentPace.ts'

describe('diagPresentPace', () => {
  it('records tick gaps and unique-advance gaps with ticks-between', () => {
    resetDiagPresentPace()
    let t = 0
    diagNotePaceTick(t)
    t += 16
    diagNotePaceTick(t)
    diagNotePaceAdvance(t, 'min-clamp')
    t += 17
    diagNotePaceTick(t)
    t += 16
    diagNotePaceTick(t)
    diagNotePaceAdvance(t, 'min-clamp')
    t += 40
    diagNotePaceTick(t)
    diagNotePaceAdvance(t, 'min-clamp')
    const snap = takeDiagPresentPaceWindow()
    expect(snap.tickN).toBe(4)
    expect(snap.advanceN).toBe(2)
    expect(snap.advIntervals).toEqual([33, 40])
    expect(snap.ticksBetween['2']).toBe(1)
    expect(snap.ticksBetween['1']).toBe(1)
    expect(snap.tickHist.lt20).toBe(3)
    expect(snap.tickHist.b40_60).toBe(1)
    expect(snap.advHist.b20_40).toBe(1)
    expect(snap.advHist.b40_60).toBe(1)
  })
})
