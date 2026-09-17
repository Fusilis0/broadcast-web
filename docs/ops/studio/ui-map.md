# Studio UI map

Where each panel sits, and which buttons live in it. Behaviour: the other files in this folder, or the [operator catalog](../studio-operator-manual.md).

No File / Edit menu. Close or minimize **parks** the window. Tray **Show studio** restores; tray **Quit** exits.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Race setup          World            local view  2D  3D  AR   Broadcast│
│  «                   (header)                                     »     │
├────────────┬──────────────────────────────────────────────┬─────────────┤
│ Project    │                                              │ Output      │
│ Fleet      │            Centre canvas                     │ Flow        │
│ Assets     │         (local 2D / 3D / AR)                 │ Calibration │
│ Heroes     │                                              │ Environment │
│ Library    │                                              │ Cinematics  │
│ Race ops   │                                              │ Wind        │
├────────────┴──────────────────────────────────────────────┴─────────────┤
│  SRT program bar  (pane follows local 2D / 3D / AR)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

| Place | On-screen name | Guide |
| --- | --- | --- |
| Left rail | **Race setup** | [Project](./project.md) · [Fleet](./fleet-live.md) · [Assets](./assets.md) · [Heroes](./hero-buildings.md) · [Library](./library.md) · [Race ops](./race-ops.md) |
| Right rail | **Broadcast** | [Output](./output.md) · [Flow](./flow.md) · [Calibration](./calibration.md) · [Environment](./environment.md) · [Cinematics](./cinematics.md) · [Wind](./wind.md) |
| Header of left rail | **World** | [World Authoring](./world-authoring.md) |
| Top of canvas | **local view** | [Local view](./local-view.md) |
| Bottom | SRT program bar | [SRT program bar](./srt-program-bar.md) |
| 2D local only | under the map | **Boat size** slider |
| Collapsed left tab | **Setup ›** | Restore left rail |
| Collapsed right tab | **‹ Broadcast** | Restore right rail |

**«** / **»** collapse one rail. Backquote (`` ` ``) collapses or restores both. Click a section title to accordion it. Drag the rail edge to resize.

Default open: **Project**, **Fleet & Live**, **Output**, **Cinematics**.

---

## Left — Race setup

### Project

**Load** · **Save** · **Save as** · **Export…** · race picker + id · **Pack ↓** · **Pack ↑** · **origin** (lat / lon / altMsl) · **Apply**

If a projects API is connected: **Refresh** · Show archived · **Dup** · **Rename** · **Archive** / **Unarchive**

### Fleet & Live

Inner header **Fleet / Live**. Drone base · Boat base · SRT template

**Connect live** · **Disconnect** · **Reconnect** · **Connect SRT** · **Disconnect SRT**

Per boat: Live · id / name / category / colour (Auto / Custom) · visibility · **Save** · **×** · **Add**  
Per POV: Live · srt id · **Vid** · **Save** · **Cam** / **Switch** · **×** · **Add**

**Frame boats** (ops preview — not the SRT 3D program rig)

### Assets

Per row: **Focus** · **3D** / **3D off** · **2D** / **2D off** · boat visibility · **Details**

Details: lat / lon / alt · height · **Full 3D** / **Buoy mesh** / **Tag** · rounding · logos · plate · Library… · Close · Open Fleet

### Hero buildings

Per landmark: **Focus** · texture chip · **X Y Z** · yaw / pitch / roll · scale  
(Master on/off is Environment **heroes**)

### Library

**Refresh** · **Upload…** (editor + API only)

### Race ops

**telemetry** (mock / replay / live) · **pov** · **view** (Follow / Free cam) · **preview** fps · GPU · **hitch** · **countdown** **start** **pause** **reset** **restart** · **authoring** · status + SRT situation line

---

## Right — Broadcast

### Output

**local view** **2D** / **3D** / **AR** · **output** (preview / chroma / transparent) · **AR bg** (alpha / video)

**SRT program out:** **SRT AR** · **SRT 3D** · **SRT 2D** (checkbox + URL + Status / Encoder / error)

**Legacy NDI (hidden):** fold-out · **Send on NDI** per channel · **Delay** · **Copy 10 s dump**

### Flow

**Live JSON** · card ▸/▾ · **Pop out** / **Dock** · Telemetry / SRT JSON

### Calibration

**device** · yaw / pitch / roll · fov · alt m · **sync ms** · **Reset** · **Calibration overlay**

### Environment

**environment** (simple / realistic) · **sea** (high / low) · **terrain** · **map** (road / aerial) · **lock tiles** · **buildings** · **heroes** · **nudge m** · **Cesium hide m** · **sea m** · **ion token** · **Apply**

### Cinematics

**sequence** (includes **Off (race view)**) · **Play** · **Pause** · **Record** · **Save tile list** · scrub / time

### Wind

**from°** · **kt** · **hold** / **API**

---

## Bottom — SRT program bar

The pane matches **local view**. Switching 2D/3D/AR here does **not** start or stop SRT.

| Local | Controls |
| --- | --- |
| **3D** | **Control 3D program** · **Frame boats** · layer checkboxes |
| **AR** | **Follow** · **Free** (disabled stubs) · layer checkboxes (AR defaults: meshes off, tags on) |
| **2D** | **Follow centroid** · per-boat follow · **E (m)** · **N (m)** · **Across (m)** · hint *2D uses stream-map icons* |

Layer checkboxes (AR and 3D): **Boat model** · **Boat tag** · **Heading arrow** · **Buoy model** · **Buoy tag** · **Rounding arrows** · **Sponsors** · **Billboards** · **Start/Finish**

---

## Overlay — World Authoring

Header **World** (or Race ops **authoring**). Title **World authoring**.

**Maximize** / **Restore** · vertex snap · grid 5m · **Finish chain** · **Delete** · **Export JSON** · **Export GeoJSON** · **Import GeoJSON** · **Save project**

| Group | Tools |
| --- | --- |
| Select | **Select** |
| Course | **Start** · **Finish** · **Mark** · **Gate L** · **Gate R** · **Gate pair** · **Buoy** · **Flag P1** · **Flag P2** |
| Graphics | **Sponsor** · **Billboard chain** · **Arrow** |
| Fleet | **Place boat** · **Place drone** |
| Anchor | **Set anchor** |

Inspector: type, name, coords, height, visibility / Full 3D / mesh / tag / rounding, logos, plate

---

## Centre canvas

What you see is **local view** only. **SRT AR** / **SRT 3D** / **SRT 2D** in Output are a different path (OBS).

Related: [all panels](./README.md) · [catalog](../studio-operator-manual.md)
