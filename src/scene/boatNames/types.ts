/** CSS-style `#rrggbb` category / name tint. */
export type BoatNameColorCss = string

export type BoatNameEntry = {
  name: string
  category: string
  /** `#rrggbb` from keyword parse or optional override. */
  color: BoatNameColorCss
}

/** Flattened catalogue: boat channel id → identity. */
export type BoatNamesCatalogue = ReadonlyMap<string, BoatNameEntry>
