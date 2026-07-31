# vMix — alpha NDI ingest (path A)

**Status:** 7.3b code landed — **human alpha Results pending**  
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

## Fallback (interim air)

If NDI is unavailable or alpha looks wrong in the switcher:

- Use Chrome + `outputMode=chroma` + window capture + green key  
- Canonical steps: [`air-runbook.md`](./air-runbook.md)

Chroma remains supported; it is **not** the production NDI mode.

## Binding / SDK (this slice)

| Item | Value |
| --- | --- |
| Binding | [`grandi`](https://www.npmjs.com/package/grandi) (Electron main) |
| Format | BGRA progressive, CPU readback from WebGL (`readPixels`) |
| Alpha | Straight alpha from transparent clear + opaque AR |

## Results (human fills)

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| NDI name seen in vMix/OBS | |
| Alpha OK (see-through empty, no green)? | Y/N |
| 8×8 timecode sharp? | Y/N |
| Latency vs chroma capture | |
| Pass / fail | |
| Notes / blockers | |

**After Pass:** BW opens **7.6** cutover DSP. **After Fail** on latency/scale: thin **7.5** polish first.
