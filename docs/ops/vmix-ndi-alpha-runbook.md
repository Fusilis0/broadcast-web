# vMix — alpha NDI ingest (path A)

**Status:** Live AR NDI (2026-09-06) is **opaque UYVY** — sim + SRT are merged in-app; vMix must **not** key `broadcast-web` as alpha. The 2026-07-31 Human Pass below is the old UYVA ingest.  
**Related:** [`ndi-alpha-electron.md`](../architecture/ndi-alpha-electron.md), [`air-runbook.md`](./air-runbook.md), [`desktop/README.md`](../../desktop/README.md)  
**Observed send name (dev):** `DESKTOP-264DNL1 (broadcast-web)`

## Goal

Ingest the Electron studio **named NDI** source as an **alpha** layer in vMix (or OBS). Do **not** apply green-key / chroma remove on this input.

## Prerequisites

1. SPA Vite running: `npm run dev`
2. Studio shell: `npm run desktop:dev`
3. SPA in transparent plate mode, e.g.  
   `http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent`  
   (or toggle **output → transparent** in the OUT control)
4. NDI runtime available (bundled with `grandi` / NDI Tools on the studio PC)

Default NDI source name: **`broadcast-web`** (full name looks like `HOSTNAME (broadcast-web)`).  
Override: `BROADCAST_NDI_NAME` or `--ndi-name=…`. Disable: `--no-ndi`.  
Output is always **1920×1080**; resizing or minimizing the Electron window must **not** stop the stream.

## vMix steps

1. **Add Input → NDI**
2. Select **`… (broadcast-web)`** (or your override name)
3. Place the input on a layer above the camera/plate
4. Confirm compositing uses the source **alpha** (vMix NDI inputs typically honor alpha when the sender publishes BGRA/UYVA)
5. **Do not** enable Chroma Key / Colour Key on this NDI input

### Quick visual check

| Expect | Fail |
| --- | --- |
| Empty sky/sea is see-through over the under layer | Solid green plate → you are on `chroma`, not `transparent` |
| Boats / course / overlays opaque | Soft/blurred 8×8 barcode → bad scale on the input |
| Sharp 8×8 visual timecode corner | Chroma Key effect still on → turn it off for NDI |

## OBS (trial)

1. **Sources → NDI Source** (obs-ndi or equivalent)
2. Pick `broadcast-web`
3. No Chroma Key filter on that source
4. Same alpha / barcode checks as above

## NDI Studio Monitor (no vMix)

When vMix/OBS is unavailable, use **NDI 6 Tools → Studio Monitor** for smoke:

1. Start Electron studio (`outputMode=transparent`) so `… (broadcast-web)` is publishing.
2. Open `C:\Program Files\NDI\NDI 6 Tools\Studio Monitor\Application.Network.StudioMonitor.x64.exe` (or Start Menu **NDI Studio Monitor**).
3. Select `HOSTNAME (broadcast-web)`.
4. Confirm motion / framing; alpha checkerboard or dark underlay shows see-through empty areas.
5. Run the Phase **10.3** checks in [`air-runbook.md`](./air-runbook.md) § Studio NDI smoke (POV vs free cam, stream map off).

Studio Monitor is enough to Pass **source live + POV/free-cam framing**. Full alpha layering over a camera plate still needs vMix/OBS when available.

## Fallback (chroma)

If NDI is unavailable or alpha looks wrong in the switcher:

- Use Chrome + `outputMode=chroma` + window capture + green key  
- Steps: [`air-runbook.md`](./air-runbook.md) § Fallback  
- Show cutover / rollback: same air-runbook § Cutover checklist

Chroma remains supported as **fallback**; it is **not** the production NDI mode.

## Binding / SDK (this slice)

| Item | Value |
| --- | --- |
| Binding | [`grandi`](https://www.npmjs.com/package/grandi) (Electron main) |
| Format | BGRA progressive, CPU readback from WebGL (`readPixels`) |
| Alpha | Straight alpha from transparent clear + opaque AR |

## Results (human fills)

| Field | Value |
| --- | --- |
| Date | 2026-07-31 |
| Operator | studio (product owner) |
| NDI name seen in vMix/OBS | `DESKTOP-264DNL1 (broadcast-web)` |
| Alpha OK (see-through empty, no green)? | **Y** |
| 8×8 timecode sharp? | **Y** (fixed buffer + no CSS scale) |
| Latency vs chroma capture | Acceptable for spike / show trial |
| Pass / fail | **Pass** |
| Notes / blockers | Minimize must **park** (tray), not OS-minimize; 1920×1080 locked |

**After Pass:** 7.6 cutover docs in [`air-runbook.md`](./air-runbook.md) (`DSP-OUT-20260731-06`).

### Phase 10.3 studio smoke (2026-08-04)

| Field | Value |
| --- | --- |
| Pass / fail | **Pass** (see [`air-runbook.md`](./air-runbook.md) § Studio NDI smoke Results) |
| Ingest | NDI Studio Monitor + `grandi` receive (`DESKTOP-264DNL1 (broadcast-web)`); vMix not on smoke PC |
| Notes | Free-cam dual-render bottomUp fix in `ndiFramePump.ts` |
