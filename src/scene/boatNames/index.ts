export {
  parseCategoryColor,
  parseHexColorCss,
  boatColorsFromCatalogue,
  boatNamesFromCatalogue,
  resolveStreamFleetLabel,
  CATEGORY_COLOR_FALLBACK,
  CATEGORY_COLOR_PEMBE,
  CATEGORY_COLOR_SARI,
  CATEGORY_COLOR_YESIL,
  CATEGORY_COLOR_MAVI,
  CATEGORY_COLOR_TURUNCU,
} from './categoryColor.ts'
export {
  BOAT_COLOR_PALETTE,
  isPaletteHex,
  paletteSwatchByHex,
  type BoatPaletteSwatch,
} from './colorPalette.ts'
export {
  normalizeBoatNames,
  lookupBoatName,
  CATEGORY_COLOR_OVERRIDE_KEY,
} from './normalizeBoatNames.ts'
export {
  loadBoatNames,
  DEFAULT_BOAT_NAMES_URL,
} from './loadBoatNames.ts'
export {
  upsertBoatNameEntry,
  removeBoatNameEntry,
  type UpsertBoatNameInput,
} from './mergeBoatName.ts'
export type {
  BoatNameColorCss,
  BoatNameEntry,
  BoatNamesCatalogue,
} from './types.ts'
