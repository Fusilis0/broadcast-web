# Boat name / colour fixtures

Static boat display-name catalogue for SCN (Phase 2.7). Unity `BoatNameAssigner` shape.

## Primary schema (Unity-compatible)

```json
{
  "Pembe Kategori": { "21": "Bora", "22": "Aksu" },
  "Mavi Kategori": { "23": "Mira", "24": "Lira" }
}
```

| Field | Role |
| --- | --- |
| Category key | Display category; tint from Turkish keywords (see below) |
| Boat id key | Channel id string (`21`–`52` on web; demo covers default `21`–`24`) |
| Name value | Tag display name |

## Category colour keywords

Port of Unity `ParseCategoryColor` (first match wins, case-insensitive):

| Keyword in category name | Colour |
| --- | --- |
| `pembe` | pink `(1, 0.4, 0.7)` |
| `sarı` / `sari` | yellow |
| `yeşil` / `yesil` | green |
| `mavi` | blue |
| `turuncu` | orange `(1, 0.5, 0)` |
| (none) | white |

## Optional extended overrides

Unity nested shape remains the default. Optional hex overrides (still nested under categories):

- Per-category: `"_color": "#rrggbb"` sibling alongside id entries
- Per-entry object: `"21": { "name": "Bora", "color": "#rrggbb" }`

Unknown ids keep the stub tag `Boat {id}` (neutral plate).

Point `config.boatNamesUrl` at a fixture (default `/fixtures/boats/demo-istanbul-names.json`).
