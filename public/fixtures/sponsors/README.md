# Sponsor fixtures

Static race sponsor billboards for SCN (Phase 2.5). Between-two-points panels (Unity `BillboardBetweenTwoPoints` spirit).

## Schema

```json
{
  "name": "optional label",
  "sponsors": [
    {
      "id": "sp-west",
      "label": "Sponsor A",
      "a": { "lat": 41.00855, "lon": 28.97755, "altMsl": 0 },
      "b": { "lat": 41.00745, "lon": 28.97755, "altMsl": 0 },
      "heightM": 8,
      "textureUrl": null,
      "color": "#1e4d8c"
    }
  ]
}
```

| Field | Role |
| --- | --- |
| `id` | Stable string id (required) |
| `label` | Panel text when no texture / overlay fallback (required) |
| `a` / `b` | WGS84 edge anchors; panel **width** = horizontal ENU distance A↔B |
| `altMsl` | Optional per-endpoint AMSL (default `0`); graphics still force **water Y = 0** for the baseline |
| `heightM` | Panel height in meters (default `8`, clamped ≥ `1`) |
| `textureUrl` | Optional URL under `public/` (e.g. `/textures/sponsors/rolex.png`). `null` / missing → procedural canvas with `label` on the board |
| `color` | Optional hex brand/map colour (default teal). Not the board fill |
| `panelColor` | Optional board fill hex (default `#f4f4f2`). Omit → default |
| `frameColor` | Optional frame stroke hex (default dark slate `#2c3338`). Omit → default |

## Placement conventions

- Lat/lon → ENU via GEO **`gpsToEnuAmsl`** after world origin + EGM96 (same as course).
- **Water Y:** panel baseline at **`y = 0`** (Unity `waterSurfaceY`). Converted AMSL ENU `y` is ignored for graphics.
- **Facing:** fixed world orientation (not camera-billboard). Face normal = flatten(A→B) × world-up (right-hand) — the **left** side when standing at A looking toward B. Order A/B so the course / typical drone approach is on that side.
- Sponsor `label` is branding only — **not** the boat name/colour catalogue (roadmap 2.7).

Point `config.sponsorsUrl` at a fixture (default `/fixtures/sponsors/demo-istanbul.json`).
