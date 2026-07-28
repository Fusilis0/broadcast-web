# OUT_MEMO

**Last updated:** 2026-07-28  
**Status:** Idle on software — **3.5** awaiting human studio Results

## Focus
Human executes [`docs/ops/vmix-chroma-runbook.md`](../../ops/vmix-chroma-runbook.md) → fill Results → accept 3.5

## Decisions
- Priority: chroma → WebRTC underlay → egress → NDI last
- **3.1 + 3.2 + 3.3 DONE**
- **3.3:** `whepUrl` empty = idle; preview underlay; chroma stops/hides underlay; native WHEP in `src/output/`; status on OUT control; `getVideoElement()` for future CV
- **3.5** runbook done; Results pending
- No in-browser NDI

## Issued dispatches
- **DSP-OUT-20260727-01** — DONE
- **DSP-OUT-20260727-02** — DONE
- **DSP-OUT-20260728-01-whep-underlay** — **DONE**
- **DSP-OUT-20260727-03-vmix-chroma-experiment** — active (human Results)

## Blockers
- Human studio Results for 3.5

## Next
1. Human: studio checklist → paste Results
2. Optional: MediaMTX LAN soak; CORS if cross-origin
3. Later: egress eval / NDI helper only if needed
