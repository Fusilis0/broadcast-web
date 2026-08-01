# Phase 5.4 — WebRTC / SRT egress evaluation

**Status:** Evaluation complete — **BW acked E0** (2026-08-01): defer app egress  
**Owner:** OUT (+ BW for production choice; PLT if a MediaMTX/SRT host is later required)  
**Related:** [`air-runbook.md`](./air-runbook.md), [`ndi-path-evaluation.md`](./ndi-path-evaluation.md), [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) §7, roadmap Phase 5.4  
**Dispatch:** `DSP-OUT-20260731-07` (done)

## Hard constraints

| Rule | Notes |
| --- | --- |
| **Preferred studio air** | Electron + alpha NDI into vMix/OBS on the **same LAN** ([`air-runbook.md`](./air-runbook.md)). Do not block shows on egress. |
| Chroma stays fallback | Chrome + green key remains supported. |
| WHEP is **ingest**, not egress | MediaMTX WHEP underlay is camera-under-AR in **preview** only ([`../../src/output/README.md`](../../src/output/README.md)). |
| NDI remains optimum local path | No NDI rewrite; path A + alpha is locked ([`ndi-path-evaluation.md`](./ndi-path-evaluation.md)). |
| This doc is docs-only | No production WebRTC/SRT sender, helper, or MediaMTX WHIP/SRT publish code in Phase 5.4. |
| Non-goals | No 6.4 project API/DB; no Hetzner/WSS human install from this eval. |

## Goal

Score options for sending broadcast-web video **out** of the studio (remote / cleaner ingest) via **WebRTC and/or SRT**, relative to current air paths, and recommend an order of investment for BW.

## When remote egress matters (and when it does not)

| Situation | Prefer |
| --- | --- |
| On-site studio: SPA/Electron + vMix/OBS **same machine or LAN** | **NDI (preferred)** or chroma fallback — **no app egress** |
| Program already leaves the venue via vMix/OBS (RTMP, SRT, NDI→remote, etc.) | **Compositor-side program out** — do not duplicate in the app |
| Far operator / cleaner needs the **AR plate alone** over WAN (not full program) | Consider app or compositor-sourced **SRT / WebRTC** of that plate |
| Preview/CV camera under AR | Existing **WHEP underlay** (ingest) — not this track |

**Rule of thumb:** If vMix/OBS already owns the show mix and has a working remote send, keep using **compositor program out**. App egress only pays off when someone needs the **broadcast-web plate** (alpha or keyed) without standing up a second compositor hop — typically a remote graphics/clean-feed ingest.

## Studio / remote requirements

| Requirement | Target / notes |
| --- | --- |
| **Latency** | Local NDI already “feels live.” WAN egress: soft target interactive (~sub-second) for WebRTC; SRT often 0.5–3 s depending on latency mode / buffer — operator judgment vs show need. |
| **Reliability** | Survive show duration; clear reconnect story; must not destabilize local NDI/chroma air. |
| **Ops complexity** | Prefer zero new studio boxes for on-site shows. Remote path may add MediaMTX / SRT listener — document who owns it. |
| **Alpha preservation** | Preferred local air is **alpha NDI**. Browser WebRTC and most SRT H.264/HEVC pipelines are **opaque RGB** (or chroma plate) — alpha is a hard loss unless a specialized path exists. |
| **Overlap with NDI** | Do not replace LAN NDI with egress for same-PC shows. Egress is for **WAN / remote**, not a second local air path. |
| **Timecode** | 8×8 visual barcode must stay sharp if the remote path is used for sync/debug. |
| **Effort** | Docs-only now; implementation only if BW opens a later DSP with a named consumer. |

## Options (locked IDs)

