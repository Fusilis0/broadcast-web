# Assets

Left rail **Race setup → Assets**. List of boats, drones, and world features. Hide or inspect pieces without leaving the studio window.

Edits apply immediately. **Project Save** writes them into the pack.

This is **not** where you subscribe telemetry or video — that is [Fleet & Live](./fleet-live.md). **Creating / deleting / dragging extra vertices** is [World Authoring](./world-authoring.md). Hero meshes are [Hero buildings](./hero-buildings.md), not this list.

---

## How the three editors split

| Surface | What it is for |
| --- | --- |
| **Assets list row** | Focus, 3D/2D show-hide, boat hull mode, open **Details** |
| **Assets Details** | Numbers and flags for the selected row (no map click) |
| **World Authoring** | Place, select on the map, drag points, Delete, extra vertices, same inspector fields for world features |
| **Fleet & Live** | Boat/drone **id**, name, category, colour, Live, Vid, srt, Cam |

Type of a world feature **cannot** be changed after place (World **type** is locked on select). Change by deleting and placing again.

---

## Every list row (all kinds)

| Control | Editable here | Notes |
| --- | --- | --- |
| **Focus** | yes | Ops free cam + map center |
| **Details** | yes | Opens the pane below |
| **3D** / **3D off** | boats: **solid / ghost / 3D off** select; others: toggle | POV 3D flag is stored; there is **no POV mesh** yet |
| **2D** / **2D off** | **list only** — not in Details, not in World inspector | Map icon. Independent of 3D |

Something is on-air in 3D/AR only if **this list**, authored flags, **and** the [SRT program bar](./srt-program-bar.md) all allow it.

---

## Boats

**List:** Focus · visibility select (**3D solid** / **3D ghost** / **3D off**) · **2D** / **2D off** · Details

| Setting | Assets Details | World (select boat / Place boat) | Fleet |
| --- | --- | --- | --- |
| Telemetry **id** | shown, **read-only** | **Place:** type id. After place: this **is** the fleet id | **editable** + Save |
| Name / category / colour | **no** | name / label on place; **not** category/colour | **yes** |
| Live / Connect | **no** | **no** | **yes** |
| Planned **Lat / Lon / Alt MSL** | **yes** (moves hull when no live GPS) | **yes** (same planned GPS) | no fields; Place boat writes them |
| **heightM (uniform)** | **yes** | **yes** | **no** |
| Visibility solid / ghost / **3D off (tag on)** | **yes** | **yes** | **yes** (same flag) |
| **2D** map icon | list row only | **no** | **no** |
| **Open Fleet** | button | — | — |

Live GPS **overrides** planned lat/lon. Planned-only does not count as live for AR Follow, 2D centroid, or SRT-bar Frame boats.

**3D off** hides the **hull**; the **tag stays**. Map dots are **2D** on the list row.

---

## POVs / drones

**List:** Focus · **3D** / **3D off** (flag only) · **2D** / **2D off** · Details

| Setting | Assets Details | World (Place drone / select) | Fleet |
| --- | --- | --- | --- |
| Telemetry **id** | **editable** | **Place:** required. After place, live pose uses this id | **editable** + Save |
| Name / label | **yes** | **yes** | no name field on the POV row (label via Details/World) |
| **srt** id / **Vid** / Live / Cam | **no** | **no** | **yes** |
| Lat / Lon / Alt MSL | **read-only** (“TEL”) | **read-only** when live GPS exists; editable planned only if no live | no GPS fields |
| **heightM** | **no** | **locked** after place (and whenever live GPS) | **no** |
| FOV / yaw / pitch / roll / CAL alt | **read-only** dump | **no** | **no** — edit in [Calibration](./calibration.md) |
| **2D** map icon | list row only | **no** | **no** |

Details note: *Pose GPS is live TEL — not written from this inspector.*

---

## World features (course + graphics)

Shared in **Details** (every feature): **Name**, **Label**, first GPS **Lat / Lon / Alt MSL**, **heightM** (caption changes by type).

Shared on **list row:** **3D** / **3D off** (`visible3d`) · **2D** / **2D off** (`visible2d`) — World inspector has **no 2D checkbox**.

