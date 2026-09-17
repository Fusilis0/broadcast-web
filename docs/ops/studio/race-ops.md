# Race ops

Left rail **Race setup → Race ops**. Telemetry source, active camera, ops look (free vs follow), HUD readouts, countdown, and a mirror of World Authoring.

Camera **Switch** also lives on [Fleet & Live](./fleet-live.md). This section is the compact race HUD.

---

## Controls

| Control | Values / default | What it does |
| --- | --- | --- |
| **telemetry** | **mock** · replay · live | Restarts ingest. **mock** = canned. **replay** = fixture file. **live** = WebSockets (needs bases + Connect live) |
| **pov** | First of the POV list | Active air camera. Same latch as Fleet **Cam** / **Switch** |
| **view** | **Free cam** (default) · Follow active POV | Ops **look only**. Does not move AR SRT or (until takeover) 3D SRT |
| **preview** | readout | Local fps |
| GPU | readout | WebGL renderer name |
| **hitch** | count | Frames with dt > 50 ms |
| **countdown** | **start pause reset restart** | Flag sequence |
| **authoring** | off | Same as header **World** |
| Status `<pre>` | — | mode, WS, POV, last ENU |
| SRT situation line | — | Ingest decode / caller (updates with Connect SRT) |

Digit keys **1–4** switch POV if that **id string** is in the list (not while typing in a field). Hint on **pov**: `digit keys 1–4`.

**Connect live** in Fleet sets telemetry to **live** for you. Switching this dropdown back to mock/replay stops live sockets.

---

## Free cam vs Follow

When **view = Free cam** and [SRT program bar](./srt-program-bar.md) **Control 3D program** is off:

| Input | Action |
| --- | --- |
| **W A S D** | Move camera + pivot on the ground; speed grows with height |
| Left-drag | Pan |
| Right-drag | Orbit |
| Wheel | Zoom toward cursor |

**Follow active POV** locks the ops look to the selected drone pose. Air / SRT underlay still uses that same active POV either way.

Related: [all panels](./README.md) · [Fleet](./fleet-live.md) · [Local view](./local-view.md) · [catalog](../studio-operator-manual.md)
