/**
 * Preset fleet category colours (Phase 16.3).
 * Explicit `color` on a boat row / `upsertBoatName` wins over keyword parse.
 */

export type BoatPaletteSwatch = {
  id: string
  label: string
  hex: string
}

/**
 * ~10 named swatches. Hex is `#rrggbb` lowercase (same as `parseHexColorCss`).
 */
export const BOAT_COLOR_PALETTE: readonly BoatPaletteSwatch[] = [
  { id: 'red', label: 'Red', hex: '#e53935' },
  { id: 'blue', label: 'Blue', hex: '#1e88e5' },
  { id: 'green', label: 'Green', hex: '#43a047' },
  { id: 'orange', label: 'Orange', hex: '#fb8c00' },
  { id: 'pink', label: 'Pink', hex: '#ff66b3' },
  { id: 'purple', label: 'Purple', hex: '#8e24aa' },
  { id: 'yellow', label: 'Yellow', hex: '#fdd835' },
  { id: 'cyan', label: 'Cyan', hex: '#00acc1' },
  { id: 'white', label: 'White', hex: '#f5f5f5' },
  { id: 'slate', label: 'Slate', hex: '#546e7a' },
]

const HEX_SET = new Set(BOAT_COLOR_PALETTE.map((s) => s.hex))

export function isPaletteHex(hex: string | undefined): boolean {
  if (!hex) return false
  return HEX_SET.has(hex.trim().toLowerCase())
}

export function paletteSwatchByHex(
  hex: string | undefined,
): BoatPaletteSwatch | undefined {
  if (!hex) return undefined
  const key = hex.trim().toLowerCase()
  return BOAT_COLOR_PALETTE.find((s) => s.hex === key)
}
