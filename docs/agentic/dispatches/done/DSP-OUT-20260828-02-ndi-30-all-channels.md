# Dispatch DSP-OUT-20260828-02-ndi-30-all-channels

## Meta
- From orchestrator: BW → OUT
- Worker role: WORKER(DSP-OUT-20260828-02-ndi-30-all-channels)
- Priority: P0
- Phase: **Studio 30** wave 1 — three NDI senders at 30 fps, always on
- Related: `HO-BW-OUT-20260828-02` · `done/DSP-OUT-20260828-01-async-ndi-pbo.md` · `done/DSP-OUT-20260812-06`
- **Status: DONE in code** — worker complete + BW accepted 2026-08-28 (merged tree `npm test` **887 + 23**, `npm run build` green). **Human smoke still open:** Output rail Send ~30/30/30 + Race ops hitch/s ~0 with all three live. 2D still sync `getImageData`.
- Caps file: `docs/architecture/performance-budgets.md` — **this worker updates the table** to AR 30 / 3D 30 / 2D on@30

## Goal

Keep **all three** NDI sources running at once. Each of AR, 2D, and 3D sends **30 frames per second, all the time**. Ops preview may stay above 30 (rAF ~60 is fine) but must not fall below 30. Forget 60 fps NDI. `STUDIO_TICK_FPS` stays **30**.

## Background

Operator 2026-08-28 (supersedes Studio 60): vMix needs three simultaneous plates at 30. Exclusive-single-NDI was refused. Naive `fps: 30` on 3D + 2D **with sync** `readPixels` froze the sidebar (2026-08-12). That is why wave 0 (PBO) exists.

**Hard prerequisite:** `DSP-OUT-20260828-01` is merged and AR+3D use pipelined PBO. If PBO is missing, **stop and report** — do not raise fps on the sync path.

Today (`src/main.ts`): AR `fps: 30`, 3D `fps: 10`, 2D `fps: 10` and `streamMapNdiWanted = false`. Stagger (`ndiCaptureStagger.ts`) **forbids** AR and 3D on the same tick. At a 30 Hz studio clock that policy **cannot** deliver AR 30 **and** 3D 30 — it would cap each near 15 if they never share a tick. After PBO, both (and 2D) must be allowed to capture on the **same** tick; stagger becomes “do not *block* twice,” not “skip the other sender.”

2D is canvas `getImageData`, not WebGL. PBO does not help it. Prefer a deferred copy (`createImageBitmap` / later-tick) from wave 0 if it exists; if 2D is still sync, still enable it at 30 and measure hitch. Do not silently leave 2D off.

## In scope

1. **Defaults always on, 30 fps:**
   - `NDI_AR_DEFAULT_FPS = 30` (already)
   - `NDI_3D_DEFAULT_FPS = 30` (was 10)
   - `STREAM_MAP_NDI_DEFAULT_FPS = 30` (was 10)
   - Studio boot: 2D **enabled** (`streamMapNdiWanted` default **true**). NDI tab toggle may still stop **only** the 2D sender; AR and 3D stay on. Do not add “pick one channel” exclusive mode.
   - Wire `src/main.ts` AR/3D/2D `fps: 30`.
2. **Stagger rewrite:** `tryClaimNdiHeavyCapture` must allow AR + 3D (+ 2D if it claims) on the same studio tick when readback is async. Keep a guard against two **blocking** sync readbacks on one tick (fallback path only). Tests: same-tick AR+3D claims succeed on the async path.
3. **Do not** raise `STUDIO_TICK_FPS` (stays 30 in `desktop/main.cjs`). Preview stays rAF (~60 when visible). Hidden window may sit on `studio:tick` ~30 — that meets “preview not less than 30” when visible; hidden ~30 is OK.
4. **Caps docs + tests:** update `docs/architecture/performance-budgets.md`, `src/output/README.md`, air-runbook one-liner, and every test that greps `NDI_3D_DEFAULT_FPS = 10` / `STREAM_MAP_NDI_DEFAULT_FPS = 10` / 2D default off (including `perfCounters.test.ts`, `ndiControllerPanel.test.ts`, `previewFrameClock.test.ts`, `streamMapNdiPump.test.ts`).
5. Output rail Send fps should read ~30 / ~30 / ~30 with all three live. Hitch/s on Race ops must stay in the “~0” class after PBO; if hitch explodes, **do not silently drop a channel** — report blocker with numbers.

## Out of scope

- Implementing PBO (wave 0). If it is not in the tree, stop.
- `STUDIO_TICK_FPS = 60` or any 60 fps NDI target.
- Exclusive / round-robin single NDI.
- Pose clocks, `syncTrimMs`, telemetry smoothing (TEL).
- SRT decode, chroma, channel names, resolution (stay 1920×1080).
- SCN sea/terrain cost knobs unless preview visible fps drops **below 30** with all three sending (then stop and escalate PRF/SCN — do not guess knobs).

## Likely files

- `src/output/ndi3dChannelPump.ts`, `streamMapNdiPump.ts`, `ndiFramePump.ts` (constants only if needed)
- `src/output/ndiCaptureStagger.ts` + test
- `src/main.ts` (fps + 2D default on)
- Tests listed above
- `docs/architecture/performance-budgets.md`, `src/output/README.md`, `docs/ops/air-runbook.md`

## Inputs provided

- Product lock: three senders, 30 fps each, all the time. Forget 60.
- Wave 0 PBO: `DSP-OUT-20260828-01`. One frame of capture latency is already accepted.
- Measurement: Race ops hitch/s + Output rail Send fps (`DSP-PRF-20260826-01`).

## Acceptance criteria

- [ ] With Electron NDI live, **AR Send ~30**, **3D Send ~30**, **2D Send ~30** at the same time (1 s window, same class as today’s AR 30 measurement).
- [ ] 2D sender starts enabled; AR and 3D still start enabled.
- [ ] `STUDIO_TICK_FPS` remains 30. Visible ops preview fps stays ≥30 (typically ~60 rAF).
- [ ] Stagger no longer skips 3D just because AR captured this tick (async path).
- [ ] Sidebar still usable; hitch/s not a return to the 2026-08-12 freeze. If it is, report — do not ship a silent 10 fps 3D fallback.
- [ ] `npm test` + `npm run build` green. Source greps for default 10 fps on 3D/2D are gone.

## Report back

1. Summary (Send fps AR/3D/2D; hitch/s; stagger change; 2D copy still sync or not)
2. Files touched
3. Tests / Electron numbers
4. Blockers (PBO missing, hitch, preview &lt;30)
5. Suggested OUT + PRF memo bullets
