# Multi-channel output — 2D / 3D / AR, always-on NDI, adjustable delay

**Status:** Design + **wave 1 multi-sender bridge landed** (`DSP-OUT-20260812-01`);
channels 13.3–13.4 pumps + **13.6 delay buffer** (`DSP-OUT-20260812-05`) landed.
Local screen switcher (13.5 / OUT-04) may land in parallel.  
**Owner:** OUT (bridge/NDI/switcher), with SCN (3D channel content), CAL (calibration hooks),
PLT (config/schema).  
**Requested:** 2026-08-12 (user) — see companion docs
[`realistic-3d-environment.md`](./realistic-3d-environment.md) and
[`ar-calibration-map-overlay.md`](./ar-calibration-map-overlay.md).

**Delay BW locks (13.6):** default `0` (no ring); max `30000` ms; allocate only when
`delayMs > 0`; UI warns above `3000` ms; per-channel `ar`/`3d`/`2d`.

## 1. The ask, in the app's existing vocabulary

The user asked for three simultaneous ways to stream — **2D**, **3D**, **AR** — all sending NDI
at the same time, with a bigger on-screen switcher, plus an adjustable NDI delay buffer and an
AR-calibration coordinate overlay.

Mapped onto what already exists in this codebase:

| User's term | Existing system | Today's status |
| --- | --- | --- |
| **2D** | The ops/authoring map (`src/scene/map2d.ts`) and its viewer-facing sibling `createStreamMap2d` (`src/scene/streamMap.ts`) | DOM canvas only; **not** an NDI source (`STREAM_MAP_NDI_BRIDGE_SUPPORTED = false`, `src/output/ndiControllerPanel.ts:21`) |
| **3D** | **The exact same** Three.js scene (`src/scene/createScene.ts`), same active-POV camera, same boats/course — just cleared **opaque** instead of transparent, with a sea/sky model added to the environment (see [`realistic-3d-environment.md`](./realistic-3d-environment.md)) | Today only runs with `preview` (dark ops) or `transparent` (alpha, AR) clears. Adding this channel is **not new rendering logic** — it's the current scene + a 4th clear-mode-like variant + a sea model, not a parallel pipeline |
| **AR** | The existing transparent-clear NDI plate — boats/course/overlays/timecode composited live over real camera footage in vMix | **Already the whole product today.** Every doc that says "AR" (`docs/architecture/ndi-alpha-electron.md`, `docs/ops/air-runbook.md`, etc.) means exactly this: `outputMode=transparent`, alpha 0 background, opaque AR content only |

So this is not three brand-new products, and **not three different rendering logics** — it's one
scene rendered three ways:

1. **AR** = today's scene, transparent clear (unchanged).
2. **3D** = the **same** scene, opaque clear, plus a sea/sky model in the background so the
   opaque areas look like something instead of a flat color.
3. **2D** = the separate, already-built map canvas, just finally wired to its own NDI sender.

All three keep sending NDI **regardless of which one the operator is looking at**, which is the
one genuinely new invariant: today only one render (whichever clear mode is active) is ever
produced/sent at a time. Making all three run continuously is the actual engineering work here —
not inventing new 3D content.

## 2. Channel model

```
┌────────────────────────────────────────────────────────────────────┐
│ Electron renderer                                                   │
│                                                                      │
│  ┌───────────┐   ┌───────────────────┐   ┌───────────────────────┐ │
│  │ 2D channel│   │ 3D channel        │   │ AR channel            │ │
│  │ map canvas│   │ SAME scene FBO,   │   │ SAME scene FBO,       │ │
│  │ (own draw)│   │ opaque clear +    │   │ transparent (alpha 0) │ │
│  │           │   │ sea/sky model     │   │ clear — unchanged     │ │
│  └─────┬─────┘   └─────────┬─────────┘   └───────────┬───────────┘ │
│        │  readback/frame     │ readback/frame           │ readback  │
│        ▼                     ▼                          ▼          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ per-channel RAM ring buffer (delay 0–30000 ms, §4)          │    │
│  └───────────────────────────┬────────────────────────────────┘    │
└────────────────────────────────────────────┬───────────────────────┘
                                              │ IPC (one message per channel)
                                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ Electron main — multi-sender NDI bridge (§3)                       │
│   sender[2d] / sender[3d] / sender[ar]  →  grandi.send each          │
│   Names: e.g. `broadcast-web-2d` / `-3d` / `-ar` (configurable)     │
└────────────────────────────────────────────┬───────────────────────┘
                                              │ LAN
                                              ▼
                              vMix — 3 independent NDI inputs
```

Key properties:

- **All three render continuously**, whether or not the operator's local preview is looking at
  them. This is a change from today, where only the on-screen camera is rendered.
- **Local on-screen focus is independent of NDI.** The Ops "which one am I looking at" switch
  (§5) never starts/stops a channel's render or its NDI send — it only changes what fills the
  operator's screen. Same pattern as the existing air-camera-lock invariant (preview ≠ air is
  already normal; this just extends it to three lanes instead of one).
- **AR keeps today's exact contract** — `outputMode=transparent`, active-POV lock, alpha 0
  background — unchanged. It becomes "one of three channels" in name only.
