# SRT egress — three-channel program out (AR / 3D / 2D)

**Status:** Design locked 2026-09-07. **Not implemented until Phase 22** (after Phase 20 buildings + Phase 21 commercial video). VPS/relay host: **wait** — operator will give details at execute time.
**Owner:** **SRT** (ffmpeg + SRT URLs/latency) + **OUT** (plates, per-channel enable, NDI park) + **PLT** (ffmpeg packaging) + **PRF** (three encodes vs preview).
**Ingest unchanged:** Phase 17 drone SRT **caller** / catalog stays. This doc is **publish** only.
**Related:** Phase 20 buildings [`3d-environment-buildings.md`](./3d-environment-buildings.md) · Phase 21 [`commercial-video.md`](./commercial-video.md) (stub).

---

## 1. Operator locks (2026-09-07)

1. **Three SRT channels at once** — AR, 3D, and 2D, same idea as today’s NDI triad. Per-channel **stop/start** remains (like NDI Send checkboxes).
2. **WAN relay** — existing VPS or a new one; **do not pick a host in this phase**. Design the caller URL + latency presets; wire the host when BW opens Phase 22.
3. **NDI is not air after SRT execution starts.** Keep the NDI code in-repo (do not delete pumps/grandi). Product default: **SRT only**. Goal: **more fps** by dropping uncompressed UYVY + `grandi` IPC. No NDI 30×3 climb.

## 2. Why SRT, and why not the NDI pack path

NDI live proof: AR/3D **~20 fps** with 2D off — stall is renderer-thread readback/pack/IPC of ~4.1 MB UYVY, not the NIC.

SRT sends **compressed** MPEG-TS (~6–15 Mbps/channel). That only helps if **encode + SRT run in ffmpeg children**, not if we PBO → UYVY → JS → ffmpeg. **Do not** feed `ndiDeferredSend` / grandi buffers into SRT.

Killing NDI **on air** frees that pack/IPC. The renderer still **draws** AR + 3D + 2D. 2D `getImageData` was ~100 ms — SRT does not magically fix that unless 2D capture also leaves the JS pack path (window/DXGI grab of the 2D surface). PRF measures after NDI is off.

## 3. Architecture

Three independent publishers. Same graph, three titles / three ffmpeg processes.

```
Electron renderer                         Electron main
┌──────────────────────────┐              ┌─────────────────────────────┐
│ Ops UI                   │              │ ffmpeg[ar]  h264_amf → SRT  │
│                          │              │ ffmpeg[3d]  h264_amf → SRT  │
│ AR  1080 surface ────────┼── DXGI/GDI ─▶│ ffmpeg[2d]  h264_amf → SRT  │
│ 3D  1080 surface ────────┤              └──────────────┬──────────────┘
│ 2D  1080 surface ────────┘                             │
│   (chrome-free program                                 │ caller
│    windows or titled                                   ▼
│    output HWNDs)                          LAN vMix ×3  or  relay ×3
└──────────────────────────┘                latency LAN 40–80 ms
                                            WAN 200–1000 ms (when host exists)
```

- **We publish as SRT caller** (dial a listener). Studio `mode=listener` is not the WAN test path (NAT).
- **GPU encode:** `h264_amf` on RX 6750 XT; NVENC on NVIDIA boxes; `libx264` fallback only.
- **Audio:** silent v1 (gfx only) unless Phase 22 says otherwise.
- **Alpha:** SRT is **opaque**. AR channel is composited plate (`arBackground: video`) or opaque AR-over-clear as today when video is off — not UYVA alpha for vMix key. Same lock as AR NDI UYVY (no vMix key of broadcast-web).
- **Ops:** three toggles **SRT AR / SRT 3D / SRT 2D**. NDI toggles stay in code, **hidden or labeled legacy**, default **off**. Do not send NDI when SRT work is the air path.

## 4. LAN (race) vs network (test)

Same three encoders. Destination URLs and `latency` are presets. **Relay hostname is TBD** (operator at Phase 22).

| | Race day LAN | Test on network (later) |
| --- | --- | --- |
| Listeners | vMix (or OBS) ×3 on the LAN | Relay listeners ×3; remote vMix calls the relay |
| We send | `srt://192.168.x.x:PORT_n?mode=caller` | `srt://RELAY:PORT_n?mode=caller` |
| Latency | 40–80 ms | 200–1000 ms |
| Bitrate / ch | 8–15 Mbps | 4–8 Mbps if uplink is thin |
| NAT | none | outbound UDP only |

Smoke: loopback three ffplay/OBS inputs → LAN second PC → wait for VPS details.

## 5. NDI park (Phase 22 execute)

| Keep | Stop using |
| --- | --- |
| `desktop/ndiSender.cjs`, pumps, tests | Default Send on; air runbook NDI-first |
| Ability to compile/run NDI in a lab | Any requirement to hit NDI 30×3 |

When Phase 22 workers start: NDI Send **defaults off**; SRT is the only documented air path. Do not rip NDI in the first SRT DSP (smaller diffs, rollback). A later DSP may hide the NDI panel.

## 6. Out of scope until Phase 22

- Picking the VPS / MediaMTX ports
- Browser WHIP
- In-browser SRT
- `STUDIO_TICK_FPS = 60`
- Google / IBB / DIY city mesh
- Commercial video (Phase 21)

## 7. Honest fps note

Three simultaneous **1080 encodes** are cheaper on the JS thread than three UYVY IPCs, not free. Preview must stay usable with all three SRT on. If AMF×3 kills the GPU, drop 2D encode first (operator already saw 2D as the NDI weak channel), not AR/3D. Do not promise HUD 30/30/30.
