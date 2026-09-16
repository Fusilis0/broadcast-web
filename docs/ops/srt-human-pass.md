# Human Pass — SRT program out (Phase 22)

**Operator Human Pass:** [`../agentic/briefs/phase22/SRT_HUMAN_PASS.md`](../agentic/briefs/phase22/SRT_HUMAN_PASS.md) (full tables **A–I**). Checklist below.

**Code-complete 2026-09-15** (22.4a–f). This is the eye check. **B** already Pass. **VPS / 22.3 stays closed** until **A** Pass.

`npm run dev` + `npm run desktop:dev`. NDI Send stays off. OBS Media Source: Local File **off**, Input Format **`mpegts`**, `latency=60000` (microseconds).

Do **not** Fail AR **Follow / Free** bar buttons (stubs). Freeze/follow is automatic. ffmpeg `fps=` ~29 session average is OK if OBS canvas is ~30.

---

## E — AR 1080 (not 2K crop)

Studio AR vs OBS AR: same 16:9 1080, not a zoomed top-left crop. 3D OBS framing unchanged.

- [ ] **Human Pass E**

---

## F — AR no terrain; freeze until GPS

OBS AR: no hills / sea / OSM / heroes. Camera still until selected POV has usable GPS (≤2 s). Then Follow. Studio 3D WASD must **not** move AR. 3D OBS still has sea+terrain.

- [ ] **Human Pass F**

---

## G — AR vs 3D layer presets

Bottom bar. Defaults: 3D all on; AR tags on, hulls off. Both publish at once. Toggling 3D **Boat model** must not change AR tags.

- [ ] **Human Pass G**

---

## H — 3D program cam

**Control 3D program** off (default): ops WASD moves studio, **OBS 3D still**. On: studio = program, OBS follows **damped**. Off again: studio = ops, OBS frozen at last program pose. **Frame boats** = live hulls only.

- [ ] **Human Pass H**

---

## I — 2D program cam

Local 2D = OBS 2D. Follow centroid of boats with pose in last 2 s. Empty set does not wander. Across (m) matches OBS zoom. Mini-map stays ops.

- [ ] **Human Pass I**

---

## A — Local OBS 30×3

Listeners **first**, then studio SRT boxes. All three on, NDI off.

| Channel | Studio caller | OBS input |
| --- | --- | --- |
| AR | `srt://127.0.0.1:9201?mode=caller&latency=60000` | `srt://0.0.0.0:9201?mode=listener&latency=60000` |
| 3D | `srt://127.0.0.1:9202?mode=caller&latency=60000` | `srt://0.0.0.0:9202?mode=listener&latency=60000` |
| 2D | `srt://127.0.0.1:9203?mode=caller&latency=60000` | `srt://0.0.0.0:9203?mode=listener&latency=60000` |

| Check | Good | Fail |
| --- | --- | --- |
| Handshake | Each row `live`, encoder **`h264_amf`** | Stays `connecting`; `libx264` |
| FPS | OBS ~**30 / 30 / 30** with all three on; studio preview still usable | ~16×3, one channel kills the others |
| AR | Opaque air plate (follow/drone POV), no ops HUD | Studio sidebar; transparent key hole |
| 2D | Stream map 1920×1080 | Cropped HiDPI zoom; ops chrome |

- [ ] **Human Pass A**

---

## B — OBS 3D = studio world (terrain + sea)

**Pass 2026-09-15.** Camera is now the **program rig** (test **H**). World still: Gerstner + terrain + OSM/heroes; no ops HUD.

- [x] **Human Pass B** (2026-09-15). Re-check only if 3D world regresses.

---

## C — LAN: another PC on the same network

**When:** after A Pass. One receiver. Not VPS. Studio stays **caller**. Paste the other PC’s IPv4 into studio SRT URL fields. Do **not** use `127.0.0.1` on the studio for this task.

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
| Picture | Same as local A/E–I (3D has sea + terrain) | Black; studio HUD |
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
| E AR 1080 | | |
| F AR freeze | | |
| G visibility | | |
| H 3D program | | |
| I 2D cam | | |
| A 30×3 | | encoder, fps |
| B 3D sea+terrain | Pass 2026-09-15 | |
| C LAN | | receiver IP, which channels |
| D URL field | | |

Then tell **BW**. VPS only after A. LAN fan-out / MediaMTX only if C Pass and we need two listeners.
