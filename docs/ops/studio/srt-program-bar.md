# SRT program bar

Bottom bar. Per-channel **layer** checkboxes and **program cameras**. The pane follows [local view](./local-view.md) (2D / 3D / AR). Switching that view does **not** start or stop SRT — checkboxes in [Output](./output.md) do.

A layer is drawn only if the **preset is on AND** the authored flag in [Assets](./assets.md) / World is on. The bar cannot force on a hidden mesh.

Presets are **runtime**. Reload resets to the defaults below. Local 3D shows the **3D** preset; local AR shows the **AR** preset — toggling 3D **Boat model** does not change AR tags.

---

## Layer checkboxes (AR and 3D)

| Layer | 3D SRT default | AR SRT default |
| --- | --- | --- |
| **Boat model** | on | **off** |
| **Boat tag** | on | on |
| **Heading arrow** | on | **off** |
| **Buoy model** | on | **off** |
| **Buoy tag** | on | on |
| **Rounding arrows** | on | **off** |
| **Sponsors** | on | on |
| **Billboards** | on | on |
| **Start/Finish** | on | on |

**2D** pane has no mesh checkboxes — stream-map sail icons only (`2D uses stream-map icons`).

---

## Local 3D

| Control | Default | What it does |
| --- | --- | --- |
| **Control 3D program** | off | Off: mouse/WASD = **ops** camera (studio only). On: drive the **damped program** rig; studio 3D **shows program** so aiming is not blind |
| **Frame boats** | — | Snap the **program** rig to boats with **live** GPS (not planned-only) |

Until you tick Control 3D program or Frame boats, the program camera **mirrors the studio 3D look** so OBS land matches what you framed. After takeover, ops WASD does not move OBS; last program pose holds.

This **Frame boats** is not Fleet **Ops preview → Frame boats** (that one only moves the ops look).

---

## Local AR

| Control | What it does |
| --- | --- |
| **Follow** / **Free** | Disabled stubs. Freeze-until-GPS then follow is **automatic** (usable GPS ≤ 2 s on the selected POV) |
| Layer checkboxes | AR preset (meshes off, tags on by default) |

---

## Local 2D

| Control | Default | What it does |
| --- | --- | --- |
| **Follow centroid** | — | Top-down follow centroid of boats with live GPS |
| Per-boat buttons | dynamic | Follow that live boat |
| **E (m)** / **N (m)** | 0 / 0 | Offset from the follow target |
| **Across (m)** | **250** (40–20000) | Metres across the 16:9 frame (zoom). Matches OBS 2D |

Empty live set: view **freezes** (does not wander). Mini-map in ops stays a utility map; program 2D is the stream map.

Local 2D also shows **Boat size** (0.25–2, default **0.5**) under the map for hulls/pills/buoys.

Architecture: [`../../architecture/srt-program-cameras.md`](../../architecture/srt-program-cameras.md).

Related: [all panels](./README.md) · [Output](./output.md) · [Local view](./local-view.md) · [Assets](./assets.md) · [catalog](../studio-operator-manual.md)
