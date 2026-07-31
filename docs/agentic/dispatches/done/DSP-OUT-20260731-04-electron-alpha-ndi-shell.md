# Dispatch DSP-OUT-20260731-04-electron-alpha-ndi-shell

**Status:** Done / archived (2026-07-31) — accepted; next `DSP-OUT-20260731-05`

## Meta
- From orchestrator: OUT (BW: open Phase **7.3** first slice — path **A**)
- Worker role: WORKER(DSP-OUT-20260731-04-electron-alpha-ndi-shell)
- Priority: P0
- Phase: Phase 7.3 — Electron + alpha NDI (scaffold + contract)
- Related: `docs/ops/ndi-path-evaluation.md` (BW lock A + alpha); `docs/ops/ndi-c-spike-runbook.md` (7.1 closed)
- BW ask: **no NDI SDK yet** — shell + alpha product contract only

## Goal

Start path **A**: (1) document the production NDI contract as **alpha** (transparent clear + AR; vMix uses alpha — **not** green-key NDI), and (2) add a minimal **Electron studio shell** that loads the existing SPA so later slices can attach an NDI sender.

## Background

- 7.1 C = NDI Tools Screen Capture → OBS. Works as screen→NDI; **rejected** for production (not app-native; no alpha end-state).
- Full product lock: Electron + named NDI source with **alpha channel**.
- Skip **B** (helper) unless A is blocked.
- Chroma + window capture remains interim air (`docs/ops/air-runbook.md`).

## In scope

1. **Design doc** `docs/architecture/ndi-alpha-electron.md` (or under `docs/ops/` if better fit):
   - End-state: Electron named NDI out with alpha
   - Clear/compositing: transparent plate for NDI path (contrast with `outputMode=chroma` for Chrome capture)
   - Frame path sketch: WebGL/canvas → main/native → NDI (BGRA / alpha-capable format) — high level only
   - Explicit non-goals for this slice: no SDK wiring yet
   - vMix: ingest as alpha source (no chroma key on production NDI)
2. **Electron scaffold** under e.g. `desktop/` or `electron/` (match repo style):
   - Loads local Vite URL in dev and/or `dist/` in prod-like mode
   - Basic main + BrowserWindow; README with run commands
   - Package metadata only as needed to `npm run` the shell
3. Link from `ndi-path-evaluation.md`, `src/output/README.md`, roadmap pointer already set by BW
4. Keep browser SPA as default product; Electron is the **studio** path

## Out of scope

- NDI SDK install, native addon, or sending frames
- Path B helper
- Changing default Chrome air away from chroma
- 5.4 egress, 6.4 DB
- Full electron-builder release pipeline (minimal OK; polished packaging = later)

## Likely files

- `docs/architecture/ndi-alpha-electron.md` (new)
- `desktop/` or `electron/` (new scaffold)
- root `package.json` scripts (optional `desktop:dev`)
- `docs/ops/ndi-path-evaluation.md` (link)
- `src/output/README.md` (link)

## Acceptance criteria

- [ ] Alpha NDI product contract documented and linked
- [ ] Electron shell runs and shows broadcast-web SPA
- [ ] No NDI SDK / sender code in this slice
- [ ] README explains how to run shell vs Chrome chroma air

## Report back

Standard five sections. Suggest follow-up DSP for NDI SDK + alpha frame send (7.3b / toward 7.5).

## Worker paste block

```
You are WORKER(DSP-OUT-20260731-04-electron-alpha-ndi-shell).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260731-04-electron-alpha-ndi-shell.md
2. docs/ops/ndi-path-evaluation.md (BW lock A + alpha)
3. docs/ops/ndi-c-spike-runbook.md (7.1 Results)
4. docs/ops/air-runbook.md
5. src/output/README.md

Deliver: alpha NDI design doc + minimal Electron shell that loads the SPA.
No NDI SDK. Report back per dispatch.
```
