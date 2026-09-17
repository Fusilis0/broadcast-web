# World Authoring

Header **World** (left rail) or Race ops **authoring**. Overlay title **World authoring**. Map editor for course, graphics, fleet placement, and origin.

**Place + editable fields for Start, Finish, Buoy, Sponsor, Billboard chain, Arrow, Set anchor, Place boat, Place drone:** [`world-authoring-tools.md`](./world-authoring-tools.md).

Placed boats/drones register into [Fleet & Live](./fleet-live.md). Hide/show after place is [Assets](./assets.md).

---

## Chrome

| Control | What it does |
| --- | --- |
| **Maximize** / **Restore** | Full-window layout |
| Map height drag | Remembered `bw.worldAuthoring.mapSizePx` |
| **vertex snap (14px)** | Default **on** |
| **grid 5m** | Default **off** |
| **Finish chain** | End a billboard polyline (≥2 points) |
| **Delete** | Selected feature (also **Delete** / **Backspace**) |
| **Esc** | Cancel placement |
| **Enter** | Confirm some placements |
| **Export JSON** / **Export GeoJSON** | Download |
| **Import GeoJSON** | Replace or merge (confirm) |
| **Save project** | Same pack save as Project **Save** |

---

## Tool groups

| Group | Tools |
| --- | --- |
| Select | **Select** |
| Course | **Start** · **Finish** · **Mark** · **Gate L** · **Gate R** · **Gate pair** · **Buoy** · **Flag P1** · **Flag P2** |
| Graphics | **Sponsor** · **Billboard chain** · **Arrow** |
| Fleet | **Place boat** · **Place drone** |
| Anchor | **Set anchor** |

Two-click tools (A then B): Gate pair, Sponsor, Start, Finish, Arrow. Billboard chain is a polyline.

**Place boat / Place drone** prompt for telemetry id and write into the fleet (session until Project Save). Optional planned GPS until live packets override.

**Set anchor** updates Project origin (ENU 0, 0, 0).

Inspector while placing/editing: type, name, label, telemetry id, lat/lon/alt MSL (and B-side for two-click), height, boat visibility, sponsor Library / plate colour / alpha, chain spacing and logos, buoy Full 3D / mesh / tag, rounding.

Architecture: [`../../architecture/race-projects-and-world-authoring.md`](../../architecture/race-projects-and-world-authoring.md).

Related: [all panels](./README.md) · [Project](./project.md) · [Fleet](./fleet-live.md) · [Assets](./assets.md) · [catalog](../studio-operator-manual.md)
