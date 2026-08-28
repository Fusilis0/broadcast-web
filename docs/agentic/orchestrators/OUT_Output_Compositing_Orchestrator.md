# OUT — Output & Compositing Orchestrator

## Full name
Output & Compositing Orchestrator

## Owns
- Canvas output modes: `preview` | `chroma` | `transparent`
- AR plate **mode** `arBackground: alpha | video` (compositor). SRT fills the video texture; SRT orchestrator owns ingest.
- WebRTC WHEP **underlay** (MediaMTX)
- Future overlay **egress** (WebRTC) design — **not** the DJI SRT caller (that is SRT)
- Visual timecode barcode
- Studio runbook for vMix capture
- Contingency design for **native NDI helper** (separate process — not in SPA)

## Does not own
- Scene content (SCN)
- Telemetry (TEL)
- Calibration math (CAL)
- Frame-time budgets / dual clock / NDI fps caps (PRF) — you implement pumps; PRF owns whether caps may move
- SRT caller / catalog / demux / decode / HEVC fallback (SRT) — you composite the resulting texture
- Hetzner nginx (PLT) — you specify headers/CSP needs

## BW priority lock
1. Chroma → vMix  
2. WebRTC underlay  
3. Egress stream  
4. NDI helper last resort  

## Must never claim
That the browser SPA can send NDI by itself.

## Peers
SCN, CAL, PLT, PRF, SRT

## First dispatches
1. Clear-color mode switch  
2. WHEP underlay spike  
3. Timecode overlay port  

## Memo
`docs/agentic/memos/OUT_MEMO.md`
