# Phase 22 — SRT human test brief

**Owner:** operator (studio PC). **BW / SCN / OUT / PRF / SRT** receive Pass/Fail.  
**Code:** 22.4 workers **code-complete 2026-09-15**. This file is the **eye check**.  
**No new worker** until a task Fails. **VPS / 22.3** stays closed until **A** Pass.

**Setup:** [`../../../ops/srt-local-obs.md`](../../../ops/srt-local-obs.md) · checklist: [`../../../ops/srt-human-pass.md`](../../../ops/srt-human-pass.md)  
**Design:** [`../../../architecture/srt-egress.md`](../../../architecture/srt-egress.md) · [`../../../architecture/srt-program-cameras.md`](../../../architecture/srt-program-cameras.md)

Studio is always **caller**. Receiver (OBS / vMix) is always **listener**. NDI Send stays **off**.

`npm run dev` + `npm run desktop:dev`. OBS Media Source: Local File **off**, Input Format **`mpegts`**, `latency=60000` (microseconds, not `60`).

**Already Pass:** **B** 3D sea + terrain (2026-09-15). Re-check only as a regression after program-cam.

**Do not Fail for:**
- ffmpeg HUD `fps=` sitting ~29 after startup — that line is a **session average**. Pass A on **OBS canvas ~30.00** and studio encoder ~30.
- Bottom-bar **Follow / Free** on **AR** — those two buttons are **disabled stubs**. AR freeze/follow is automatic (no GPS = still; GPS = Follow).
- Planned-only boats drawing as 2D sail icons — they must **not** pull Follow centroid.

`STUDIO_TICK_FPS` is still **60**. Do not ask to raise it.

---

## Setup (every look / fps test)

Listeners **first**, then studio SRT boxes. Leave URL fields at loopback unless doing **C/D**:

| Channel | Studio URL field (caller) | OBS input (listener) |
| --- | --- | --- |
| AR | `srt://127.0.0.1:9201?mode=caller&latency=60000` | `srt://0.0.0.0:9201?mode=listener&latency=60000` |
| 3D | `srt://127.0.0.1:9202?mode=caller&latency=60000` | `srt://0.0.0.0:9202?mode=listener&latency=60000` |
| 2D | `srt://127.0.0.1:9203?mode=caller&latency=60000` | `srt://0.0.0.0:9203?mode=listener&latency=60000` |

NDI Send **off**. Enable the channel you are judging; for **A** and **G** all three on.

---

## Test E — AR 1080 (not a 2K crop)

**DSP-OUT-20260915-01.** Worker: HiDPI bitmap is **scaled** to 1920×1080; plate CSS locked 1080.

Studio **AR**. OBS **AR**. Compare FOV to studio local AR (same 16:9, not a top-left crop). 3D OBS must still look like the previous 1080 Pass (not suddenly cropped).

| Check | Pass | Fail |
| --- | --- | --- |
| AR frame | Full 16:9 1080; same scene as studio AR | Zoomed 2K crop (top-left only); stretched plate |
| 3D frame | Unchanged 1080 framing | 3D now cropped or letterboxed |

- [ ] **Pass E**

---

## Test F — AR look freeze (no Cesium, no wander)

**DSP-SCN-20260915-01.** World look IPC is **3D-only**. AR env: simple, terrain / buildings / heroes **off**. Follow applies only when the **selected POV** has usable GPS in the last **2 s**.

**F1 — no GPS (or Connect live off)**  
Local **AR**. OBS **AR**. Do **not** orbit studio 3D expecting AR to move.

| Check | Pass | Fail |
| --- | --- | --- |
| World | Opaque air; **no** hills, sea mesh, OSM city, hero glTF | Cesium / Gerstner / heroes like 3D |
| Camera | Still (origin or last good GPS). No orbit leftover | Wanders with 3D WASD / cinematic |
| 3D | OBS 3D still has sea + terrain when SRT 3D is on | 3D went blank / simple with AR |

**F2 — GPS on selected POV**  
Pick the Follow POV that has live lat/lon (not 0,0; not attitude-only). Within ~2 s OBS AR should **Follow**. Kill GPS → freeze at last pose.

| Check | Pass | Fail |
| --- | --- | --- |
| Unlock | AR camera tracks that POV | Stays frozen forever with good GPS |
| Planned-only | Boat with no live GPS does **not** unlock | Follows a planned seed |

- [ ] **Pass F**

---

## Test G — visibility presets (both on air)

**DSP-SCN-20260915-02.** Bottom bar at the **bottom of the studio window**. Local AR/3D only **shows** that channel’s copy.

Defaults: **3D** all layers on. **AR** boat/buoy **tag on**, model + arrows **off**, sponsors / billboards / start-finish **on**.

| Step | Pass | Fail |
| --- | --- | --- |
| Local AR | Bar shows AR defaults (tags on, hulls off) | Bar copied 3D (hulls on) |
| OBS both | 3D: hulls; AR: tags, **no** hulls | Same picture on both |
| Uncheck 3D **Boat model** | OBS 3D hulls off; switch local AR → AR tags still on | AR lost tags |
| Back to local 3D | Hull still off | 3D preset reset / copied from AR |

