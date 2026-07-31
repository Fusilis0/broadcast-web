# Phase 7.1 — Third-party NDI spike (path C)

Studio trial runbook for sending the **broadcast-web** Chrome window into **vMix as NDI** via a **third-party** bridge (OBS-NDI, vMix NDI, NDI Tools, or window→NDI utility). No product NDI code, Electron shell, or NDI SDK work in this phase.

**Status:** **Closed** (2026-07-31) — C works as screen→NDI only; **rejected for production NDI**  
**Owner:** OUT + studio operator  
**Dispatch:** `DSP-OUT-20260731-03-ndi-third-party-spike`  
**Scores / order:** [`ndi-path-evaluation.md`](./ndi-path-evaluation.md) — BW revised: end-state **A + alpha** (skip **B** unless A blocked)

## Hard constraints

| Rule | Notes |
| --- | --- |
| **Chroma remains fallback air** | Preferred studio path is Electron alpha NDI ([`air-runbook.md`](./air-runbook.md)). This spike did **not** become production NDI. |
| NDI not required for shows | Do not block on-air on this trial. |
| Same-PC capture | Chrome + the capture/publish tool run on the **same studio PC** (same rule as air runbook). Receiving vMix may be same PC or another LAN machine. |
| No product NDI code | Do not add Electron, native helper, or NDI SDK integration here. Use existing third-party tools only. |
| No production cutover | Pass/fail informs whether to defer owned NDI (**B**/**A**) or open 7.2/7.3 — not a live show cutover. |

## Goal

Prove whether a **third-party** Chrome → NDI chain is good enough for studio ops (named source, latency, 8×8 timecode fidelity, chroma key after hop) before investing in owned NDI.

## Prerequisites

| Item | Notes |
| --- | --- |
| Studio PC | **Chrome** + capture/publish tool on the **same machine** |
| App source | Local `npm run dev` / `npm run preview` **or** hosted HTTPS SPA (see [`air-runbook.md`](./air-runbook.md)) |
| Compositor | **vMix** preferred as NDI receiver; OBS acceptable for publish and/or receive trials |
| Third-party NDI | One of: OBS + NDI plugin, vMix NDI output, NDI Tools (e.g. Scan Converter), or other window→NDI utility |
| Telemetry | **mock** or **replay** is enough |
| Race pack (recommended) | `?race=demo-istanbul` so AR + timecode are visible |

## Chroma vs preview (what to send)

| Mode | When to use | Keying |
| --- | --- | --- |
| **`outputMode=chroma`** (preferred for show-like trial) | Green plate → NDI → key in receiving vMix | Same as air: key `#00ff00` after the NDI hop |
| **`outputMode=preview`** | Full-frame dark clear + optional WHEP underlay over NDI | No chroma key; useful only to judge latency/resolution without key |

For a production-shaped C trial, prefer **chroma**. Preview is optional diagnostics only.

## Setup

1. Studio PC: Chrome + chosen third-party publish tool on the **same machine**.
2. Open SPA (local or hosted), e.g.:

```text
http://127.0.0.1:5173/?race=demo-istanbul&outputMode=chroma
https://YOUR_SPA_DOMAIN/?race=demo-istanbul&outputMode=chroma
```

   Or set chroma via OUT runtime control / session config (do not require committing chroma as repo default).
3. Fullscreen Chrome on the output monitor; hide overlapping windows over the WebGL view.
4. Confirm solid green clear (chroma) and sharp **8×8** visual timecode (default bottom-right) **before** enabling NDI — baseline like [`air-runbook.md`](./air-runbook.md).
5. Choose **one** third-party path below; document the exact tool chain in Results.

### Variant — OBS publish

1. OBS: **Window Capture** (or Display/region) → select the **Chrome** window covering WebGL.
2. Prefer **no** soft scaling on the capture (preserve barcode sharpness).
3. Enable **NDI output** (OBS-NDI plugin or equivalent) for that source/program as your build supports.
4. Note the published **NDI source name**.

### Variant — vMix publish

1. vMix: **Add Input** → **Window Capture** (or Screen/region) → select **Chrome**.
2. Enable **NDI output** / NDI send for that input or mix as available on your vMix build/license.
3. Prefer nearest/no soft scale on the captured region.
4. Note the published **NDI source name**.

### Variant — Dedicated window→NDI tool

1. Point NDI Tools Scan Converter (or similar) at the Chrome window / output monitor region.
2. Prefer settings that avoid bilinear soft scale on the barcode.
3. Note the published **NDI source name**.

### Receive in vMix

1. On the same PC **or** a second studio PC on the LAN: vMix → **Add Input** → **NDI**.
2. Select the published name from the publisher above.
3. If sending chroma plate: apply **Chroma Key** green `#00ff00` on the NDI input (or downstream).
4. Put a background under the keyed layer; confirm AR + timecode.

Optional A/B judgment: briefly compare latency/feel vs **direct** window capture (no NDI hop) on the same PC.

## Pass / fail

- [x] NDI source appears with a stable, recognizable name *(Screen Capture → OBS NDI list)*
- [ ] Latency acceptable vs direct window capture (operator judgment; soft target ≤ ~1–2 frames worse) — *not scored; product gate failed first*
- [ ] Resolution sharp; **8×8 timecode** readable (not smeared) — *not fully scored*
- [ ] Chroma key (if sending green plate) still clean after NDI hop — *n/a for end-state (want alpha, not green)*
- [ ] Survives ≥ 10 minutes without freeze / name flip — *not fully scored*
- [x] Ops steps good enough for a show? — **No** for production NDI (screen capture only; not app-native)

## Results (human fills)

| Field | Value |
| --- | --- |
| Date | 2026-07-31 |
| Operator | studio (product owner) |
| URL used (local / hosted) | local `http://localhost:5173/?race=demo-istanbul&outputMode=chroma` |
| `outputMode` used | chroma |
| Tool chain (C variant) | NDI Tools **Screen Capture** 5.5.1 → OBS **NDI Source** (Bridge tried first — wrong tool; does not capture windows) |
| NDI source name observed | Screen Capture source visible in OBS NDI list |
| Receive host | same PC |
| Pass / fail | **Fail for production NDI** — C is screen/window capture over NDI, not app-native out |
| Latency vs direct window capture | n/a (stopped at product fit) |
| Timecode readable after NDI? | n/a |
| Chroma key after NDI? | n/a — full product must use **alpha**, not green-key NDI |
| ≥10 min soak | n/a |
| Blockers vs Unity NDI | No named app sender; no alpha; depends on external Screen Capture; ops wants Unity-like direct NDI |
| Good enough for a show? | **N** as production NDI path (chroma window capture remains fallback) |
| Recommend start **B** (helper) / **A** (Electron)? | **A** — full version = Electron + NDI **with alpha** (not green remove). Skip B unless A blocked. |
| Screenshot paths (optional) | — |
| `git log -1` on studio PC (optional) | — |

### Decision guide (after Results)

| Outcome | Next |
| --- | --- |
| **Pass** for the show format | May **defer A/B**; keep chroma as production; document C as optional air variant; BW revisits if Unity cutover needs owned NDI |
| **Fail** named-source / latency / resolution / ops gates, **or** ops requires Unity-like owned NDI | BW/OUT open **7.2** (**B**) and/or **7.3** (**A**) |
| Explicit BW “skip C / force owned” | May open 7.2/7.3 without waiting on this table |

**BW decision (2026-07-31):** C closed as **fail for product**. End-state locked to **A + alpha NDI**. **Skip 7.2 (B)** unless A is blocked. Next: **7.3** Electron shell + alpha contract (then NDI SDK).

Do **not** declare production NDI cutover from this spike alone.

## Non-goals

- Electron SPA / studio shell
- Native NDI helper or NDI SDK integration (7.2 / 7.3)
- Changing default air path away from chroma
- 5.4 egress, 6.4 DB
- Hetzner deploy / WSS setup (use existing runbooks if needed for a hosted URL)

## Related

| Doc | Role |
| --- | --- |
| [`air-runbook.md`](./air-runbook.md) | Preferred Electron alpha NDI + chroma fallback |
| [`ndi-path-evaluation.md`](./ndi-path-evaluation.md) | A/B/C scores, BW ack C→B→A, Phase 7 entry criteria |
| [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md) | Milestone C historical record |
| [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) | Phase 7.1 |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, timecode, WHEP |
