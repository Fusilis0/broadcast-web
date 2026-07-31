# Phase 5.5 — NDI path evaluation (A / B / C)

**Status:** Evaluation complete — **BW revised (2026-07-31):** C trial closed; **end-state = A + alpha NDI** (skip B unless A blocked)  
**Owner:** OUT (+ PLT packaging when A starts; BW for production choice)  
**Related:** [`air-runbook.md`](./air-runbook.md), [`ndi-c-spike-runbook.md`](./ndi-c-spike-runbook.md) (Phase 7.1 C trial — closed), [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) §7, roadmap Phase 5.5 / 7

## Hard constraints

| Rule | Notes |
| --- | --- |
| **Preferred studio air** | Electron + alpha NDI ([`air-runbook.md`](./air-runbook.md)). Do not block a show if NDI fails — roll back to chroma. |
| Chroma stays fallback | Green-key Chrome window capture remains supported ([`air-runbook.md`](./air-runbook.md) § Fallback). |
| No in-browser NDI | Browser SPA alone cannot emit NDI; a native bridge (third-party, helper, or Electron) is required for owned or bridged NDI. |
| This doc is docs-only | No Electron app, NDI SDK integration, or helper code in Phase 5.5. |

## Goal

Score options for sending the **AR camera view** (WebGL plate + visual timecode) into **vMix as NDI** — the optimum studio path — and recommend an order of investment for BW.

## Studio requirements

| Requirement | Target / notes |
| --- | --- |
| **Latency** | Studio LAN; aim for “feels live” vs Unity NDI today. Soft target ≤ ~1–2 frames worse than window capture; unacceptable if operators notice lag vs chroma path. |
| **Resolution** | Match active WebGL output (typically 1080p-class studio; preserve pixel sharpness for 8×8 timecode barcode — nearest/no soft scale). |
| **Named source** | Prefer a stable NDI name ops can pick in vMix (Unity-like: one input, no hunting Chrome windows). |
| **Studio ops** | Same-PC studio; vMix primary compositor; OBS acceptable for trials. Minimal extra clicks vs current chroma. |
| **Alpha / key** | **Production NDI:** straight **alpha** (transparent clear + AR; vMix uses alpha — **not** green-key remove). Chroma plate via NDI is OK only for C trials. Chrome + window capture is the documented **fallback**. |
| **Timecode** | Visual 8×8 barcode must remain sharp on the NDI frames (same burn-in as canvas). |
| **Reliability** | Survive fullscreen Chrome, outputMode switches, and typical show duration without silent freeze. |

## Options (locked IDs)

| ID | Option | Idea |
| --- | --- | --- |
| **C** | Third-party NDI | OBS/vMix NDI plugin, NDI Tools, or window→NDI utility from Chrome capture |
| **B** | Native NDI helper sidecar | Tiny native process; SPA stays browser; helper sends NDI |
| **A** | Electron + our NDI sender | Studio shell around SPA; WebGL/frame → NDI SDK |

## Scoring matrix

Scale **1–5** (5 = best for that criterion). Effort inverted: 5 = lowest effort.

| Criterion | **C** Third-party | **B** Native helper | **A** Electron + NDI |
| --- | --- | --- | --- |
| Time-to-trial / effort | **5** (hours) | **2** (days–weeks) | **1** (weeks+) |
| Named NDI source (Unity-like) | **2** | **5** | **5** |
| Latency predictability | **3** | **4** | **4** |
| Resolution / timecode fidelity | **3** | **5** | **5** |
| Studio ops simplicity | **3** | **4** | **4** |
| Keeps default product = browser SPA | **5** | **5** | **2** |
| Engineering control / maintainability | **1** | **4** | **3** |
| Packaging / install risk | **4** | **3** | **2** |
| NDI SDK / licensing surface | **5** (tool vendor) | **2** (we integrate SDK) | **2** (we integrate SDK) |
| Alignment with output ladder (chroma first) | **5** | **4** | **4** |
| **Weighted lean** (see below) | **Strong near-term** | **Preferred owned** | **Alternate owned** |

### Pros / cons / effort / risks

#### C — Third-party (OBS/vMix NDI, window→NDI)

| | |
| --- | --- |
| **Pros** | Fastest proof; reuses proven Chrome capture; no product code; good enough to learn latency/ops gaps |
| **Cons** | Extra hop (Chrome → capture tool → NDI); window hunting; quality/tool-dependent; less “first-class” than Unity |
| **Effort** | Low — studio afternoon spike |
| **Risks** | Plugin/tool license or version breakage; soft scaling hurts timecode; double GPU capture cost |

#### B — Native NDI helper sidecar

