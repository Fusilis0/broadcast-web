# OUT_MEMO

**Last updated:** 2026-07-27  
**Status:** Idle — Phase 3.1 accepted; awaiting BW route for 3.2 / 3.3

## Focus
Phase 3.1 **DONE**. Next OUT slice per BW: **3.2** visual timecode or **3.3** WHEP underlay.

## Decisions
- Priority: chroma → WebRTC underlay → egress → NDI helper last (BW lock)
- No in-browser NDI; NDI helper is contingency only (Phase 5.5)
- Modes per architecture §5.5: `preview` | `chroma` | `transparent` | `webrtc-underlay` | `egress` (later)
- **3.1 live:** `outputMode` + optional `chromaKey`; committed default **`preview`**
- Runtime toggle via `startOutputModeControl` (not persisted); config is source of truth on reload
- vMix: capture WebGL window; key on clear green — no in-browser NDI
- Optional later: fold OUT control into SCN HUD via callback (currently separate OUT widget)

## Issued dispatches
- **DSP-OUT-20260727-01-preview-chroma-clear** — **DONE** → `dispatches/done/`  
  Accepted 2026-07-27; worker: 136 tests + build green

## Planned dispatches (not issued)
1. **DSP-OUT-…-timecode** (Phase 3.2) — awaiting BW route
2. **DSP-OUT-…-whep-underlay-spike** (Phase 3.3) — after MediaMTX URL known / BW route
3. **3.5** Local vMix chroma experiment — OUT + human (after studio ready)

## Handoffs
- **HO-SCN-OUT-20260727-01** — received; asks closed
- **HO-OUT-BW-20260727-01** — FYI: 3.1 done; ask BW to route 3.2 vs 3.3

## Blockers
- None — waiting on BW for next Phase 3 slice

## Next actions
1. Await BW route (prefer **3.2** timecode next if studio chroma path is enough for now; **3.3** when underlay/CV needed)
2. Issue matching DSP when BW confirms
