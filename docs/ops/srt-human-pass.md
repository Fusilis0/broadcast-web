# Human Pass — SRT program out (Phase 22)

**Operator Human Pass (A–D):** [`../agentic/briefs/phase22/SRT_HUMAN_PASS.md`](../agentic/briefs/phase22/SRT_HUMAN_PASS.md). Checklist below.

Do **A** then **B** on this PC. **C** needs a second machine on the same LAN. **D** is the URL field. **VPS / 22.3 stays closed** until A+B Pass.

`npm run dev` + `npm run desktop:dev`. NDI Send stays off. OBS Media Source: Local File **off**, Input Format **`mpegts`**, `latency=60000` (microseconds).

---

## A — Local OBS 30×3

Listeners **first**, then studio SRT boxes.

| Channel | Studio caller | OBS input |
| --- | --- | --- |
| AR | `srt://127.0.0.1:9201?mode=caller&latency=60000` | `srt://0.0.0.0:9201?mode=listener&latency=60000` |
| 3D | `srt://127.0.0.1:9202?mode=caller&latency=60000` | `srt://0.0.0.0:9202?mode=listener&latency=60000` |
| 2D | `srt://127.0.0.1:9203?mode=caller&latency=60000` | `srt://0.0.0.0:9203?mode=listener&latency=60000` |

| Check | Good | Fail |
| --- | --- | --- |
| Handshake | Each row `live`, encoder **`h264_amf`** | Stays `connecting`; `libx264` |
| FPS | OBS ~**30 / 30 / 30** with all three on; studio preview still usable | ~7–15, one channel kills the others |
| AR | Opaque air plate (follow/drone POV), no ops HUD | Studio sidebar; transparent key hole |
| 2D | Stream map 1920×1080 | Cropped HiDPI zoom; ops chrome |

- [ ] **Human Pass A**

---

## B — OBS 3D = studio world (terrain + sea)

Known miss: SRT 3D showed **hero glTF only** (no sea, no terrain) because plates are a new SPA. Fix is in tree (`srtOut:worldLook`). This task is the eye check.

Studio: **3D**, free cam, environment **realistic**, terrain **on**, overlay **aerial** (or road — match studio), buildings on, heroes on. Enable **SRT 3D** only first if A is noisy.

| Check | Good | Fail |
| --- | --- | --- |
| Camera | Same **free-cam** orbit as studio 3D | Drone/follow / FINISH POV |
| Sea | Gerstner water in the strait, boats sit on it | Dry mesh / missing water / heroes on empty |
| Terrain | Hills + Bing aerial (or road) under the city | Flat void; photo-drape only with no relief if studio has terrain |
| Buildings / heroes | OSM massing + landmarks like studio | Heroes-only “model dump”; no city |
| HUD | Plate has **no** ops sidebar / LOCAL VIEW | Screen-copy of the studio |

- [ ] **Human Pass B**

If Fail: screenshot OBS 3D vs studio 3D, note which layer is missing (sea / terrain / overlay / buildings). Do not “fix” by turning NDI on.

---

## C — LAN: another PC on the same network

**When:** after A Pass (B can be same session). One receiver. Not VPS.

Studio stays **caller**. The other PC is **listener**. Paste that PC’s IPv4 into the studio SRT URL fields (already in Output). Do **not** use `127.0.0.1` on the studio for this task.

1. Both PCs same subnet (not guest Wi‑Fi / client isolation).
2. Receiver: `ipconfig` → IPv4, e.g. `192.168.1.50`.
3. Receiver Windows Firewall: **UDP 9201–9203** inbound, Private network.
4. Receiver OBS ×3: `srt://0.0.0.0:920n?mode=listener&latency=60000`, format **`mpegts`**.
5. Studio URLs (example):
   - AR `srt://192.168.1.50:9201?mode=caller&latency=60000`
   - 3D `srt://192.168.1.50:9202?mode=caller&latency=60000`
   - 2D `srt://192.168.1.50:9203?mode=caller&latency=60000`
6. Start listeners, then enable SRT on the studio. Prove **3D first**, then AR / 2D.

| Check | Good | Fail |
| --- | --- | --- |
| Connect | Studio `live`; receiver OBS shows picture | `connecting` (wrong IP, UDP blocked, listener not up) |
| Picture | Same as local A/B (3D has sea + terrain) | Black; studio HUD |
| Local OBS | **Goes dark** on this PC — one caller, one listener. Expected. | — |

**Not this task:** studio OBS **and** the other PC at once (needs a relay). **Not** flipping studio to listener. **Not** VPS.

- [ ] **Human Pass C** (3D at least; AR+2D if 3D Pass)

---

## D — URL field is the destination

Click the URL under each SRT box. Paste local `127.0.0.1`, a LAN IP (Test C), or a known VPS host. Studio stays **caller**. Do not paste `0.0.0.0`. Enter / blur while live restarts that channel.

| Check | Good | Fail |
| --- | --- | --- |
| Edit | Field is a text input | Dead label |
| Destination | ffmpeg dials the pasted host | Always loopback |
| `0.0.0.0` | Error line, no dial | Silent hang |

- [ ] **Human Pass D**

---

## Report

| Task | Pass / Fail | Notes |
| --- | --- | --- |
| A 30×3 | | encoder, fps |
| B 3D sea+terrain | | |
| C LAN | | receiver IP, which channels |
| D URL field | | |

Then tell **BW**. VPS only after A. LAN fan-out / MediaMTX only if C Pass and we need two listeners.
