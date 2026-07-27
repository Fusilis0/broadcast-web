# Dispatch DSP-OUT-20260727-02-visual-timecode

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260727-02-visual-timecode)
- Priority: P0
- Phase: Phase 3.2 — Visual timecode
- Related handoffs: HO-OUT-BW-20260727-01 (BW: 3.2 now; 3.3 WHEP deferred)
- BW ask: visual timecode burn-in; no WHEP; no NDI
- **Status: DONE** (worker report accepted by OUT 2026-07-27)

## Goal

Port Unity’s **8×8 LSB visual timecode barcode** into `src/output/` so the live telemetry timestamp (ms) is burned into the ops/chroma frame for sync debugging.

## Acceptance criteria

- [x] 8×8 B/W barcode encodes drone telemetry `ts` (ms) with Unity-compatible bit order (LSB → index 0)
- [x] Visible in `npm run dev` and updates when telemetry timestamps advance; holds when unchanged
- [x] Tracks active POV when possible; sensible fallback to latest drone `ts`
- [x] Logic under `src/output/`; no boat/course/TEL feature work; no NDI
- [x] Config documented; default does not break chroma (3.1 still works)
- [x] `npm test` + `npm run build` green — worker: **149** tests; build green
- [x] README notes capture + “no in-browser NDI”

## Worker report (summary)

In-renderer Three `DataTexture` + orthographic overlay on same WebGL canvas (NearestFilter, ~96px, bottom-right). Encode + golden tests. Config: `timecodeEnabled` / corner / sizePx.

## Files delivered

- `src/output/{visualTimecodeEncode,visualTimecodeEncode.test,visualTimecodeOverlay,index,README}`
- `src/config/{types,loadConfig,loadConfig.test,README}`
- `public/config.json`
- `src/main.ts`

## Full original dispatch

See git history for issued in-scope / out-of-scope / paste-block text.
