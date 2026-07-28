# Dispatch DSP-OUT-20260728-01-whep-underlay

## Meta
- From orchestrator: OUT (BW-opened Phase **3.3** — finish software while **3.5** studio Results pending)
- Worker role: WORKER(DSP-OUT-20260728-01-whep-underlay)
- Priority: P0
- Phase: Phase 3.3 — WebRTC underlay (WHEP)
- Related handoffs: none
- BW ask: MediaMTX **WHEP** video underlay for preview/CV path; no NDI; do not block on studio 3.5

## Goal

Add a browser **WHEP** underlay so drone (or ops) video can sit behind / under the Three AR canvas in **preview**. Soft-fail when URL empty or MediaMTX unreachable. Chroma air path must keep working (underlay off or hidden in chroma unless explicitly allowed).

## Background

- Roadmap 3.3; Milestone C wants underlay; BW output lock: chroma → WebRTC underlay → egress → NDI last
- Architecture: MediaMTX WHEP underlay + future CV (`docs/architecture/system-architecture.md`)
- OUT today: clear modes + visual timecode (`src/output/`); no video yet
- Unity used WebRTC WHEP via StreamModeManager (sibling `../broadcast` — read-only reference if needed)
- Prefer native `RTCPeerConnection` + WHEP HTTP (POST SDP) — avoid heavy deps unless necessary; document choice in README

## In scope

1. **Config**
   - `whepUrl: string` in `AppConfig` / `public/config.json` (default `""`)
   - Optional: `whepEnabled: boolean` default `true` when URL set, or simply “non-empty URL enables”
   - `.env.example` note if useful (no secrets)

2. **WHEP client** under `src/output/` (e.g. `whepUnderlay.ts`)
   - Connect when URL present and mode allows underlay
   - Attach remote track to an HTML `<video>` (muted, playsInline) positioned under the WebGL canvas
   - Reconnect / soft-fail with console warn; never crash boot
   - `start` / `stop` handle; cleanup PC + video on stop

3. **Compositing**
   - **preview:** video visible behind transparent/dark clear as practical (DOM layer under canvas is OK for V1)
   - **chroma:** underlay **hidden/stopped** by default so green key stays clean (document this)
   - Timecode + AR canvas remain on top

4. **Ops**
   - Tiny status in OUT control or HUD-adjacent: `whep=off|connecting|live|error` (OUT-owned DOM OK; do not rewrite SCN HUD unless unavoidable)

5. **Docs / tests**
   - `src/output/README.md` — URL shape example (`http://mediamtx:8889/whep/…` style placeholder), chroma interaction
   - Unit-test pure helpers (URL normalize / state machine) where easy; manual note if no MediaMTX in CI

## Out of scope

- Filling **3.5** Results / vMix studio run
- Native NDI helper / in-browser NDI
- SRT / WebRTC **egress** (5.4)
- CV matching (4.5) — only provide video element/track for future use
- Changing TEL live multi-URL, scene content, geodesy
- Requiring a real MediaMTX in CI (empty URL = idle pass)

## Likely files

- `src/output/whep*.ts`, `index.ts`, `README.md`, tests
- `src/config/types.ts`, `loadConfig.ts`, tests, `public/config.json`, `.env.example`
- `src/main.ts`, `src/style.css` (video under canvas)
- Optional thin OUT status DOM

## Acceptance criteria

- [ ] Empty `whepUrl` → app boots; status off/idle; no errors
- [ ] With URL (manual): can attempt WHEP; video shows under canvas in preview when session works
- [ ] Switching to chroma hides/stops underlay (green key not polluted)
- [ ] `npm test` + `npm run build` green without MediaMTX
- [ ] README documents config + chroma interaction + no NDI

## Report back

1. Summary  
2. Files touched  
3. Tests / how verified (incl. empty-URL path)  
4. Follow-ups / blockers (MediaMTX URL format if unknown)  
5. Suggested OUT memo bullets  

## Worker paste block

```
You are WORKER(DSP-OUT-20260728-01-whep-underlay).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260728-01-whep-underlay.md (full)
2. docs/agentic/DISPATCH_PROTOCOL.md
3. src/output/README.md + applyOutputMode / main.ts mount
4. docs/architecture/system-architecture.md (MediaMTX / underlay)
5. Optional Unity read-only: ../broadcast StreamModeManager / WHEP usage

Implement WHEP underlay only. No NDI, no studio Results, no TEL multi-URL.
When finished, report using the dispatch Report back section.
```
