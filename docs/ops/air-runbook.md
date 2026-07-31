# Air runbook — preferred studio path + chroma fallback

End-to-end ops for putting **broadcast-web on air**.

| Path | Role | How |
| --- | --- | --- |
| **Electron + alpha NDI** | **Preferred** studio air (Phase **7.6**) | `desktop/` shell → named NDI `broadcast-web` → vMix/OBS as **alpha** layer (`outputMode=transparent`) |
| **Chrome + chroma** | **Fallback** | Fullscreen Chrome → green clear → OBS/vMix window capture → chroma key |

**Locks:** end-state **A + alpha** (not green-key NDI). Human **Pass** on alpha ingest: 2026-07-31 — [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md).  
Shell run notes: [`../../desktop/README.md`](../../desktop/README.md). Contract: [`../architecture/ndi-alpha-electron.md`](../architecture/ndi-alpha-electron.md). Path scores: [`ndi-path-evaluation.md`](./ndi-path-evaluation.md).

This doc absorbs the Phase **3.5** studio chroma checklist ([`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md)). Milestone **C** (chroma) passed 2026-07-30; alpha NDI is now the preferred studio path.

## Non-goals

- Deploying to Hetzner from this checklist (see [`hetzner-static-deploy.md`](./hetzner-static-deploy.md))
- Installing WSS/proxy TLS on a VPS (see [`wss-live-telemetry.md`](./wss-live-telemetry.md))
- In-browser NDI, Electron SPA rewrite, or path **B** helper
- Killing the chroma code path (fallback stays supported)
- electron-builder / installer polish

---

## Preferred — Electron + alpha NDI

### Prerequisites

| Item | Notes |
| --- | --- |
| Studio PC | Electron shell + **vMix or OBS** on the **same LAN** (typically same machine) |
| App source | Local Vite (`npm run dev`) **or** `npm run build` + `npm run desktop:file` |
| Clear mode | **`outputMode=transparent`** (alpha 0 plate; opaque AR + timecode) |
| NDI runtime | Bundled with `grandi` / NDI Tools on the studio PC |
| Source name | Default **`broadcast-web`** → appears as `HOSTNAME (broadcast-web)` |

### Steps — preferred path

1. From repo root (once): `npm install` and `npm install --prefix desktop`.
2. **Dev:** terminal 1 → `npm run dev`. Terminal 2 → `npm run desktop:dev`.  
   **File build:** `npm run build` then `npm run desktop:file`.
3. Load transparent plate (URL or OUT control):
   ```text
   http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent
   ```
   Or set `BROADCAST_WEB_URL` before `desktop:dev` (see desktop README).
4. Confirm NDI name (override: `BROADCAST_NDI_NAME` / `--ndi-name=`). Disable only for shell debug: `--no-ndi`.
5. In **vMix** (or OBS): **Add Input → NDI** → select `… (broadcast-web)`.
6. Place on a layer above camera/plate. Compositing must use source **alpha**.
7. **Do not** enable Chroma Key / Colour Key on this NDI input.
8. Confirm: empty sky/sea see-through; boats/course/overlays opaque; **8×8** visual timecode sharp (nearest, not soft-scaled).

Full ingest detail: [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md).

### Park / tray (do not OS-minimize)

Windows OS minimize freezes WebGL. The shell **parks** off-screen instead:

1. Minimize or ✕ → window parks; NDI keeps ~30 fps at **1920×1080**
2. System tray → **Show studio** (or double-click) to restore
3. Tray → **Quit** to exit (✕ alone does not quit while NDI is on)

---

## Cutover checklist (path A vs Unity / Chrome)

Use before a show that runs **broadcast-web** as the AR NDI layer.

### Pre-show

- [ ] Repo ready: `npm install` + `npm install --prefix desktop` (once per machine)
- [ ] Start path: **Vite + `desktop:dev`** *or* **`build` + `desktop:file`**
- [ ] SPA in **`outputMode=transparent`** (not `chroma`, not `preview` for air)
- [ ] Race pack loaded if needed (`?race=demo-istanbul` or show pack)
- [ ] NDI name visible in vMix/OBS: `HOSTNAME (broadcast-web)` (or override)
- [ ] vMix/OBS NDI input selected; layer above plate; **no** chroma key on NDI
- [ ] Alpha OK (see-through empty); AR opaque; **8×8** timecode sharp
- [ ] Know park/tray restore (do not rely on OS minimize)
- [ ] Fallback ready: Chrome + chroma steps below (bookmark this runbook)

### Parallel with Unity NDI

Until BW + studio explicitly OK dropping Unity:

- [ ] Keep Unity NDI input available in the switcher (muted / off-air)
- [ ] Prefer broadcast-web `broadcast-web` source on program when path A is clean
- [ ] Do not remove Unity from the show template until cutover is signed off

### Rollback

If NDI missing, alpha wrong, freeze, or latency unacceptable:

1. Stop relying on the Electron NDI input (mute / remove from program).
2. Switch to **Chrome + chroma** path below (same machine capture + green key).
3. Optional: fall back to **Unity NDI** if still in parallel.

Rollback target = this runbook’s **Fallback** section (not green-key on the Electron NDI source).

### Post-show / gate notes

| Gate | Owner |
| --- | --- |
| Drop Unity from show template | BW + studio explicit OK (Phase **5.6**) |
| Prefer Electron NDI for studio shows | OUT docs + human Pass (done 2026-07-31); ops follow preferred path |
| Keep chroma code / docs | Always — fallback |

---

## Fallback — Chrome + chroma

Use when NDI is unavailable or alpha looks wrong. Solid green clear → window capture → chroma key.

### Prerequisites

| Item | Notes |
| --- | --- |
| Studio PC | **Chrome** + **OBS or vMix** on the **same machine** as capture |
| App source | Local `npm run dev` **or** hosted HTTPS SPA URL after static deploy smoke |
| Compositor | OBS (chroma key) or vMix (chroma key) |
| Telemetry default | **mock** or **replay** is enough for air; live is optional |
| Config | Committed `public/config.json` may stay `"outputMode": "preview"` — set chroma per session |

### Choose URL: local vs hosted

#### A — Local (dev)

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

#### B — Hosted (Hetzner / static SPA)

```text
https://YOUR_SPA_DOMAIN/
https://YOUR_SPA_DOMAIN/?race=demo-istanbul
https://YOUR_SPA_DOMAIN/?race=demo-istanbul&outputMode=chroma
```

Full deploy steps: [`hetzner-static-deploy.md`](./hetzner-static-deploy.md). Hosted URL can replace `npm run dev` once smoke items 1–5 there pass.

**Same-PC rule still applies for capture:** Chrome and OBS/vMix must run on the studio PC that captures the window.

### Race pack

```text
http://127.0.0.1:5173/?race=demo-istanbul
https://YOUR_SPA_DOMAIN/?race=demo-istanbul
```

Confirm fleet/course fixtures resolve (`/races/<id>/project.json` → 200). Miss → warn + `config.json` boot (see deeplink / race-project contracts).

### Steps — chroma on air

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

### Expected defaults (chroma)

| Item | Value |
| --- | --- |
| Preview clear | `#1a1a1a` / `0x1a1a1a` |
| Chroma clear (default key) | `#00ff00` / RGB `(0, 255, 0)` / `0x00ff00` |
| Optional override | `chromaKey` in config |
| Timecode | enabled `true`; corner `bottom-right`; size `96` px |
| Timecode encode | Unity 8×8 LSB; bit 0 bottom-left; NearestFilter |
| Telemetry for air | default **mock** (or **replay**) is enough |
| `whepUrl` | can stay empty; underlay is **stopped in chroma** (keeps green clean) |

### Optional — live telemetry (WSS)

Mock/replay need no WebSockets. For **live** on an **HTTPS** hosted page, browsers block `ws://` (mixed content). Use **`wss://`**. Full runbook: [`wss-live-telemetry.md`](./wss-live-telemetry.md).

```text
https://YOUR_SPA_DOMAIN/?race=demo-istanbul&mode=live&outputMode=chroma
```

WS URLs come from host `config.json` / `VITE_WS_*`, not from deeplink query params. Empty `wsUrl` → live idles (warn, no crash). Local `http://localhost` may use `ws://` or `wss://`.

### Pass / fail checklist (chroma fallback)

- [ ] App loads (local or hosted); race pack optional but recommended (`?race=demo-istanbul`)
- [ ] Chroma clear is pure green (no sky / dark / WHEP bleed in keyed areas)
- [ ] OBS or vMix keys cleanly (minimal spill / hole-punch on green)
- [ ] AR overlays readable after key
- [ ] Visual timecode visible, pointy / nearest (not smeared), bottom-right
- [ ] Chrome + compositor on the **same** PC

### Results (human fills after studio / air)

| Field | Value |
| --- | --- |
| Date | |
| Operator | |
| Path used (Electron NDI / Chrome chroma) | |
| URL or shell mode (dev / file / hosted) | |
| Capture / ingest (NDI name or OBS/vMix window) | |
| Pass / fail | |
| Notes | |
| Screenshot paths (optional) | |
| `git log -1` on studio PC (optional) | |

### Historical — Milestone C (Phase 3.5 chroma)

| Field | Value |
| --- | --- |
| Date | 2026-07-30 |
| Operator | Fusilis (studio PC) |
| Pass / fail | **Pass** |
| Notes | OBS window capture + chroma key. Output must be `chroma` (not `preview`) for green clear. Milestone C met. |
| Accepted | BW / OUT 2026-07-30 — Phase 3.5 closed |

### Historical — alpha NDI Pass (Phase 7.3 / 7.4)

| Field | Value |
| --- | --- |
| Date | 2026-07-31 |
| Pass / fail | **Pass** |
| Record | [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md) Results |
| Notes | 1080p lock; park-on-minimize; source `DESKTOP-264DNL1 (broadcast-web)` |

---

## Related

| Doc | Role |
| --- | --- |
| [`../../desktop/README.md`](../../desktop/README.md) | Studio Electron shell + NDI send |
| [`vmix-ndi-alpha-runbook.md`](./vmix-ndi-alpha-runbook.md) | vMix/OBS alpha NDI ingest (human Pass) |
| [`../architecture/ndi-alpha-electron.md`](../architecture/ndi-alpha-electron.md) | Path A product contract |
| [`ndi-path-evaluation.md`](./ndi-path-evaluation.md) | A/B/C scores; BW lock A + alpha |
| [`vmix-chroma-runbook.md`](./vmix-chroma-runbook.md) | Phase 3.5 experiment record (chroma) |
| [`ndi-c-spike-runbook.md`](./ndi-c-spike-runbook.md) | Phase 7.1 path C trial (closed; not production NDI) |
| [`hetzner-static-deploy.md`](./hetzner-static-deploy.md) | Static SPA build / upload / TLS / smoke |
| [`wss-live-telemetry.md`](./wss-live-telemetry.md) | Live mode over `wss://` on HTTPS |
| [`../../src/output/README.md`](../../src/output/README.md) | OUT clear modes, timecode, WHEP, frame pump |
| Roadmap Phase 5.3 / 7.6 | [`docs/roadmap/phases-roadmap.md`](../roadmap/phases-roadmap.md) |
