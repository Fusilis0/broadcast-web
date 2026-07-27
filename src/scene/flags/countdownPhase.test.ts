import { describe, expect, it } from 'vitest'
import {
  flagPhasesFromRemaining,
  formatCountdownMmSs,
} from './countdownPhase.ts'

const UNITY_DEFAULTS = {
  whiteRaiseMinutes: 5,
  orangeRaiseMinutes: 6,
  blueWhiteRaiseMinutes: 4,
  blueWhiteLowerMinutes: 1,
}

describe('flagPhasesFromRemaining', () => {
  it('matches Unity timeline (orange → white → blue-white up → down → freeze at 0)', () => {
    // Just after start (5:59): orange only (minutes ≈ 5.98 ≤ 6, > 5)
    expect(flagPhasesFromRemaining(6 * 60 - 1, UNITY_DEFAULTS)).toEqual({
      white: false,
      orange: true,
      blueWhite: false,
    })

    // Exactly 5:00: white + orange
    expect(flagPhasesFromRemaining(5 * 60, UNITY_DEFAULTS)).toEqual({
      white: true,
      orange: true,
      blueWhite: false,
    })

    // Exactly 4:00: blue-white joins
    expect(flagPhasesFromRemaining(4 * 60, UNITY_DEFAULTS)).toEqual({
      white: true,
      orange: true,
      blueWhite: true,
    })

    // Just above 1:00: blue-white still up
    expect(flagPhasesFromRemaining(60 + 0.01, UNITY_DEFAULTS)).toEqual({
      white: true,
      orange: true,
      blueWhite: true,
    })

    // Exactly 1:00: blue-white lowers (minutes > lower is false at equality)
    expect(flagPhasesFromRemaining(60, UNITY_DEFAULTS)).toEqual({
      white: true,
      orange: true,
      blueWhite: false,
    })

    // At 0: white + orange stay (caller freezes; logic still returns this)
    expect(flagPhasesFromRemaining(0, UNITY_DEFAULTS)).toEqual({
      white: true,
      orange: true,
      blueWhite: false,
    })
  })

  it('raises orange at exactly startMinutes remaining', () => {
    expect(flagPhasesFromRemaining(6 * 60, UNITY_DEFAULTS).orange).toBe(true)
    expect(flagPhasesFromRemaining(6 * 60 + 1, UNITY_DEFAULTS).orange).toBe(
      false,
    )
  })
})

describe('formatCountdownMmSs', () => {
  it('pads MM:SS and ceils fractional seconds', () => {
    expect(formatCountdownMmSs(0)).toBe('00:00')
    expect(formatCountdownMmSs(59.1)).toBe('01:00')
    expect(formatCountdownMmSs(6 * 60)).toBe('06:00')
    expect(formatCountdownMmSs(5 * 60 + 9)).toBe('05:09')
  })
})
