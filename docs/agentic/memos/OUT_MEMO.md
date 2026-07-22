# OUT_MEMO

**Last updated:** 2026-07-22  
**Status:** Bootstrapped — idle until canvas exists

## Focus
Phase 3.1 — `preview` / `chroma` clear-mode switch (first DSP after PLT scaffold lands)

## Decisions
- Priority: chroma → WebRTC underlay → egress → NDI helper last (BW lock)
- No in-browser NDI; NDI helper is contingency only (Phase 5.5)
- Scaffold clear stays dark preview; chroma green is OUT’s first product slice
- Modes per architecture §5.5: `preview` | `chroma` | `transparent` | `webrtc-underlay` | `egress` (later)
- First worker slice: `preview` ↔ `chroma` only (config-driven); `transparent` / WHEP deferred

## Issued dispatches
—

## Planned dispatches (not issued)
1. **DSP-OUT-…-clear-mode-switch** (Phase 3.1) — after PLT scaffold green  
   - Wire `outputMode` from `public/config.json` (`preview` | `chroma`)  
   - Apply Three clear color: dark preview vs chroma key `(0,255,0)` (or configurable)  
   - Own under `src/output/`; no scene content changes  
2. **DSP-OUT-…-whep-underlay-spike** (Phase 3.3) — after clear modes + MediaMTX URL known  
3. Timecode burn-in (Phase 3.2) — after clear modes

## Handoffs
—

## Blockers
- **No `src/` yet** — PLT scaffold `DSP-PLT-20260722-01-scaffold-vite-three` still active / awaiting worker
- Do not issue OUT DSPs until blank canvas + `src/output/` stub exist

## Next actions
1. Wait for PLT worker report: Vite/Three canvas runnable, `src/output/` folder present, `outputMode: "preview"` in config
2. Issue clear-mode DSP (3.1)
3. Note WHEP underlay spike for later; do not start until chroma path is demonstrable
