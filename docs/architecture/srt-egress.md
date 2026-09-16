# SRT egress — three-channel program out (AR / 3D / 2D)

**Status:** Design locked 2026-09-07. **Phase 22 open.** Local callers shipped. **2026-09-15:** 3D OBS picture **Pass**. Program cameras + AR/3D look: [`srt-program-cameras.md`](./srt-program-cameras.md). VPS/relay **later**.
**Owner:** **SRT** (ffmpeg + SRT URLs/latency) + **OUT** (plates, per-channel enable, NDI park) + **PLT** (ffmpeg packaging) + **PRF** (three encodes vs preview).
**Ingest unchanged:** Phase 17 drone SRT **caller** / catalog stays. This doc is **publish** only.
**Related:** Phase 20 buildings [`3d-environment-buildings.md`](./3d-environment-buildings.md) · Phase 21 [`commercial-video.md`](./commercial-video.md).

---

## 1. Operator locks

### 2026-09-15 — 3D Pass; program cams; AR clean

Operator: **OBS 3D OK.** Fail: AR 2K, AR terrain, AR/2D cameras wander without telemetry, 2D no boats / no zoom, **~16 fps×3**.

Lock: [`srt-program-cameras.md`](./srt-program-cameras.md). 3D SRT = **program rig**, not ops free cam. AR = no Cesium/sea/heroes; freeze until telemetry. 2D = top-down follow centroid or one boat (telemetry only). Bottom bar. **Do not change `STUDIO_TICK_FPS`.**

### 2026-09-09 — local first, then VPS

1. **Hide / retire NDI on air.** Keep pumps/`grandi` in-repo. Hide (or legacy-fold) the NDI Send UI. Do not send NDI during this work.
2. **Implement SRT out** for AR, 3D, and 2D. Per-channel start/stop.
3. **First Pass = this PC.** Operator listens in **OBS** on `127.0.0.1`. No VPS, no second machine, no WAN.
4. **Pass:** three SRT streams visible in OBS, **30 / 30 / 30 fps**, picture correct (AR plate / 3D / 2D map). Then we configure the VPS and the full relay. Not before.

Local default callers (ffmpeg `latency` is microseconds; 60 ms → `60000`):

| Channel | Studio (caller) | OBS (listener) |
| --- | --- | --- |
| AR | `srt://127.0.0.1:9201?mode=caller&latency=60000` | `srt://0.0.0.0:9201?mode=listener&latency=60000` |
| 3D | `srt://127.0.0.1:9202?mode=caller&latency=60000` | `srt://0.0.0.0:9202?mode=listener&latency=60000` |
| 2D | `srt://127.0.0.1:9203?mode=caller&latency=60000` | `srt://0.0.0.0:9203?mode=listener&latency=60000` |

Start **OBS listeners first**, then enable SRT in studio. Ports **9201–9203** so they do not collide with ingest catalog **9000**. OBS Media Source: uncheck Local File, **Input Format = `mpegts`**, latency is **microseconds** (`60000` = 60 ms). `latency=60` in OBS is 60 µs and will sit on connecting forever.

### 2026-09-07 (still true)

1. **Three SRT channels at once** — AR, 3D, and 2D. Per-channel stop/start.
2. **WAN relay** — do not pick a host in the local slice. Wire when local Pass is done.
3. **NDI is not air.** Keep the code. Product default: **SRT only**. No NDI 30×3 climb.

## 2. Why SRT, and why not the NDI pack path

NDI live proof: AR/3D **~20 fps** with 2D off — stall is renderer-thread readback/pack/IPC of ~4.1 MB UYVY, not the NIC.

SRT sends **compressed** MPEG-TS (~6–15 Mbps/channel). That only helps if **encode + SRT run in ffmpeg children**, not if we PBO → UYVY → JS → ffmpeg. **Do not** feed `ndiDeferredSend` / grandi buffers into SRT.

Killing NDI **on air** frees that pack/IPC. The renderer still **draws** AR + 3D + 2D. 2D `getImageData` was ~100 ms — SRT does not magically fix that unless 2D capture also leaves the JS pack path (window/DXGI grab of the 2D surface).

## 3. Architecture

Three independent publishers. Same graph, three titles / three ffmpeg processes.

