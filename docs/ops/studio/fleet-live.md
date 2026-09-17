# Fleet & Live

How the left-rail **Fleet & Live** section works: ids, colours, telemetry sockets, SRT ingest, and camera switch.

Where the buttons sit: [`ui-map.md`](./ui-map.md). Full catalog: [`../studio-operator-manual.md`](../studio-operator-manual.md).

The inner header is **Fleet / Live**. Course marks and hide/show live in **[Assets](./assets.md)**; this panel is the **people and cameras** registry.

---

## Two independent pipes

| Pipe | What it carries | How you start it |
| --- | --- | --- |
| **Live WS** | Boat GPS / hull pose, drone pose (telemetry) | Check **Live** on rows → **Connect live** |
| **SRT ingest** | Drone **video** (decoded into AR underlay) | Set **srt** id, check **Vid** → **Connect SRT** |

They do not turn each other on. You can have GPS with no picture, or picture with no GPS. Race ops **telemetry** must be **live** for sockets to matter; **Connect live** switches that for you.

**open ≠ packets.** A green/open socket does not mean GPS has arrived. Row hints show last packet age (`nopkt` = none yet). Colour bars on AR mean SRT is connected but **no decoded frame** yet.

---

## What an id is

Three different identifiers. Mixing them up is the usual failure.

| Field | Who uses it | Typical range |
| --- | --- | --- |
| Boat **id** | Telemetry subscribe + hull / tag / map pill | **21–52** (defaults **21–24**) |
| Drone / POV **id** | Telemetry subscribe + active camera + calibration device | **1–12** (defaults **1**, **2**) |
| **srt** id | Ingest camera on the relay (catalog **1–27**) | Can differ from the POV id |

The WebSocket URL is built as `base?type=client&subscribe=<id>`. Put **no id** in **Drone base** / **Boat base** — the panel appends each Live-checked id.

**Name** is the on-screen label (tag / 2D pill). Empty name falls back to id.

**Category** is a free-text class (often a colour word). It does **not** subscribe a different socket. With colour **Auto**, these keywords (Turkish, case-insensitive) pick the hull/tag colour — first match wins:

| Keyword in category | Colour |
| --- | --- |
| pembe | pink `#ff66b3` |
| sarı / sari | yellow |
| yeşil / yesil | green |
| mavi | blue |
| turuncu | orange |
| *(none of the above)* | white |

Or pick a palette swatch: **Red Blue Green Orange Pink Purple Yellow Cyan White Slate**. **Custom** appears if the pack already has a hex that is not in the palette. Changing colour applies immediately (no Save).

Config boot filters boat ids outside 21–52 and POV ids outside 1–12. The panel **Add** row will still take any non-empty string; stay in-band so Load / live subscribe match the producer.

---

## Add boats and drones

### In this panel

**Boats (editable)** — type **id**, optional **name**, **category**, colour → **Add**. The new row gets **Live** on.

Each boat row:

| Control | What it does |
| --- | --- |
| **Live** | Include this id in Connect live. While connected, uncheck **closes that socket now**; check **opens it now** |
| id / name / category | Edit, then **Save** (Save also turns Live on for that row) |
| Colour | Auto / palette (immediate) |
| **solid** / **ghost** / **hidden** | Hull draw: opaque · translucent + ring · hull off but **tag stays**. Map icon is separate (Assets **2D**) |
| Socket hint | Open / retrying / last packet age |
| **×** | Remove from fleet |

**Drones / POV (editable)** — type telemetry **id** → **Add**. Live turns on. Keep **at least one** drone.

Each POV row:

| Control | What it does |
| --- | --- |
| **Live** | Drone telemetry socket (same rules as boats) |
| id | Telemetry / POV id — **not** the video camera unless you set them equal |
| **srt** | Catalog camera (`18` or `cam18`). Empty → that POV cannot ingest |
| **Vid** | Include in **Connect SRT**. While SRT is up, uncheck closes **that** caller now |
| **Save** | Commit id / srt changes (turns Live on) |
| **Cam** / **Switch** | Make this the **active air camera** (see below) |
| **×** | Remove (not the last POV) |

### Other ways they appear

