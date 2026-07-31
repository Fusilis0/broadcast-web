# Phase 5.3 — Air runbook (Chrome + chroma)

End-to-end checklist for putting **broadcast-web on air today**: fullscreen Chrome → solid green chroma clear → OBS or vMix window capture → key → AR + visual timecode on the keyed plate.

This is the **canonical air path**. It absorbs the Phase **3.5** studio chroma checklist ([`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md)). Milestone **C** already passed (2026-07-30); keep this doc as the durable ops procedure.

**NDI is not required** for the current air path. Native NDI / Electron helper remain **Phase 7** (future). Do not block on-air on NDI.

## Non-goals

- Deploying to Hetzner from this checklist (see [`hetzner-static-deploy.md`](./hetzner-static-deploy.md))
- Installing WSS/proxy TLS on a VPS (see [`wss-live-telemetry.md`](./wss-live-telemetry.md))
- In-browser NDI, Electron SPA, or native helper work
- Changing chroma / timecode product code

## Prerequisites

| Item | Notes |
| --- | --- |
| Studio PC | **Chrome** + **OBS or vMix** on the **same machine** as capture (window/screen capture) |
| App source | Local `npm run dev` **or** hosted HTTPS SPA URL after static deploy smoke |
| Compositor | OBS (chroma key) or vMix (chroma key) — both accepted |
| Telemetry default | **mock** or **replay** is enough for air; live is optional |
| Config | Committed `public/config.json` may stay `"outputMode": "preview"` — set chroma per session |

## Choose URL: local vs hosted

### A — Local (dev)

```bash
npm install
npm run dev
```

Open the printed URL in **Chrome** (usually `http://localhost:5173` or `http://127.0.0.1:5173`).

Optional production-build check on the same PC:

```bash
npm run build
npm run preview
```

### B — Hosted (Hetzner / static SPA)

Use the HTTPS origin after deploy smoke passes (canvas, geoid, race pack):

```text
https://YOUR_SPA_DOMAIN/
https://YOUR_SPA_DOMAIN/?race=demo-istanbul
https://YOUR_SPA_DOMAIN/?race=demo-istanbul&outputMode=chroma
```

Full deploy steps: [`hetzner-static-deploy.md`](./hetzner-static-deploy.md). Hosted URL can replace `npm run dev` once smoke items 1–5 there pass.

**Same-PC rule still applies for capture:** Chrome showing the page and OBS/vMix must run on the studio PC that captures the window (remote desktop to a far machine is out of scope for this runbook).

## Race pack

Load a pack with `?race=`:

```text
http://127.0.0.1:5173/?race=demo-istanbul
https://YOUR_SPA_DOMAIN/?race=demo-istanbul
```

Confirm fleet/course fixtures resolve (`/races/<id>/project.json` → 200). Miss → warn + `config.json` boot (see deeplink / race-project contracts).

## Steps — chroma on air

1. Open the **local or hosted** URL in **Google Chrome**.
2. Optional sanity: leave **preview** — dark clear (`#1a1a1a`), boats/course when the mock camera looks at the fleet, HUD/map.
3. Prefer **fullscreen** Chrome on the output monitor (F11 or OS fullscreen). Hide other windows over the WebGL area.
4. Set **chroma** for this session (any one):
   - Runtime OUT **output** control → `chroma`, **or**
   - Query `?outputMode=chroma` (with other params as needed), **or**
   - Session config `"outputMode": "chroma"` then reload  
   Do **not** require committing chroma as the repo default.
5. Confirm clear is **solid green** behind AR (boats / course / overlays). Green = `#00ff00` / RGB `(0, 255, 0)`. Optional override: `chromaKey` in config.
6. In **OBS** or **vMix** (same PC):
   - **OBS:** Add **Window Capture** (or Display Capture / region) → select the **Chrome** window covering the WebGL view → filter **Chroma Key** → key colour green `#00ff00`.
   - **vMix:** **Add Input** → **Window Capture** (or Screen / region) → select **Chrome** → apply **Chroma Key** → green `#00ff00`.
7. Put a background under the keyed layer (camera, clip, or colour bars) so you can see the composite.
8. Confirm AR composites cleanly; confirm the **8×8** visual timecode barcode is visible and sharp (default **bottom-right**, ~96 px — blocky / nearest, not soft).
9. Fill **Results** below after the show or rehearsal. Do **not** rely on NDI.

## Expected defaults

| Item | Value |
| --- | --- |
| Preview clear | `#1a1a1a` / `0x1a1a1a` |
| Chroma clear (default key) | `#00ff00` / RGB `(0, 255, 0)` / `0x00ff00` |
| Optional override | `chromaKey` in config |
| Timecode | enabled `true`; corner `bottom-right`; size `96` px |
| Timecode encode | Unity 8×8 LSB; bit 0 bottom-left; NearestFilter |
| Telemetry for air | default **mock** (or **replay**) is enough |
| `whepUrl` | can stay empty; underlay is **stopped in chroma** (keeps green clean) |
| NDI | **not used** — Phase 7 later |

## Optional — live telemetry (WSS)

Mock/replay need no WebSockets. For **live** on an **HTTPS** hosted page, browsers block `ws://` (mixed content). Use **`wss://`** (native on the telemetry host or same-origin reverse proxy on the SPA host).

Pointers only — full runbook: [`wss-live-telemetry.md`](./wss-live-telemetry.md).

```text
https://YOUR_SPA_DOMAIN/?race=demo-istanbul&mode=live&outputMode=chroma
```

WS URLs come from host `config.json` / `VITE_WS_*`, not from deeplink query params. Empty `wsUrl` → live idles (warn, no crash). Local `http://localhost` may use `ws://` or `wss://`.

## Pass / fail checklist

- [ ] App loads (local or hosted); race pack optional but recommended (`?race=demo-istanbul`)
- [ ] Chroma clear is pure green (no sky / dark / WHEP bleed in keyed areas)
- [ ] OBS or vMix keys cleanly (minimal spill / hole-punch on green)
- [ ] AR overlays readable after key
- [ ] Visual timecode visible, pointy / nearest (not smeared), bottom-right
- [ ] No reliance on NDI
- [ ] Chrome + compositor on the **same** PC

## Results (human fills after studio / air)

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| URL used (local / hosted) | |
| Capture tool (OBS / vMix) | |
| Pass / fail | |
| Notes | |
| Screenshot paths (optional) | |
| `git log -1` on studio PC (optional) | |

### Historical — Milestone C (Phase 3.5)

| Field | Value |
| --- | --- |
| Date | 2026-07-30 |
| Operator | Fusilis (studio PC) |
| Pass / fail | **Pass** |
| Notes | OBS window capture + chroma key. Output must be `chroma` (not `preview`) for green clear. Milestone C met. |
| Accepted | BW / OUT 2026-07-30 — Phase 3.5 closed |

## Related

| Doc | Role |
| --- | --- |
| [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md) | Phase 3.5 experiment record (absorbed here as canonical air path) |
| [`hetzner-static-deploy.md`](./hetzner-static-deploy.md) | Static SPA build / upload / TLS / smoke |
| [`wss-live-telemetry.md`](./wss-live-telemetry.md) | Live mode over `wss://` on HTTPS |
| [`src/output/README.md`](../../src/output/README.md) | OUT clear modes, timecode, WHEP |
| Roadmap Phase 5.3 / 7 | [`docs/roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) |
