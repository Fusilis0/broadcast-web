# Dispatch DSP-SCN-20260915-02-srt-visibility-presets

## Meta
- From: **BW**. Domain: **SCN**
- Worker: WORKER(DSP-SCN-20260915-02-srt-visibility-presets)
- Priority: **P1** (after 01)
- Phase: **22.4c**
- Design: `docs/architecture/srt-program-cameras.md` §5–6

## Goal

AR and 3D SRT each have their **own** layer preset. Both publish at once (3D boat **models**, AR **tags only**). Local AR/3D switch only **shows** that preset on the **bottom bar**. Defaults locked in the design doc table.

## In scope

1. Channel preset: boat model / tag / heading arrow; buoy model / tag / rounding arrows; sponsors; billboards; start/finish. Independent toggles per channel.
2. Defaults: **3D** all on; **AR** env already off in 01; AR boat/buoy **tag on**, model+arrows **off**; sponsors/S-F/billboards **on**.
3. Bottom bar (not side menus): when local focus is AR or 3D, show **that** channel’s toggles. Do not implement 3D takeover or 2D follow here (stubs OK).
4. Authoring `visible3d` / mesh / tag still AND with the preset.
5. Tests for default matrix + switching local focus does not copy 3D onto AR plate.

## Out of scope

Program rig takeover (03). 2D cam (04). Capture. `STUDIO_TICK_FPS`. Per-boat overrides (global per channel only).

## Likely files

- `src/scene/` visibility + boat tag/arrow
- `src/main.ts` plate apply
- New bottom bar module under `src/output/` or `src/scene/`
- `src/style.css`

## Acceptance

- [x] 3D SRT: boats as meshes; AR SRT: tags, no hulls (defaults)
- [x] Toggles on bottom bar change **that** channel only
- [x] Local 3D → AR shows AR defaults in the bar; 3D plate unchanged
- [x] No `STUDIO_TICK_FPS`

## Report

Where presets live; how plates consume them.

**Worker 2026-09-15 — code-complete**

Presets: `src/scene/srtChannelVisibility.ts` (`createSrtChannelPresetStore`). Independent AR / 3D copies. Defaults: 3D all on; AR boat/buoy **tag on**, model+arrows **off**, sponsors/billboards/S-F **on**. Authoring `visible3d` / mesh / tag still AND (`resolveLayerVisible`). Scene applies the **current** copy via `SceneHandle.setChannelLayerPreset`.

Plates: AR/3D boot with their channel preset (`startScene.channelLayerPreset`). Studio sends `{channel, preset}` on `srtOut:layerPreset`; desktop routes each packet to **that** plate only. Local AR/3D switch only **shows** that copy on the bottom bar (`src/scene/srtProgramBar.ts`) and applies it to the ops scene — it does not copy 3D onto AR. 3D takeover / 2D follow are disabled stubs.

`STUDIO_TICK_FPS` still 60. Next: **new chat** `DSP-SCN-20260915-03`.
