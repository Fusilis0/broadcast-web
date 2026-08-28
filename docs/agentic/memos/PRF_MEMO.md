# PRF_MEMO

**Last updated:** 2026-08-28  
**Status:** Idle — wait Electron paste (hitch + Send + Sync)

## Accepted 2026-08-28 night (BW) — OUT-07
`HO-BW-PRF-20260828-09`. 2D CPU copy is off the AR/3D `directRender` stack. Smoke: Send ~30/30/30, hitch/s ~0, 2D **on**. Console must not show `NDI 2D capture: async worker unavailable`. Do not uncheck 2D. Wave 2 SCN only if GPU % is **high** and preview still &lt;30.

## Accepted 2026-08-28 night (BW)
`HO-BW-PRF-20260828-08` still holds: low GPU % = JS blocked. OUT-04 in tree (tick 60, one FBO). Remaining hitch is 2D on that tick (**OUT-07**). Do not silent-cap Send. Wave 2 SCN only if GPU % is **high**.

## GPU idle 2026-08-28 (BW)
`HO-BW-PRF-20260828-08`. ~10% GPU + hitch ≠ weak PC. Do not recommend 2D off. OUT-04 stagger uses **more** GPU (one FBO / 16 ms). OUT-07 moves 2D CPU copy off that tick. Wave 2 SCN only if GPU % is **high**.

## Live fail 2026-08-28 (BW)
`HO-BW-PRF-20260828-07` (superseded on 2D-off). 2D off: preview 16 / hitch 12 / Send 22. 2D on was 6 / 7 / ~10. RX 6750 XT.

## Studio 30 code accepted 2026-08-28 (BW)
`HO-BW-PRF-20260828-06`. Caps **now** AR/3D/2D **30/30/30**, 2D on. `STUDIO_TICK_FPS` 30. Do **not** raise pumps in PRF chat. Measurement gate: Electron Output rail Send ~30/30/30, hitch/s ~0, visible preview ≥30. Wave 2 SCN knobs only if preview **&lt;30**. 2D sync `getImageData` is the hitch leftover. Never `STUDIO_TICK_FPS = 60`.

## Studio 60 accepted then cancelled 2026-08-28 (BW)
BW had accepted `HO-PRF-BW-20260828-03` the same day; operator dropped 60. Wave 0 PBO still required.

## Role
Performance Orchestrator (`PRF`). Budgets + measurement. Does not own look (SCN) or egress (OUT).

## Locked caps (BW 2026-08-28 Studio 30)
- Ops **preview** ~60 fps via rAF when visible (`DSP-OUT-20260818-01`). Floor: **≥30** when the window is visible.
- NDI AR/3D/2D **30/30/30** always-on (`DSP-OUT-20260828-02`). 2D-off refused 2026-08-28 night.
- `STUDIO_TICK_FPS = 60` **only** as OUT-04 NDI FBO stagger (preview rAF). Send stays 30.
- Matched pose / `syncTrimMs` must not change these clocks (TEL-08). Smoothing is `sampleAt` only (`DSP-TEL-20260828-01`).
- Canonical doc: `docs/architecture/performance-budgets.md`

## Operator 2026-08-28
Electron HUD **matches the locks** (preview ~60, AR Send ~30, 3D Send ~10). Product ask restated: **60 fps minimum on AR, 3D, 2D, UI, everywhere.** Resource use is fine.

PRF will not bump pump fps or `STUDIO_TICK_FPS` here. Escalated: `HO-PRF-BW-20260828-03` (proposed phase **Studio 60**: OUT PBO first, then 60 capture clock, then raise Send defaults).

## Operator 2026-08-26
Asked: general improvements, low GPU use, “make sure it uses some”, glitchy feel, **60 fps on preview/AR/3D/2D**, resource use fine, good stream.

**Refuse (still):** silent `STUDIO_TICK_FPS = 60` / all-NDI-60 as a one-line tweak.

## DSP-PRF-01 accepted 2026-08-27
Worker complete. `npm test` **869 + 23**, `npm run build` green. Caps unchanged.

- Ops HUD: GPU string + hitch/s (`N / 1s (>50ms)`; `dt>33ms` tooltip-only).
- Output rail: live **Send** fps per AR/3D/2D.
- `powerPreference: 'high-performance'`.
- Informal Electron confirm 2026-08-28: numbers match caps (not a 60-NDI result).

## Known cost centers (inventory)
- Gerstner ocean + foam + sea quality (SCN)
- Cesium tiles: compile/upload hitch, multi-cam LOD, VRAM
- Wind strings tick (SCN-05 claimed ~0.075 ms)
- NDI `readPixels` + delay buffer RAM (OUT) — still sync; PBO is Studio 60 wave 0
- Four warm SRT decodes (OUT; cap 4)
- `terrain.tick` every preview rAF; lock-tiles default off

## Not ours
- SRT colour bars / HEVC → OUT / SRT
- Pose match hold → TEL-10
- Unlocking 60 NDI → **BW**

## Open
- BW accept/reject Studio 60 (`HO-PRF-BW-20260828-03`). No DSP until that.
- If accepted: OUT wave 0 async PBO (`HO-PRF-OUT-20260826-01`), caps still 30/10 until wave 2.

## Handoffs / dispatches
- `done/DSP-PRF-20260826-01-measure-gpu-hitch.md`
- `handoffs/HO-PRF-BW-20260826-01.md` (refuse 60 as tweak)
- `handoffs/HO-PRF-BW-20260827-02.md` (01 accepted)
- `handoffs/HO-PRF-BW-20260828-03.md` (Studio 60 phase request)
- `handoffs/HO-PRF-OUT-20260826-01.md`
- `handoffs/HO-PRF-SCN-20260826-01.md`
- `handoffs/HO-PRF-PLT-20260826-01.md`
