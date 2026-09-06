import { afterEach, describe, expect, it } from 'vitest'
import {
  notePresentedPts90k,
  peekLastPresentedPts90k,
  resetPresentedPts90k,
} from './ndiPresentPts.ts'

describe('ndiPresentPts', () => {
  afterEach(() => {
    resetPresentedPts90k()
  })

  it('notes and peeks the last unique present PTS', () => {
    expect(peekLastPresentedPts90k()).toBeNull()
    notePresentedPts90k(90000)
    expect(peekLastPresentedPts90k()).toBe(90000)
    notePresentedPts90k(90030)
    expect(peekLastPresentedPts90k()).toBe(90030)
    resetPresentedPts90k()
    expect(peekLastPresentedPts90k()).toBeNull()
  })
})
