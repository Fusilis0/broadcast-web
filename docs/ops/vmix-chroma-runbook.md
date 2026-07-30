# Phase 3.5 — Local vMix chroma experiment

Studio runbook to prove the web-on-air chroma path: fullscreen Chrome, `outputMode=chroma`, vMix window capture, key on clear green, AR content and the 8×8 visual timecode readable over the keyed plate.

**Non-goals for this run:** WebRTC WHEP underlay, native NDI helper / in-browser NDI, Hetzner deploy, live VPS soak. Capture is **window / screen of Chrome** only.

**Same PC required:** Chrome (`npm run dev`) and **vMix must run on the same machine** (window/screen capture). You can clone/pull the repo onto that studio PC from GitHub.

## Setup on a studio PC (from Git)

1. Install **Node.js LTS** (includes `npm`) from https://nodejs.org if missing.
2. Install **Git** if missing.
3. Install **Google Chrome** and **vMix**.
4. Clone (or pull) the private repo (you need GitHub access to `Fusilis0/broadcast-web`):

```bash
git clone git@github.com:Fusilis0/broadcast-web.git
cd broadcast-web
git checkout main
git pull
```

Or HTTPS:

```bash
git clone https://github.com/Fusilis0/broadcast-web.git
cd broadcast-web
git pull
```

5. Install dependencies once:

```bash
npm install
```

6. Confirm you are on latest main (expected tip includes chroma + timecode + WHEP code):

```bash
git log -1 --oneline
```

## Prerequisites

- Studio PC with **Chrome**, **vMix**, and this repo (cloned as above)
- `npm install` already done (or run once)
- Local app: `npm run dev` (mock / replay telemetry is fine)
- Committed `public/config.json` may stay `"outputMode": "preview"` — use runtime OUT control or a session-only config change for chroma

## Steps

1. Start the app: `npm run dev`. Open the printed URL in **Chrome** (usually `http://localhost:5173` or `http://127.0.0.1:5173`).
2. Sanity (optional): leave **preview** — you should see dark clear, boats/course when the mock camera looks at the fleet, HUD/map.
3. Prefer **fullscreen** Chrome on the output monitor (F11 or OS fullscreen). Hide other windows over the WebGL area.
4. Set **chroma** for this session:
   - Runtime OUT **output** control → `chroma`, **or**
   - Session config `"outputMode": "chroma"` then reload  
   Do **not** require committing chroma as the repo default.
5. Confirm clear is **solid green** behind AR (boats / course / overlays). Green = `#00ff00` / RGB `(0, 255, 0)`.
6. In **vMix** (same PC): **Add Input** → **Window Capture** (or Screen / region) → select the **Chrome** window covering the WebGL view.
7. Apply **Chroma Key** on that input; key colour green `#00ff00`. Put a background under the keyed layer (camera, clip, or colour bars) so you can see the composite.
8. Confirm AR composites cleanly; confirm the **8×8** visual timecode barcode is visible and sharp (default **bottom-right**, ~96 px — blocky, not soft).
9. Fill **Results** below (or paste the table back to BW chat). Do not rely on NDI for this test.

## Expected defaults

| Item | Value |
| --- | --- |
| Preview clear | `#1a1a1a` / `0x1a1a1a` |
| Chroma clear (default key) | `#00ff00` / RGB `(0, 255, 0)` / `0x00ff00` |
| Optional override | `chromaKey` in config |
| Timecode | enabled `true`; corner `bottom-right`; size `96` px |
| Timecode encode | Unity 8×8 LSB; bit 0 bottom-left |
| Telemetry for test | default **mock** is enough (`whepUrl` can stay empty) |

Committed config keeps `"outputMode": "preview"` unless the studio sets chroma for the session. Timecode defaults match `public/config.json` / Phase 3.2 (`NearestFilter` / point sampling — should look blocky, not soft).

## Pass / fail checklist

- [ ] App runs; telemetry / scene visible in preview first (optional sanity)
- [ ] Chroma clear is pure green (no sky / dark bleed in keyed areas)
- [ ] vMix keys cleanly (minimal spill / hole-punch on green)
- [ ] AR overlays readable after key
- [ ] Visual timecode visible, pointy / nearest (not smeared), bottom-right
- [ ] No reliance on NDI
- [ ] Chrome + vMix were on the **same** PC

## Results (human fills after studio)

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| Pass / fail | |
| Notes | |
| Screenshot paths (optional) | |
| `git log -1` on studio PC (optional) | |

## Related

- Output module notes: [`src/output/README.md`](../../src/output/README.md)
- Dispatch: `DSP-OUT-20260727-03-vmix-chroma-experiment`
- Later: Phase **5.3** air runbook may absorb this checklist