- **3D reuses the AR render path wholesale** — same active-POV camera, same boats/course/scene
  graph — just an **opaque** clear instead of transparent, and a sea/sky model added to the
  environment so the areas that used to be "see-through" now show something. No second scene, no
  new camera rig, no new content pipeline. Useful as a clean "virtual broadcast" look independent
  of a real camera underneath, and as the home for the AR-calibration coordinate overlay
  (companion doc) when a real camera comparison isn't wanted.
- **2D** finally gets the NDI sender that Phase 11 stubbed out — `createStreamMap2d`'s canvas
  (or a dedicated higher-res render target) becomes a fourth-ish frame source, but conceptually
  one of the three requested channels.

## 3. Multi-sender NDI bridge (blocking prerequisite)

Today `desktop/ndiSender.cjs` owns exactly **one** `grandi` sender and one IPC pair
(`ndi:start` / `ndi:frame` — see `src/output/README.md` §"Electron NDI frame pump", and
`ndiControllerPanel.ts:16-21` for the explicit single-sender comment). This must become
**N independent named senders**, each fed by its own IPC channel (or one channel carrying a
`channel: '2d' | '3d' | 'ar'` tag), each independently started/stopped/reporting status.

This is the one piece all three channels share and the one piece that must land first — it's a
pure `desktop/` (main-process) refactor, no product-visible change until channels are wired to
it.

Proposed shape (naming indicative, not final):

```js
// desktop/ndiSender.cjs (sketch)
const senders = new Map() // channel id -> { sender, name, sdkVersion, error }
async function start(channelId, name) { /* one grandi sender per channelId */ }
function sendFrame(channelId, frame) { /* route to senders.get(channelId) */ }
function getStatus(channelId) { /* per-channel status for the NDI tab, §5 */ }
```

## 4. Adjustable NDI delay (RAM buffer, 0–30000 ms)

**Ask:** each output keeps an internal, adjustable delay (milliseconds, max **30000 ms** /
30 s) — frames sit in RAM and are sent late, so the operator can time-align broadcast-web's
outputs against a separately-delayed live camera feed (or hide brief telemetry glitches) without
re-plumbing the studio's video path.

**Mechanism:** a per-channel ring buffer of already-rendered frames sits between capture
(`readPixels`) and the IPC send to the main-process sender. Each tick: push the new frame with a
timestamp, then pop and send whichever buffered frame is now `delayMs` old. Delay is adjustable at
runtime (ops UI, §5) without restarting the render loop.

**The memory cost is the real engineering risk here and must be sized before a dispatch is
written:**

| Resolution | Frame size (RGBA8) | Frames for 30 s @ 30 fps | RAM for 30 s buffer |
| --- | --- | --- | --- |
| 1920×1080 | ~8.3 MB | 900 | **~7.5 GB** |
| 1080×1920 (as requested, §5) | ~8.3 MB | 900 | **~7.5 GB** (same pixel count) |

That is **per channel** — three channels each holding a full 30 s buffer at 1080p is realistically
**~22 GB of RAM**, which is not acceptable to just ship as the default. Options to bring this down,
roughly in order of preference (to decide before the OUT dispatch, not during it):

1. **Cap the *default* well below 30000 ms** (e.g. a few seconds) and clearly label the slider's
   upper end as "expensive" — keep 30000 ms as the *allowed max* per the ask, not the common case.
2. **Store buffered frames compressed in RAM** (e.g. re-encode each buffered frame to a
   lightweight format before storing, decode on send) — trades CPU for RAM; only matters for the
   long tail of the delay range.
3. **Only buffer at all when `delayMs > 0`** — zero-delay (the expected common case) bypasses the
   ring buffer entirely and sends immediately, so the memory cost is opt-in per channel.
4. **Reduce buffered-frame rate** (e.g. store at 15 fps for the buffer even if the live path is
   30 fps) when delay is large — halves memory for long delays at the cost of smoothness.

None of this blocks writing the design — it blocks picking a **default** and a **hard cap
enforcement point** in code. The dispatch should pin one of (1)–(4) (or a combination) explicitly.

**Config surface (draft):** `outputDelayMs.{2d,3d,ar}` (or one shared knob first, per-channel
later) in `public/config.json`, clamped `0..30000`, plus an Ops sidebar control (near the
NDI tab) to change it live per channel.

## 5. Ops switcher — bigger, 3 buttons, local focus only

**Ask:** "bigger area to switch between 2D, 3D and AR... 3 buttons... the one I click needs to be
shown on screen." Today's `startOutputModeControl` (`src/output/outputModeControl.ts`) is a small
dropdown for `preview`/`chroma`/`transparent` mounted at the top of the Ops sidebar section
(`src/output/README.md` §"Clear modes"). This is a **different axis** — clear/compositing mode is
about *how* a channel clears (still needed for AR: transparent vs chroma-fallback vs local dark
preview); the new 3-button switcher is about **which of the three always-running channels fills
the operator's screen right now**.

