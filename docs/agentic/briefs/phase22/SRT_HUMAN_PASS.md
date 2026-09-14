# Phase 22 — SRT human test brief

**Owner:** operator (studio PC). **SRT / OUT / BW** receive Pass/Fail.  
**Code:** `DSP-SRT-20260909-01` + destination URL field (2026-09-14).  
**No worker** until a task Fails. **VPS / 22.3** stays closed until **A** Pass.

**Setup:** [`../../../ops/srt-local-obs.md`](../../../ops/srt-local-obs.md) · checklist copy: [`../../../ops/srt-human-pass.md`](../../../ops/srt-human-pass.md)  
**Design:** [`../../../architecture/srt-egress.md`](../../../architecture/srt-egress.md)

Studio is always **caller**. Receiver (OBS / vMix) is always **listener**. NDI Send stays **off**.

`npm run dev` + `npm run desktop:dev`. OBS Media Source: Local File **off**, Input Format **`mpegts`**, `latency=60000` (microseconds, not `60`).

Order: **A → B** on this PC. **C** needs a second LAN machine. **D** is the URL field (local / LAN / VPS host). **D** can reuse A or C; do not invent a VPS in this brief.

---

## Test A — Local OBS 30×3

**Goal:** three program SRT streams on this PC at ~30 fps each.

Listeners **first**, then check studio SRT boxes. Leave URL fields at loopback (or paste them):

| Channel | Studio URL field (caller) | OBS input (listener) |
| --- | --- | --- |
| AR | `srt://127.0.0.1:9201?mode=caller&latency=60000` | `srt://0.0.0.0:9201?mode=listener&latency=60000` |
| 3D | `srt://127.0.0.1:9202?mode=caller&latency=60000` | `srt://0.0.0.0:9202?mode=listener&latency=60000` |
| 2D | `srt://127.0.0.1:9203?mode=caller&latency=60000` | `srt://0.0.0.0:9203?mode=listener&latency=60000` |

| Check | Pass | Fail |
| --- | --- | --- |
| Handshake | Each row `live`, encoder **`h264_amf`** | `connecting`; **`libx264`** |
| FPS | OBS ~**30 / 30 / 30**, all three on; studio preview usable | ~7–15; one channel kills the others |
| AR | Opaque air plate, no ops HUD | Studio sidebar; key hole |
| 2D | Stream map 1920×1080 | HiDPI crop; ops chrome |

- [ ] **Pass A**

---

## Test B — OBS 3D sea + terrain

**Goal:** SRT 3D matches studio free cam (not heroes-only). Known miss was a new plate SPA; `srtOut:worldLook` is in tree.

Studio: **3D**, free cam, **realistic**, terrain **on**, overlay **aerial** (or road — match studio), buildings on, heroes on. Enable **SRT 3D** first if A is noisy.

| Check | Pass | Fail |
| --- | --- | --- |
| Camera | Same **free-cam** orbit as studio 3D | Drone / follow / FINISH POV |
| Sea | Gerstner in the strait; boats sit on it | Dry / missing water / heroes on empty |
| Terrain | Hills + Bing aerial (or road) | Flat void vs studio |
| City | OSM massing + landmarks like studio | Heroes-only dump |
| HUD | No ops sidebar / LOCAL VIEW on the plate | Screen-copy of the studio |

If Fail: screenshot OBS 3D vs studio 3D; name the missing layer. Do not turn NDI on.

- [ ] **Pass B**

---

## Test C — LAN, one other PC

**Goal:** same three callers, destination = the other PC’s IPv4. After **A**. One receiver. Not VPS.

1. Same subnet (not guest Wi‑Fi / client isolation).
2. Receiver `ipconfig` → IPv4, e.g. `192.168.1.50`.
3. Receiver firewall: **UDP 9201–9203** inbound, Private.
4. Receiver OBS ×3: `srt://0.0.0.0:920n?mode=listener&latency=60000`, **`mpegts`**.
5. Studio **URL fields** (not `127.0.0.1`):
   - AR `srt://192.168.1.50:9201?mode=caller&latency=60000`
   - 3D `srt://192.168.1.50:9202?mode=caller&latency=60000`
   - 2D `srt://192.168.1.50:9203?mode=caller&latency=60000`
6. Listeners first. Prove **3D**, then AR / 2D.

| Check | Pass | Fail |
| --- | --- | --- |
| Connect | Studio `live`; receiver OBS has picture | `connecting` (IP / UDP / no listener) |
| Picture | Same as A/B (3D has sea + terrain) | Black; studio HUD |
| Local OBS | **Goes dark** on this PC (one caller = one listener). Expected | — |

**Out of scope:** two listeners at once (relay). Studio as listener. VPS.

- [ ] **Pass C** (3D minimum)

---

## Test D — URL field is the destination

**Goal:** the text field under each SRT box is editable and ffmpeg dials whatever `srt://` you paste.

| Step | Pass | Fail |
| --- | --- | --- |
| Field | Click, type, select text. Not a dead label | Cannot focus / type |
| Local | Paste loopback from Test A, check box → `live` | Ignores the field; always 127.0.0.1 from code only |
| LAN | Paste receiver IP (Test C) → other PC gets the stream | Still hits 127.0.0.1 |
| `0.0.0.0` | Studio Error explains caller cannot bind `0.0.0.0` | Connects or hangs with no message |
| Live edit | Change URL, Enter or blur → that channel restarts to the new host | Old destination until app restart |
| VPS (optional) | If you already have a relay host, paste it. Listener must exist first. **Do not pick a new VPS in this test.** | — |

Studio always **`mode=caller`**. Pasting a listener URL with a real IP is rewritten to caller.

- [ ] **Pass D** (local required; LAN if C is in the same session)

---

## Report to BW

| Test | Pass / Fail | Notes |
| --- | --- | --- |
| A 30×3 | | encoder, fps |
| B 3D sea+terrain | | |
| C LAN | | receiver IP, channels |
| D URL field | | |

Then **BW**. 22.3 VPS only after **A**. Fan-out / MediaMTX only if **C** Pass and two listeners are required.
