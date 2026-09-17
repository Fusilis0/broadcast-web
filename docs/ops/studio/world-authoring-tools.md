# World Authoring — Start, Finish, Buoy, Sponsor, Chain, Arrow, Anchor, Fleet

How to **place and edit** these tools only. Open **World** (left-rail header) or Race ops **authoring**.

Other course tools (Mark, Gate, Flag) are not in this file. Hide/show after place: [Assets](./assets.md).

---

## How you work

1. Pick a tool in the palette.
2. Click the map (one click, two clicks, or a chain of points).
3. **Select** the object to edit it in the inspector. **type** stays locked — delete and place again to change kind.
4. **Delete** / Backspace removes the selected feature (not the world origin).
5. **Esc** cancels an in-progress place. **Save project** writes the pack.

**vertex snap (14px)** default on. **grid 5m** default off.

Inspector **Add** = create from typed GPS. **Edit** = rewrite the selected object (same id/type).

---

## Start

**Course → Start.** Two clicks: line end **A**, then **B** (or **Enter** at the cursor). Hint: *Click line end A, then B*.

What you get: a **START** band between two GPS points (Unity-style line between A and B). Default label `START`.

| Field | Editable after place |
| --- | --- |
| name | yes |
| label | yes |
| lat / lon / alt MSL **A** | yes |
| lat B / lon B / alt B MSL | yes |
| heightM (band uniform) | yes |
| telemetry id | **no** (hidden) |
| Full 3D / buoy mesh / tag / rounding | **no** |
| logos / plate | **no** |

Map: drag either end in **Select**. Shows on the **2D stream map** (unless Assets **2D off**).

---

## Finish

**Course → Finish.** Same as Start: two clicks A then B.

Default label `FINISH`. Same editable fields as Start (`heightM (band uniform)`, A and B GPS). Same **no** list (no telem id, no buoy flags, no logos).

Start and Finish are two different features. Place both if you need both lines.

---

## Buoy

**Course → Buoy.** One click on the map.

If any TEL buoy ids are configured, a prompt asks for an **optional live buoy id** (blank = static). Otherwise it places a static buoy.

Default: name `buoy-N`, label `buoy`, heightM **5**.

| Field | Editable after place |
| --- | --- |
| name / label | yes |
| telemetry id | **yes** (bind / unbind live buoy channel) |
| lat / lon / alt MSL | yes (one point) |
| heightM | yes |
| **full 3D** | yes — off = nothing 3D |
| **buoy mesh** | yes — float body |
| **tag** | yes — name sprite |
| **rounding** | Off / **CW** (default) / CCW |
| lat B / logos / plate | **no** |

Shows on the **2D stream map** unless **2D off**. Rounding **Off** hides rounding arrows even if the SRT bar has Rounding arrows on.

---

## Sponsor

**Graphics → Sponsor.** Two clicks: **A** then **B**. The board **lies flat on the sea**. Stretching A–B scales the slab uniformly. Hint: *Click A, then B — board lies flat*.

Default span if you type only one GPS in the inspector: **20 m** east.

| Field | Editable after place |
| --- | --- |
| name / label | yes — name stays in the **list**, not printed on the mesh |
| lat / lon / alt **A and B** | yes — this **is** the canvas |
| heightM (glyph in A–B canvas) | yes — scales the **logo inside** the slab; it **cannot grow** the slab past A–B |
| **Library…** logo (or Solid plate) | yes |
| **plate colour** / **plate alpha** | yes |
| telemetry id / rounding / buoy mesh | **no** |

Not a racing-mark: no Full 3D / mesh / tag. Not on the on-air 2D stream-map allow-list (ops map still follows Assets **2D**).

---

## Billboard chain

**Graphics → Billboard chain.** Click **≥2** points along the ribbon, then **Finish chain** or **Enter**. Extra clicks add vertices. **Finish chain** is disabled until there are two points.

