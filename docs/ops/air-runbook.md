# Air runbook — preferred studio path + chroma fallback

End-to-end ops for putting **broadcast-web on air**.

| Path | Role | How |
| --- | --- | --- |
| **Electron + alpha NDI** | **Preferred** studio air (Phase **7.6**) | `desktop/` shell → named NDI `broadcast-web` → vMix/OBS as **alpha** layer (`outputMode=transparent`) |
| **Chrome + chroma** | **Fallback** | Fullscreen Chrome → green clear → OBS/vMix window capture → chroma key |

**AR NDI FourCC (2026-09-06):** `broadcast-web` is **UYVY** (opaque program — sim + SRT merged in-app). Do **not** expect alpha key on that input. 3D/2D were already UYVY. Historical alpha ingest below is the 2026-07-31 Pass, not the live send.  
**Air framing:** NDI / transparent plate = **active POV** only (Fleet **Cam** / keys `1–4`). Ops free cam (`view=free`) may move the on-screen preview; NDI dual-renders active POV and must **not** follow free look.  
Shell run notes: [`../../desktop/README.md`](../../desktop/README.md). Contract: [`../architecture/ndi-alpha-electron.md`](../architecture/ndi-alpha-electron.md). Path scores: [`ndi-path-evaluation.md`](./ndi-path-evaluation.md).

