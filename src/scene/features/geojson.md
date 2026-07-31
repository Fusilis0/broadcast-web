# GeoJSON ↔ WorldFeature (Phase 4.4)

Interchange adapter for **geojson.io** (and similar). Native pack format remains RaceProject / `world-features.json` (`{ features: WorldFeature[] }`). GeoJSON is import/export only — not stored as the pack schema.

## FeatureCollection shape

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "course:Mark-NW",
      "properties": {
        "type": "mark",
        "name": "Mark-NW",
        "heightM": 5,
        "color": "#ffdd33",
        "label": "optional",
        "altMsl": 0
      },
      "geometry": {
        "type": "Point",
        "coordinates": [28.9784, 41.0087, 0]
      }
    }
  ]
}
```

Coordinates are **`[lon, lat]`** or **`[lon, lat, altMsl]`** (GeoJSON order). Z and/or `properties.altMsl` map to `WorldGpsPoint.altMsl` (default `0`).

## Property keys

| Property | Required | Notes |
| --- | --- | --- |
| `type` | **yes** | One of: `mark`, `gateLeft`, `gateRight`, `sponsor`, `flagP1`, `flagP2`, `start`, `finish`, `arrow`, `rotation` |
| `name` | no | Falls back to `id`, then generated `type-N` |
| `id` | no | Feature `id` field or `properties.id`; generated if missing |
| `heightM` | no | Number (sponsors, poles) |
| `color` | no | `#rrggbb`, `rrggbb`, or integer `0xRRGGBB` |
| `label` | no | Sponsor text, etc. |
| `altMsl` | no | Default altitude when coordinate Z omitted |

Unknown / missing `type`, bad geometry, or wrong point count → feature **skipped** (`console.warn`); import does not throw.

## Geometry rules

| `type` | Export geometry | Import accepts |
| --- | --- | --- |
| `mark`, `gateLeft`, `gateRight`, `flagP1`, `flagP2`, `arrow`, `rotation` | **Point** | Point only |
| `sponsor` | **LineString** (exactly 2 positions = A→B) | LineString with 2 positions |
| `start`, `finish` | Point (1 pt) or LineString (2 pts) | Point or LineString (1–2 positions) |

### Gate pairs (documented choice)

- **Canonical / export:** two separate **Point** features — `gateLeft` and `gateRight` (same as `WorldFeature[]`). Pairing in 3D/map uses name prefix (Unity style: `Gate1-Left` / `Gate1-Right`).
- **Import convenience:** a **LineString** with 2 positions and `properties.type` of `gate` or `gatePair` expands to one `gateLeft` (first vertex) + one `gateRight` (second). Names become `{name}-Left` / `{name}-Right`.

Polygons, Multi*, GeometryCollection → skipped (out of scope).

## geojson.io workflow

1. Draw Points / LineStrings; set properties (`type`, `name`, …) in the table.
2. Download / copy FeatureCollection → editor **Import GeoJSON**.
3. Editor **Export GeoJSON** → open again in geojson.io for external edits.
4. Prefer **Save project** / Export JSON for the native RaceProject pack.

## API

| Symbol | Role |
| --- | --- |
| `geojsonToWorldFeatures` | `unknown` → `{ features, skipped }` |
| `worldFeaturesToGeojson` | `WorldFeature[]` → FeatureCollection |
| `serializeWorldFeaturesGeojson` / `downloadWorldFeaturesGeojson` | Download `.geojson` |
