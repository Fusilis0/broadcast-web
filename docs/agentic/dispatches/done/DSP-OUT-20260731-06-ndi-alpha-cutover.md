# Dispatch DSP-OUT-20260731-06-ndi-alpha-cutover

**Status:** Done / archived (2026-07-31) — accepted; next pack 5.4 + 6.4 + human ops

## Meta
- From orchestrator: OUT (BW: Phase **7.6** — alpha NDI cutover docs)
- Worker role: WORKER(DSP-OUT-20260731-06-ndi-alpha-cutover)
- Priority: P0
- Phase: Phase 7.6 — vMix NDI alpha runbook + cutover
- Related: human Pass in `docs/ops/vmix-ndi-alpha-runbook.md` (2026-07-31)
- Prior: 7.3a/7.3b done (`DSP-OUT-20260731-04` / `05`)

## Goal

Formalize **Electron + alpha NDI** as the preferred studio air path (with chroma still the documented fallback), and write a short **cutover checklist** vs Unity NDI / Chrome chroma so ops can run a show on path A.

## Background

- End-state lock: **A + alpha** (not green-key NDI).
- Studio shell: `desktop/` — 1920×1080, park-on-minimize, named source `broadcast-web`.
- Human Pass recorded in [`vmix-ndi-alpha-runbook.md`](../../ops/vmix-ndi-alpha-runbook.md).
- Chroma Chrome path remains supported interim/fallback ([`air-runbook.md`](../../ops/air-runbook.md)).

## In scope

1. Update [`air-runbook.md`](../../ops/air-runbook.md):
   - Preferred studio path = Electron + `outputMode=transparent` + NDI alpha
   - Keep chroma steps as **fallback**
   - Link desktop README + vMix alpha runbook
2. Expand or add cutover section (same file or `docs/ops/ndi-alpha-cutover.md`):
   - Pre-show checklist (Vite/dev or file build, desktop:dev, NDI name, vMix alpha, no chroma key on NDI)
   - Park/tray note
   - Parallel with Unity NDI until BW+studio OK to drop Unity
   - Rollback = Chrome chroma air-runbook
3. Touch [`ndi-alpha-electron.md`](../../architecture/ndi-alpha-electron.md) status → cutover docs ready
4. Roadmap pointer already opened by BW — align 7.4/7.6 notes if needed

## Out of scope

- electron-builder / installer polish (PLT later)
- Path B helper
- Killing chroma code path
- 5.4 egress, 6.4 DB (separate pack)
- Changing NDI SDK / frame pump unless a docs typo

## Acceptance criteria

- [ ] Air runbook states preferred = Electron alpha NDI; chroma = fallback
- [ ] Cutover checklist exists (pre-show / rollback / Unity parallel)
- [ ] Links consistent from OUT README / eval docs
- [ ] No product code required unless a one-line doc bugfix

## Report back

Standard five sections. Suggest next: **5.4 + 6.4 + human ops** pack (BW).

## Worker paste block

```
You are WORKER(DSP-OUT-20260731-06-ndi-alpha-cutover).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-OUT-20260731-06-ndi-alpha-cutover.md
2. docs/ops/vmix-ndi-alpha-runbook.md (Pass Results)
3. docs/ops/air-runbook.md
4. desktop/README.md
5. docs/architecture/ndi-alpha-electron.md

Deliver: air-runbook preferred-path update + cutover checklist. Chroma stays fallback.
Report back per dispatch.
```
