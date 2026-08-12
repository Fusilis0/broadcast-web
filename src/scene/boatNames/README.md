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

## Colour keywords

`parseCategoryColor` (Turkish, case-insensitive): `pembe` → pink, `mavi` → blue, `sarı`/`sari` → yellow, `yeşil`/`yesil` → green, `turuncu` → orange; else white.

## Consumers (Phase 8.3)

| Surface | How |
| --- | --- |
| Tag plate | `createBoatTag` / `setTagIdentity` |
| 3D hull | `applyBoatHullTint` via `createBoatEntity.setTagIdentity` |
| 2D map icons | `boatColorsFromCatalogue` → `map.setBoatDotColors` (wired in `main`); sailboat chrome in `mapChrome` |

Fleet / Live panel upserts call `scene.upsertBoatName` → tag + hull; `main` syncs map dots.

Visibility modes (`solid` / `ghost` / `hidden`) are **not** catalogue fields — they live on Fleet session rows + optional RaceProject `fleet.boatVisibility` (see scene README § Ghost / invisible boats).

## Public helpers

| Symbol | Role |
| --- | --- |
| `normalizeBoatNames` / `loadBoatNames` | Fixture → `BoatNamesCatalogue` |
| `lookupBoatName` | id → entry |
| `parseCategoryColor` / `parseHexColorCss` | Colour parse |
| `boatColorsFromCatalogue` | id → `#rrggbb` for map/hull sync |
| `upsertBoatNameEntry` / `removeBoatNameEntry` | Live Fleet edits |
