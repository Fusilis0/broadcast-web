import { describe, expect, it } from 'vitest'
import {
  formatOpsViewStatus,
  isOpsViewMode,
} from './freeCam.ts'

describe('ops view mode helpers', () => {
  it('accepts follow | free only', () => {
    expect(isOpsViewMode('follow')).toBe(true)
    expect(isOpsViewMode('free')).toBe(true)
    expect(isOpsViewMode('orbit')).toBe(false)
    expect(isOpsViewMode('')).toBe(false)
  })

  it('formats compact HUD status', () => {
    expect(formatOpsViewStatus('follow')).toBe('view=follow')
    expect(formatOpsViewStatus('free')).toBe('view=free')
  })
})
