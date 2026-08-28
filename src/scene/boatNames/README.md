# boatNames

Owned by **SCN**. Unity-style boat id → name + category colour catalogue.

## Schema

Fixture: `public/fixtures/boats/demo-istanbul-names.json` (`config.boatNamesUrl`).

Nested map (Unity `BoatNameAssigner`):

```json
{
  "Pembe Kategori": { "21": "Bora", "22": "Aksu" },
  "Mavi Kategori": { "23": "Mira", "24": "Lira" }
}
```

Optional overrides: category `_color`, or per-entry `{ "name", "color" }` with `#rrggbb` / `0xrrggbb`.

## Colour keywords (legacy)

`parseCategoryColor` (Turkish, case-insensitive): `pembe` → pink, `mavi` → blue, `sarı`/`sari` → yellow, `yeşil`/`yesil` → green, `turuncu` → orange; else white.

Used when a fleet row has **no** explicit `color`.

## Category palette (Phase 16.3)

`BOAT_COLOR_PALETTE` — ten named swatches (red, blue, green, orange, pink, purple, yellow, cyan, white, slate). Fleet / Live row has a colour `<select>` next to category. Picking a swatch calls `upsertBoatName({ id, name, category, color })` (explicit-colour path already on `mergeBoatName`). Auto (empty) falls back to keyword parse.

Persisted additively as `fleet.boats[].color` (`#rrggbb`). Old packs without the field behave as before.

## Consumers (Phase 8.3 + 16.3)

| Surface | How |
| --- | --- |
| Tag plate + leader | `createBoatTag` / `setTagIdentity` (line colour = boat colour) |
| 3D hull + sails | `applyBoatHullTint` via `createBoatEntity.setTagIdentity` |
| 2D map icons | `boatColorsFromCatalogue` → `map.setBoatDotColors` (wired in `main`); sailboat chrome in `mapChrome` |

Fleet / Live panel upserts call `scene.upsertBoatName` → tag + hull/sail; `main` syncs map dots.

Visibility modes (`solid` / `ghost` / `hidden`) are **not** catalogue fields — they live on Fleet session rows + optional RaceProject `fleet.boatVisibility` (see scene README § Ghost / invisible boats).

## Public helpers

| Symbol | Role |
| --- | --- |
| `normalizeBoatNames` / `loadBoatNames` | Fixture → `BoatNamesCatalogue` |
| `lookupBoatName` | id → entry |
| `parseCategoryColor` / `parseHexColorCss` | Colour parse |
| `BOAT_COLOR_PALETTE` / `isPaletteHex` | Preset swatches |
| `boatColorsFromCatalogue` | id → `#rrggbb` for map/hull sync |
| `upsertBoatNameEntry` / `removeBoatNameEntry` | Live Fleet edits |
