# Output

Right rail **Broadcast → Output**. Studio picture mode and **air** (SRT program out to OBS). Ingest (pulling drone cameras) is [Fleet & Live](./fleet-live.md) **Connect SRT**.

---

## Local picture (does not start SRT)

Duplicated at the top of the canvas — see [Local view](./local-view.md).

| Control | Values | What it does |
| --- | --- | --- |
| **local view** | **2D** / **3D** / **AR** | What fills the **studio window**. Does not start or stop SRT/NDI |
| **output** | preview · chroma · transparent | How the **AR** canvas **clears**. Independent of 2D/3D/AR |
| **AR bg** | alpha · video | `alpha` = no ingest picture under tags. `video` = SRT ingest in WebGL behind tags |

| output | Clear | Typical use |
| --- | --- | --- |
| preview (default) | Dark opaque | Ops looking at AR |
| chroma | Green (or `chromaKey` in config) | Key in vMix/OBS |
| transparent | Black, alpha 0 | Legacy NDI alpha — **not** SRT program out |

**SRT program plates are always opaque.** Ops `transparent` does not punch a hole in OBS.

**Connect SRT** also switches **AR bg → video** and local view → **AR**.

Unknown `outputMode` → preview. Unknown `arBackground` → alpha.

---

## SRT program out (air)

Heading **SRT program out**. Three independent ffmpeg **callers**. Check a box to publish; uncheck kills **that** channel only.

| Checkbox | Default studio URL | OBS Media Source **Input** |
| --- | --- | --- |
| **SRT AR** | `srt://127.0.0.1:9201?mode=caller&latency=60000` | `srt://0.0.0.0:9201?mode=listener&latency=60000` |
| **SRT 3D** | port **9202** | listener **9202** |
| **SRT 2D** | port **9203** | listener **9203** |

Each row: checkbox · **URL** · Status · Encoder · error.

**OBS:** Local File **off**, Input Format **`mpegts`**, latency **60000** (microseconds = 60 ms). Do **not** use `latency=60`. Do **not** paste `0.0.0.0` into studio. Start **listeners first**, then tick studio boxes.

Want encoder **`h264_amf`**. Error line is ffmpeg (often “no listener”). URLs remembered in `bw.srt.out.urls`.

| Channel | Picture |
| --- | --- |
| **AR** | Active POV, tags, video underlay when ingest is live. No terrain/sea/OSM/heroes. Opaque 1920×1080 |
| **3D** | Program camera (see [SRT program bar](./srt-program-bar.md)). Sea + terrain + buildings + heroes. No ops HUD |
| **2D** | Stream map 1920×1080 |

Until you tick **Control 3D program** or bar **Frame boats**, the 3D program camera **mirrors the studio 3D look**. After takeover, ops WASD does not move OBS.

If OBS AR is a small picture in a striped box: Transform → **Reset**, then **Ctrl+F**, Bounding Box **Stretch to bounds**. Canvas **1920×1080**.

Ingest catalog is port **9000**. Program out is **9201–9203**. Do not collide them.

Local how-to: [`../srt-local-obs.md`](../srt-local-obs.md).

---

## Legacy NDI (hidden)

Folded `<details>`, **closed**. Air is SRT. Enabling an SRT box does not start NDI.

| Control | Default |
| --- | --- |
| **Send on NDI** per AR/3D/2D | all off |
| **Delay** (ms) | 0 (0–30000; >3000 warns memory) |
| **Copy 10 s dump** | Stage timing to clipboard |

Session only — never saved into `project.json`.

Related: [all panels](./README.md) · [Local view](./local-view.md) · [SRT program bar](./srt-program-bar.md) · [catalog](../studio-operator-manual.md)
