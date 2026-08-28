# Dispatch DSP-OUT-20260828-04-one-ndi-fbo-per-tick

## Meta
- From orchestrator: OUT (adopted BW draft via `HO-BW-OUT-20260828-04`)
- Worker role: WORKER(DSP-OUT-20260828-04-one-ndi-fbo-per-tick)
- Priority: P0
- Phase: Studio 30 **failed live** — hitch, not missing fps constants
- Related: `HO-BW-OUT-20260828-04` · `done/DSP-OUT-20260828-01` · `done/DSP-OUT-20260828-02`
- Status: **accepted 2026-08-28 (BW)** — tick 60; one FBO/tick including PBO; 2D stayed on. Suite **900 + 23**.
- Parallel (do not expand into): `DSP-OUT-20260828-05-pts-transcode-lut` · `DSP-OUT-20260828-06` superseded by **07**

## Amendment 2026-08-28 (BW) — paste this if the worker already started

**2D default off is void.** Operator: GPU ~10% on RX 6750 XT. That is idle GPU + blocked JS, not a weak PC. Product lock: AR + 3D + **2D** all send **30**, all **on**.

- Do **not** set `streamMapNdiWanted = false`. Keep `streamMapNdiWanted = true` and `STREAM_MAP_NDI_DEFAULT_FPS = 30`.
- If you already defaulted 2D off, **revert that** and keep the FBO stagger + tick 60 work.
- 2D hitch is **OUT-06** (async `getImageData`), not this dispatch.
- Tick 60 + one FBO per tick is how we **use more GPU** (feed the card every ~16 ms) so vMix still sees AR **and** 3D at 30 at the same time. It is not “pick one channel.”

## Goal

Stop doing **two full 1080p scene renders on the same JavaScript tick**. Electron 2026-08-28: even with 2D off, **preview 16 fps**, hitch **12 / 1s**, AR/3D Send **22**. App freezes. PBO made *readback* async; both pumps still **`directRender`** every tick when `blocking: false`. That hitch is the **renderer thread waiting**, which is why GPU % stays ~10%.

Keep the product lock: AR, 3D, **and 2D** NDI **~30 Send, default on**. This dispatch only staggers **WebGL FBO** work. Do not turn 2D off.

## Background

`tryClaimNdiHeavyCapture(..., { blocking: false })` always returns true. AR + 3D both `directRender` every `studio:tick`. Plus ops **rAF** preview. Two Cesium/ocean submits on one call stack stall JS; the 6750 XT finishes each frame quickly then sits idle.

**Clock exception (BW):** `STUDIO_TICK_FPS` may be **60** if and only if (1) preview stays rAF / not driven by this clock, (2) **one** NDI FBO render per tick (stagger AR vs 3D), (3) PBO still used. That spreads 30+30 as alternate ticks so GPU stays fed. Do **not** set tick 60 and also allow two FBOs on one tick. 2D stays on; its blocking copy is OUT-06.

If after stagger+tick 60 **and** OUT-06, preview is still &lt;30 **and GPU % is high**: **do not** silent-cap Send to 10. Report numbers; SCN cheaper 3D pass is next. If GPU % is still low, the next step is OffscreenCanvas WebGL (not dropping a sender).

## In scope

1. **Render stagger:** `tryClaimNdiHeavyCapture` must refuse a second **FBO render** on the same tick even when PBO (`blocking: false`). Async readback may still complete on that tick. Tests: AR then 3D same 8 ms window → second skipped.
2. **`STUDIO_TICK_FPS = 60`** in `desktop/main.cjs` with a comment that this is NDI stagger only. Preview dual-clock tests must still say preview is rAF, not 60 from this constant. Grep tests that forbade 60: update to the new lock (60 tick, one FBO, preview rAF).
3. **2D NDI stays default on** (`streamMapNdiWanted = true`, `STREAM_MAP_NDI_DEFAULT_FPS = 30`). Toggle still 2D-only. Do **not** implement async 2D here (OUT-06).
4. Caps doc + Output README + air-runbook one-liner: all three on @30; AR/3D via 60 Hz tick + one FBO each tick; hitch is the gate; low GPU % means JS blocked.
5. Tests for stagger + tick 60 + **2D default true**. `npm test` + `npm run build`.

## Out of scope

- PTS / `stream_anchor` (OUT-05 / SRT-01).
- Ocean/Cesium quality (SCN).
- Silent 10 fps 3D fallback.
- 2D default off (refused).
- 2D async `getImageData` (OUT-06).

## Likely files

- `src/output/ndiCaptureStagger.ts` + test
- `src/output/ndiFramePump.ts`, `ndi3dChannelPump.ts` (claim must mean “I will render”)
- `desktop/main.cjs` (`STUDIO_TICK_FPS`)
- `src/main.ts` — do **not** flip 2D wanted to false
- Tests that grep 2D default / `STUDIO_TICK_FPS`
- `docs/architecture/performance-budgets.md`, `src/output/README.md`

## Acceptance criteria

- [ ] Two NDI FBO renders cannot run in the same stagger window, including PBO mode.
- [ ] Studio tick 60; preview still rAF.
- [ ] 2D NDI still starts **on** @ 30.
- [ ] Worker does not assert GPU fps. Electron numbers are operator.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Tick 60 vs stayed 30 (if 60 was blocked, why)
2. Files
3. Tests
4. Suggested OUT/PRF memo

## Worker paste block

```
You are WORKER(DSP-OUT-20260828-04-one-ndi-fbo-per-tick).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260828-04-one-ndi-fbo-per-tick.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-BW-OUT-20260828-04.md
4. src/output/ndiCaptureStagger.ts, ndiFramePump.ts, ndi3dChannelPump.ts
5. desktop/main.cjs (STUDIO_TICK_FPS)
6. docs/architecture/performance-budgets.md

Implement: one NDI FBO render per stagger window (even when PBO blocking:false);
STUDIO_TICK_FPS=60 NDI-only (preview stays rAF); 2D NDI stays default ON @ 30
(do not set wanted false — async 2D is OUT-06). Do not silent-cap Send to 10.
Do not touch PTS/OUT-05. Report back per dispatch.
```