| Place | What happens |
| --- | --- |
| World **Place boat** / **Place drone** | Registers into this fleet; optional **planned** GPS until live packets override |
| **Assets** | Lists the same boats/POVs. **Details → Open Fleet** jumps here. **Focus** looks at them in 3D |
| Project **Load** | Restores `fleet.boats` + POV list from the pack |

**Planned** lat/lon/alt (World or Assets Details) draws a hull/icon **without** live GPS. Planned-only does **not** count as live for AR Follow, 2D program centroid, or SRT-bar **Frame boats**.

Defaults start **Live and Vid unchecked**. Adding a row checks Live for that id only — you still press **Connect live** / **Connect SRT**.

---

## Connect telemetry

1. Race ops **telemetry** is **mock** (canned) or **replay** until you go live.
2. Fill **Drone base** and **Boat base** (studio default host if empty).
3. Check **Live** on the ids you want.
4. **Connect live** — opens those sockets and sets telemetry mode to **live**. Greyed while already connected.
5. **Disconnect** — closes **all** live sockets; stays down until Connect or Reconnect.
6. **Reconnect** — stop then start (safe after Disconnect). Does not touch SRT.

Need at least one Live-checked boat **or** drone, or Connect live refuses.

**Frame boats** (under **Ops preview**) orbits the **ops** 3D look at hulls that exist. It is **not** the bottom-bar SRT 3D **Frame boats**. Free / Follow live in **Race ops → view**.

---

## Connect drone video (SRT ingest)

This is **ingest** (studio pulls cameras). It is not **SRT AR / 3D / 2D** program out to OBS — see [Output](./output.md).

1. Leave **SRT template** empty to use catalog cameras **1–27** (relay port **9000**). A filled `{srtId}` URL on a real host is an escape hatch. Do not paste the dummy `srt://host:…` placeholder.
2. On each POV, set **srt** to that camera id (may differ from telemetry id).
3. Check **Vid** (cap **4** POVs at once).
4. **Connect SRT** — also sets **AR bg → video** and local view → **AR** so the underlay is visible in studio.
5. **Disconnect SRT** — kills ingest callers; telemetry stays up.

Do **not** also open the same ingest URL in VLC/OBS while studio is the caller — that steals the catalog stream. Watching program-out **9201–9203** is fine.

---

## Switch cameras

**Active air POV** = which drone the AR camera follows, which SRT picture is the underlay, and which device **Calibration** edits.

Ways to switch (all the same latch):

| Control | Where |
| --- | --- |
| **Switch** (becomes **Cam** on the active row) | Fleet POV row |
| **pov** dropdown | Race ops |
| Keys **1**–**4** | If those **id strings** are in the POV list (key `1` → id `"1"`, not “first row”). Ignored while typing in a field |

**view → Free cam** only moves the **ops** look. It does not change active POV, AR SRT, or (until you take over) 3D program out.

Warm extra SRT callers can stay connected in the background (Vid-checked). **Switch** changes which one you **see**.

---

## Fleet vs Assets vs World

| You want to… | Use |
| --- | --- |
| Subscribe GPS / video, add a boat id, switch cam | **Fleet & Live** |
| Hide hull, hide 2D icon, move planned GPS, buoy mesh/tag | **[Assets](./assets.md)** |
| Place a mark, sponsor, boat on the map | **[World](./world-authoring.md)** |
| Watch raw JSON | **[Flow](./flow.md)** |
| Mock vs live source | **[Race ops](./race-ops.md)** |

Visibility reminder: **hidden** / **3D off** turns the **hull** off; the **tag stays**. Map dots are Assets **2D** / **2D off**.

---

## What persists

| Scope | What |
| --- | --- |
| This tab (`broadcast-web.fleetLive.v1`) | Bases, Live/Vid checks, srt ids, colours, visibility |
| Project **Save** | Fleet boats / POV list into the pack (SRT template token is **redacted**) |
| Not saved | Live socket state — reconnect after reload |

**air** role can still Load and connect; pack Save is disabled.

Related: [all panels](./README.md) · [UI map](./ui-map.md) · [catalog](../studio-operator-manual.md)