- [ ] **Pass G**

---

## Test H — 3D program rig (not ops cam)

**DSP-SCN-20260915-03.** **Control 3D program** default **off**. IPC is `srtOut:programView` (ops preview copy is gone).

World layers (sea/terrain) should still match studio 3D env (**B** still true). Camera is **not** ops WASD unless the latch is on.

| Step | Pass | Fail |
| --- | --- | --- |
| Latch **off** | WASD/orbit studio 3D: **studio** moves; **OBS 3D still** | OBS follows ops |
| Latch **on** | Studio 3D **is** program; OBS follows, **damped** (smoother than ops) | Instant snap / OBS still frozen |
| Latch **off** again | Studio back to **ops** look; OBS **holds last program pose** | OBS jumps to ops; studio stuck on program |
| **Frame boats** | With live hulls: program snaps to those boats (planned-only skipped) | Frames empty / planned seeds |

- [ ] **Pass H**

---

## Test I — 2D program cam

**DSP-SCN-20260915-04.** Studio **local 2D = OBS 2D**. Ops mini-map is a different picture (may auto-fit).

Default: **Follow centroid**, E/N **0**, Across **250 m**. Live = `poseBus` in last **2000 ms**.

| Step | Pass | Fail |
| --- | --- | --- |
| No live boats | Follow centroid pressed; no boat buttons (or empty); view **frozen** (course/origin). Does not wander | Auto-fit pan with empty pack |
| Live boats | Sail icons on OBS 2D; centroid tracks live set; boat buttons appear | No boats; planned-only in centroid |
| One boat | Button → that boat; Across 250 vs 500 changes zoom **same** in studio 2D and OBS | OBS zoom ignores bar; studio ≠ OBS |
| Mini-map | Ops mini-map still utility (can auto-fit) | Mini-map forced to 250 m program |

- [ ] **Pass I**

---

## Test A — Local OBS 30×3

**DSP-PRF-20260915-01.** Worker: plate write **30/30/30** (`h264_amf`); OBS canvas **30.00**. Wall was stdin watermark, not Cesium / tick.

Do this with **AR+3D+2D on**, NDI off, after F (AR without Cesium).

| Check | Pass | Fail |
| --- | --- | --- |
| Handshake | Each row `live`, encoder **`h264_amf`** | `connecting`; **`libx264`** |
| FPS | OBS ~**30 / 30 / 30**, all three on; studio preview usable | ~16×3; one channel kills the others |
| AR | Opaque air plate, no ops HUD | Studio sidebar; key hole |
| 2D | Stream map 1920×1080 | HiDPI crop; ops chrome |

- [ ] **Pass A**

---

## Test B — OBS 3D sea + terrain (regression)

**Already Pass 2026-09-15.** After H, camera is the **program rig**. Do **not** require OBS to match ops orbit.

Studio: **3D**, environment **realistic**, terrain **on**, overlay as in studio, buildings/heroes on. SRT 3D on.

| Check | Pass | Fail |
| --- | --- | --- |
| Sea | Gerstner in the strait; boats sit on it | Dry / missing water / heroes on empty |
| Terrain | Hills + Bing aerial (or road) | Flat void vs studio |
| City | OSM massing + landmarks like studio | Heroes-only dump |
| HUD | No ops sidebar / LOCAL VIEW on the plate | Screen-copy of the studio |

- [x] **Pass B** (2026-09-15 — OBS 3D sea+terrain). Re-tick only if a later Fail.

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
| Picture | Same as A/E–I (3D has sea + terrain) | Black; studio HUD |
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

## Suggested order on the studio PC

1. Listeners up. SRT AR+3D+2D on. NDI off.
2. **E** AR 1080 vs 2K.
3. **F** AR no world + freeze / Follow.
4. **G** layer bar vs both OBS.
5. **H** Control 3D program.
6. **I** 2D centroid / boat / zoom (needs live boats for icons + buttons).
7. **A** fps with all three still on.
8. **B** only if 3D world looks wrong after H.
9. **C/D** when a second PC / URL change is available.

---

## Report to BW

| Test | Pass / Fail | Notes |
| --- | --- | --- |
| E AR 1080 | | crop vs scale |
| F AR freeze | | Cesium? wander? Follow after GPS? |
| G visibility | | 3D hulls vs AR tags |
| H 3D program | | latch off/on/off; damping; Frame boats |
| I 2D cam | | boats; zoom match; freeze empty |
| A 30×3 | | encoder, OBS fps ×3 |
| B 3D world | Pass 2026-09-15 | regression only |
| C LAN | | receiver IP, channels |
| D URL field | | |

Then **BW**. New worker only on Fail. 22.3 VPS only after **A**. Fan-out / MediaMTX only if **C** Pass and two listeners are required.
