/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  hasNdiFboCanBeginProbes,
  isNdiFboReadbackPressured,
  registerNdiFboCanBeginProbe,
  resetNdiFboReadbackPressure,
} from './ndiFboReadbackPressure.ts'

describe('ndiFboReadbackPressure', () => {
  afterEach(() => {
    resetNdiFboReadbackPressure()
  })

  it('is not pressured with no probes', () => {
    expect(hasNdiFboCanBeginProbes()).toBe(false)
    expect(isNdiFboReadbackPressured()).toBe(false)
  })

  it('pressures when any probe returns false', () => {
    const unregOk = registerNdiFboCanBeginProbe(() => true)
    const unregBusy = registerNdiFboCanBeginProbe(() => false)
    expect(hasNdiFboCanBeginProbes()).toBe(true)
    expect(isNdiFboReadbackPressured()).toBe(true)
    unregBusy()
    expect(isNdiFboReadbackPressured()).toBe(false)
    unregOk()
    expect(hasNdiFboCanBeginProbes()).toBe(false)
  })
})
