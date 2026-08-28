import { describe, expect, it } from 'vitest'
import {
  BOAT_COLOR_PALETTE,
  isPaletteHex,
  paletteSwatchByHex,
} from './colorPalette.ts'

describe('BOAT_COLOR_PALETTE', () => {
  it('has ten named #rrggbb swatches', () => {
    expect(BOAT_COLOR_PALETTE).toHaveLength(10)
    const ids = new Set(BOAT_COLOR_PALETTE.map((s) => s.id))
    expect(ids.size).toBe(10)
    for (const swatch of BOAT_COLOR_PALETTE) {
      expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/)
      expect(isPaletteHex(swatch.hex)).toBe(true)
    }
  })

  it('looks up by hex case-insensitively', () => {
    expect(paletteSwatchByHex('#E53935')?.id).toBe('red')
    expect(isPaletteHex('#00acc1')).toBe(true)
    expect(isPaletteHex('#ffffff')).toBe(false)
    expect(isPaletteHex(undefined)).toBe(false)
  })
})
