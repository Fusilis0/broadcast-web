# Dispatch DSP-OUT-20260812-04-local-channel-switcher

## Meta
- From orchestrator: BW → OUT (Phase 13.5)
- Worker role: WORKER(DSP-OUT-20260812-04-local-channel-switcher)
- Priority: P0
- Phase: Phase 13 — Multi-channel output
- Prerequisites: `done/DSP-OUT-20260812-02` (3D pump), `done/DSP-OUT-20260812-03` (2D pump)
- Parallel-safe with: `DSP-OUT-20260812-05` (delay) — **you own local preview / Ops switcher UI**;
  do **not** edit delay-buffer logic or add delay sliders. Rebase `main.ts` / shared CSS if needed.
- Design: `docs/architecture/multi-output-streaming.md` §5
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 461+23; human 2D/3D/AR + vMix smoke recommended)

## Goal

Add a **big 2D / 3D / AR** local switcher so the operator’s on-screen view follows the chosen
channel, while **all three NDI sends keep running** unchanged (switcher never starts/stops pumps).

## Background

- Today: screen shows WebGL scene (preview/chroma/transparent clear via `outputMode`) + optional
  stream-map PiP. NDI already has three always-on (or toggleable-2D) channels.
- Switcher axis ≠ `outputMode`: `outputMode` still governs **AR clear** (preview/chroma/transparent).
  Switcher picks **which channel fills the local window**.
- **BW lock:** 1920×1080 stays. No delay work in this DSP.

## In scope

1. Prominent **three-button** control (`2D` | `3D` | `AR`) — Ops section and/or a dedicated strip
   above the canvas (prefer readable size; not a tiny dropdown). Clear pressed state for the active
   local channel.
2. Local focus behavior:
   - **AR:** show WebGL canvas; restore normal AR/`outputMode` clear path (transparent air plate
     when in studio transparent mode). Free cam / follow POV keep working as today for ops.
   - **3D:** show WebGL canvas with **opaque** clear + `setEnvironmentOpaqueClearSafe(true)` for
     the **screen** pass (match what 3D NDI looks like). Do not stop AR/2D NDI.
   - **2D:** show the stream-map as the primary local view (full-bleed or large host — not only a
     tiny PiP). WebGL may hide or sit underneath; NDI AR/3D continue.
3. Invariant tests/comments: changing local focus must **not** call `ndi.stop` / disable pumps
   (except the existing explicit 2D NDI tab toggle, which stays independent).
4. Keep existing `outputMode` control for AR clear; document how it composes with the switcher.
5. Docs: `src/output/README.md`, short ops note in `docs/ops/air-runbook.md`.
6. Tests: focus state machine / “switcher does not stop NDI” regression where practical.

## Out of scope

- NDI delay buffer / delay UI (`DSP-OUT-20260812-05`).
- Changing NDI source names or pump internals beyond hooks needed for local opaque/2D presentation.
- Portrait 1080×1920.
- Redesigning stream-map chrome (reuse existing `createStreamMap2d`).

## Likely files

- New: `src/output/localChannelSwitcher.ts` (+ test) — or similar
- Edit: `src/main.ts`, `src/output/outputModeControl.ts` (compose only), `src/style.css`,
  Ops sidebar mount, maybe `streamMap` host visibility helpers
- Docs: `src/output/README.md`, `docs/ops/air-runbook.md`
- Avoid heavy edits to `ndiControllerPanel.ts` / pump delay paths (sibling DSP)

## Acceptance criteria

- [ ] Three big buttons switch local view among 2D / 3D / AR with clear active state
- [ ] Switching local view does **not** stop AR/3D/2D NDI (verify via pumps still enabled / status live)
- [ ] 3D local view is opaque (+ env when realistic on); AR local view keeps alpha-safe clear when `transparent`
- [ ] 2D local view shows the race map large enough to operate (not only 520px PiP corner)
- [ ] `npm test` + `npm run build` green
- [ ] README / air-runbook note the switcher vs `outputMode` vs NDI independence

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for OUT
