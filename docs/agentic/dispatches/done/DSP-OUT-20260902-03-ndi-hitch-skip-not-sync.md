# Dispatch DSP-OUT-20260902-03-ndi-hitch-skip-not-sync

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260902-03-ndi-hitch-skip-not-sync)
- Priority: P0
- Phase: Overlay hitch with NDI on — **skip capture, do not `fallToSync`**
- Related: `HO-BW-OUT-20260902-04` · `HO-OUT-BW-20260902-03` · **not** a clone of `DSP-OUT-20260902-01`
- Status: **Human 2026-09-02** — hitch/banner **Pass**; AR/3D send **Fail**. Next: `DSP-OUT-20260902-04-ndi-send-when-checked`.
- Product: v1 still needs **AR + 3D + 2D** on air. Unchecking Send is a **temporary ops workaround**, not the plan. **Do not** write “one channel is enough.” This slice is **not** 30×3.

## Goal

NDI capture must **not hitch rAF**. If PBO cannot stay on in Electron without stripes/black, **skip that capture** (Send may drop) — **never** use `fallToSync` / `readRenderTargetPixels` as the live path. Yellow **SYNC READBACK** must **hide when all Send boxes are off** (must not latch from a boot probe). Keep OBS picture locks.

**This slice is not 30+30+30.** Acceptance is: NDI off still ~60; **one** NDI on does not pin preview at ~15; Send is a **real number** (not frozen 0 / live·no send). Three channels at 30 is the **next** OUT/PRF problem.

## Background

- Dual clock: preview **rAF** and NDI **`studio:tick`** share **one** Electron renderer JS thread. NDI off → preview >60. NDI on → same thread capture/pack → 8–20.
- `DSP-OUT-20260902-01` claimed PBO via `properties.get`; **live Fail**: banner still on (even with Send unchecked); 1 NDI → preview 15–20 / Send ~10–11; three on → preview ~8, Send **0**.
- `markNdiSyncReadback()` **latches**. `createNdiAsyncReadback` can `noteFallback()` when `!gl` at construct — banner yellow with NDI off.
- Picture locks (keep): no half-width GPU-pack skip (`w*2===srcW`); no default-FB as UYVY; 3D send stays full-size RGBA → UYVY (CPU or **worker**, not GPU dest skip); AR UYVA.

## In scope

1. **WebGL2 live path:** PBO `begin`/`poll` only. If `begin` cannot pack (no FBO, no slot, fence fail): **return false / skip** — do **not** `fallToSync()`, do **not** `readRenderTargetPixels` on the tick. Sync remains **debug/emergency only** (e.g. explicit `forceSync` tests), not studio default.
2. **Banner:** `markNdiSyncReadback` must not stay true when all three pumps are `setEnabled(false)`. Clear on all-off. Do not mark from helper construction / boot probe. Banner hidden unless a **live enabled** channel is actually on sync (should be never after (1)).
3. **One NDI on, preview not ~15:** if CPU UYVY/UYVA pack on `poll()` still blocks rAF, skip extra captures or pack on the **existing** UYVY worker — **not** sync `readPixels`. Do not restore GPU half-width send.
4. **Send HUD:** when that channel is enabled and PBO completes, `record()` so Send is a moving number. If skipped, 0 / live·no send is honest.
5. Tests: no `fallToSync` on missing FBO this tick; all-off clears sync-readback flag; half-width skip still off.
6. README one line: skip ≠ sync. `npm test` + `npm run build`.

## Out of scope

- Raising `STUDIO_TICK_FPS`, fake mouse, “set preview 60”
- Cloning 02-01 (`properties` PBO as the whole story)
- GPU UYVY half-width skip
- Promising 30×3 in this DSP
- Writing architecture that one NDI is enough
- Fullscreen snap-back unless you trip over it
- SCN, 19.1/19.3/19.4 rework
- Committing unless asked

## Likely files

- `src/output/ndiAsyncReadback.ts` (`fallToSync`, `noteFallback`, `begin`)
- `src/output/ndiStageTiming.ts` (`markNdiSyncReadback` + **clear**)
- `src/output/ndiControllerPanel.ts` (banner vs wanted/enabled)
- `src/output/ndiFramePump.ts`, `ndi3dChannelPump.ts` (skip on failed begin; pack off-tick if needed)
- tests + `src/output/README.md`

## Acceptance criteria

- [x] Live WebGL2: no `fallToSync` as the always-on path
- [x] All Send off → no yellow SYNC READBACK; preview still ~60 *(human Pass)*
- [x] One Send on → preview **not** pinned ~15 *(human: 3D ~37, 2D >60)*
- [ ] One Send on → Send a **real number** / OBS picture — **Fail AR/3D** (`live · no send`, OBS black). 2D Pass (~10–11). Honest skip was this slice’s hitch call; it is **not** the product (checkbox must send). Follow-up `DSP-OUT-20260902-04`.
- [x] Docs do **not** say one channel is enough; 30×3 still the cap, not this gate
- [x] `npm test` + `npm run build` green — **1061 + 23**

## Human result (2026-09-02)

| NDI | Result |
| --- | --- |
| All Send off | **Pass** — no banner, preview **>60** |
| 3D only | Preview ~**37**, no banner, Status **live · no send**, Send **0**, OBS **black** |
| AR only | Same as 3D |
| 2D only | **Pass** — Send ~**10–11**, preview **>60**, picture OK |
| Three on | Not this gate |

Skip-every-tick on AR/3D (PBO no-FBO) is why Send is 0. Next DSP must send when the box is checked without restoring always-on `fallToSync`.

## Worker report

1. **Skip vs sync; banner clear-all-off.** Live `begin` never `fallToSync` / never `readRenderTargetPixels`. Missing FBO this tick returns false (skip); PBO mode stays. `noteFallback` is not called at construct — only when emergency `begin` actually sync-reads. All three Send off → `clearNdiSyncFallbacks()`; `shouldShowNdiSyncFallbackBanner` is false so the yellow banner hides even if a boot probe had latched.

2. **Files / tests.** `ndiAsyncReadback.ts` (+ tests: no-FBO skip, no construct note, no `function fallToSync`). `ndiStageTiming.ts` (`clearNdiSyncFallbacks` / `clearNdiSyncReadback`). `ndiControllerPanel.ts` (banner vs enabled). `ndi3dChannelPump.ts` (existing UYVY worker; half-width skip still off). `ndiFramePump.ts` (skip → `noteNdiSkip busy`). README: skip ≠ sync; v1 still AR+3D+2D. Suite **1061 + 23**, build green.

3. **Human retest** — see table above.

4. **OUT memo; leftover.** Hitch rows held. AR/3D send is `DSP-OUT-20260902-04`. 30×3 still later OUT/PRF.