This doc absorbs the Phase **3.5** studio chroma checklist ([`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md)). Milestone **C** (chroma) passed 2026-07-30; alpha NDI is now the preferred studio path.

## Non-goals

- Deploying to Hetzner from this checklist (see [`hetzner-static-deploy.md`](./hetzner-static-deploy.md))
- Installing WSS/proxy TLS on a VPS (see [`wss-live-telemetry.md`](./wss-live-telemetry.md))
- In-browser NDI, Electron SPA rewrite, or path **B** helper
- Killing the chroma code path (fallback stays supported)
- electron-builder / installer polish

---

## Preferred — Electron + alpha NDI

### Prerequisites

| Item | Notes |
| --- | --- |
| Studio PC | Electron shell + **vMix or OBS** on the **same LAN** (typically same machine) |
| App source | Local Vite (`npm run dev`) **or** `npm run build` + `npm run desktop:file` |
| Clear mode | **`outputMode=transparent`** (alpha 0 plate; opaque AR). Visual timecode burn-in is **off** by default (Phase 19.1); restore with `timecodeEnabled: true`. |
| NDI runtime | Bundled with `grandi` / NDI Tools on the studio PC |
| Source name | Default AR **`broadcast-web`** (~30 fps) → `HOSTNAME (broadcast-web)`; continuous 3D **`broadcast-web-3d`** (~30 fps); 2D **`broadcast-web-2d`** (~30 fps, **default on** — uncheck in NDI tab to stop only 2D) |

### Steps — preferred path

1. From repo root (once): `npm install` and `npm install --prefix desktop`.
2. **Dev:** terminal 1 → `npm run dev`. Terminal 2 → `npm run desktop:dev`.  
   **File build:** `npm run build` then `npm run desktop:file`.
3. Load transparent plate (URL or OUT control):
   ```text
   http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent
   ```
   Or set `BROADCAST_WEB_URL` before `desktop:dev` (see desktop README).
4. Confirm NDI name (override: `BROADCAST_NDI_NAME` / `--ndi-name=`). Disable only for shell debug: `--no-ndi`.
4b. **GPU:** shell defaults to high-performance (discrete) preference. Check the Electron console for
   `GPU preference:` / `GPU info`. If Task Manager still shows the iGPU, set
   `desktop\node_modules\electron\dist\electron.exe` → **High performance** in Windows Graphics
   settings (and NVIDIA Control Panel if present). Details: [`../desktop/README.md`](../../desktop/README.md) § GPU.
5. In **vMix** (or OBS): **Add Input → NDI** → select `… (broadcast-web)` (AR, **opaque UYVY**).
6. Place on a layer. This input is a finished picture (in-app composite). Do **not** expect see-through alpha.
7. **Do not** enable Chroma Key / Colour Key on this NDI input.
8. Confirm: empty sky/sea see-through; boats/course/overlays opaque. Bottom-right corner is **clean** by default (no 8×8 barcode). Restore the burn-in with `"timecodeEnabled": true` in `config.json` or the race pack `output`.
9. **Second source (3D):** Add another NDI input → `… (broadcast-web-3d)`. Expect an **opaque** plate of the same active-POV scene (sea/sky when Ops environment = `realistic` / `?env=realistic`). It must match the in-app 3D view — **no green/purple vertical stripes** (those mean UYVY bytes shown as RGB). AR and 3D are both **UYVY**. It must keep updating while you look at free-cam / sidebar — same air lock as AR.
10. **Water/shore cue:** a localized semi-transparent pad under the course AABB may show on the AR plate — that is expected (Phase 8.8). Empty areas outside the pad must stay see-through. Tune opacities in `WATER_CUE_DEFAULTS` if the pad is too heavy ([`unity-asset-port.md`](./unity-asset-port.md)).
11. **Active cam lock:** switch Fleet **Cam** / POV (`1–4`) → both AR and 3D NDI framing follow that drone. If ops free cam is on screen, NDI must still match the **active** cam (not the free look).
12. **Overlay clutter:** there is **no** PiP minimap card over 3D/AR (Phase 19.2). Stream map is a DOM canvas — it does **not** appear on Electron **AR/3D** NDI (WebGL readback only). NDI source **`broadcast-web-2d`** carries the race map (1920×1080, 16:9 filled) at boot (default **on** @ ~30 fps). Uncheck the NDI-tab **2D** toggle to stop only that sender. Local **2D** on the channel switcher shows the same map full-screen.
13. **Ops NDI tab:** open the left sidebar **NDI** section. Confirm **AR**, **3D**, and **2D** status **live**, source names match the switcher, SDK version populated, **Active POV** matches Fleet Cam, Error rows hidden. **2D** toggle starts/stops **only** that sender (AR/3D stay on). Collapsing the sidebar must not change AR/3D or blank 2D NDI. Chrome/Vite-only: tab shows **unavailable** (expected — no studio bridge).
14. **Local view switcher (Phase 13.5):** top-center **2D / 3D / AR** buttons change only the operator’s on-screen preview. **AR** = WebGL with `outputMode` clear (transparent plate when `transparent`). **3D** = opaque WebGL (sea/sky when realistic). **2D** = full-screen race map (PiP card removed). Switching must **not** stop NDI — confirm AR/3D/2D stay **live** in the NDI tab and in vMix while you click through all three (uncheck 2D in the NDI tab to stop only that sender). The Ops **output** dropdown is still AR clear only (`preview` / `chroma` / `transparent`); it is a different axis from the local switcher.
15. **NDI delay (Phase 13.6, optional):** each channel has a **Delay** ms input (0–30000) in the NDI tab. Leave at **0** unless you need to time-align against a delayed camera — default allocates **no** RAM ring. Above **3000 ms** the tab warns **high memory** (still allowed). At 1080p30, 30 s ≈ **~7.5 GB per channel**. Shrinking delay drops buffered frames. Optional boot seed: `outputDelayMs.{ar,3d,2d}` in `config.json`.
16. **UI FPS dials (Studio 30 Send):** on-screen WebGL preview is **rAF** when the studio window is visible (Ops HUD **preview** — expect ~60, must stay ≥30). NDI Send **AR ~30 / 3D ~30 / 2D ~30**, all on. **Live AR/3D readback is WebGL2 PBO**; yellow **SYNC READBACK** on the NDI tab means the studio fell off PBO (broken — report, do not “set preview 60”). `studio:tick` is **60 Hz**. 2D pixel grab is deferred off that tick. Send shows a number while frames go out (**0 fps** if Status is live but nothing sent). Empty **course/boats on local 2D** is scene content (SCN), not a missing 2D NDI sender. Low Task Manager GPU % with hitch means the **JS thread** is blocked — do **not** uncheck 2D as the fix. Minimized studio still sends NDI. If hitch/s explodes, report numbers — do not silently drop a channel.
17. **Cesium ion terrain (Phase 14.1):** Ops **terrain** defaults **off**. Paste the Unity ion token into Ops **ion token** and **Apply** (studio app writes `public/config.json` — **commit that** so git shares it). Chrome-only: session until you paste the same field into `public/config.json` and commit. Empty token → terrain stays off with an Ops status line. When on, World Terrain is **opaque/3D only** (same gate as sea/sky). Attribution is a **DOM** credit on local **3D** focus and in Ops — it must **not** appear on the AR/chroma plate (not burned into WebGL). Residual height: Ops **nudge m**. **Lock tiles** once the shot is framed. Do not upload a filled token to a public Hetzner SPA.
18. **AR video underlay + SRT (Phase 17.2):** Output **AR background → video** unmounts ocean/sky/terrain on the AR plate automatically (you do **not** also pick transparent). 3D NDI still has env. Fleet: one **SRT template** next to the WS bases (`{srtId}` in both `cam` and `pub` slots); per-drone **SRT id** beside the telemetry id (they are different numbers — e.g. telem `5` / SRT `30`); **Video** is independent of Live WS. **Connect SRT** (Electron). Paste the relay token only in the template field — it is **session-only**; Save redacts it from the pack. Enable **Sync debug** in Output (off by default, DOM-only, never on NDI).

Full ingest detail: [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md).

### Manual checklist — NDI = active POV

- [ ] Electron studio; AR NDI source live in vMix/OBS as **opaque UYVY** (not keyed alpha)
- [ ] Second NDI input `broadcast-web-3d` live (opaque; env when realistic on)
- [ ] Switch active POV (Fleet **Cam** or `1–4`) → AR and 3D perspective change together
- [ ] HUD **view=free** (orbit) → on-screen preview moves; AR + 3D framing stay on active POV
- [ ] HUD **view=follow** → screen matches active POV again (same as NDI)
- [ ] AR NDI is opaque UYVY (finished in-app picture, not a keyed plate)
- [ ] Sidebar **NDI** tab: AR + 3D live, source/SDK/Active POV match air; collapse sidebar → NDI unchanged
- [ ] Local **2D / 3D / AR** switcher: each button updates the window; NDI tab stays live for AR/3D
- [ ] With defaults (AR/3D/2D ~30), ops sidebar remains usable while NDI is live
- [ ] Visible studio: Ops HUD **preview** fps is not stuck at 30 (rAF path). NDI AR/3D/2D Send ~30 in vMix. Park/minimize: NDI keeps sending

### Studio NDI smoke (Phase 10.3)

Runnable gate for cutover. Ingest in **vMix**, **OBS**, or **NDI Studio Monitor** (same LAN / same PC). Stream map stays **off the AR plate** — there is no HUD PiP; confirm map on **`broadcast-web-2d`** instead (`HO-SCN-OUT-20260804-01` / Phase 13.4 / 19.2).

| # | Check | Pass when |
| --- | --- | --- |
| 1 | Boot | Vite + `desktop:dev` (or `build` + `desktop:file`); URL has `outputMode=transparent` + race pack |
| 2 | Source live | Switcher/Studio Monitor shows `HOSTNAME (broadcast-web)` (or override); ~30 fps; **1920×1080** |
| 3 | Alpha plate | Empty sky/sea see-through; boats/course/overlays opaque; **no** chroma key on NDI input; bottom-right **clean** (barcode off unless `timecodeEnabled: true`) |
| 4 | POV → NDI | Fleet **Cam** / keys `1–4` changes NDI framing to that drone |
| 5 | Free cam ≠ NDI | HUD **view=free** → Electron window orbits; NDI stays on active POV |
| 6 | Follow sync | HUD **view=follow** → window matches NDI again |
| 7 | Stream map off AR | No minimap card over 3D/AR; enable **2D** NDI toggle → **`broadcast-web-2d`** fills 16:9; local **2D** still shows the map full-screen |
| 8 | NDI controller tab | Sidebar **NDI**: AR + 3D + 2D live + matching source/SDK/Active POV; 2D toggle **on** by default; off → 2D idle, AR/3D still live; collapse rail → AR unchanged / 2D not blank when on |
| 9 | Local view switcher | Top **2D / 3D / AR** buttons change only the window; NDI tab stays live for AR/3D |
| 10 | UI FPS dials | With defaults (all three ~30 fps), sidebar/menu stays draggable while NDI is live |
| 11 | Preview 60 | Visible studio HUD **preview** is ~display refresh (not hard-capped 30). AR/3D/2D NDI ~30. Park/minimize: NDI still updates |
**Fail / blocker notes:** if Electron, NDI Tools, or switcher missing on the machine, record **Blocker** (not Pass) with what was unavailable. Unit tests for dual-render do **not** replace this smoke.

#### Results — DSP-OUT-20260804-01

| Field | Value |
| --- | --- |
| Date | 2026-08-04 |
| Operator | WORKER(DSP-OUT-20260804-01) on `DESKTOP-264DNL1` |
| Ingest | NDI Studio Monitor available; frame verify via `grandi` receive (vMix not installed) |
| Shell mode | `desktop:dev` + Vite; `?race=demo-istanbul&outputMode=transparent` |
| NDI name seen | `DESKTOP-264DNL1 (broadcast-web)` |
| Checks 1–7 | 1 boot ✓ · 2 source 1920×1080 ✓ · 3 alpha + clean bottom-right (barcode off) ✓ · 4 POV 1↔2 changes NDI ✓ · 5 free cam upright active-POV (dual-render) ✓ · 6 follow sync ✓ · 7 stream map off / DOM-only ✓ |
| Pass / fail | **Pass** |
| Notes / blockers | vMix absent — Studio Monitor + `grandi` receive used. P0 fix: air-target readback used wrong `bottomUp` (free-cam dual-render flipped NDI); corrected in `ndiFramePump.ts`. |
| `git log -1` (optional) | `36871e2` (pre-fix tip; smoke on dirty tree with pump fix) |

### Park / tray (do not OS-minimize)

Windows OS minimize freezes WebGL. The shell **parks** off-screen instead:

1. Minimize or ✕ → window parks; NDI keeps ~30 fps at **1920×1080**
2. System tray → **Show studio** (or double-click) to restore
3. Tray → **Quit** to exit (✕ alone does not quit while NDI is on)

---

## Cutover checklist (path A vs Unity / Chrome)

Use before a show that runs **broadcast-web** as the AR NDI layer.

### Pre-show

- [ ] Repo ready: `npm install` + `npm install --prefix desktop` (once per machine)
- [ ] Start path: **Vite + `desktop:dev`** *or* **`build` + `desktop:file`**
- [ ] SPA in **`outputMode=transparent`** (not `chroma`, not `preview` for air)
- [ ] Race pack loaded if needed (`?race=demo-istanbul` or show pack). If WAN/`public/races` may be missing on air PC: HUD **Pack ↓** on studio, then **Pack ↑** (or cached `?race=`) — [`venue-pack.md`](./venue-pack.md)
- [ ] NDI name visible in vMix/OBS: `HOSTNAME (broadcast-web)` (or override)
- [ ] vMix/OBS NDI input selected; layer above plate; **no** chroma key on NDI
- [ ] Alpha OK (see-through empty); AR opaque; bottom-right **clean** (no barcode unless pack/config sets `timecodeEnabled: true`)
- [ ] Know park/tray restore (do not rely on OS minimize)
- [ ] Fallback ready: Chrome + chroma steps below (bookmark this runbook)

### Parallel with Unity NDI

Until BW + studio explicitly OK dropping Unity:

- [ ] Keep Unity NDI input available in the switcher (muted / off-air)
- [ ] Prefer broadcast-web `broadcast-web` source on program when path A is clean
- [ ] Do not remove Unity from the show template until cutover is signed off

### Rollback

If NDI missing, alpha wrong, freeze, or latency unacceptable:

1. Stop relying on the Electron NDI input (mute / remove from program).
2. Switch to **Chrome + chroma** path below (same machine capture + green key).
3. Optional: fall back to **Unity NDI** if still in parallel.

Rollback target = this runbook’s **Fallback** section (not green-key on the Electron NDI source).

### Post-show / gate notes

| Gate | Owner |
| --- | --- |
| Drop Unity from show template | BW + studio explicit OK (Phase **5.6**) |
| Prefer Electron NDI for studio shows | OUT docs + human Pass (done 2026-07-31); ops follow preferred path |
| Keep chroma code / docs | Always — fallback |

---

## Fallback — Chrome + chroma

Use when NDI is unavailable or alpha looks wrong. Solid green clear → window capture → chroma key.

### Prerequisites

| Item | Notes |
| --- | --- |
| Studio PC | **Chrome** + **OBS or vMix** on the **same machine** as capture |
| App source | Local `npm run dev` **or** hosted HTTPS SPA URL after static deploy smoke |
| Compositor | OBS (chroma key) or vMix (chroma key) |
| Telemetry default | **mock** or **replay** is enough for air; live is optional |
| Config | Committed `public/config.json` may stay `"outputMode": "preview"` — set chroma per session |

### Choose URL: local vs hosted

#### A — Local (dev)

```bash
npm install
npm run dev
```

Open the printed URL in **Chrome** (usually `http://localhost:5173` or `http://127.0.0.1:5173`).

Optional production-build check on the same PC:

```bash
npm run build
npm run preview
```

#### B — Hosted (Hetzner / static SPA)

```text
https://YOUR_SPA_DOMAIN/
https://YOUR_SPA_DOMAIN/?race=demo-istanbul
https://YOUR_SPA_DOMAIN/?race=demo-istanbul&outputMode=chroma
```

Full deploy steps: [`hetzner-static-deploy.md`](./hetzner-static-deploy.md). Hosted URL can replace `npm run dev` once smoke items 1–5 there pass.

**Same-PC rule still applies for capture:** Chrome and OBS/vMix must run on the studio PC that captures the window.

### Race pack

```text
http://127.0.0.1:5173/?race=demo-istanbul
https://YOUR_SPA_DOMAIN/?race=demo-istanbul
```

Confirm fleet/course fixtures resolve (`/races/<id>/project.json` → 200). Miss → warn + `config.json` boot (see deeplink / race-project contracts).

### Steps — chroma on air

1. Open the **local or hosted** URL in **Google Chrome**.
2. Optional sanity: leave **preview** — dark clear (`#1a1a1a`), boats/course when the mock camera looks at the fleet, HUD/map.
3. Prefer **fullscreen** Chrome on the output monitor (F11 or OS fullscreen). Hide other windows over the WebGL area.
4. Set **chroma** for this session (any one):
   - Runtime OUT **output** control → `chroma`, **or**
   - Query `?outputMode=chroma` (with other params as needed), **or**
   - Session config `"outputMode": "chroma"` then reload  
   Do **not** require committing chroma as the repo default.
5. Confirm clear is **solid green** behind AR (boats / course / overlays). Green = `#00ff00` / RGB `(0, 255, 0)`. Optional override: `chromaKey` in config. The mild water/shore pad under the course is AR (keyed out only if you over-key); green outside the pad must stay clean.
6. In **OBS** or **vMix** (same PC):
   - **OBS:** Add **Window Capture** (or Display Capture / region) → select the **Chrome** window covering the WebGL view → filter **Chroma Key** → key colour green `#00ff00`.
   - **vMix:** **Add Input** → **Window Capture** (or Screen / region) → select **Chrome** → apply **Chroma Key** → green `#00ff00`.
7. Put a background under the keyed layer (camera, clip, or colour bars) so you can see the composite.
8. Confirm AR composites cleanly. Bottom-right is **clean** by default (Phase 19.1). To restore the 8×8 barcode: `"timecodeEnabled": true` in `config.json` or race pack `output` (corner **bottom-right**, ~96 px — blocky / nearest, not soft).

### Expected defaults (chroma)

| Item | Value |
| --- | --- |
| Preview clear | `#1a1a1a` / `0x1a1a1a` |
| Chroma clear (default key) | `#00ff00` / RGB `(0, 255, 0)` / `0x00ff00` |
| Optional override | `chromaKey` in config |
| Timecode | default **off** (`timecodeEnabled: false`); set `true` to restore; corner `bottom-right`; size `96` px |
| Timecode encode | Unity 8×8 LSB; bit 0 bottom-left; NearestFilter |
| Telemetry for air | default **mock** (or **replay**) is enough |
| `whepUrl` | can stay empty; underlay is **stopped in chroma** (keeps green clean) |

### Optional — live telemetry (WSS)

Mock/replay need no WebSockets. For **live** on an **HTTPS** hosted page, browsers block `ws://` (mixed content). Use **`wss://`**. Full runbook: [`wss-live-telemetry.md`](./wss-live-telemetry.md).

```text
https://YOUR_SPA_DOMAIN/?race=demo-istanbul&mode=live&outputMode=chroma
```

WS URLs come from host `config.json` / `VITE_WS_*`, not from deeplink query params. Empty `wsUrl` → live idles (warn, no crash). Local `http://localhost` may use `ws://` or `wss://`.

### Pass / fail checklist (chroma fallback)

- [ ] App loads (local or hosted); race pack optional but recommended (`?race=demo-istanbul`)
- [ ] Chroma clear is pure green (no sky / dark / WHEP bleed in keyed areas)
- [ ] OBS or vMix keys cleanly (minimal spill / hole-punch on green)
- [ ] AR overlays readable after key
- [ ] Visual timecode **absent** by default (bottom-right clean). If `timecodeEnabled: true`, barcode visible, pointy / nearest (not smeared), bottom-right
- [ ] Chrome + compositor on the **same** PC

### Results (human fills after studio / air)

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| Path used (Electron NDI / Chrome chroma) | |
| URL or shell mode (dev / file / hosted) | |
| Capture / ingest (NDI name or OBS/vMix window) | |
| Pass / fail | |
| Notes | |
| Screenshot paths (optional) | |
| `git log -1` on studio PC (optional) | |

### Historical — Milestone C (Phase 3.5 chroma)

| Field | Value |
| --- | --- |
| Date | 2026-07-30 |
| Operator | Fusilis (studio PC) |
| Pass / fail | **Pass** |
| Notes | OBS window capture + chroma key. Output must be `chroma` (not `preview`) for green clear. Milestone C met. |
| Accepted | BW / OUT 2026-07-30 — Phase 3.5 closed |

### Historical — alpha NDI Pass (Phase 7.3 / 7.4)

| Field | Value |
| --- | --- |
| Date | 2026-07-31 |
| Pass / fail | **Pass** |
| Record | [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md) Results |
| Notes | 1080p lock; park-on-minimize; source `DESKTOP-264DNL1 (broadcast-web)` |

---

## AR video sync commissioning (Phase 17)

**Good:** Output **AR background = video**, local focus **AR**, realistic env unmounted (sea is in the picture). Sync debug **off** for air; turn it **on** only in the Output rail (it is never burned into NDI). Presented PTS resolves to NTP with mode **interpolated** (or short **extrapolated**), latency sits inside **100–400 ms** without a pin, `pacing` climbs, `slope ≈ 1`, FREE-RUN is **absent**, overlay sits on the boats.

Paste the relay token only in Fleet **SRT template** (session). Per-row **SRT id** is the camera number on the wire; telemetry id is a different field. Empty SRT id → Connect SRT skips that row.

| Badge | Meaning | What to do |
| --- | --- | --- |
| **FREE-RUN** | No `stream_anchor` pacing samples for this SRT id — video is unmatched, pose is "now" | Confirm LUT key = SRT id (not telem id). Check the producer is sending `stream_anchor` on the same id. Do not trust overlay alignment until this clears |
| **EXTRAPOLATING** | Presented PTS is past the last pacing anchor (live is supposed to do this a little) | If `extra` ≫ 2 s the fit is stale — check anchor rate / last-anchor age. Short extra with `slope ≈ 1` is normal |
| **CLAMP PINNED** | Adaptive latency hit the **100 ms** floor or **400 ms** ceiling | Floor: decoder/network jitter; wait or check SRT bitrate. Ceiling: telemetry stall — pose buffer is not covering the frame; do not let it walk further. Fix ingest, then trim |
| **POSE STALE** | Drone sample age &gt; 2 s at presented NTP | Live WS for that telem id not delivering; Connect live on the **telemetry** id (not the SRT id) |
| **BOAT HELD** | Boat DR held because `brg === 0` (bearing unknown) or still | Expected when parked / GPS hole. If a moving boat is held, the producer sent `brg = 0` — do not invent north |

**Trim** on this panel is read-only (`syncTrimMs`, CAL). Overlay lags the picture → raise trim; overlay leads → lower. Range ±500 ms, step 5.

Decoder counters stay **—** until OUT-06 wires them. Pose/boat rows stay **—** until TEL-08 drives `sampleAt`.

---

## Related

| Doc | Role |
| --- | --- |
| [`../../desktop/README.md`](../../desktop/README.md) | Studio Electron shell + NDI send |
| [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md) | vMix/OBS alpha NDI ingest (human Pass) |
| [`../architecture/ndi-alpha-electron.md`](../architecture/ndi-alpha-electron.md) | Path A product contract |
| [`ndi-path-evaluation.md`](./ndi-path-evaluation.md) | A/B/C scores; BW lock A + alpha |
| [`egress-webrtc-srt-evaluation.md`](./egress-webrtc-srt-evaluation.md) | Phase 5.4 — WebRTC/SRT egress scores; defer app egress; prefer compositor program out |
| [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md) | Phase 3.5 experiment record (chroma) |
| [`ndi-c-spike-runbook.md`](./ndi-c-spike-runbook.md) | Phase 7.1 path C trial (closed; not production NDI) |
| [`hetzner-static-deploy.md`](./hetzner-static-deploy.md) | Static SPA build / upload / TLS / smoke |
| [`wss-live-telemetry.md`](./wss-live-telemetry.md) | Live mode over `wss://` on HTTPS |
| [`../../src/output/README.md`](../../src/output/README.md) | OUT clear modes, timecode, WHEP, frame pump |
| Roadmap Phase 5.3 / 5.4 / 7.6 | [`docs/roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) |
