# Course fixtures

Static race course waypoints for SCN (Phase 2.3).

## Schema

```json
{
  "name": "optional label",
  "waypoints": [
    {
      "name": "Mark-NW",
      "type": "mark" | "gateLeft" | "gateRight",
      "lat": 41.0087,
      "lon": 28.9778,
      "altMsl": 0,
      "rounding": "cw"
    }
  ],
  "appearance": {
    "boundaryColor": "#ffb200",
    "gateColor": "#00ff80",
    "buoyColor": "#ffdd33",
    "buoyHeightM": 5
  }
}
```

Optional waypoint `rounding`: `"cw"` \| `"ccw"` \| `"none"` (**omit = CW**). Explicit `"none"` hides the 3D two-arrow ring on that mark / gate end. Demo Istanbul omits the field except one `"ccw"` example on Mark-SE.

### Waypoint types

| `type` | Role |
| --- | --- |
| `mark` | Buoy + vertex of the closed **boundary** loop (mark order = draw order) |
| `gateLeft` / `gateRight` | Gate ends; paired by **name prefix** (Unity spirit) |

### Gate pairing

Strip trailing `-Left` / ` Left` / `-Right` / ` Right` from `name`. Left and right with the same remaining base name form one gate segment.

Example: `Gate1-Left` + `Gate1-Right` → gate `Gate1`.

### Placement

Lat/lon are WGS84. SCN converts with GEO `gpsToEnuAmsl` after world origin + EGM96 are set. Course **lines** sit at water Y = 0 (Unity `waterSurfaceY`); buoys stand on that plane. A mild water/shore pad is sized from the waypoint AABB (tunables in `src/scene/course/waterCue.ts`).

Point `config.courseUrl` at a fixture (default `/fixtures/course/demo-istanbul.json`).
