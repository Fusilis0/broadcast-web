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
| `a` / `b` | WGS84 edge anchors; board **width** = horizontal ENU distance A↔B. Stretching A–B scales the board uniformly when `boardAspect` is stored |
| `altMsl` | Optional per-endpoint AMSL (default `0`); graphics still force **water Y = 0** for the board |
| `heightM` | Short-side depth **across the water** (default `8`, clamped ≥ `1`). Edits the stored ratio; not wall height |
| `textureUrl` | Optional URL under `public/` (e.g. `/textures/sponsors/rolex.png`). When set, the logo is contain-fit and the **name is not drawn** on the mesh. `null` / missing → procedural label only if no logo was chosen |
| `color` | Optional hex brand/map colour (default teal). Not the board fill |
| `panelColor` | Optional board fill hex (default `#f4f4f2`). Omit → default |
| `frameColor` | Optional frame stroke hex (default dark slate `#2c3338`). Omit → default |
| `panelAlpha` | Optional plate alpha 0–1 (default `1` = opaque) |
| `boardAspect` | Optional along/across ratio (A–B / short side). Omit → independent `heightM` until the next span or height edit |

## Placement conventions

- Lat/lon → ENU via GEO **`gpsToEnuAmsl`** after world origin + EGM96 (same as course).
- **Water Y:** board sits on the water plane at **`y = 0.08`** (same lift as start/finish). Converted AMSL ENU `y` is ignored. Boards do not follow Gerstner displacement.
- **Facing:** flat on the sea, normal pointing **up** (readable from a drone / free cam above). Not a vertical wall and not camera-billboard. `billboardChain` instances remain upright.
- Order A/B so the logo/text reads left-to-right along A→B.
- Sponsor `label` is branding only — **not** the boat name/colour catalogue (roadmap 2.7).

Point `config.sponsorsUrl` at a fixture (default `/fixtures/sponsors/demo-istanbul.json`).