Default spacing **12 m**, heightM **8**, label `Chain N`. Empty logos → solid framed plate (bluish).

| Field | Editable after place |
| --- | --- |
| name / label | yes |
| lat / lon / alt (first point) + **B** | yes |
| Extra vertices | **yes** — **Add point**, drag in Select, click a segment to insert |
| heightM (vertical) | yes — height only; logos keep ratio (contain-fit) |
| **spacingM (logo pitch on ribbon)** | yes — pitch of logos on the strip, not panel gaps |
| plate colour / plate alpha | yes |
| Logos + integer **w** + **Add logo…** / **Remove** | yes |
| telemetry id / rounding / buoy mesh | **no** |

Cap **64** points. Not on the on-air 2D stream-map allow-list.

---

## Arrow

**Graphics → Arrow.** Two clicks: **position A**, then **heading tip B** (or Enter). Hint: *Click position A, then heading tip B*.

Stored as a **single GPS point** at A. B is **not** kept as a second point — it becomes the label `brg NNN°` (bearing).

| Field | Editable after place |
| --- | --- |
| name | yes |
| label | yes (this is where the bearing text lives) |
| lat / lon / alt MSL | yes — **A only** |
| lat B / lon B | **no** in the inspector (not a two-point kind) |
| heightM | unused at create |
| telemetry id / logos / buoy flags | **no** |

To change heading: edit **label**, or delete and place again (A then new B). Select drags the **position**, not the tip.

---

## Set anchor

**Anchor → Set anchor.** One click. Does **not** create a course feature.

Sets Project **origin** (ENU 0, 0, 0) to that lat/lon. Same as Project **origin → Apply**. Everything in 3D (terrain, boats, this map) is relative to that point.

| Field | In this tool |
| --- | --- |
| Inspector name / height / logos | **none** — click only |
| Delete | **n/a** — change origin by clicking again or typing origin in Project |

---

## Place boat

**Fleet → Place boat.** One click, then prompt **Boat id**.

Registers into [Fleet & Live](./fleet-live.md). The click is **planned GPS** until live telemetry overrides. Session until **Save project**.

| Field | World inspector (selected boat) | Fleet panel |
| --- | --- | --- |
| telemetry id | **yes** (this **is** the boat id) | **yes** |
| name / label | yes | name / category |
| lat / lon / alt MSL | yes while **not** live | no GPS fields |
| heightM (uniform) | yes | **no** |
| visibility solid / ghost / 3D off (tag on) | yes | yes |
| colour / Live / Connect | **no** | **yes** |
| 2D map icon | **no** (Assets list) | **no** |

Select can **drag** a boat that is not live. Live GPS wins over planned.

---

## Place drone

**Fleet → Place drone.** One click, then prompt **Drone / POV id**.

Registers a POV into Fleet. Planned map pin until live drone GPS.

| Field | World inspector | Fleet panel |
| --- | --- | --- |
| telemetry id | yes on place | **yes** |
| name / label | yes | no name on the POV row |
| lat / lon / alt | **read-only** when live TEL exists | **no** |
| heightM | **locked** after place (and whenever live) | **no** |
| srt / Vid / Live / Cam | **no** | **yes** |
| visibility (hull) | **no** (drones have no hull mode) | **no** |

Calibration FOV/yaw is [Calibration](./calibration.md), not this inspector.

---

## Quick: who has A–B vs one point

| Tool | Clicks to place | GPS kept |
| --- | --- | --- |
| Start / Finish | 2 | **A and B** |
| Sponsor | 2 | **A and B** (the board) |
| Billboard chain | ≥2, then Finish chain | polyline |
| Arrow | 2 | **A only** (B → bearing label) |
| Buoy | 1 | one point |
| Place boat / Place drone | 1 + id prompt | one planned point |
| Set anchor | 1 | origin, not a feature |

Related: [World chrome](./world-authoring.md) · [Assets](./assets.md) · [Fleet](./fleet-live.md) · [Project](./project.md)