| | |
| --- | --- |
| **Pros** | SPA stays browser (Hetzner/chroma unchanged); owned named source; can target canvas/frames without Electron shell |
| **Cons** | Two processes; need a frame bridge (e.g. local WS, shared texture, or capture API); Windows build + NDI SDK |
| **Effort** | Medium–high — spike then production hardening |
| **Risks** | Bridge latency/sync; helper crash vs browser; PLT install story for sidecar |

#### A — Electron shell + our NDI sender

| | |
| --- | --- |
| **Pros** | Single studio app; full control of lifecycle; closest packaging to a dedicated broadcast client |
| **Cons** | Electron + GPU/WebGL capture complexity; packaging burden; diverges from “default = web SPA” |
| **Effort** | High — shell, native addon, release channel |
| **Risks** | GPU capture edge cases; Electron updates; larger support surface for OUT+PLT |

### NDI SDK (high level only)

Owned paths **A** and **B** require the **NDI SDK** (native sender) and compliance with NDI licensing/redistribution terms at integration time. Path **C** typically uses an existing NDI-capable tool (OBS-NDI, vMix NDI, NDI Tools) so we do not ship the SDK ourselves. No purchase decision in this evaluation — note only.

## Recommendation (for BW ack)

### Original eval order (historical)

Trial **C** → owned **B** preferred → **A** alternate. See scoring matrix above.

### BW revision (2026-07-31) — binding

1. **Preferred studio air:** Electron + alpha NDI ([`air-runbook.md`](./air-runbook.md)); chroma + window capture = **fallback**.
2. **7.1 C trial closed** — Results: Screen Capture → OBS works technically but is **not** app-native NDI; **fail for production NDI** ([`ndi-c-spike-runbook.md`](./ndi-c-spike-runbook.md)).
3. **Full-version end-state locked:** path **A** (Electron + our NDI sender) with **alpha channel** (no green-key as the production NDI mode).
4. **Skip 7.2 (B)** unless A is blocked (SDK/packaging/capture dead-end); do not build helper first.
5. **7.3–7.5 done;** **7.6** cutover docs in air-runbook (human Pass 2026-07-31).

**Preferred studio air:** Electron NDI **with alpha**. **Fallback:** Chrome chroma.

**7.3+:** alpha contract [`../architecture/ndi-alpha-electron.md`](../architecture/ndi-alpha-electron.md); Electron shell + `outputMode=transparent` + named BGRA send via `grandi` ([`../../desktop/`](../../desktop/), [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md)).

## Spike checklist — human trial of C (Phase 7.1)

**Canonical 7.1 runbook:** [`ndi-c-spike-runbook.md`](./ndi-c-spike-runbook.md) (setup variants, pass/fail, Results). Summary retained below for eval context; prefer the dedicated runbook when executing the trial.

### Setup

1. Studio PC: Chrome + vMix (or OBS) on the **same machine** (same rule as air runbook).
2. Open SPA (local or hosted) with `outputMode=chroma` (or preview if testing full-frame NDI without key).
3. Fullscreen Chrome on the output monitor; hide overlapping windows.
4. Choose one third-party path (document which):
   - **OBS:** Window Capture Chrome → NDI output plugin / NDI Tools Scan Converter equivalent, **or**
   - **vMix:** Window/Screen capture → enable NDI output / NDI input chain as available on your build, **or**
   - Dedicated **window→NDI** tool pointed at Chrome.
5. In the receiving vMix (same or second PC on LAN): add **NDI** input; select the published name.

### Pass / fail

- [ ] NDI source appears with a stable, recognizable name
- [ ] Latency acceptable vs direct window capture (operator judgment)
- [ ] Resolution sharp; **8×8 timecode** readable (not smeared)
- [ ] Chroma key (if sending green plate) still clean after NDI hop
- [ ] Survives ≥ 10 minutes without freeze / name flip
- [ ] Ops steps written in Results (good enough for a show?)

### Results (human fills)

Canonical filled table: [`ndi-c-spike-runbook.md`](./ndi-c-spike-runbook.md) § Results (2026-07-31). Summary: **Fail for production NDI** → end-state **A + alpha**; skip B.

## Related

| Doc | Role |
| --- | --- |
| [`air-runbook.md`](./air-runbook.md) | Preferred Electron alpha NDI + cutover + chroma fallback |
| [`ndi-c-spike-runbook.md`](./ndi-c-spike-runbook.md) | Phase 7.1 third-party NDI trial (path C) |
| [`../architecture/ndi-alpha-electron.md`](../architecture/ndi-alpha-electron.md) | Phase 7.3 — alpha NDI + Electron product contract |
| [`../../desktop/README.md`](../../desktop/README.md) | Studio Electron shell + alpha NDI send |
| [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md) | vMix/OBS alpha NDI ingest |
| [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md) | Milestone C historical record |
| [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) §7 | Output ladder + A/B/C options |
| [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) | Phase 5.5 eval · Phase 7 spikes |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, timecode, WHEP |
