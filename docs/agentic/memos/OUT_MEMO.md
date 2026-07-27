# OUT_MEMO

**Last updated:** 2026-07-27  
**Status:** Idle — Phase 3.2 accepted; 3.3 WHEP deferred until BW opens underlay/CV

## Focus
Phases **3.1** + **3.2** done. Next OUT product slice only when BW opens **3.3** or **3.5** (vMix chroma experiment).

## Decisions
- Priority: chroma → WebRTC underlay → egress → NDI helper last (BW lock)
- No in-browser NDI
- **3.1 DONE** — preview/chroma clear under `src/output/`
- **3.2 DONE** — Unity-compatible 8×8 LSB visual timecode (in-renderer WebGL overlay)
  - LSB → index 0, bottom-left texture origin; NearestFilter; default bottom-right ~96px
  - `timecodeEnabled` default **true**; corner/size via config
  - Active POV drone `ts`, fallback latest drone `ts`
- **3.3 WHEP** — still **deferred** until underlay/CV needed (BW)
- Follow-ups (not issued): NTP/`stream_anchor` status line; decoder/CV; optional ms debug text

## Issued dispatches
- **DSP-OUT-20260727-01-preview-chroma-clear** — **DONE** → `dispatches/done/`
- **DSP-OUT-20260727-02-visual-timecode** — **DONE** → `dispatches/done/`  
  Accepted 2026-07-27; worker: 149 tests + build green

## Planned dispatches (not issued)
1. **DSP-OUT-…-whep-underlay-spike** (Phase 3.3) — **deferred** until BW opens underlay/CV
2. **3.5** Local vMix chroma experiment — OUT + human

## Handoffs
- **HO-SCN-OUT-20260727-01** — closed
- **HO-OUT-BW-20260727-01** — 3.2 routed; 3.3 deferred
- **HO-OUT-BW-20260727-02** — FYI: 3.2 accepted

## Blockers
- None — idle on OUT until BW routes 3.3 / 3.5 / other

## Next actions
1. Await BW (3.3 WHEP when CV/underlay needed, or 3.5 studio chroma experiment)
2. Stay out of SCN/TEL/NDI
