# Sponsor fixtures

Static race sponsor boards for SCN (Phase 2.5 / 18.7). Between-two-points panels laid **flat on the sea** (Unity `*LogoOnSea` / start–finish spirit). `billboardChain` stays upright and does not use this placement.

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
| `a` / `b` | WGS84 edge anchors; board **width** = horizontal ENU distance A↔B (text/logo reads along A→B) |
| `altMsl` | Optional per-endpoint AMSL (default `0`); graphics still force **water Y = 0** for the board |
| `heightM` | Depth of the board **across the water**, perpendicular to A→B (default `8`, clamped ≥ `1`). Not wall height. Same role as the start/finish band depth |
| `textureUrl` | Optional URL under `public/` (e.g. `/textures/sponsors/rolex.png`). `null` / missing → procedural canvas with `label` on the board |
| `color` | Optional hex brand/map colour (default teal). Not the board fill |
| `panelColor` | Optional board fill hex (default `#f4f4f2`). Omit → default |
| `frameColor` | Optional frame stroke hex (default dark slate `#2c3338`). Omit → default |

## Placement conventions

- Lat/lon → ENU via GEO **`gpsToEnuAmsl`** after world origin + EGM96 (same as course).
- **Water Y:** board sits on the water plane at **`y = 0.08`** (same lift as start/finish). Converted AMSL ENU `y` is ignored. Boards do not follow Gerstner displacement.
- **Facing:** flat on the sea, normal pointing **up** (readable from a drone / free cam above). Not a vertical wall and not camera-billboard. `billboardChain` instances remain upright.
- Order A/B so the logo/text reads left-to-right along A→B.
- Sponsor `label` is branding only — **not** the boat name/colour catalogue (roadmap 2.7).

Point `config.sponsorsUrl` at a fixture (default `/fixtures/sponsors/demo-istanbul.json`).
