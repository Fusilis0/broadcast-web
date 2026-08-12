# AR calibration overlay (manual)

**Status:** shipped (`DSP-SCN-20260812-02`)  
**Related:** [`ar-calibration-map-overlay.md`](../architecture/ar-calibration-map-overlay.md), Calib sliders (`src/calibration/offsetSliders.ts`)

## What it is

A toggleable **ENU coordinate overlay** drawn through the same calibrated active-POV
camera as the rest of AR: dense grid, world origin, and high-contrast poles for
marks / gates / start–finish / buoys.

It is **read-only**. Slider changes still write `offsetsStore` as usual; the overlay
never calls `setOffsets`.

## How to use

1. Open the ops sidebar → **Calib**.
2. Check **Calibration overlay** (default off).
3. Prefer **preview** ops view with the active POV (follow mode) so framing matches air.
4. Drag **yaw / pitch / roll / FOV / alt** until the grid and mark poles line up with
   known real-world landmarks (or the live camera feed, when visible).
5. Uncheck the overlay when finished — normal `visible3d` / ghost / hide rules return
   for the regular course props (overlay helpers are removed).

### Force-visible marks

While the overlay is on, helpers are drawn for **all** placed marks/gates/start/finish/buoys
even if Assets → Show-3D is off. Sponsors, flags, and billboard chains are not duplicated
on the overlay (use the normal scene for those).

## Grid defaults (v1)

| Knob | Value |
| --- | --- |
| Spacing | **50 m** |
| Extent | **±1000 m** from origin (**2 km** side) |

No per-venue grid UI yet — large enough for a typical course footprint.

## Compositing note (WHEP underlay)

Today’s **preview** clear is often **opaque**, so the WebGL canvas can fully cover the
WHEP `<video>` underlay. The overlay still helps by densifying synthetic geometry for
landmark comparison and for opaque 3D / transparent NDI workflows.

**Workarounds when you need video under the synthetic layer:**

- Use **transparent** output + alpha NDI into vMix/OBS (see [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md)), or
- Compare overlay marks to a known landmark bearing/photo without live underlay.

Do not expect true alpha-over-WHEP compositing until OUT ships canvas-alpha work —
this overlay does not invent an opaque sky; it is lines/poles/labels only so
`transparent` / `chroma` clears stay usable.