| ID | Option | Idea |
| --- | --- | --- |
| **E1** | Browser WebRTC egress | SPA (or Electron renderer) publishes WebRTC (e.g. WHIP → MediaMTX / SFU); remote vMix/OBS/WHEP or WebRTC ingest |
| **E2** | SRT from helper / Electron | Native or Electron main encodes frames → SRT caller/listener to remote ingest |
| **E3** | Compositor-side egress | vMix/OBS already has program (or NDI/chroma layer) out — RTMP/SRT/NDI/WebRTC as the tool supports |
| **E0** | Defer / not needed | Keep NDI + chroma; no app egress investment until a named remote use case |

## Scoring matrix

Scale **1–5** (5 = best for that criterion). Effort inverted: 5 = lowest effort / soonest value.

| Criterion | **E1** Browser WebRTC | **E2** SRT helper/Electron | **E3** Compositor out | **E0** Defer |
| --- | --- | --- | --- | --- |
| Latency (WAN-capable) | **4** | **3** | **3–4** (tool-dependent) | **5** (N/A — local NDI) |
| Reliability / ops battle-tested | **2** | **3** | **5** | **5** (status quo) |
| Ops complexity (lower = better score) | **2** | **2** | **4** | **5** |
| Alpha preservation | **1** | **1–2** | **4** (if sending alpha NDI/program that already has alpha) | **5** (local alpha NDI unchanged) |
| Overlap / non-duplication with NDI | **2** | **2** | **5** (reuses air path) | **5** |
| Effort / time-to-value | **2** | **1** | **5** (already available) | **5** |
| Engineering control of AR plate | **4** | **5** | **2** (plate only via compositor graph) | **1** (no new control) |
| Alignment with “remote when it matters” | **3** | **4** | **5** for program; **3** for plate-only | **4** until need is real |
| **Weighted lean** | Later alternate | Later owned WAN plate | **Near-term default for remote** | **Near-term product choice** |

### Pros / cons / effort / risks

#### E1 — Browser WebRTC egress

| | |
| --- | --- |
| **Pros** | Fits browser stack; can reuse MediaMTX (WHIP publish / WHEP play) mental model already used for underlay ingest; good WAN latency potential |
| **Cons** | Distinct from WHEP **underlay** (easy to confuse in ops); typically **no alpha**; encode cost in tab; needs publish URL, auth, and a remote consumer; Chromium capture/`getDisplayMedia` or canvas capture quirks |
| **Effort** | Medium — WHIP client, signaling, ops runbook, fail-soft vs air paths |
| **Risks** | Operators confuse underlay vs egress; tab background throttle; quality vs NDI; second moving part during shows |

#### E2 — SRT from helper / Electron

| | |
| --- | --- |
| **Pros** | Broadcast-familiar transport; fits cleaner/remote ingest boxes; Electron already owns frames for NDI (`grandi` path) so a future dual-send is conceivable; tunable latency/reliability |
| **Cons** | Native encode + SRT stack; packaging; still usually **opaque** compressed video; more code than E3; overlaps compositor SRT if program out already exists |
| **Effort** | High — encoder choice, SRT library, studio config, soak testing |
| **Risks** | GPU/CPU contention with NDI pump; scope creep into “second air path”; PLT host/firewall story |

#### E3 — Compositor-side egress (vMix / OBS program out)

| | |
| --- | --- |
| **Pros** | **Already how remote shows leave the venue**; zero broadcast-web code; one graph for program; can carry NDI alpha layer + camera as mixed program; ops already trained |
| **Cons** | Remote gets **program** (or whatever the compositor sends), not necessarily a pristine app-owned plate; depends on vMix/OBS license/features |
| **Effort** | Lowest — document which output (SRT/RTMP/NDI) the show template uses |
| **Risks** | None for the app; show depends on compositor config (acceptable and current) |

#### E0 — Defer / not needed

| | |
| --- | --- |
| **Pros** | Protects focus on preferred NDI air, chroma fallback, Unity parallel cutover (5.6), human deploy; matches “do not block shows on egress” |
| **Cons** | No owned WAN plate if a remote graphics ingest appears suddenly |
| **Effort** | None now |
| **Risks** | Revisit cost later if a named consumer appears — acceptable with this scored eval as the starting point |

