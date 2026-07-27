# Phase 3.5 — Local vMix chroma experiment

Studio runbook to prove the web-on-air chroma path: fullscreen Chrome, `outputMode=chroma`, vMix window capture, key on clear green, AR content and the 8×8 visual timecode readable over the keyed plate.

**Non-goals for this run:** WebRTC WHEP underlay, native NDI helper / in-browser NDI, Hetzner deploy, live VPS soak. Capture is **window / screen of Chrome** only.

## Prerequisites

- Studio PC with **Chrome**, **vMix**, and this repo
- `npm install` already done (or run once)
- Local app: `npm run dev` (mock / replay telemetry is fine)
- Committed `public/config.json` may stay `"outputMode": "preview"` — use runtime OUT control or a session-only config change for chroma

## Steps

1. Start the app: `npm run dev`. Open the printed URL in **Chrome** (usually `http://localhost:5173`).
2. Prefer **fullscreen** Chrome on the output monitor (F11 or OS fullscreen).
3. Set **chroma** for this session:
   - Runtime OUT **output** control → `chroma`, **or**
   - Session config `"outputMode": "chroma"` then reload  
   Do **not** require committing chroma as the repo default.
4. Confirm clear is **solid green** behind AR (boats / course / overlays).
5. In **vMix**: capture the Chrome **window** (or a screen region covering the WebGL view). Canvas-only tools also see the in-renderer timecode.
6. Apply **chroma key** on the expected clear colour (`#00ff00` / RGB `(0, 255, 0)` unless overridden).
7. Confirm AR composites cleanly; confirm the **8×8** visual timecode barcode is visible and sharp (default bottom-right, ~96 px).

## Expected defaults

| Item | Value |
| --- | --- |
| Preview clear | `#1a1a1a` / `0x1a1a1a` |
| Chroma clear (default key) | `#00ff00` / RGB `(0, 255, 0)` / `0x00ff00` |
| Optional override | `chromaKey` in config |
| Timecode | enabled `true`; corner `bottom-right`; size `96` px |
| Timecode encode | Unity 8×8 LSB; bit 0 bottom-left |

Committed config keeps `"outputMode": "preview"` unless the studio sets chroma for the session. Timecode defaults match `public/config.json` / Phase 3.2 (`NearestFilter` / point sampling — should look blocky, not soft).

## Pass / fail checklist

- [ ] App runs; telemetry / scene visible in preview first (optional sanity)
- [ ] Chroma clear is pure green (no sky / dark bleed in keyed areas)
- [ ] vMix keys cleanly (minimal spill / hole-punch on green)
- [ ] AR overlays readable after key
- [ ] Visual timecode visible, pointy / nearest (not smeared), bottom-right
- [ ] No reliance on NDI

## Results (human fills after studio)

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| Pass / fail | |
| Notes | |
| Screenshot paths (optional) | |

## Related

- Output module notes: [`src/output/README.md`](../../src/output/README.md)
- Dispatch: `DSP-OUT-20260727-03-vmix-chroma-experiment`
- Later: Phase **5.3** air runbook may absorb this checklist
