# Electron + alpha NDI — product contract (path A)

**Status:** Phase **7.3a done** (contract + Electron shell); **7.3b** = transparent + NDI send (`DSP-OUT-20260731-05`)  
**Owner:** OUT (+ PLT packaging later)  
**Dispatch:** `DSP-OUT-20260731-04` (done) → `DSP-OUT-20260731-05` (active)  
**Locks:** [`../ops/ndi-path-evaluation.md`](../ops/ndi-path-evaluation.md) (BW: end-state **A + alpha**); C closed [`../ops/ndi-c-spike-runbook.md`](../ops/ndi-c-spike-runbook.md)

## 1. End-state (full product air)

| Item | Contract |
| --- | --- |
| Shell | **Electron** studio app around the existing SPA (not an Electron rewrite of the product) |
| NDI | Named NDI source owned by us (Unity-like: one stable name in vMix) |
| Keying | **Alpha channel** — transparent clear + opaque AR; vMix ingests as alpha source |
| Not production NDI | Green-key / chroma plate over NDI |
| Default product | Browser SPA remains default (Hetzner / Chrome). Electron is the **studio** path |
| Interim air | Chrome + `outputMode=chroma` + window capture ([`../ops/air-runbook.md`](../ops/air-runbook.md)) until this path ships |

### vMix

- Add **NDI** input → select the published studio name.
- Use the source as an **alpha** layer (premultiplied or straight per SDK choice in a later slice).
- **Do not** apply Chroma Key green-remove on the production NDI input.
- Chroma key remains only for interim Chrome window capture.

## 2. Clear / compositing modes

| Path | Clear | Alpha | Studio use |
| --- | --- | --- | --- |
| Chrome air (interim) | Solid green `#00ff00` (`outputMode=chroma`) | Opaque plate | Window capture → chroma key in OBS/vMix |
| Ops preview | Dark `#1a1a1a` (`outputMode=preview`) | Opaque | Local ops; optional WHEP underlay |
| **NDI production (A)** | Transparent plate behind AR | **Alpha out** | Electron → NDI BGRA (or equivalent alpha-capable format) |

Contrast: chroma is an **opaque keyed plate** for capture tools that cannot take alpha. NDI path **A** must clear to **transparent** so only AR (boats, course, overlays, visual timecode) has coverage; empty sky/sea is alpha = 0.

### Product implication (later OUT work — not this slice)

- A dedicated clear mode (e.g. `transparent` / NDI plate) will set WebGL clear alpha to `0` and keep AR + 8×8 timecode opaque.
- Today `normalizeOutputMode` does not yet expose that mode (unknown → `preview`). Shell + contract only in 7.3a.
- Timecode stays burned into the **same** WebGL canvas (NearestFilter) so NDI frames keep barcode sharpness.

## 3. Frame path (high level)

```
┌─────────────────────────────────────────────────────────────┐
│ Electron renderer                                            │
│   SPA (Vite / dist) → Three.js WebGL canvas                  │
│   clear alpha 0 + AR + visual timecode                       │
└────────────────────────────┬────────────────────────────────┘
                             │ readback / GPU path (TBD)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Electron main / native addon (later)                         │
│   pixels → BGRA (or NDI alpha-capable video_frame)           │
│   NDIlib_send_send_video_v2 (named source)                   │
└────────────────────────────┬────────────────────────────────┘
                             │ LAN
                             ▼
                      vMix NDI input (alpha)
```

Notes for follow-up slices (not implemented here):

- Prefer a path that preserves alpha end-to-end (avoid RGB-only encode).
- Soft scale on the barcode is a fail (same rule as chroma air / C trial).
- Latency soft target: feel live vs current window capture (see eval doc).

## 4. Studio shell (this slice)

Minimal Electron app under [`../../desktop/`](../../desktop/):

- Loads local Vite URL in **dev**, or built `dist/` in **file** mode.
- Main process + `BrowserWindow` only — **no** NDI SDK, native addon, or frame sender.
- Browser SPA remains the default `npm run dev` product; use `npm run desktop:dev` for the studio shell.

Run details: [`../../desktop/README.md`](../../desktop/README.md).

## 5. Non-goals (this slice)

| Out of scope | Why |
| --- | --- |
| NDI SDK install / redistributables | BW: shell + alpha contract first |
| Native addon / sending frames | Follow-up DSP (7.3b → toward 7.5) |
| Path **B** helper | Skip unless A blocked |
| Changing default Chrome air away from chroma | Interim air unchanged |
| Wiring `transparent` clear in SPA | Later OUT when sender exists |
| Full electron-builder release channel | Minimal scaffold only |
| 5.4 egress, 6.4 DB | Separate tracks |

## 6. Acceptance for later production cutover (not 7.3a)

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
| [`../ops/air-runbook.md`](../ops/air-runbook.md) | Interim chroma air |
| [`../../desktop/README.md`](../../desktop/README.md) | How to run the studio shell |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, timecode, WHEP |
| [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) | Phase 7.3 |
