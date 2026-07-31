# Phase 5.5 — NDI path evaluation (A / B / C)

**Status:** Evaluation complete (2026-07-31) — **BW acked** recommendation **C → B → A**  
**Owner:** OUT (+ PLT packaging when A/B start; BW for production choice)  
**Related:** [`air-runbook.md`](./air-runbook.md), [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) §7, roadmap Phase 5.5 / 7

## Hard constraints

| Rule | Notes |
| --- | --- |
| **NDI is not required for current air** | Canonical path remains Chrome → chroma → OBS/vMix ([`air-runbook.md`](./air-runbook.md)). Do not block shows on NDI. |
| Chroma stays fallback | Even after a production NDI path, green-key window capture remains supported. |
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
| **Alpha / key** | Either pre-keyed AR-over-video **or** AR-on-chroma plate keyed in vMix — must be explicit per path. Chroma plate via NDI is OK for C; owned A/B should aim for a clean camera-view source. |
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

**Order (matches design preference):**

1. **Keep chroma** as the production air path now ([`air-runbook.md`](./air-runbook.md)) — already proven (Milestone C / Phase 5.3).
2. **Trial C next** (Phase **7.1**) — human studio spike; document pass/fail against requirements above.
3. **If C is insufficient** for named source, latency, or timecode fidelity → invest in **owned NDI**.
4. **Preferred owned path: B** (native helper) — preserves browser SPA as the default product; Electron remains optional studio shell.
5. **A** if studio ops reject a two-process helper or demand a single packaged app after B spike (or in parallel only if BW prioritizes packaging).

**Near-term recommended option:** **C** (trial only).  
**Long-term recommended owned option (if needed):** **B**, with **A** as alternate.

Do **not** start A/B implementation until Phase 7 entry criteria below are met and BW/OUT open the matching DSP.

## Phase 7 entry criteria

| When | Action |
| --- | --- |
| Chroma air path documented and usable | **Met** (5.3) — prerequisite for any NDI work |
| Human studio time available for third-party trial | Start **7.1** (C spike) using checklist below |
| C trial **fails** named-source / latency / resolution / ops gates **or** ops explicitly requires Unity-like owned NDI | BW opens **7.2** (B) and/or **7.3** (A); prefer **B** first unless packaging forces **A** |
| C trial **passes** for a given show format | May defer A/B; keep chroma + C as documented air variants; revisit if Unity cutover needs owned NDI |
| Production NDI chosen (7.4) | Only after spike evidence; then 7.5–7.6 runbook + parallel with Unity until cutover OK |

**Do not enter 7.2 / 7.3** solely because 5.5 docs exist — wait for C spike results or an explicit BW “skip C / force owned” decision.

## Spike checklist — human trial of C (Phase 7.1)

Optional ops section; fill Results after the trial.

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

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| Tool chain (C variant) | |
| NDI source name observed | |
| Pass / fail | |
| Blockers vs Unity NDI | |
| Recommend start B / A? (Y/N + why) | |

## Related

| Doc | Role |
| --- | --- |
| [`air-runbook.md`](./air-runbook.md) | Canonical chroma air path — NDI not required |
| [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md) | Milestone C historical record |
| [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) §7 | Output ladder + A/B/C options |
| [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) | Phase 5.5 eval · Phase 7 spikes |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, timecode, WHEP |