## Recommendation (for BW ack)

**BW ack (2026-08-01):** Accept **E0**. No app egress implementation DSP. Remote leave = **E3** compositor program out until a named AR-plate-only WAN consumer appears (then prefer **E2** before **E1**).

### Binding recommendation (2026-08-01)

1. **Defer app WebRTC/SRT egress (E0)** as the product investment for now. Preferred studio air stays **Electron + alpha NDI**; chroma remains fallback. Do **not** open an implementation DSP unless a named remote consumer is real.
2. **When remote program delivery is needed today:** use **E3 — compositor-side egress** (vMix/OBS SRT/RTMP/NDI/WebRTC program out). Do not build a parallel sender in broadcast-web for the same job.
3. **If a future DSP is justified** (remote needs the **AR plate only**, compositor hop unacceptable):
   - Prefer **E2 (SRT from Electron)** over browser WHIP if the studio already runs Electron for NDI — one process, frames already in main.
   - Keep **E1 (browser WebRTC/WHIP)** as an alternate when the sender must be Chrome-only (no Electron) or MediaMTX WHIP is already ops-standard.
4. **Never** treat egress as a replacement for LAN NDI or as a reason to rewrite NDI.
5. **Alpha:** assume WAN egress is **opaque or chroma-keyed** unless a future spike proves otherwise; local alpha NDI remains the alpha-preserving path.

### Suggested investment order

| Order | Action | When |
| --- | --- | --- |
| 1 | **E0** — no app egress code | Now (default) |
| 2 | **E3** — document/use vMix/OBS program out for remote | Any show that leaves the venue |
| 3 | **E2** — Electron/helper SRT spike | Only if BW names a plate-only WAN consumer |
| 4 | **E1** — browser WHIP egress spike | Only if Chrome-only sender or MediaMTX-first ops wins |

### Explicit: when to keep using vMix/OBS program out

Use compositor egress (**E3**) instead of app egress when:

- The remote audience/ingest needs **program** (camera + AR + graphics), not the raw overlay plate
- The studio already has working RTMP/SRT/NDI out of vMix/OBS
- You need alpha composite **before** the WAN hop (mix locally on NDI/chroma, then send opaque program)
- Adding an app publisher would create a second fail point during the show

Consider app egress (**E1/E2**) only when:

- A remote site must ingest the **broadcast-web plate alone** (clean feed / remote key / remote graphics island)
- Standing up or routing through the studio compositor for that plate is worse than an app publisher
- BW has accepted opaque (or chroma) plate over WAN and an owner for the receive URL/ops

## Non-goals (reaffirmed)

- No production WebRTC/SRT sender in this phase  
- No NDI rewrite; no change to preferred Electron alpha air  
- No Phase **6.4** project API / DB work  
- No Hetzner/WSS human install from this evaluation  
- No conflating WHEP **underlay** (in) with egress (out)

## Related

| Doc | Role |
| --- | --- |
| [`air-runbook.md`](./air-runbook.md) | Preferred Electron alpha NDI + chroma fallback |
| [`ndi-path-evaluation.md`](./ndi-path-evaluation.md) | Local NDI A/B/C scores; A + alpha lock |
| [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md) | vMix/OBS alpha NDI ingest |
| [`../architecture/race-projects-and-world-authoring.md`](../architecture/race-projects-and-world-authoring.md) §7 | Output ladder (chroma → WHEP → SRT/WebRTC egress → NDI) |
| [`../roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) | Phase 5.4 |
| [`../../src/output/README.md`](../../src/output/README.md) | Clear modes, timecode, WHEP underlay, NDI pump |
| [`../../desktop/README.md`](../../desktop/README.md) | Studio Electron shell |
