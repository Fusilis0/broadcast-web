# Dispatch DSP-OUT-20260830-01-2d-native-grab

## Meta
- From orchestrator: BW (route to OUT)
- Worker role: WORKER(DSP-OUT-20260830-01-2d-native-grab)
- Priority: **P0 ★**
- Phase: 18.13 — 2D grab wall, from the 2026-08-29 live dump
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active** — wave 3. Runs in parallel with `DSP-OUT-20260829-02` (`desktop/` only) and `DSP-OUT-20260829-04` (pumps / clocks / IPC defer)
- File lock: **`src/output/ndi2dAsyncCapture.ts`**, **`src/output/ndi2dCapture.worker.ts`**, and their tests only

## Goal

Get 2D NDI Send from **3 fps** to **≥30** without touching AR or 3D. The live dump named the stage: `2dGrab` is **120–193 ms mean** (max 222 ms). At that cost the pump can finish ~3–4 grabs per second, which is exactly the 3 fps on the rail. `grabbing` stays true the whole time, so every other tick records `busy` (41–51 skips/s).

## Background — what the dump proved

Operator paste 2026-08-29, all three senders live:

- 2D Send **3 fps**. `captureTicks 2d  6+:31` — never a 2-tick cadence.
- `2dGrab` 120–193 ms mean, 3–4 samples per second. `2dSend` still ~20 ms (same 8 MB IPC as AR/3D).
- `fallbacks sync2dCapture=false` — the **worker path is active**. This is not the sync `getImageData` fallback. Do not "fix" it by forcing sync.
- Source canvas is still **`STREAM_MAP_SIZE_PX = 520`**. The worker letterboxes that into a 1920×1080 `OffscreenCanvas` and then:

```80:80:src/output/ndi2dCapture.worker.ts
    const imageData = context.getImageData(0, 0, msg.outW, msg.outH)
```

That is an 8 MB canvas-2D readback of a frame that is mostly letterbox black. Chromium `getImageData` on a 1080p OffscreenCanvas after an upscale blit is the 160 ms. `createImageBitmap` of the 520² source on the renderer is cheap by comparison.

The NDI output must stay **1920×1080** (operator lock; portrait cancelled). The mistake is producing those 8 MB by *reading a 1080p canvas*, not the declared size itself.

## In scope

1. **Stop `getImageData(0, 0, 1920, 1080)`.** Read the source (or its ImageBitmap) at **native size** only. 520² is ~1.1 MB; a future 16:9 stream-map canvas from `DSP-SCN-20260829-03` will still be far smaller than 8 MB if it stays in the 520–960 band. Do not assume 520 forever — take `source.width` / `source.height`.
2. **Letterbox in a typed-array blit**, not via canvas 2D. Fill a pooled 1920×1080 RGBA8 buffer with the letterbox colour once per size change, then copy source rows into the destination rect (`letterboxRect` already exists and is tested). That is memcpy of ~1 MB, not an 8 MB GPU/CPU canvas readback.
3. **Keep the worker** (or an equivalent off-tick path). `createImageBitmap` + transfer of the *native* bitmap is fine; the worker then blits into the pooled 1080p buffer and transfers that `ArrayBuffer` back. Fail closed to a sync blit of the same design — still no 1080p `getImageData`.
4. **Do not change the declared 2D output size.** `STUDIO_OUTPUT_WIDTH/HEIGHT` 1920×1080 stays. Receivers still see a 1080p source.
5. Unit tests: native-size grab + blit produces a 1920×1080 buffer; letterbox pixels sit in the computed rect; letterbox fill is the existing `NDI_2D_LETTERBOX_FILL`; a non-square source still pillar/letterboxes; worker transfer list still moves the result (no forced full-buffer slice when the view is already the whole `ArrayBuffer`).
6. Re-measure with the PRF dump. Success is `2dGrab` mean well under **8 ms** and 2D Send ≥30 with AR and 3D still on. Paste the new `2dGrab` / `captureTicks 2d` lines.

## File lock (wave 3)

You own **only**:

- `src/output/ndi2dAsyncCapture.ts`
- `src/output/ndi2dCapture.worker.ts`
- `src/output/ndi2dAsyncCapture.test.ts` (and a worker test if you add one)
- A short note in `src/output/README.md` if the grab contract changes

**Do not edit** `streamMapNdiPump.ts` — `DSP-OUT-20260829-04` owns the rate gate, `busy`/`grabbing` scheduling, and IPC deferral in that file. Your `grab()` simply has to return a 1920×1080 `ArrayBuffer` faster. The pump already letterboxes via `letterboxRect` and passes `box` in.

**Do not edit** `desktop/`, `ndiFramePump.ts`, `ndi3dChannelPump.ts`, `ndiAsyncReadback.ts`.

## Out of scope

- Changing 2D output to native map resolution (OBS/vMix lock is 1920×1080).
- Removing the PiP card or resizing the stream-map canvas — `DSP-SCN-20260829-03`, wave 4. When that lands the source may become 16:9; your blit must already take source size from the canvas, not a hardcoded 520.
- AR/3D readback, colour space, SRT, the rate gate, the stagger.
- Inventing JPEG/H.264 inside the grab. If the blit is still >15 ms after native-size read, report the number — do not add a codec.

## Inputs provided

- Live dump (operator 2026-08-29): 2D Send 3 fps; `2dGrab` 120–193 ms; `2d busy` 41–51 /s; worker path on.
- Source: `STREAM_MAP_SIZE_PX = 520` (`src/scene/streamMap.ts:7`). Output: `STUDIO_OUTPUT_*` 1920×1080.
- `letterboxRect` in `streamMapNdiPump.ts` is the geometry; reuse it or a shared helper — **do not fork a second letterbox**. If you need it in the worker, extract the pure function to a tiny module both can import, or duplicate the four-line formula in the worker with a test that they match. Prefer extract-to-shared if it does not force you to touch the pump's tick logic. A new `src/output/letterboxRect.ts` is allowed and is yours.

## Acceptance criteria

- [ ] No `getImageData` of the 1920×1080 destination appears on the hot path (worker or sync).
- [ ] `grab()` still resolves to a 1920×1080 RGBA `ArrayBuffer` suitable for today's `sendFrame`.
- [ ] `2dGrab` mean in a live dump is **< 8 ms** (order-of-magnitude drop from 160 ms), or the report says why and gives the new number.
- [ ] 2D Send ≥30 with AR and 3D left on. Do not disable another channel to make the number.
- [ ] Worker still used when available; fallback is the same blit, not the old 1080p `getImageData`.
- [ ] Nothing under `desktop/`, `ndiFramePump.ts`, `ndi3dChannelPump.ts`, or `streamMapNdiPump.ts` was modified (except a pure `letterboxRect` extract that `-04` can keep importing).
- [ ] `npm test` and `npm run build` green.

## Report back

1. What `2dGrab` is now (native read + blit vs anything else) and the new mean/max ms
2. Before/after 2D Send fps, with AR/3D still on
3. Files touched
4. If 30 was missed: remaining wall with numbers
5. Suggested memo bullets for OUT
