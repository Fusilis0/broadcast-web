# Phase 7.1 — Third-party NDI spike (path C)

Studio trial runbook for sending the **broadcast-web** Chrome window into **vMix as NDI** via a **third-party** bridge (OBS-NDI, vMix NDI, NDI Tools, or window→NDI utility). No product NDI code, Electron shell, or NDI SDK work in this phase.

**Status:** Docs ready — **human Results pending**  
**Owner:** OUT + studio operator  
**Dispatch:** `DSP-OUT-20260731-03-ndi-third-party-spike`  
**Scores / order:** [`ndi-path-evaluation.md`](./ndi-path-evaluation.md) (BW ack **C → B → A**)

## Hard constraints

| Rule | Notes |
| --- | --- |
| **Chroma remains production air** | Canonical path is still Chrome → chroma → OBS/vMix window capture ([`air-runbook.md`](./air-runbook.md)). This spike does **not** change the default air path. |
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

- [ ] NDI source appears with a stable, recognizable name
- [ ] Latency acceptable vs direct window capture (operator judgment; soft target ≤ ~1–2 frames worse)
- [ ] Resolution sharp; **8×8 timecode** readable (not smeared)
- [ ] Chroma key (if sending green plate) still clean after NDI hop
- [ ] Survives ≥ 10 minutes without freeze / name flip
- [ ] Ops steps good enough for a show? (note in Results)

## Results (human fills)

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| URL used (local / hosted) | |
| `outputMode` used | chroma / preview |
| Tool chain (C variant) | OBS-NDI / vMix NDI / NDI Tools / other — versions if known |
| NDI source name observed | |
| Receive host | same PC / second LAN PC |
| Pass / fail | |
| Latency vs direct window capture | |
| Timecode readable after NDI? | Y/N + notes |
| Chroma key after NDI? | Y/N / n/a |
| ≥10 min soak | pass / fail |
| Blockers vs Unity NDI | |
| Good enough for a show? | Y/N + why |
| Recommend start **B** (helper) / **A** (Electron)? | Y/N + why |
| Screenshot paths (optional) | |
| `git log -1` on studio PC (optional) | |

### Decision guide (after Results)

| Outcome | Next |
| --- | --- |
| **Pass** for the show format | May **defer A/B**; keep chroma as production; document C as optional air variant; BW revisits if Unity cutover needs owned NDI |
| **Fail** named-source / latency / resolution / ops gates, **or** ops requires Unity-like owned NDI | BW/OUT open **7.2** (**B** preferred) and/or **7.3** (**A**) |
| Explicit BW “skip C / force owned” | May open 7.2/7.3 without waiting on this table |

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
| [`air-runbook.md`](./air-runbook.md) | Canonical chroma air path — unchanged by this spike |
| [`ndi-path-evaluation.md`](./ndi-path-evaluation.md) | A/B/C scores, BW ack C→B→A, Phase 7 entry criteria |
| [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md) | Milestone C historical record |
| [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) | Phase 7.1 |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, timecode, WHEP |
