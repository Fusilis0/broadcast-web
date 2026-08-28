# Electron + alpha NDI — product contract (path A)

**Status:** Phase **7.6** — cutover docs ready (preferred studio air = Electron + alpha NDI; chroma = fallback)  
**Owner:** OUT (+ PLT packaging later)  
**Dispatch:** `DSP-OUT-20260731-06` (cutover); code via `05` (archived)  
**Locks:** [`../ops/ndi-path-evaluation.md`](../ops/ndi-path-evaluation.md) (BW: end-state **A + alpha**); human Pass [`../ops/vmix-ndi-alpha-runbook.md`](../ops/vmix-ndi-alpha-runbook.md); C closed [`../ops/ndi-c-spike-runbook.md`](../ops/ndi-c-spike-runbook.md)

## 1. End-state (full product air)

| Item | Contract |
| --- | --- |
| Shell | **Electron** studio app around the existing SPA (not an Electron rewrite of the product) |
| NDI | Named NDI source owned by us (Unity-like: one stable name in vMix) |
| Keying | **Alpha channel** — transparent clear + opaque AR; vMix ingests as alpha source |
| Not production NDI | Green-key / chroma plate over NDI |
| Default product | Browser SPA remains default (Hetzner / Chrome). Electron is the **studio** path |
| Fallback air | Chrome + `outputMode=chroma` + window capture ([`../ops/air-runbook.md`](../ops/air-runbook.md) § Fallback) |

### vMix

- Add **NDI** input → select the published studio name (default **`broadcast-web`** → `HOSTNAME (broadcast-web)`).
- Use the source as an **alpha** layer (straight alpha from BGRA send).
- **Do not** apply Chroma Key green-remove on the production NDI input.
- Chroma key remains only for the Chrome window-capture **fallback**.
- Checklist: [`../ops/vmix-ndi-alpha-runbook.md`](../ops/vmix-ndi-alpha-runbook.md).

## 2. Clear / compositing modes

AR has **two** contracts. `alpha` is the default and the documented fallback (L1 /
`arBackground`). `video` is an operator-selected mode, not a replacement.

| Path | Clear | Alpha | Studio use |
| --- | --- | --- | --- |
| Chrome air (fallback) | Solid green `#00ff00` (`outputMode=chroma`) | Opaque plate | Window capture → chroma key in OBS/vMix |
| Ops preview | Dark `#1a1a1a` (`outputMode=preview`) | Opaque | Local ops; optional WHEP underlay |
| **NDI production (A) — `arBackground: alpha`** | Transparent plate (`outputMode=transparent`) | **Alpha out** | Electron → NDI BGRA; vMix keys AR over camera |
| **NDI production (A) — `arBackground: video`** | In-WebGL fullscreen texture, then AR, then timecode | **Opaque program** | Electron → NDI BGRA already composited; no vMix key |

Contrast: chroma is an **opaque keyed plate** for capture tools that cannot take alpha. NDI path **A** in `alpha` mode clears to **transparent** so only AR (boats, course, overlays, visual timecode) has coverage; empty sky/sea is alpha = 0. In `video` mode the compositor draws the texture *inside* the WebGL pass (before the scene) so the AR NDI FBO readback includes it — a DOM `<video>` never would.

Missing / unknown `arBackground` → `alpha` (today's behaviour). Switch the mode back to `alpha` if the in-app composite fails; there is no dual-send channel.

Timecode stays burned into the **same** WebGL canvas (NearestFilter) so NDI frames keep barcode sharpness — it draws **after** both background and scene.

## 3. Frame path (implemented)

```
┌─────────────────────────────────────────────────────────────┐
│ Electron renderer                                            │
│   SPA → Three.js WebGL (alpha plate *or* in-WebGL video bg + AR + timecode)   │
│   startNdiFramePump: gl.readPixels RGBA (after timecode)     │
└────────────────────────────┬────────────────────────────────┘
                             │ IPC (ndi:frame)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Electron main (`desktop/ndiSender.cjs`)                      │
│   RGBA → top-down BGRA → grandi.send / sender.video          │
│   Default name: broadcast-web                                │
└────────────────────────────┬────────────────────────────────┘
                             │ LAN
                             ▼
                      vMix NDI input (alpha)
```

| Item | Choice |
| --- | --- |
| Binding | [`grandi`](https://www.npmjs.com/package/grandi) ^2.0 (NDI SDK 6.x via Node-API) |
| Format | Progressive **BGRA**, ~30 fps (CPU readback; drop-if-busy) |
| Resolution | **1920×1080** locked drawing buffer (independent of window size) |
| Minimized | NDI must keep sending (Electron background-throttle off + interval clock) |
| Alpha | Straight (WebGL clear α=0; opaque draws α=1) |
| Bridge | `window.broadcastStudio` (preload) |
| Air camera | **Active POV only** (`getActivePovCamera`). Ops free cam may preview on screen; NDI dual-renders air when cameras differ. |

Latency soft target vs window capture: ops judgment recorded **Pass** (2026-07-31); see cutover checklist in air-runbook.

## 4. Studio shell

App under [`../../desktop/`](../../desktop/):

- Loads local Vite URL in **dev**, or built `dist/` in **file** mode.
- Main process owns NDI; renderer only readbacks + IPC.
- Browser SPA remains the default `npm run dev` product; use `npm run desktop:dev` for the studio path.

Run details: [`../../desktop/README.md`](../../desktop/README.md).

## 5. Non-goals (still later)

| Out of scope | Why |
| --- | --- |
| Path **B** helper | Skip unless A blocked |
| Removing Chrome chroma path | Fallback stays documented and supported |
| Full electron-builder release channel | Spike shell + send only |
| GPU zero-copy | CPU readback acceptable for 7.3b |
| 5.4 egress, 6.4 DB | Separate tracks |

## 6. Production cutover (7.6)

Cutover docs ready — ops checklist in [`../ops/air-runbook.md`](../ops/air-runbook.md) (preferred path + cutover + chroma fallback).

| Criterion | Status |
| --- | --- |
| Named NDI source stable in vMix | **Pass** (human, 2026-07-31) |
| Alpha composite (no green key on NDI input) | **Pass** |
| 8×8 timecode sharp after NDI | **Pass** |
| Latency acceptable vs chroma window capture | **Pass** (ops judgment) |
| Chroma + Chrome remains documented fallback | **Yes** (air-runbook § Fallback) |
| Drop Unity from show template | **Open** — BW + studio (Phase 5.6) |

## Related

| Doc | Role |
| --- | --- |
| [`../ops/ndi-path-evaluation.md`](../ops/ndi-path-evaluation.md) | A/B/C scores; BW lock A + alpha |
| [`../ops/ndi-c-spike-runbook.md`](../ops/ndi-c-spike-runbook.md) | 7.1 C closed — fail for production NDI |
| [`../ops/vmix-ndi-alpha-runbook.md`](../ops/vmix-ndi-alpha-runbook.md) | Alpha ingest checklist + human Pass |
| [`../ops/air-runbook.md`](../ops/air-runbook.md) | Preferred Electron NDI + cutover + chroma fallback |
| [`../../desktop/README.md`](../../desktop/README.md) | How to run the studio shell + NDI |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, timecode, WHEP, frame pump |
| [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) | Phase 7.3 / 7.6 |
