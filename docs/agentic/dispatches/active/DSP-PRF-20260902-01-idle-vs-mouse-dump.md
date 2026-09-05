# Dispatch DSP-PRF-20260902-01-idle-vs-mouse-dump

## Meta
- From orchestrator: PRF (`HO-BW-PRF-20260902-01`)
- Worker role: WORKER(DSP-PRF-20260902-01-idle-vs-mouse-dump)
- Priority: P0
- Phase: measurement — idle ~8 vs mousedown+hover >40
- Related: `HO-BW-PRF-20260902-01`, `HO-OUT-BW-20260902-01`, `done/DSP-PRF-20260829-01-ndi-stage-timing.md`
- FYI: OUT (dump wiring on pumps / controller; no pixel-path change)

## Goal

Make one pasted dump answer **preview HUD vs Send AR/3D/2D vs `tickIntervalMs`**, for a **10 s idle** window and a **10 s mousedown+hover** window. Do **not** raise fps. Do **not** fake mouse input. Caps stay preview ~60 rAF, NDI **30/30/30**, `STUDIO_TICK_FPS` **60**.

Operator: idle ~8 crunchy; mouse down + hover feels >40. Nobody shipped a click boost. Need A/B/C from numbers, then PRF hands OUT only if a **named stage** (likely 3D CPU UYVY pack, OUT-06) is the idle hog.

## Background

Read, in order:

1. `docs/architecture/performance-budgets.md` (caps + existing dump legend). Ignore stale `BOOTSTRAP_PRF` “3D ~10 / tick 30”.
2. `docs/agentic/handoffs/HO-BW-PRF-20260902-01.md`
3. `src/output/ndiStageTiming.ts` — `formatNdiStageDump` / `window.__perfDump`. Dump has `tickIntervalMs`, `captureTicks`, stages. It does **not** stamp Race ops **preview** fps, **hitch**, or Output **Send**.
4. Race ops `preview` + `hitch`; Output rail **Send** per channel (`getSendFps()`). HUD already splits preview vs Send — the paste must include both.
5. `src/output/ndi3dChannelPump.ts` — live 3D send is full-size RGBA → CPU `createNdiPackPool('uyvy')`. That work is folded into `3dReadbackDrain` / `3dEnqueueIpc` today.

`backgroundThrottling` is already false. `STUDIO_TICK_FPS` is already 60. Preview is rAF; NDI is `studio:tick`.

## In scope

1. **Dump header snapshot** (at Copy / `__perfDump()` time)
   - `session=` `idle` | `mousedown` (from the button that copied, or an argument to `__perfDump('idle')`).
   - `previewFps=` Race ops 1 s preview fps.
   - `hitch50=` hitch/s (`dt>50ms` count).
   - `sendFps ar=/3d=/2d=` live Send counters.
   - Existing `tickIntervalMs` / stages / `captureTicks` stay.

2. **Two copy actions** on Output → Stage timing (keep the existing 10 s window)
   - **Copy idle 10 s** and **Copy mouse 10 s**.
   - They **only** label the dump. They must **not** dispatch mouse events, hover CSS, `robotjs`, or rAF pumps.
   - Operator still holds the real mouse for the mouse dump.

3. **Name 3D CPU pack** as its own stage if it is not already a dedicated `NDI_STAGE_NAMES` entry: `timeNdiStage('3dCpuPack', …)` around `packPool.pack` in the 3D pump only. Do not change pack math, dest size, or GPU UYVY.

4. Tests: dump text contains `session=`, `previewFps=`, `sendFps`; buttons do not call `dispatchEvent` / `MouseEvent`. Existing dump/histogram tests stay green. Do **not** assert GPU fps.

## Out of scope

- Fake mousedown, cursor jiggle, `setInterval` rAF keep-alive.
- Changing `STUDIO_TICK_FPS`, `backgroundThrottling`, NDI default fps, stagger, PBO, or 2D worker.
- Re-implementing 19.3 stripes / GPU UYVY.
- SCN look / seaQuality.
- Productizing “click to go faster.”

## Likely files

- `src/output/ndiStageTiming.ts` (+ test)
- `src/output/ndiControllerPanel.ts` (+ test)
- `src/output/ndi3dChannelPump.ts` (`3dCpuPack` timer only)
- `src/main.ts` (inject `getPreviewFps` / hitch / `getSendFps` into the dump)
- `src/output/README.md` — one paragraph: idle vs mouse copy
- `docs/architecture/performance-budgets.md` — only if the worker must point at the new header keys (PRF already added the playbook)

## Inputs provided

- `Copy 10 s dump` + `__perfDump()` already exist.
- Preview fps + hitch HUD + Send rows already exist.
- Playbook (A/B/C) is in `performance-budgets.md` § Measurement, idle vs mouse.

## Acceptance criteria

- [ ] Paste from **Copy idle 10 s** includes `session=idle` plus preview fps, hitch50, sendFps ar/3d/2d, and `tickIntervalMs`.
- [ ] Paste from **Copy mouse 10 s** includes `session=mousedown` and the same fields.
- [ ] No synthetic input in the worker diff.
- [ ] `3dCpuPack` appears in the stages list when 3D actually packs (count can be 0 if no 3D send in that window).
- [ ] Caps unchanged: Send targets 30/30/30; `STUDIO_TICK_FPS` still 60; preview still rAF.
- [ ] `npm test` + `npm run build` green.

## Report back

When done, reply with:
1. Summary (header keys, two buttons, `3dCpuPack` or why skipped)
2. Files touched
3. Tests run — **no Electron required** (operator runs the playbook)
4. Follow-ups
5. Suggested PRF memo bullets
