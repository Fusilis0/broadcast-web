# Electron + alpha NDI — product contract (path A)

**Status:** Phase **7.3b done** (code) — human vMix/OBS alpha check pending  
**Owner:** OUT (+ PLT packaging later)  
**Dispatch:** `DSP-OUT-20260731-05` (archived)  
**Locks:** [`../ops/ndi-path-evaluation.md`](../ops/ndi-path-evaluation.md) (BW: end-state **A + alpha**); C closed [`../ops/ndi-c-spike-runbook.md`](../ops/ndi-c-spike-runbook.md)

## 1. End-state (full product air)

| Item | Contract |
| --- | --- |
| Shell | **Electron** studio app around the existing SPA (not an Electron rewrite of the product) |
| NDI | Named NDI source owned by us (Unity-like: one stable name in vMix) |
| Keying | **Alpha channel** — transparent clear + opaque AR; vMix ingests as alpha source |
| Not production NDI | Green-key / chroma plate over NDI |
| Default product | Browser SPA remains default (Hetzner / Chrome). Electron is the **studio** path |
| Interim air | Chrome + `outputMode=chroma` + window capture ([`../ops/air-runbook.md`](../ops/air-runbook.md)) until production cutover |

### vMix

- Add **NDI** input → select the published studio name (default **`broadcast-web`** → `HOSTNAME (broadcast-web)`).
- Use the source as an **alpha** layer (straight alpha from BGRA send).
- **Do not** apply Chroma Key green-remove on the production NDI input.
- Chroma key remains only for interim Chrome window capture.
- Checklist: [`../ops/vmix-ndi-alpha-runbook.md`](../ops/vmix-ndi-alpha-runbook.md).

## 2. Clear / compositing modes

| Path | Clear | Alpha | Studio use |
| --- | --- | --- | --- |
| Chrome air (interim) | Solid green `#00ff00` (`outputMode=chroma`) | Opaque plate | Window capture → chroma key in OBS/vMix |
| Ops preview | Dark `#1a1a1a` (`outputMode=preview`) | Opaque | Local ops; optional WHEP underlay |
| **NDI production (A)** | Transparent plate (`outputMode=transparent`) | **Alpha out** | Electron → NDI BGRA |

Contrast: chroma is an **opaque keyed plate** for capture tools that cannot take alpha. NDI path **A** clears to **transparent** so only AR (boats, course, overlays, visual timecode) has coverage; empty sky/sea is alpha = 0.

Timecode stays burned into the **same** WebGL canvas (NearestFilter) so NDI frames keep barcode sharpness.

## 3. Frame path (implemented)

```
┌─────────────────────────────────────────────────────────────┐
│ Electron renderer                                            │
│   SPA → Three.js WebGL (transparent clear + AR + timecode)   │
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
| Alpha | Straight (WebGL clear α=0; opaque draws α=1) |
| Bridge | `window.broadcastStudio` (preload) |

Latency soft target vs window capture remains an ops judgment for cutover (7.6).

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
| Changing default Chrome air away from chroma | Interim air unchanged until cutover |
| Full electron-builder release channel | Spike shell + send only |
| GPU zero-copy | CPU readback acceptable for 7.3b |
| 5.4 egress, 6.4 DB | Separate tracks |

## 6. Acceptance for production cutover (7.6 — not this slice)

- Named NDI source stable in vMix
- Alpha composite (no green key on NDI input)
- 8×8 timecode sharp after NDI
- Latency acceptable vs chroma window capture
- Chroma + Chrome remains documented fallback

## Related

| Doc | Role |
| --- | --- |
| [`../ops/ndi-path-evaluation.md`](../ops/ndi-path-evaluation.md) | A/B/C scores; BW lock A + alpha |
| [`../ops/ndi-c-spike-runbook.md`](../ops/ndi-c-spike-runbook.md) | 7.1 C closed — fail for production NDI |
| [`../ops/vmix-ndi-alpha-runbook.md`](../ops/vmix-ndi-alpha-runbook.md) | Alpha ingest checklist |
| [`../ops/air-runbook.md`](../ops/air-runbook.md) | Interim chroma air |
| [`../../desktop/README.md`](../../desktop/README.md) | How to run the studio shell + NDI |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, timecode, WHEP, frame pump |
| [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) | Phase 7.3 |
