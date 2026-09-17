# Calibration

Right rail **Broadcast → Calibration**. Per-POV offsets on the **active air camera** (AR pose vs video). Device follows Fleet / Race ops **pov**.

Overlay how-to: [`../ar-calibration-overlay.md`](../ar-calibration-overlay.md).

---

## Controls

| Knob | Default | Range | What it does |
| --- | --- | --- | --- |
| **device** | Active / first POV | picker | Which POV these knobs edit |
| **yaw°** / **pitch°** / **roll°** | 0 | −200…200, step 0.1 | Attitude offset |
| **fov°** | **66.8832** | 20…120, step 0.1 | Horizontal FOV |
| **alt m** | 0 | −50…50, step 0.1 | Height offset |
| **sync ms** | 0 | −500…500, step 5 | Time trim: `t_ntp = toNtp(pts) + syncTrimMs`. **Positive = AR leads video** |
| **Reset** | — | — | Zeros + default FOV for **that** device |
| **Calibration overlay** | off | checkbox | ENU grid + force-visible marks through the active POV (read-only) |

Saved in the pack as `calibration.byPovId` on **Project Save**.

Related: [all panels](./README.md) · [Fleet](./fleet-live.md) · [Race ops](./race-ops.md) · [catalog](../studio-operator-manual.md)
