# Local view

The **centre canvas** plus the **local view** **2D** / **3D** / **AR** buttons (top of canvas and again in [Output](./output.md)).

This is **what you look at in the studio window**. It does **not** start or stop SRT or NDI. Air is the **SRT AR / SRT 3D / SRT 2D** checkboxes.

---

## Buttons

| Button | Picture in studio |
| --- | --- |
| **AR** (default) | Tags + optional drone video underlay. Clear mode from Output **output** / **AR bg** |
| **3D** | Opaque world: sea, terrain, buildings, heroes (Environment). Ops or program camera — see [SRT program bar](./srt-program-bar.md) |
| **2D** | Stream map filling the window. **Boat size** slider appears under the map (0.25–2, default **0.5**) |

Hint in UI: “NDI stays on” (legacy wording). Ignore it for air path.

The [SRT program bar](./srt-program-bar.md) pane **follows** this choice so layer/camera controls match what you are looking at.

---

## vs OBS

| Studio | OBS (when that SRT box is on) |
| --- | --- |
| Local **AR** | Not automatically on-air — tick **SRT AR** |
| Local **3D** | Tick **SRT 3D**. Program cam may mirror ops until you take over |
| Local **2D** | Tick **SRT 2D**. **Across (m)** on the bar matches OBS zoom |

AR SRT plate never shows terrain/sea/heroes. 3D SRT never shows the drone underlay.

Related: [all panels](./README.md) · [Output](./output.md) · [Environment](./environment.md) · [catalog](../studio-operator-manual.md)