Proposed: a new, visually prominent control — three big labeled buttons (`2D` / `3D` / `AR`) —
replacing the cramped dropdown real estate, living in the Ops sidebar (or, since "bigger area" was
explicit, potentially the top of the World Authoring workspace / a dedicated header strip so it's
not squeezed into the 340px rail). Whichever is active gets a clear pressed/highlighted state, and
that channel's canvas is what's visible in the local Electron window. `outputMode`
(preview/chroma/transparent) keeps governing the **AR** channel's own clear behavior underneath
this switcher — the two controls compose (switcher picks *which* channel you see; output mode
picks how the AR channel would clear if it's the fallback Chrome/chroma path without Electron
multi-sender NDI available).

**NDI tab (`src/output/ndiControllerPanel.ts`) becomes per-channel:** status/source
name/SDK/error rows repeated ×3 (2D / 3D / AR), each independently `live`/`stopped`/`error`,
since the whole point is all three keep running independent of screen focus.

## 6. Resolution — flag before building

**Ask (verbatim):** "all has to stream 1080X1920 res even they dont maximized." Today's studio
lock is **1920×1080 landscape** — canonical constants `STUDIO_OUTPUT_WIDTH/HEIGHT` in
`src/output/studioOutput.ts:5-6`, passed in as `startScene({ outputSize: { width, height } })` at
boot (`src/main.ts:1314-1319`), enforced by a `lockedOut` path in `src/scene/createScene.ts:406-424`
that forces `renderer.setSize(width, height, false)` so the drawing buffer stays fixed while CSS
size follows the window; the Electron window itself (`STUDIO_WIDTH/HEIGHT`,
`desktop/main.cjs:32-33`) is separate and does not drive NDI pixels. This is exactly the "even they
dont maximized" property already built for the single AR channel today — extending it to three
channels means each gets its own locked render target through the same `lockedOut` mechanism,
not a new one.

`1080×1920` as written is **portrait** (width × height), the opposite orientation from today's
lock. This doc intentionally does **not** silently "correct" that to `1920×1080` — it's recorded
here as-requested so it isn't lost, but it needs an explicit confirm-or-correct from the user
before a dispatch pins it, since it's a broadcast-format decision (vertical/social-style output),
not an implementation detail:

- If genuinely portrait (e.g. targeting vertical/mobile/social simulcast): all three channels
  render into a 1080×1920 drawing buffer/FBO regardless of window size, same "locked buffer size,
  independent of window" pattern as today, just rotated.
- If this was meant as the familiar "1920×1080" shorthand mis-ordered: no change needed, keep the
  existing landscape lock and just extend it to the new 3D/2D channels.

Either way, the **mechanism** is identical to what already exists for AR (fixed drawing-buffer
size decoupled from the Electron window's CSS size) — only the concrete numbers are in question.

## 7. Relationship to existing invariants (must not regress)

- **NDI = active POV only**, never free cam (`src/output/README.md` §"Air camera lock") — holds
  for the 3D and AR channels; 2D has no camera concept (map projection instead).
- **Sidebar is DOM-only / never touches capture** (`docs/architecture/unified-ops-sidebar.md`
  §2) — the new bigger switcher is still DOM; it only decides which already-rendered channel is
  blitted to the visible canvas locally.
- **No in-browser NDI** — Chrome without the Electron studio bridge still can't send any of the
  three; the NDI tab shows `unavailable` for all three exactly like it does today for one.

## 8. Suggested phase breakdown (for BW to dispatch later — not written yet)

1. **Multi-sender NDI bridge** (`desktop/`, OUT) — pure main-process refactor; land first, no
   product-visible change, unblocks everything else.
2. **3D channel** (SCN + OUT) — reuse the existing AR render path with an opaque clear + add the
   sea/sky model ([`realistic-3d-environment.md`](./realistic-3d-environment.md)); no new camera
   or content pipeline.
3. **2D channel wired to its own NDI sender** (OUT) — turn on the Phase 11 stub now that (1)
   exists.
4. **Ops 3-way switcher + per-channel NDI tab** (OUT) — the bigger UI from §5.
5. **Per-channel delay buffer** (OUT) — §4, with an explicit memory-budget decision recorded in
   the dispatch itself.
6. **AR calibration map overlay** (CAL + SCN) — separate companion doc
   ([`ar-calibration-map-overlay.md`](./ar-calibration-map-overlay.md)); can land independently of
   1–5 since it only needs the existing single AR channel.

## Open questions (confirm before dispatching)

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | Is `1080×1920` really portrait, or shorthand for today's `1920×1080`? | Changes every channel's render target + vMix input setup |
| 2 | ~~Default NDI delay, and which memory-mitigation option (§4) to ship first?~~ **Locked in OUT-05:** default 0; allocate only when `delayMs > 0`; UI warn >3000 ms; max 30000. | Avoids shipping a slider that can silently eat ~7.5 GB/channel |
| 3 | Does the 3D channel need its **own** independent output-mode-style clear config, or is "opaque, always" sufficient for v1? | Determines whether `outputMode` grows a 4th value or stays AR-only |
| 4 | Where does the "bigger" switcher physically live — Ops sidebar, or a new header strip outside the 340px rail? | UI real estate / whether it competes with the World Authoring workspace |