```
Electron renderer                         Electron main
┌──────────────────────────┐              ┌─────────────────────────────┐
│ Ops UI                   │              │ ffmpeg[ar]  h264_amf → SRT  │
│                          │              │ ffmpeg[3d]  h264_amf → SRT  │
│ AR  1080 plate  ──────────┼── capturePage │ ffmpeg[2d]  h264_amf → SRT  │
│ 3D  1080 plate  ──────────┤   BGRA pipe   └──────────────┬──────────────┘
│ 2D  1080 plate  ──────────┘                             │
│   (chrome-free windows;                                 │ caller
│    compositor, not screen)                              ▼
└──────────────────────────┘                Local: OBS ×3 on 127.0.0.1
                                         Later: LAN vMix or VPS relay
```

- **We publish as SRT caller** (dial a listener). OBS/vMix/`ffplay` listen. Studio `mode=listener` is not the path (NAT + this local test).
- **GPU encode:** `h264_amf` on RX 6750 XT; NVENC on NVIDIA boxes; `libx264` fallback only.
- **Audio:** silent v1 (gfx only).
- **Alpha:** SRT is **opaque**. AR is the composited plate, not UYVA for a vMix key.
- **Ops:** three toggles **SRT AR / SRT 3D / SRT 2D**. NDI toggles **hidden / legacy**, default **off**. Do not send NDI while SRT is the air path.
- **Program windows:** 1920×1080, chrome-free, titled (`broadcast-web-srt-ar` / `-3d` / `-2d`). Capture is Chromium **`capturePage`** of that window (the plate’s own WebGL/DOM), piped as BGRA into ffmpeg. **Not DXGI screen copy** (that shows whatever is on top of the rectangle). Do not OS-minimize them. Park off-screen is the default — they do not need to be on top of the studio.

## 4. Local (now) vs LAN vs VPS (later)

Same three encoders. Destination URLs and `latency` are presets.

| | Local Pass (now) | Race day LAN | VPS / network (later) |
| --- | --- | --- | --- |
| Listeners | OBS ×3 on this PC | vMix (or OBS) ×3 on the LAN | Relay listeners ×3 |
| We send | `srt://127.0.0.1:920n?mode=caller` | `srt://192.168.x.x:PORT_n?mode=caller` | `srt://RELAY:PORT_n?mode=caller` |
| Latency | 40–80 ms | 40–80 ms | 200–1000 ms |
| Bitrate / ch | 8–15 Mbps | 8–15 Mbps | 4–8 Mbps if uplink is thin |
| NAT | loopback | none | outbound UDP only |

**Human Pass (operator, studio PC):** [`../ops/srt-human-pass.md`](../ops/srt-human-pass.md)

1. **A** — OBS on this PC, **30/30/30**, right picture.
2. **B** — OBS **3D** sea + terrain. **Human Pass 2026-09-15.** 3D SRT is now the **program rig**, not ops free cam (`srt-program-cameras.md`).
3. **C** — one other LAN PC: studio caller URLs use that PC’s IPv4; OBS there listens `0.0.0.0:920n`. One caller = one listener (local OBS goes dark). Relay only if we need two receivers.

VPS **after A**. Do not pick a relay host before C is even attempted.

## 5. NDI park (this slice)

| Keep | Stop using |
| --- | --- |
| `desktop/ndiSender.cjs`, pumps, tests | NDI Send UI as the air control |
| Ability to compile/run NDI in a lab | Any requirement to hit NDI 30×3 |

NDI Send already defaults **off** (`HO-SCN-OUT-20260909-01`). This slice **hides** that UI. Do not delete pumps. Do not start NDI when an SRT channel is on.

## 6. Out of scope (this local slice)

- Picking the VPS / MediaMTX ports
- Browser WHIP / in-browser SRT
- Changing `STUDIO_TICK_FPS`
- Cinematic Record / MP4
- Ingest catalog / drone SRT

## 7. FPS Pass (local)

**Human Pass:** OBS reports ~**30 fps** on **each** of AR, 3D, and 2D, with the right picture, all three on, NDI off. Preview must stay usable.

Three 1080 encodes are cheaper on the JS thread than three UYVY IPCs, not free. If AMF×3 cannot hold 30×3, **stop and report** (which channel, encoder fps, GPU). Do not silently drop 2D. Do not reopen the NDI pack path to “fix” fps.
