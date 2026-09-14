# Local SRT program out → OBS (Phase 22)

Three silent **1080p30** SRT callers from the Electron studio to **OBS on this PC**. No VPS. NDI Send stays hidden / off.

**Operator Human Pass list (A local 30×3, B OBS 3D terrain+sea, C LAN second PC):** [`srt-human-pass.md`](./srt-human-pass.md).

Studio is always **caller** (it dials). OBS must be **listener** (it waits). Two callers = both sit on `connecting` forever. That is what you are seeing.

Design: [`../architecture/srt-egress.md`](../architecture/srt-egress.md).

## Ports (do not collide with ingest catalog 9000)

| Channel | Studio (caller) | OBS **Input** (listener) |
| --- | --- | --- |
| AR | `srt://127.0.0.1:9201?mode=caller&latency=60000` | `srt://0.0.0.0:9201?mode=listener&latency=60000` |
| 3D | `srt://127.0.0.1:9202?mode=caller&latency=60000` | `srt://0.0.0.0:9202?mode=listener&latency=60000` |
| 2D | `srt://127.0.0.1:9203?mode=caller&latency=60000` | `srt://0.0.0.0:9203?mode=listener&latency=60000` |

**Both sides use microseconds for `latency`.** `60000` = 60 ms. Do **not** put `latency=60` in OBS — that is 60 µs and the handshake never completes.

## 1. How to listen in OBS (do this first)

Do this **before** checking any SRT box in studio. One source per channel.

1. Open **OBS Studio** (28+).
2. In **Sources**, click **+** → **Media Source**.
3. Name it `SRT AR` → OK.
4. In the properties dialog:
   - **Uncheck** `Local File`.
   - **Input:** `srt://0.0.0.0:9201?mode=listener&latency=60000`
   - **Input Format:** `mpegts` ← required. Empty format = black / never connects.
   - Uncheck **Restart playback when source becomes active** (stops the source going black when you click away).
   - Leave **Network Buffering** at default unless the picture stutters.
5. Click **OK**. The preview can stay black — that is idle listener, waiting for the studio caller.
6. Repeat for **SRT 3D** (port **9202**) and **SRT 2D** (port **9203**). Put all three in the same scene so you can see them.

`0.0.0.0` means “listen on this PC, any interface.” In studio, paste the **destination** in the URL field under each SRT box (editable). Local: keep `127.0.0.1`. LAN/VPS: that host’s IP, still `mode=caller`. Do **not** paste `0.0.0.0` into studio. Do **not** use VLC Source (VLC cannot listen).

If you already created sources with the old URL (`latency=60` or no `mpegts`), **delete them and add new ones**. OBS can hold a dead SRT port until restart.

## 2. Studio SRT

1. `npm run dev` and `npm run desktop:dev`.
2. After OBS listeners exist, check **SRT 3D** only first.
3. Plates are **offscreen** (not sitting on the studio). Capture is the plate’s own compositor at **1920×1080** — not a DXGI screen crop and not a HiDPI 2K crop.
4. **SRT 3D** is the ops **free camera** with terrain/sea/buildings. **SRT AR** is the drone/follow plate (opaque — ops `transparent` does not apply to SRT). 2D is the stream map.
5. Status should move `connecting` → `live` with **~30 fps** (ffmpeg `-progress`). Encoder **`h264_amf`**. If it stays `connecting` and Error fills in, the Error line is ffmpeg (often “no listener”).
6. OBS preview should match the studio free-cam world (no sidebar). Then enable AR / 2D.

Unchecking a box kills **that** ffmpeg child only.

## 3. What picture to expect

| Channel | Picture |
| --- | --- |
| AR | Composited air plate (active POV). Opaque — not an alpha key. |
| 3D | Ops **free camera** (studio orbit), no ops HUD. **Sea + terrain + overlay** must match studio 3D — not heroes-only. Not the drone/follow POV. Human task **B** in [`srt-human-pass.md`](./srt-human-pass.md). |
| 2D | Stream map, 1920×1080. |

## 4. How to read fps

**Pass is ~30 / 30 / 30 in OBS with all three on**, preview still usable.

- Studio Output row: `live · N fps` from ffmpeg `-progress` (stdout). `-loglevel warning` hides the old stderr stats line.
- OBS: each Media Source preview should move at ~30, not stuttery 10–15.

## 5. Stuck on `connecting · 0 fps` / Error —

| Symptom | Cause | Fix |
| --- | --- | --- |
| All three `connecting`, Error — | OBS is not a listener (or URL/format wrong) | Follow §1. Input Format **must** be `mpegts`. Latency **60000**. |
| Same, and no extra windows | Plate SPA still loading | Wait ~20 s; three Cesium windows appear then ffmpeg starts. |
| OBS black after live | Plate minimized / compositor stalled | Do not OS-minimize. Plates are already off-screen; restart SRT 3D. |
| Encoder `libx264` | AMF missing | Fail for 30×3 — report. |

**Quick proof without OBS** (same ffmpeg as studio, in a terminal):

```
ffplay -fflags nobuffer -flags low_delay -analyzeduration 0 -probesize 32k srt://127.0.0.1:9201?mode=listener&latency=60000
```

Then check **SRT AR** only. If ffplay shows the plate, SRT works and OBS setup was wrong.

## 6. Fail / stop (do not fake Pass)

- Encoder is `libx264` and fps dies
- Grab is black after live
- One channel blocks the others
- Ingest SRT (drone catalog) is broken

Do not turn NDI Send back on to “fix” fps.