World always has **type** (locked when selected), **name**, **label**, GPS, **Edit** / **Add**, map drag, **Delete**.

### Buoy · Mark

| Setting | Details | World |
| --- | --- | --- |
| Name / label | yes | yes |
| Lat / Lon / Alt MSL | yes (one point) | yes |
| heightM | yes | yes |
| **Telemetry id** | **yes** (optional live buoy bind) | **yes** (same) |
| **Full 3D** | **yes** | **yes** |
| **Buoy mesh** | **yes** | **yes** |
| **Tag** | **yes** | **yes** |
| **Rounding** Off / CW / CCW | **yes** | **yes** |
| 2D map | list row only | **no** |

If **Full 3D** is off, mesh and tag checkboxes are ignored (nothing 3D). Rounding **Off** hides rounding arrows even if the SRT bar has **Rounding arrows** on.

### Gates (Gate L / Gate R)

Same as buoy/mark for **Full 3D / Buoy mesh / Tag / Rounding**.

| Setting | Details | World |
| --- | --- | --- |
| Telemetry id | **no** | **no** (hidden unless type is buoy/mark/boat/drone) |
| Second GPS (B) | only if the feature already has 2 points | **Gate pair** tool uses A–B; single Gate L/R is one point |

### Start / Finish

| Setting | Details | World |
| --- | --- | --- |
| Name / label | yes | yes |
| **Lat/Lon/Alt A and B** | **yes** | **yes** (two-point kind) |
| heightM (band uniform) | yes | yes |
| Telemetry id | **no** | **no** |
| Full 3D / mesh / tag / rounding | **no** | **no** |
| Extra vertices | **no** — note says reshape in World | map drag / tools |

### Sponsor

| Setting | Details | World |
| --- | --- | --- |
| Name / label | yes | yes |
| **Lat/Lon/Alt A and B** (canvas on the sea) | **yes** | **yes** |
| heightM (glyph in A–B canvas) | yes — cannot grow the slab past A–B | yes |
| **Library…** logo | **yes** (or Solid plate) | **yes** |
| **Plate colour** / **Plate alpha** | **yes** | **yes** |
| Telemetry id / rounding / buoy mesh | **no** | **no** |
| Name on the 3D mesh | **never** — name stays in this list | same |

### Billboard chain

| Setting | Details | World |
| --- | --- | --- |
| Name / label | yes | yes |
| First point GPS only | **yes** (point 0) | first + **B** fields + **Add point** + map vertices |
| **Extra vertices** | **no** — *Reshape extra vertices with World Authoring tools* | **yes** |
| heightM (vertical) | yes | yes |
| **spacingM (logo pitch on ribbon)** | **yes** | **yes** |
| Plate colour / alpha | yes | yes |
| Logos + integer **w** + **Add logo…** / **Remove** | **yes** | **yes** |
| Empty logos | solid framed plate | same |

### Flags (P1 / P2) · Arrow · Other (`rotation`, …)

| Setting | Details | World |
| --- | --- | --- |
| Name / label / first GPS / heightM | yes | yes |
| Point B | Details: **yes if** the feature already has ≥2 points (arrow after two-click) | Arrow is **two-click on the map**; inspector A–B fields are **not** shown (not a two-point *kind*) |
| Telemetry id / buoy mesh / rounding / logos | **no** | **no** |
| Extra vertices | **no** — reshape in World | **yes** (map) |

---

## Not in Assets at all

| Thing | Where |
| --- | --- |
| Create / Delete a feature | World only |
| Change feature **type** after place | **cannot** — delete and place again |
| Boat colour / category / Live | Fleet |
| Drone **srt** / Vid / Cam | Fleet |
| Hero landmark XYZ / yaw | [Hero buildings](./hero-buildings.md) |
| Cesium / sea | [Environment](./environment.md) |
| Layer on OBS only | [SRT program bar](./srt-program-bar.md) |

Related: [all panels](./README.md) · [Fleet](./fleet-live.md) · [World](./world-authoring.md) · [catalog](../studio-operator-manual.md)
